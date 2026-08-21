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

test('parseSimpleYaml correctly preserves # within quotes and strips true comments', () => {
  const yaml = `
# Header full line comment
title: "Issue #123: fix critical bug" # inline comment
description: 'Tag #core #v2 should stay'
raw_comment: without quotes # this is removed
list:
  - "Item #1" # list inline comment
  - 'Item #2'
`;
  const parsed = parseSimpleYaml(yaml);
  assert.strictEqual(parsed.title, 'Issue #123: fix critical bug');
  assert.strictEqual(parsed.description, 'Tag #core #v2 should stay');
  assert.strictEqual(parsed.raw_comment, 'without quotes');
  assert.strictEqual(parsed.list[0], 'Item #1');
  assert.strictEqual(parsed.list[1], 'Item #2');
});

test('loadProjectConfig loads project config properly', () => {
  const config = loadProjectConfig();
  assert.ok(config);
  assert.ok(Array.isArray(config.defaults.agents));
  assert.ok(Array.isArray(config.workspace.test_paths));
});
