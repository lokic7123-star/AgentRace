import test from 'node:test';
import assert from 'node:assert';
import { saveRunRecord, markAgentKept, getStats, getLatestRun } from '../src/db.js';

test('database persistence and stats aggregation', () => {
  const runId = `test_${Date.now()}`;
  const repoPath = 'd:/test_repo';

  saveRunRecord(
    {
      id: runId,
      repo_path: repoPath,
      base_commit: 'a1b2c3d',
      task_text: 'Fix concurrency lock timeout in connection pool',
      task_category: 'bugfix',
      created_at: new Date().toISOString()
    },
    [
      {
        agent: 'claude',
        duration_seconds: 18.4,
        exit_code: 0,
        build_passed: true,
        lint_passed: true,
        test_passed: true,
        tests_passed_count: 14,
        tests_total_count: 14,
        source_lines_added: 42,
        source_lines_removed: 10,
        test_lines_added: 0,
        test_lines_removed: 0,
        kept: false
      },
      {
        agent: 'codex',
        duration_seconds: 14.2,
        exit_code: 0,
        build_passed: true,
        lint_passed: false,
        test_passed: true,
        tests_passed_count: 11,
        tests_total_count: 14,
        source_lines_added: 18,
        source_lines_removed: 4,
        test_lines_added: 2,
        test_lines_removed: 5,
        kept: false
      }
    ]
  );

  const latest = getLatestRun(repoPath);
  assert.ok(latest);
  assert.strictEqual(latest.id, runId);
  assert.strictEqual(latest.results.length, 2);

  markAgentKept(runId, 'claude');

  const stats = getStats({ repoPath, sinceDays: 1 });
  assert.ok(stats);
  assert.strictEqual(stats.totalRuns >= 1, true);
  assert.ok(stats.agentMetrics.claude);
  assert.strictEqual(stats.agentMetrics.claude.totalKept >= 1, true);
  assert.ok(stats.categories.bugfix);
});
