/**
 * AgentRace (arace) Constants & Types
 */

export const EXIT_CODES = {
  SUCCESS: 0,              // 0: 所有 Agent 均正常执行且验真流程跑通
  GENERAL_ERROR: 1,        // 1: 通用运行时错误
  NO_AGENTS_FOUND: 2,      // 2: 未检测到任何可用的 Agent CLI
  PARTIAL_FAILURE: 3,      // 3: 部分 Agent 发生执行崩溃或超时，但至少有一个完成
  ALL_FAILURE: 4,          // 4: 全部 Agent 超时或执行崩溃
  GIT_DIRTY_OR_ERROR: 5    // 5: Git 状态异常（如工作区不干净且未带 --allow-dirty）
};

export const TASK_CATEGORIES = {
  BUGFIX: 'bugfix',
  REFACTOR: 'refactor',
  FEATURE: 'feature',
  TEST: 'test',
  OTHER: 'other'
};

export const COLLABORATION_MODES = {
  PARALLEL_SYNTHESIS: 'parallel_synthesis', // 多路并行探索 + 主 Agent 优点融合
  PIPELINE_DIVISION: 'pipeline_division'    // 架构/实现/测试流水线分工
};

export const AGENT_STATUSES = {
  IDLE: 'idle',
  PLANNING: 'planning',       // 正在分析需求与规划架构
  CODING: 'coding',           // 正在编写业务逻辑
  TESTING: 'testing',         // 正在补充测试用例
  VERIFYING: 'verifying',     // 正在执行独立门禁验真
  SYNTHESIZING: 'synthesizing', // 主 Agent 正在融合提炼方案
  COMPLETED: 'completed',     // 方案已就绪并通过验证
  ERROR: 'error'              // 执行异常
};

export const DEFAULT_CONFIG = {
  version: 1,
  workspace: {
    prepare_cmd: 'npm install',
    test_paths: [
      'test/**',
      'tests/**',
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
      'src/**/*.spec.js',
      'src/**/*.test.js',
      '**/*_test.go',
      'tests/**/*.py',
      '**/*_test.py'
    ]
  },
  verify: {
    build_cmd: 'npm run build',
    lint_cmd: 'npm run lint',
    test_cmd: 'npm test',
    timeout_per_step: '180s'
  },
  defaults: {
    agents: ['antigravity', 'opencode'],
    timeout: '600s'
  }
};
