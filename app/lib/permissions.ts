import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function checkPermission(
  userId: string,
  tenantId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('user_tenant_roles')
    .select('roles(role_permissions(permissions(resource, action)))')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)

  console.log('Permission check raw data:', JSON.stringify(data, null, 2))
  console.log('Permission check error:', error)

  if (error) {
    return false
  }

  if (!data || data.length === 0) {
    console.log('No user_tenant_roles rows found for this user/tenant')
    return false
  }

  for (const row of data as any[]) {
    const role = row.roles
    if (!role || !role.role_permissions) continue

    for (const rp of role.role_permissions) {
      const perm = rp.permissions
      if (perm && perm.resource === resource && perm.action === action) {
        return true
      }
    }
  }

  return false
}
