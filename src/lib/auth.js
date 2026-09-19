import { account, teams, Query, isAppwriteConfigured } from './appwrite';
import { hasPlatformAdminMembership } from './adminMembership';

// UI visibility only. Appwrite permissions enforce protected server operations.
// A group name is user-controlled and must never identify platform administrators.
export async function isAdminUser() {
  if (!isAppwriteConfigured) return false;
  try {
    const user = await account.get();
    const result = await teams.listMemberships("admin", [Query.equal("userId", user.$id), Query.equal("confirm", true)]);
    return hasPlatformAdminMembership(result.memberships);
  } catch {
    return false;
  }
}
