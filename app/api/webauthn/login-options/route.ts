import { NextRequest, NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const loginChallengeStore = new Map<string, string>()
export { loginChallengeStore }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000'
    const rpID = origin.replace('https://', '').replace('http://', '').split(':')[0]

    const userResult = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userResult.error || !userResult.data) {
      return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
    }

    const userId = userResult.data.id

    const credsResult = await supabaseAdmin
      .from('webauthn_credentials')
      .select('credential_id')
      .eq('user_id', userId)

    if (!credsResult.data || credsResult.data.length === 0) {
      return NextResponse.json({ error: 'No passkey registered for this account' }, { status: 400 })
    }

    const allowCredentials = credsResult.data.map(function (cred) {
      return { id: cred.credential_id }
    })

    const options = await generateAuthenticationOptions({
      rpID: rpID,
      allowCredentials: allowCredentials,
      userVerification: 'preferred',
    })

    loginChallengeStore.set(userId, options.challenge)

    return NextResponse.json({ options: options, userId: userId })
  } catch (err) {
    console.error('Login options error:', err)
    return NextResponse.json({ error: 'Something went wrong', details: String(err) }, { status: 500 })
  }
}
