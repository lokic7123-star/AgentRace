import test from 'node:test';
import assert from 'node:assert/strict';
import { Supervisor } from '../src/supervisor.js';

test('Supervisor decomposes algorithmic task into specialist DAG', async () => {
  const supervisor = new Supervisor('antigravity');
  const dag = await supervisor.decomposeTask('题目：戳气球（区间 DP 经典）', ['antigravity', 'opencode', 'reasonix']);
  
  assert.ok(dag.subtasks.length >= 3);
  assert.equal(dag.subtasks[0].role, 'algorithm_architect');
  assert.equal(dag.subtasks[1].role, 'core_implementer');
  assert.equal(dag.subtasks[2].role, 'qa_engineer');
  assert.deepEqual(dag.subtasks[1].deps, ['subtask-1']);
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

test('Supervisor decomposes engineering task into modular DAG', async () => {
  const supervisor = new Supervisor('antigravity');
  const dag = await supervisor.decomposeTask('重构连接池并增加健康检查与指标上报', ['antigravity', 'opencode', 'reasonix']);
  
  assert.ok(dag.subtasks.length >= 3);
  assert.equal(dag.subtasks[0].role, 'domain_architect');
  assert.equal(dag.subtasks[1].role, 'backend_developer');
  assert.equal(dag.subtasks[2].role, 'qa_engineer');
});