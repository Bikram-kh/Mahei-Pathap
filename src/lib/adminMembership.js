export function hasPlatformAdminMembership(memberships, teamId = 'admin') {
  return Array.isArray(memberships) && memberships.some(m => m.teamId === teamId && m.confirm === true);
}
