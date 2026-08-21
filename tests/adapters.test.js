import test from 'node:test';
import assert from 'node:assert';
import { createAdapter, BaseAdapter, CustomAdapter } from '../src/adapters/index.js';

test('all market adapters return bare argument arrays without manual quote wrapping', () => {
  const agentNames = [
    'dsh', 'claude', 'codex', 'aider', 'gemini', 'antigravity',
    'cursor', 'windsurf', 'copilot', 'openhands', 'cody', 'goose',
    'cline', 'plandex', 'mentat', 'ollama', 'sgpt', 'opencode',
    'lmstudio', 'openclaw', 'reasonix', 'tabnine'
  ];

  const complexTask = 'Fix memory leak in "redis" & worker pool; check `status`';

  for (const name of agentNames) {
    const adapter = createAdapter(name);
    const { command, args } = adapter.buildCommand(complexTask, '/tmp/wt');
    assert.ok(command, `Adapter ${name} command should be defined`);
    assert.ok(Array.isArray(args), `Adapter ${name} args should be an array`);

    // Verify taskText is passed as a bare argument item (without added outer quotes)
    const taskArg = args.find(a => a === complexTask || a.includes(complexTask));
    assert.ok(taskArg, `Adapter ${name} should contain unescaped raw task string`);
    assert.strictEqual(taskArg.startsWith('"Fix') && taskArg.endsWith('status`"'), false, `Adapter ${name} should not manually wrap outer quotes`);
  }
});

test('CustomAdapter correctly substitutes template tokens', () => {
  const custom = createAdapter('custom_bot', {
    custom_bot: { cmd: 'bot-cli --run "{task}" --dir "{worktree}"' }
  });

  assert.ok(custom instanceof CustomAdapter);
  const { command, args } = custom.buildCommand('My task & test', '/workspace/wt');
  assert.strictEqual(command, 'bot-cli --run "My task & test" --dir "/workspace/wt"');
  assert.deepStrictEqual(args, []);
});

test('BaseAdapter correctly handles complex special characters without injection', () => {
  const adapter = createAdapter('claude');
  const task = 'Refactor auth: handle "users" & `tokens` | calc.exe';
  const { command, args } = adapter.buildCommand(task);
  assert.strictEqual(command, 'claude');
  assert.deepStrictEqual(args, ['-p', task, '--dangerously-skip-permissions']);
});
