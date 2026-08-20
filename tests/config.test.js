import test from 'node:test';
import assert from 'node:assert';
import { parseSimpleYaml, loadProjectConfig } from '../src/config.js';

test('parseSimpleYaml parses yaml key values and lists', () => {
  const yaml = `
version: 1
workspace:
  prepare_cmd: "npm install"
  test_paths:
    - "test/**"
    - "src/**/*.spec.ts"
verify:
  build_cmd: "npm run build"
  timeout_per_step: 180s
defaults:
  agents:
    - claude
    - codex
  timeout: 600s
`;
  const parsed = parseSimpleYaml(yaml);
  assert.strictEqual(parsed.version, 1);
  assert.strictEqual(parsed.workspace.prepare_cmd, 'npm install');
  assert.strictEqual(parsed.workspace.test_paths[0], 'test/**');
  assert.strictEqual(parsed.workspace.test_paths[1], 'src/**/*.spec.ts');
  assert.strictEqual(parsed.verify.build_cmd, 'npm run build');
  assert.strictEqual(parsed.defaults.agents[0], 'claude');
  assert.strictEqual(parsed.defaults.agents[1], 'codex');
});

test('loadProjectConfig loads project config properly', () => {
  const config = loadProjectConfig();
  assert.ok(config);
  assert.ok(Array.isArray(config.defaults.agents));
  assert.ok(Array.isArray(config.workspace.test_paths));
});
