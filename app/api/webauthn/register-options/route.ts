import { NextRequest, NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const challengeStore = new Map<string, string>()
export { challengeStore }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = body.userId
    const email = body.email

    if (!userId || !email) {
      return NextResponse.json({ error: 'userId and email are required' }, { status: 400 })
    }

    const existingCredsResult = await supabaseAdmin
      .from('webauthn_credentials')
      .select('credential_id')
      .eq('user_id', userId)

    const excludeCredentials = (existingCredsResult.data || []).map(function (cred) {
      return { id: cred.credential_id }
    })

    const options = await generateRegistrationOptions({
      rpName: 'Keystone',
      rpID: 'localhost',
      userName: email,
      userID: new TextEncoder().encode(userId),
      attestationType: 'none',
      excludeCredentials: excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    challengeStore.set(userId, options.challenge)

    return NextResponse.json(options)
  } catch (err) {
    console.error('Register options error:', err)
    return NextResponse.json({ error: 'Something went wrong', details: String(err) }, { status: 500 })
  }
}
