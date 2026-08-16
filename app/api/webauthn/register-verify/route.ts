import { NextRequest, NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { createClient } from '@supabase/supabase-js'
import { challengeStore } from '../register-options/route'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = body.userId
    const response = body.response
    const deviceName = body.deviceName || 'Unnamed device'

    if (!userId || !response) {
      return NextResponse.json({ error: 'userId and response are required' }, { status: 400 })
    }

    const expectedChallenge = challengeStore.get(userId)

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'No pending registration found for this user' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000'
    const rpID = origin.replace('https://', '').replace('http://', '').split(':')[0]

    const verification = await verifyRegistrationResponse({
      response: response,
      expectedChallenge: expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    const credential = verification.registrationInfo.credential

    const insertResult = await supabaseAdmin.from('webauthn_credentials').insert({
      user_id: userId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      device_name: deviceName,
    })

    if (insertResult.error) {
      console.error('Credential insert failed:', insertResult.error)
      return NextResponse.json({ error: 'Failed to save credential' }, { status: 500 })
    }

    challengeStore.delete(userId)

    return NextResponse.json({ message: 'Passkey registered successfully' })
  } catch (err) {
    console.error('Register verify error:', err)
    return NextResponse.json({ error: 'Something went wrong', details: String(err) }, { status: 500 })
  }
}
