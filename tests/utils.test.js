import test from 'node:test';
import assert from 'node:assert';
import {
  parseDurationToMs,
  formatDuration,
  classifyTaskCategory,
  matchGlob,
  isTestFile
} from '../src/utils.js';

test('parseDurationToMs parses valid strings', () => {
  assert.strictEqual(parseDurationToMs('600s'), 600000);
  assert.strictEqual(parseDurationToMs('5m'), 300000);
  assert.strictEqual(parseDurationToMs('1h'), 3600000);
  assert.strictEqual(parseDurationToMs('500ms'), 500);
  assert.strictEqual(parseDurationToMs(30), 30000);
});

test('formatDuration formats seconds', () => {
  assert.strictEqual(formatDuration(18.4), '18.4s');
  assert.strictEqual(formatDuration(75.2), '1m 15.2s');
});

test('classifyTaskCategory classifies task texts correctly', () => {
  assert.strictEqual(classifyTaskCategory('Fix concurrency lock timeout in connection pool'), 'bugfix');
  assert.strictEqual(classifyTaskCategory('Refactor database model layer'), 'refactor');
  assert.strictEqual(classifyTaskCategory('Add unit test for utility helper'), 'test');
  assert.strictEqual(classifyTaskCategory('Implement new OAuth2 authentication flow'), 'feature');
  assert.strictEqual(classifyTaskCategory('Miscellaneous maintenance'), 'other');
});

test('matchGlob and isTestFile work accurately', () => {
  assert.strictEqual(matchGlob('test/app.test.js', 'test/**'), true);
  assert.strictEqual(matchGlob('src/components/button.spec.ts', 'src/**/*.spec.ts'), true);
  assert.strictEqual(matchGlob('src/components/button.ts', 'src/**/*.spec.ts'), false);

  const patterns = ['test/**', 'tests/**', 'src/**/*.spec.ts', 'src/**/*.test.ts'];
  assert.strictEqual(isTestFile('src/models/user.test.ts', patterns), true);
  assert.strictEqual(isTestFile('src/models/user.ts', patterns), false);
  assert.strictEqual(isTestFile('test/integration/api.js', patterns), true);
});
