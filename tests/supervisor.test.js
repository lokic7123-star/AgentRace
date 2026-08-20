import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Supervisor } from '../src/supervisor.js';

test('Supervisor decomposes algorithmic task into specialist DAG', async () => {
  const supervisor = new Supervisor('antigravity');
  const dag = await supervisor.decomposeTask('题目：戳气球（区间 DP 经典）', ['antigravity', 'opencode', 'reasonix']);
  
  assert.ok(dag.subtasks.length >= 3);
  assert.equal(dag.subtasks[0].role, 'algorithm_architect');
  assert.equal(dag.subtasks[1].role, 'core_implementer');
  assert.equal(dag.subtasks[2].role, 'qa_engineer');
  assert.deepEqual(dag.subtasks[1].deps, ['subtask-1']);
  assert.deepEqual(dag.subtasks[2].deps, ['subtask-2']);
});

test('Supervisor dynamically decomposes fullstack task into multi-tier DAG', async () => {
  const supervisor = new Supervisor('antigravity');
  const dag = await supervisor.decomposeTask('开发用户登录注册的前后端 API 与页面组件', ['antigravity', 'opencode', 'reasonix']);
  
  assert.equal(dag.strategy, 'Full-Stack Multi-Tier Pipeline');
  assert.equal(dag.subtasks[0].role, 'domain_architect');
  assert.equal(dag.subtasks[1].role, 'backend_developer');
  assert.equal(dag.subtasks[2].role, 'qa_engineer');
});

test('Supervisor generates black-box specification prompt for QA Agent', () => {
  const supervisor = new Supervisor('antigravity');
  const qaSubtask = {
    id: 'subtask-3',
    role: 'qa_engineer',
    title: '全覆盖单元测试套件',
    outputFile: 'tests/solution.test.js'
  };
  const prompt = supervisor.generateBlackboxQAPrompt(qaSubtask, '优化 Redis 连接池并发锁');
  
  assert.ok(prompt.includes('黑盒测试契约规范'));
  assert.ok(prompt.includes('严禁空断言'));
  assert.ok(!prompt.includes('function solve(')); // Does not leak implementation source
});

test('validateAssertionDensity strictly inspects target test file and catches weak tests', () => {
  const supervisor = new Supervisor('antigravity');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arace-test-'));
  const testSubdir = path.join(tempDir, 'tests');
  fs.mkdirSync(testSubdir, { recursive: true });

  const qaSubtask = {
    role: 'qa_engineer',
    outputFile: 'tests/my_solution.test.js'
  };

  // 1. Non-existent test file -> invalid
  const res1 = supervisor.validateAssertionDensity(tempDir, qaSubtask);
  assert.equal(res1.valid, false);
  assert.ok(res1.reason.includes('does not exist'));

  // 2. Weak/Trivial test file (only assert.ok(true)) -> caught as 0 non-trivial assertions
  fs.writeFileSync(path.join(tempDir, 'tests/my_solution.test.js'), 'test("weak", () => { assert.ok(true); });', 'utf8');
  const res2 = supervisor.validateAssertionDensity(tempDir, qaSubtask);
  assert.equal(res2.valid, false);
  assert.equal(res2.assertionCount, 0); // assert.ok is caught as non-substantive

  // 3. Valid test file with multiple non-trivial assertions -> valid
  fs.writeFileSync(path.join(tempDir, 'tests/my_solution.test.js'), `
    test("valid", () => {
      assert.equal(maxCoins([3,1,5,8]), 167);
      assert.deepEqual(solve([]), 0);
      assert.throws(() => parse(null));
    });
  `, 'utf8');
  const res3 = supervisor.validateAssertionDensity(tempDir, qaSubtask);
  assert.equal(res3.valid, true);
  assert.equal(res3.assertionCount, 3);

  // 4. Non-QA subtask -> skipped
  const devSubtask = { role: 'backend_developer', outputFile: 'src/solution.js' };
  const res4 = supervisor.validateAssertionDensity(tempDir, devSubtask);
  assert.equal(res4.valid, true);
  assert.equal(res4.skipped, true);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('runOrchestration executes cascading worktree pipeline and verifies dependencies', async () => {
  const supervisor = new Supervisor('antigravity', {
    verify: { test_cmd: 'node -e "process.exit(0)"' }
  });

  const progressSteps = [];
  const result = await supervisor.runOrchestration({
    taskText: '戳气球区间 DP 优化',
    rootDir: process.cwd(),
    availableAgents: ['antigravity', 'opencode', 'reasonix'],
    onProgress: (p) => progressSteps.push(p)
  });

  assert.ok(result.runId);
  assert.equal(result.subtaskResults.length, 3);

  // Verify Cascading Base Commit Propagation:
  // subtask-1 starts from HEAD
  assert.equal(result.subtaskResults[0].baseCommitUsed, 'HEAD');
  
  // subtask-2 cascades and branches off subtask-1's branch
  assert.equal(result.subtaskResults[1].baseCommitUsed, result.subtaskResults[0].branchName);
  
  // subtask-3 cascades and branches off subtask-2's branch
  assert.equal(result.subtaskResults[2].baseCommitUsed, result.subtaskResults[1].branchName);

  // Final integrated branch cascades from subtask-3
  assert.ok(result.finalResult.branch.includes('integrated'));
  assert.equal(result.finalResult.gatePassed, true);
});