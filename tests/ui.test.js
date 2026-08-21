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

  const historyRes = await fetch(`http://localhost:${port}/api/history`);
  assert.strictEqual(historyRes.status, 200);
  const historyData = await historyRes.json();
  assert.ok(Array.isArray(historyData.history));

  // /api/diff without runId (default active run)
  const defaultDiffRes = await fetch(`http://localhost:${port}/api/diff`);
  assert.strictEqual(defaultDiffRes.status, 200);
  const defaultDiffData = await defaultDiffRes.json();
  assert.ok(Array.isArray(defaultDiffData.diffs));

  // /api/diff with malicious runId -> 400
  const maliciousDiffRes = await fetch(`http://localhost:${port}/api/diff?runId=invalid%3Bcalc`);
  assert.strictEqual(maliciousDiffRes.status, 400);

  // /api/diff with non-existent runId -> 404
  const notFoundDiffRes = await fetch(`http://localhost:${port}/api/diff?runId=nonexistent_9999`);
  assert.strictEqual(notFoundDiffRes.status, 404);

  // /api/diff with valid historical runId
  if (historyData.history && historyData.history.length > 0) {
    const histRunId = historyData.history[0].id;
    const histDiffRes = await fetch(`http://localhost:${port}/api/diff?runId=${encodeURIComponent(histRunId)}`);
    assert.strictEqual(histDiffRes.status, 200);
    const histDiffData = await histDiffRes.json();
    assert.strictEqual(histDiffData.runId, histRunId);
    assert.ok(Array.isArray(histDiffData.diffs));
  }

  const safeLogRes = await fetch(`http://localhost:${port}/api/logs/..%2F..%2Fpackage.json`);
  assert.ok(safeLogRes.status === 200 || safeLogRes.status === 400);

  server.close();
});
