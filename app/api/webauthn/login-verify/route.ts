import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { loginChallengeStore } from '../login-options/route'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = body.userId
    const response = body.response
    const tenantId = body.tenantId || '00000000-0000-0000-0000-000000000001'

    if (!userId || !response) {
      return NextResponse.json({ error: 'userId and response are required' }, { status: 400 })
    }

    const expectedChallenge = loginChallengeStore.get(userId)

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'No pending login found for this user' }, { status: 400 })
    }

    const credResult = await supabaseAdmin
      .from('webauthn_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('credential_id', response.id)
      .single()

    if (credResult.error || !credResult.data) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 400 })
    }

    const storedCredential = credResult.data

    const origin = req.headers.get('origin') || 'http://localhost:3000'
    const rpID = origin.replace('https://', '').replace('http://', '').split(':')[0]

    const verification = await verifyAuthenticationResponse({
      response: response,
      expectedChallenge: expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: storedCredential.credential_id,
        publicKey: new Uint8Array(Buffer.from(storedCredential.public_key, 'base64')),
        counter: storedCredential.counter,
      },
    })

    if (!verification.verified) {
      await supabaseAdmin.from('audit_log').insert({
        user_id: userId,
        tenant_id: tenantId,
        event_type: 'webauthn_login_failed',
        allowed: false,
      })
      return NextResponse.json({ error: 'Verification failed' }, { status: 401 })
    }

    await supabaseAdmin
      .from('webauthn_credentials')
      .update({ counter: verification.authenticationInfo.newCounter })
      .eq('id', storedCredential.id)

    loginChallengeStore.delete(userId)

    const userResult = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    const fakeToken = createHash('sha256').update(userId + Date.now()).digest('hex')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)

    await supabaseAdmin.from('sessions').insert({
      user_id: userId,
      refresh_token_hash: fakeToken,
      expires_at: expiresAt.toISOString(),
    })

    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      tenant_id: tenantId,
      event_type: 'webauthn_login_success',
      allowed: true,
    })

    return NextResponse.json({
      message: 'Passkey login successful',
      user: { id: userId, email: userResult.data ? userResult.data.email : null },
    })
  } catch (err) {
    console.error('Login verify error:', err)
    return NextResponse.json({ error: 'Something went wrong', details: String(err) }, { status: 500 })
  }
}
