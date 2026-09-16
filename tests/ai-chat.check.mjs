import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiChat, AI_PLAYER } from '../server/ai-chat.mjs';

const room = () => ({ name: 'test', players: new Map() });
const message = (name, text = '/ai hello') => ({ id: name, name, text, channel: 'all' });
test('serial replies, isolated rooms, bounded context, failures and no self-replies', async () => {
  const requests = [], replies = [], failures = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const ai = createAiChat({ apiKey: 'test',
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body); requests.push(body);
      if (requests.length === 1) await gate;
      if (body.messages.at(-1).content.includes('fail')) return { ok: false, status: 429 };
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'hello lah' } }] }) };
    },
    publish: async (r, payload) => { replies.push({ r, ...payload }); },
  });
  const a = room(), b = room();
  await ai.enqueue(a, message('Ignored', 'hello without a command'));
  assert.equal(requests.length, 0);
  const done = ai.enqueue(a, message('Ali'));
  ai.enqueue(a, message('Sarah'));
  ai.enqueue(a, message('John'));
  assert.equal(requests.length, 1);
  await ai.enqueue(b, message('Other', '/ai secret room'));
  assert.equal(replies[0].r, b);
  release(); await done;
  assert.deepEqual(replies.filter(p => p.r === a).map(p => p.text), ['@Ali hello lah', '@Sarah hello lah', '@John hello lah']);
  assert.ok(requests[2].messages.some(m => m.role === 'assistant'));
  assert.ok(!JSON.stringify(requests[2]).includes('secret room'));
  assert.equal(requests[0].model, 'deepseek-flash');
  assert.equal(requests[0].thinking.type, 'disabled');
  for (let i = 0; i < 40; i++) await ai.enqueue(a, message(`p${i}`, `/ai ${'好'.repeat(200)}`));
  const last = requests.at(-1).messages;
  assert.ok(last.length <= 32);
  assert.ok(Buffer.byteLength(JSON.stringify(last.slice(1, -1))) <= 12000);
  await ai.enqueue(a, message('fail', '/ai fail'), text => failures.push(text));
  await ai.enqueue(a, message('recovered', '/ai recovered'));
  assert.equal(failures.length, 1);
  assert.equal(replies.at(-1).text, '@recovered hello lah');
  const count = requests.length;
  await ai.enqueue(a, { ...message('self'), id: AI_PLAYER.id });
  await ai.enqueue(a, { ...message('private'), channel: 'dm' });
  assert.equal(requests.length, count);
  await createAiChat({ apiKey: '', fetchImpl: () => { throw Error('must not call'); } }).enqueue(a, message('disabled'));
});

test('can publish a reply through the OpenAI chat endpoint', async () => {
  const requests = [], replies = [];
  const ai = createAiChat({ provider: 'openai', apiKey: 'test',
    fetchImpl: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'hello from fallback' } }] }) };
    },
    publish: async (_room, payload) => replies.push(payload),
  });
  await ai.enqueue(room(), message('Ali'));
  assert.equal(requests[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(requests[0].body.model, 'gpt-4o-mini');
  assert.equal(requests[0].body.thinking, undefined);
  assert.equal(replies[0].text, '@Ali hello from fallback');
});
