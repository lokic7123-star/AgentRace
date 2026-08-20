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

test('market agents adapters create valid commands', () => {
  const agents = ['dsh', 'claude', 'codex', 'aider', 'gemini', 'antigravity', 'cursor', 'windsurf', 'copilot', 'openhands', 'cody', 'goose', 'cline', 'plandex', 'mentat', 'opencode', 'tabnine', 'reasonix', 'openclaw'];
  for (const name of agents) {
    const adapter = createAdapter(name);
    assert.ok(adapter);
    assert.strictEqual(adapter.name, name);
    const { command } = adapter.buildCommand('Test task', '/tmp/worktree');
    assert.ok(command);
  }
});

test('detectInstalledAgents includes comprehensive market agents list', () => {
  const agents = detectInstalledAgents();
  assert.ok(agents.length >= 20);
  assert.ok(agents.some(a => a.name === 'dsh'));
  assert.ok(agents.some(a => a.name === 'claude'));
  assert.ok(agents.some(a => a.name === 'codex'));
  assert.ok(agents.some(a => a.name === 'openhands'));
  assert.ok(agents.some(a => a.name === 'windsurf'));
  assert.ok(agents.some(a => a.name === 'goose'));
  assert.ok(agents.some(a => a.name === 'cline'));
  assert.ok(agents.some(a => a.name === 'ollama'));
  assert.ok(agents.some(a => a.name === 'lmstudio'));
  assert.ok(agents.some(a => a.name === 'tabnine'));
  assert.ok(agents.some(a => a.name === 'sgpt'));
});
