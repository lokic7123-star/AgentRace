import test from 'node:test';
import assert from 'node:assert';
import { parseTestOutput } from '../src/verifier.js';

test('parseTestOutput parses Jest and Vitest outputs', () => {
  const jestOut = `
PASS src/pool.test.js
Tests:       14 passed, 14 total
Snapshots:   0 total
Time:        1.823 s
`;
  const parsed = parseTestOutput(jestOut, true);
  assert.strictEqual(parsed.passed, 14);
  assert.strictEqual(parsed.total, 14);
  assert.strictEqual(parsed.summary, '14/14 pass');
});

test('parseTestOutput parses Vitest failure with failed tests', () => {
  const failOut = `
FAIL test/auth.test.ts
Tests:       3 failed, 11 passed, 14 total
`;
  const parsed = parseTestOutput(failOut, false);
  assert.strictEqual(parsed.passed, 11);
  assert.strictEqual(parsed.total, 14);
  assert.strictEqual(parsed.summary, '11/14 pass');
});

test('parseTestOutput parses Pytest output', () => {
  const pytestOut = `==================== 14 passed, 2 failed in 0.45s ====================`;
  const parsed = parseTestOutput(pytestOut, false);
  assert.strictEqual(parsed.passed, 14);
  assert.strictEqual(parsed.total, 16);
  assert.strictEqual(parsed.summary, '14/16 pass');
});

test('parseTestOutput parses Cargo test output', () => {
  const cargoOut = `test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out`;
  const parsed = parseTestOutput(cargoOut, true);
  assert.strictEqual(parsed.passed, 14);
  assert.strictEqual(parsed.total, 14);
  assert.strictEqual(parsed.summary, '14/14 pass');
});

test('parseTestOutput parses Node.js native test runner output', () => {
  const nodeOut = `
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 214.5
`;
  const parsed = parseTestOutput(nodeOut, true);
  assert.strictEqual(parsed.passed, 14);
  assert.strictEqual(parsed.total, 14);
  assert.strictEqual(parsed.summary, '14/14 pass');
});
