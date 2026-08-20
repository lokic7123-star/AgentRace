import test from 'node:test';
import assert from 'node:assert';
import { analyzeTestDiffSecurity } from '../src/ast_guard.js';

test('analyzeTestDiffSecurity detects test.skip and test.only', () => {
  const diffWithSkip = `
+  test.skip('should handle timeout', () => {
+    expect(true).toBe(true);
+  });
`;
  const res = analyzeTestDiffSecurity(diffWithSkip, 'test/pool.test.js');
  assert.strictEqual(res.isSuspicious, true);
  assert.strictEqual(res.score < 100, true);
  assert.ok(res.warnings.some(w => w.includes('test.skip')));
});

test('analyzeTestDiffSecurity passes legitimate tests', () => {
  const cleanDiff = `
+  test('should return valid user', () => {
+    const user = getUser(123);
+    expect(user.name).toBe('Alice');
+  });
`;
  const res = analyzeTestDiffSecurity(cleanDiff, 'test/user.test.js');
  assert.strictEqual(res.isSuspicious, false);
  assert.strictEqual(res.score, 100);
});

test('analyzeTestDiffSecurity catches assert.ok(true), assert.equal(1, 1), and test.todo', () => {
  const diffWithTrivial = `
+  test.todo('future test');
+  assert.ok(true);
+  assert.equal(1, 1);
+  expect(true).toBeTruthy();
`;
  const res = analyzeTestDiffSecurity(diffWithTrivial, 'test/fake.test.js');
  assert.strictEqual(res.isSuspicious, true);
  assert.ok(res.warnings.length >= 3);
});
