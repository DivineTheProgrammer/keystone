import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../lib/rbac'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') || '00000000-0000-0000-0000-000000000001'

  const authResult = await requirePermission(req, tenantId, 'users', 'invite')

  if (!authResult.authorized) {
    return authResult.response
  }

  const usersResult = await supabaseAdmin
    .from('user_tenant_roles')
    .select('user_id, users(email), roles(name)')
    .eq('tenant_id', tenantId)

  if (usersResult.error) {
    return NextResponse.json({ error: usersResult.error.message }, { status: 500 })
  }

  return NextResponse.json({ tenantUsers: usersResult.data })
}
