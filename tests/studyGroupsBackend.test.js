import test from 'node:test';
import assert from 'node:assert/strict';
import { validText, assertActive, assertOwner, invitationValid, fail, validInviteToken, validRecordId, MAX_MEMBERS, MAX_PDF_BYTES, stableId } from '../functions/mahei-study-groups/src/policy.js';

test('study groups reject blank and oversized input', () => {
  assert.throws(() => validText(' ', 'Name', 80));
  assert.throws(() => validText('a'.repeat(81), 'Name', 80));
  assert.equal(validText(' Maths ', 'Name', 80), 'Maths');
});
test('study groups archive and ownership policy is enforced server-side', () => {
  assert.throws(() => assertActive({status:'archived'}));
  assert.throws(() => assertOwner({ownerId:'owner'}, 'other'));
  assert.doesNotThrow(() => assertOwner({ownerId:'owner'}, 'owner'));
});
test('invites expire, revoke, and enforce member capacity', () => {
  assert.equal(MAX_MEMBERS,20);
  assert.throws(() => invitationValid({revoked:true,expiresAt:'2100-01-01'}, 0));
  assert.throws(() => invitationValid({expiresAt:'2000-01-01'}, 0));
  assert.throws(() => invitationValid({expiresAt:'2100-01-01'}, 20));
  assert.doesNotThrow(() => invitationValid({expiresAt:'2100-01-01'}, 19));
});
test('invitation expiry uses the supplied clock', () => {
  const invite = { expiresAt: '2026-01-08T00:00:00.000Z' };
  assert.doesNotThrow(() => invitationValid(invite, 1, Date.parse('2026-01-07T23:59:59.000Z')));
  assert.throws(() => invitationValid(invite, 1, Date.parse('2026-01-08T00:00:00.000Z')), (error) => error.status === 410);
});
test('only fail() errors are marked safe to show to students', () => {
  assert.throws(() => fail('Nope', 403), (error) => error.expose === true && error.status === 403);
  assert.throws(() => validInviteToken('<script>'), (error) => error.expose === true);
  assert.equal(validInviteToken('a'.repeat(43)), 'a'.repeat(43));
  assert.throws(() => validRecordId('../etc'), (error) => error.status === 404);
});
test('request ids are stable but separated by user and operation', () => {
  assert.equal(stableId('a','x'),stableId('a','x'));
  assert.notEqual(stableId('a','x'),stableId('b','x'));
  assert.equal(MAX_PDF_BYTES,25*1024*1024);
});
