import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/server/app';

let server: http.Server;
let baseUrl = '';
const previousNodeEnv = process.env.NODE_ENV;

before(async () => {
  process.env.NODE_ENV = 'production';
  server = http.createServer(createApp());
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a TCP port.');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  process.env.NODE_ENV = previousNodeEnv;
});

test('health endpoint returns JSON', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^application\/json/);
  assert.deepEqual(await response.json(), { status: 'ok', provider: 'supabase' });
});

test('unknown API routes fail with a JSON 404 instead of SPA HTML', async () => {
  const response = await fetch(`${baseUrl}/api/sync/pull`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type') || '', /^application\/json/);
  assert.match(String((await response.json()).error), /API route not found/);
});

test('worker directory and AI routes require authentication', async () => {
  const [workers, assistant] = await Promise.all([
    fetch(`${baseUrl}/api/workers/directory`),
    fetch(`${baseUrl}/api/gemini/assistant`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'CHAT', prompt: 'test' }),
    }),
  ]);
  assert.equal(workers.status, 401);
  assert.equal(assistant.status, 401);
});

test('credential editing and special-event mutations require authentication', async () => {
  const responses = await Promise.all([
    fetch(`${baseUrl}/api/admin/users/example`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' }),
    fetch(`${baseUrl}/api/admin/special-events/example`, { method: 'DELETE' }),
    fetch(`${baseUrl}/api/admin/special-events/attendance/example`, { method: 'DELETE' }),
    fetch(`${baseUrl}/api/admin/classes/mass-create`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }),
  ]);
  assert.deepEqual(responses.map(response => response.status), [401, 401, 401, 401]);
});

test('production does not expose the database schema', async () => {
  const response = await fetch(`${baseUrl}/api/schema`);
  assert.equal(response.status, 404);
});

test('malformed JSON receives an explicit JSON 400', async () => {
  const response = await fetch(`${baseUrl}/api/gemini/assistant`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Request body must be valid JSON.' });
});
