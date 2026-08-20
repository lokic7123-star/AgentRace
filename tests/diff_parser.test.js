import test from 'node:test';
import assert from 'node:assert';
import { parseDiffStats, formatDiffBadge } from '../src/diff_parser.js';

test('parseDiffStats correctly splits source and test files', () => {
  const numstat = `42\t10\tsrc/connection_pool.js\n18\t4\tsrc/utils.js\n5\t2\ttest/connection_pool.test.js\n`;
  const testPatterns = ['test/**', 'src/**/*.spec.js'];

  const stats = parseDiffStats(numstat, testPatterns);
  assert.strictEqual(stats.sourceAdded, 60);
  assert.strictEqual(stats.sourceRemoved, 14);
  assert.strictEqual(stats.testAdded, 5);
  assert.strictEqual(stats.testRemoved, 2);
  assert.strictEqual(stats.testModified, true);
  assert.strictEqual(stats.files.length, 3);
});

test('formatDiffBadge formats badges and flags modification', () => {
  assert.strictEqual(formatDiffBadge(42, 10, false), '+42 / -10');
  assert.strictEqual(formatDiffBadge(5, 2, true), '+5 / -2 (Modified)');
  assert.strictEqual(formatDiffBadge(0, 0, false), '+0 / -0');
});
