// Direct lesson videos verified against provider pages. Unmatched topics never get search links or invented video IDs.
const clean = value => String(value || '').replace(/https?:\/\/\S+/gi, '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);

export function learningSearchTopic(messages, index, fallback = '') {
  // Walk backwards so short answers such as “yes” or “2” retain their lesson context.
  for (let i = index - 1; i >= 0; i -= 1) {
    if (messages[i]?.role !== 'user') continue;
    const text = clean(messages[i].content);
    const lesson = text.match(/^Teach me (.+?)(?:\. Start with|$)/i);
    if (lesson) return lesson[1];
    const question = text.match(/^(?:please\s+)?(?:explain|what is|what are|how does|how do|tell me about|teach me about)\s+(.+)/i);
    if (question && !/^(?:it|this|that|again|more|simply|in simple|in detail)\b/i.test(question[1])) {
      return question[1].replace(/[?.!]+$/, '');
    }
  }
  return clean(fallback);
}

// Keep specific topics ahead of broader ones when selecting a lesson.
const LESSON_VIDEOS = [
  { matches: /young.?s|double.slit/i, label: "Young’s double slit introduction", href: 'https://www.khanacademy.org/v/youngs-double-split-part-1', provider: 'Khan Academy' },
  { matches: /single.slit/i, label: 'Single slit interference', href: 'https://www.khanacademy.org/science/physics/light-waves/light-waves/interference-of-light-waves/v/single-slit-interference', provider: 'Khan Academy' },
  { matches: /diffraction/i, label: 'Diffraction and interference of light', href: 'https://www.youtube.com/watch?v=VmN3i4HW5l0', provider: 'Khan Academy · YouTube' },
  { matches: /superposition|constructive|destructive|wave nature of light|wave interference|interference of light/i, label: 'Constructive and destructive interference', href: 'https://www.youtube.com/watch?v=oTjTXS40pqs', provider: 'Khan Academy · YouTube' },
];

export function teacherResources(messages, index, profile = {}, fallback = '') {
  const topic = learningSearchTopic(messages, index, fallback || profile.subject);
  const video = LESSON_VIDEOS.find(item => item.matches.test(topic));
  return video ? [{ label: video.label, href: video.href, provider: video.provider, topic }] : [];
}
