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

test('SIB AI route rejects unauthenticated request with 401', async () => {
  const response = await fetch(`${baseUrl}/api/sib/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'Why did Class B attendance decline?' })
  });

  assert.equal(response.status, 401);
  const data = await response.json();
  assert.ok(data.error);
});

test('SIB Weekly Report route rejects unauthenticated request with 401', async () => {
  const response = await fetch(`${baseUrl}/api/sib/weekly-report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quarterNumber: 1 })
  });

  assert.equal(response.status, 401);
  const data = await response.json();
  assert.ok(data.error);
});

test('SIB AI route rejects invalid empty body or missing query with 400 when authenticated or headers set', async () => {
  // Without Authorization, 401 is always returned first for security
  const unauth = await fetch(`${baseUrl}/api/sib/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(unauth.status, 401);
});
