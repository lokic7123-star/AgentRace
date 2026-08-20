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
    agents: ['claude', 'codex'],
    timeout: '600s'
  }
};
