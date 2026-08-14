import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '../../lib/permissions'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = body.userId
    const tenantId = body.tenantId
    const resource = body.resource
    const action = body.action

    if (!userId || !tenantId || !resource || !action) {
      return NextResponse.json(
        { error: 'userId, tenantId, resource, and action are all required' },
        { status: 400 }
      )
    }

    const allowed = await checkPermission(userId, tenantId, resource, action)

    return NextResponse.json({ allowed: allowed })
  } catch (err) {
    console.error('Check-permission route error:', err)
    return NextResponse.json({ error: 'Something went wrong', details: String(err) }, { status: 500 })
  }
}
