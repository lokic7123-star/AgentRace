import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const binPath = path.resolve('bin/arace.js');

function runCLI(args = [], env = {}) {
  return spawnSync('node', [binPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

test('CLI --help outputs usage information', () => {
  const res = runCLI(['--help']);
  assert.strictEqual(res.status, 0);
  assert.ok(res.stdout.includes('AgentRace (arace)'));
  assert.ok(res.stdout.includes('COMMANDS:'));
  assert.ok(res.stdout.includes('USAGE:'));
});

test('CLI detect scans for agents and returns valid status', () => {
  const res = runCLI(['detect']);
  // Exit code 0 (if any agent found) or 2 (if no agent found)
  assert.ok(res.status === 0 || res.status === 2);
  assert.ok(res.stdout.includes('AgentRace Agent Detection:'));
  assert.ok(res.stdout.includes('Claude Code'));
});

test('CLI doctor performs environment diagnosis', () => {
  const res = runCLI(['doctor']);
  assert.strictEqual(res.status, 0);
  assert.ok(res.stdout.includes('AgentRace Environment Doctor:'));
  assert.ok(res.stdout.includes('Git Repository:'));
  assert.ok(res.stdout.includes('Fast CoW Support'));
});

test('CLI stats returns json data', () => {
  const res = runCLI(['stats', '--json']);
  assert.strictEqual(res.status, 0);
  const json = JSON.parse(res.stdout);
  assert.ok(json);
  assert.ok(typeof json.totalRuns === 'number');
  assert.ok(json.categories);
});

test('CLI run in mock mode executes full race, dashboard, and persistence', () => {
  const res = runCLI(['run', 'Fix concurrency lock timeout in connection pool', '--with', 'claude,codex', '--allow-dirty'], {
    ARACE_MOCK: '1'
  });

  assert.ok(res.status === 0 || res.status === 3);
  assert.ok(res.stdout.includes('RACE RESULTS'));
  assert.ok(res.stdout.includes('claude'));
  assert.ok(res.stdout.includes('codex'));
  assert.ok(res.stdout.includes('Source Diff'));
  assert.ok(res.stdout.includes('Test Diff'));
});
