import test from 'node:test';
import assert from 'node:assert/strict';
import { captureGroupInvitation, clearGroupInvitation } from '../src/lib/groupInvitation.js';
const memory = () => { const values = new Map(); return { getItem:k=>values.get(k)||null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) }; };
test('invitation survives authentication redirect and is explicitly cleared', () => {
 const store = memory(); const token = 'a'.repeat(64);
 assert.equal(captureGroupInvitation(`https://mahei.test/?groupInvite=${token}`,store),token);
 assert.equal(captureGroupInvitation('https://mahei.test/?userId=1&secret=abc',store),token);
 clearGroupInvitation(store);
 assert.equal(captureGroupInvitation('https://mahei.test/',store),'');
});
test('ignores unsafe or oversized invitation input without erasing a valid pending invite',()=>{
 const store=memory(); const token='b'.repeat(64);
 captureGroupInvitation(`https://mahei.test/?groupInvite=${token}`,store);
 assert.equal(captureGroupInvitation('https://mahei.test/?groupInvite=%3Cscript%3E',store),token);
});
