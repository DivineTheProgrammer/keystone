import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { checkRateLimit, resetRateLimit } from '../../lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email
    const password = body.password
    const tenantId = body.tenantId || '00000000-0000-0000-0000-000000000001'

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }

    const rateLimitKey = 'login:' + email.toLowerCase()
    const rateLimitResult = checkRateLimit(rateLimitKey)

    if (!rateLimitResult.allowed) {
      await supabaseAdmin.from('audit_log').insert({
        tenant_id: tenantId,
        event_type: 'login_rate_limited',
        allowed: false,
      })

      return NextResponse.json(
        { error: 'Too many failed attempts. Try again in ' + rateLimitResult.retryAfterSeconds + ' seconds.' },
        { status: 429 }
      )
    }

    const signInResult = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (signInResult.error || !signInResult.data.session) {
      const auditResult = await supabaseAdmin.from('audit_log').insert({
        tenant_id: tenantId,
        event_type: 'login_failed',
        allowed: false,
      })

      if (auditResult.error) {
        console.error('Audit log insert failed (login failed case):', auditResult.error)
      }

      return NextResponse.json(
        { error: signInResult.error ? signInResult.error.message : 'Login failed' },
        { status: 401 }
      )
    }

    resetRateLimit(rateLimitKey)

    const session = signInResult.data.session
    const user = signInResult.data.user

    const tokenHash = createHash('sha256').update(session.refresh_token).digest('hex')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)

    const sessionInsertResult = await supabaseAdmin.from('sessions').insert({
      user_id: user.id,
      refresh_token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    })

    if (sessionInsertResult.error) {
      console.error('Session insert failed:', sessionInsertResult.error)
    }

    const auditInsertResult = await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      tenant_id: tenantId,
      event_type: 'login_success',
      allowed: true,
    })

    if (auditInsertResult.error) {
      console.error('Audit log insert failed (login success case):', auditInsertResult.error)
    }

    return NextResponse.json({
      message: 'Login successful',
      accessToken: session.access_token,
      user: { id: user.id, email: user.email },
      sessionLogged: !sessionInsertResult.error,
      auditLogged: !auditInsertResult.error,
    })
  } catch (err) {
    console.error('Login route error:', err)
    return NextResponse.json({ error: 'Something went wrong', details: String(err) }, { status: 500 })
  }
}
