import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000002'

export async function POST(request: Request) {
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('SECRET KEY exists:', !!process.env.SUPABASE_SECRET_KEY)

  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? 'Failed to create auth user' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({ id: userId, email })

    if (userError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: `Failed to create user profile: ${userError.message}` },
        { status: 500 }
      )
    }

    const { error: linkError } = await supabaseAdmin
      .from('user_tenant_roles')
      .insert({
        user_id: userId,
        tenant_id: DEFAULT_TENANT_ID,
        role_id: ADMIN_ROLE_ID,
      })

    if (linkError) {
      await supabaseAdmin.from('users').delete().eq('id', userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: `Failed to assign tenant role: ${linkError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Signup successful', user: { id: userId, email } },
      { status: 201 }
    )
  } catch (err) {
    console.error('Signup route error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    )
  }
}
