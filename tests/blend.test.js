import test from 'node:test';
import assert from 'node:assert';
import { createAdapter } from '../src/adapters/index.js';
import { detectInstalledAgents } from '../src/detector.js';

test('DSH adapter creation and command generation', () => {
  const adapter = createAdapter('dsh');
  assert.strictEqual(adapter.name, 'dsh');
  const { command, args } = adapter.buildCommand('Fix memory leak');
  assert.strictEqual(command, 'dsh');
  assert.ok(args.includes('run'));
  assert.ok(args.some(a => a.includes('Fix memory leak')));
});

test('detectInstalledAgents includes DSH in known agents list', () => {
  const agents = detectInstalledAgents();
  const dsh = agents.find(a => a.name === 'dsh');
  assert.ok(dsh);
  assert.strictEqual(dsh.name, 'dsh');
});
