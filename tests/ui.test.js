import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { createServer } from '../src/server/api.js';

test('Web API server responds to /api/status and /api/stats', async () => {
  const server = createServer(process.cwd());
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;

  const statusRes = await fetch(`http://localhost:${port}/api/status`);
  assert.strictEqual(statusRes.status, 200);
  const statusData = await statusRes.json();
  assert.ok(statusData);

  const statsRes = await fetch(`http://localhost:${port}/api/stats`);
  assert.strictEqual(statsRes.status, 200);
  const statsData = await statsRes.json();
  assert.ok(typeof statsData.totalRuns === 'number');

  const htmlRes = await fetch(`http://localhost:${port}/`);
  assert.strictEqual(htmlRes.status, 200);
  const html = await htmlRes.text();
  assert.ok(html.includes('AgentRace'));

  server.close();
});
