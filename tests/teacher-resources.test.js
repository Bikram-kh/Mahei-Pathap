import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherResources, learningSearchTopic } from '../src/lib/teacherResources.js';

test('historical replies retain their lesson rather than the current roadmap topic', () => {
  const messages = [{role:'user',content:'Teach me Wave nature of light. Start with a short explanation and a practice question.'},{role:'assistant',content:'Lesson'},{role:'user',content:'2'},{role:'assistant',content:'Correct'}];
  assert.equal(learningSearchTopic(messages,3,'Calculus'),'Wave nature of light');
});
test('explicit follow-up topics select the specific video, never a search page', () => {
  const messages = [{role:'user',content:'What is interference & diffraction?'},{role:'assistant',content:'Explanation'}];
  const links = teacherResources(messages,1,{subject:'Physics'});
  assert.equal(links.length,1);
  assert.equal(links[0].href,'https://www.youtube.com/watch?v=VmN3i4HW5l0');
});
test('superposition uses a verified direct video and unsupported topics have no invented fallback', () => {
  assert.equal(teacherResources([],0,{},'Wave nature of light and superposition principle')[0].href,'https://www.youtube.com/watch?v=oTjTXS40pqs');
  assert.deepEqual(teacherResources([],0,{subject:'Maths'}),[]);
  assert.deepEqual(teacherResources([],0),[]);
});
