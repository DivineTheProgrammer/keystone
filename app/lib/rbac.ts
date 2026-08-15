import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from './permissions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type AuthResult =
  | { authorized: true; userId: string; tenantId: string }
  | { authorized: false; response: NextResponse }

export async function requirePermission(
  req: NextRequest,
  tenantId: string,
  resource: string,
  action: string
): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 }),
    }
  }

  const token = authHeader.replace('Bearer ', '')

  const userResult = await supabase.auth.getUser(token)

  if (userResult.error || !userResult.data.user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }),
    }
  }

  const userId = userResult.data.user.id

  const allowed = await checkPermission(userId, tenantId, resource, action)

  if (!allowed) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'You do not have permission to perform this action' },
        { status: 403 }
      ),
    }
  }

  return { authorized: true, userId: userId, tenantId: tenantId }
}
