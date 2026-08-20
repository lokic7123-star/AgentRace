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

test('Supervisor decomposes engineering task into modular DAG', async () => {
  const supervisor = new Supervisor('antigravity');
  const dag = await supervisor.decomposeTask('重构连接池并增加健康检查与指标上报', ['antigravity', 'opencode', 'reasonix']);
  
  assert.ok(dag.subtasks.length >= 3);
  assert.equal(dag.subtasks[0].role, 'domain_architect');
  assert.equal(dag.subtasks[1].role, 'backend_developer');
  assert.equal(dag.subtasks[2].role, 'qa_engineer');
});