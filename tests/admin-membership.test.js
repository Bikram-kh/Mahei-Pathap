import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPlatformAdminMembership } from '../src/lib/adminMembership.js';
test('only a confirmed membership in the platform admin team qualifies',()=>{
 assert.equal(hasPlatformAdminMembership([{teamId:'study-123',teamName:'admin',confirm:true}]),false);
 assert.equal(hasPlatformAdminMembership([{teamId:'admin',confirm:false}]),false);
 assert.equal(hasPlatformAdminMembership([{teamId:'admin',confirm:true}]),true);
});
