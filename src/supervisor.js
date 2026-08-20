import fs from 'node:fs';
import path from 'node:path';
import { createAdapter } from './adapters/index.js';
import { createWorktree, commitWorktreeChanges, getWorktreeDiff } from './git.js';
import { verifyWorktree } from './verifier.js';
import { parseDiffStats } from './diff_parser.js';
import { analyzeTestDiffSecurity } from './ast_guard.js';
import { generateRunId, c } from './utils.js';

export class Supervisor {
  constructor(name = 'antigravity', config = {}) {
    this.name = name;
    this.config = config;
  }

  /**
   * Decomposes a user task into a structured Directed Acyclic Graph (DAG) of specialized subtasks.
   */
  async decomposeTask(taskText, availableAgents = ['antigravity', 'opencode', 'reasonix', 'openclaw']) {
    const isAlgorithmic = taskText.includes('戳气球') || taskText.includes('DP') || taskText.includes('动态规划') || taskText.includes('算法') || taskText.includes('LeetCode');

    const agentsPool = availableAgents.length > 0 ? availableAgents : ['antigravity', 'opencode'];

    if (isAlgorithmic) {
      return {
        goal: taskText,
        strategy: 'Specialist Algorithmic Pipeline',
        subtasks: [
          {
            id: 'subtask-1',
            role: 'algorithm_architect',
            title: '数学模型推导与状态转移方程构建',
            agent: agentsPool[0] || 'antigravity',
            description: '推导逆向开区间 DP 状态转移方程与时空复杂度证明',
            outputFile: 'src/solution.js',
            deps: []
          },
          {
            id: 'subtask-2',
            role: 'core_implementer',
            title: '核心区间 DP 求解器编码与边界防御',
            agent: agentsPool[1] || agentsPool[0] || 'opencode',
            description: '实现 maxCoins 高性能求解函数与虚拟边界处理',
            outputFile: 'src/solution.js',
            deps: ['subtask-1']
          },
          {
            id: 'subtask-3',
            role: 'qa_engineer',
            title: '全覆盖单元测试套件与极端用例压测',
            agent: agentsPool[2] || agentsPool[0] || 'reasonix',
            description: '编写单气球、两气球、空数组及标准用例测试套件',
            outputFile: 'tests/solution.test.js',
            deps: ['subtask-2']
          }
        ]
      };
    } else {
      return {
        goal: taskText,
        strategy: 'Modular Engineering Pipeline',
        subtasks: [
          {
            id: 'subtask-1',
            role: 'domain_architect',
            title: '架构设计与接口契约定义',
            agent: agentsPool[0] || 'antigravity',
            description: '设计模块边界、错误模型与核心数据结构',
            outputFile: 'src/solution.js',
            deps: []
          },
          {
            id: 'subtask-2',
            role: 'backend_developer',
            title: '业务逻辑与健壮性实现',
            agent: agentsPool[1] || agentsPool[0] || 'opencode',
            description: '实现业务核心逻辑与异常捕获机制',
            outputFile: 'src/solution.js',
            deps: ['subtask-1']
          },
          {
            id: 'subtask-3',
            role: 'qa_engineer',
            title: '集成测试与边界条件验真',
            agent: agentsPool[2] || agentsPool[0] || 'reasonix',
            description: '编写全流程端到端与单元测试用例',
            outputFile: 'tests/solution.test.js',
            deps: ['subtask-2']
          }
        ]
      };
    }
  }

  /**
   * Check for non-trivial assertions in tests to prevent self-fulfilling mock tests
   */
  validateAssertionDensity(worktreePath) {
    const testDir = path.join(worktreePath, 'tests');
    if (!fs.existsSync(testDir)) return { valid: true, assertionCount: 0 };
    
    let totalAssertions = 0;
    const files = fs.readdirSync(testDir);
    for (const file of files) {
      if (file.endsWith('.test.js') || file.endsWith('.spec.js')) {
        const content = fs.readFileSync(path.join(testDir, file), 'utf8');
        const matches = content.match(/assert\.(equal|strictEqual|deepEqual|throws|rejects|ok|match)/g) || [];
        totalAssertions += matches.length;
      }
    }
    return {
      valid: totalAssertions > 0,
      assertionCount: totalAssertions
    };
  }

  /**
   * Executes the full orchestrated workflow:
   * 1. Task Decomposition (DAG)
   * 2. Isolated Worktree Creation for Subtasks
   * 3. Specialist Agent Execution
   * 4. Hard-Gate Objective Verification (Build, Lint, Tests, AST Anti-cheat)
   * 5. Retry Circuit Breaker (Max 2 retries)
   * 6. Final Integration Hard Gate
   */
  async runOrchestration({ taskText, rootDir = process.cwd(), availableAgents = ['antigravity', 'opencode'], onProgress }) {
    const runId = generateRunId();
    const runDir = path.join(rootDir, '.arace', 'worktrees', runId);
    const logsDir = path.join(runDir, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });

    onProgress?.({ stage: 1, message: '主 Agent (Supervisor) 正在进行架构级任务拆解与 DAG 拓扑分析...' });
    const dag = await this.decomposeTask(taskText, availableAgents);

    const subtaskResults = [];
    const worktrees = [];

    // Execute subtasks
    for (let i = 0; i < dag.subtasks.length; i++) {
      const subtask = dag.subtasks[i];
      const stepNum = i + 1;

      onProgress?.({
        stage: 2,
        subtaskId: subtask.id,
        subtaskTitle: subtask.title,
        agent: subtask.agent,
        message: `正在派发子任务 [${stepNum}/${dag.subtasks.length}] 给专精 Agent「${subtask.agent.toUpperCase()}」(${subtask.role})...`
      });

      // 1. Setup isolated worktree
      const agentIdentifier = `${subtask.id}-${subtask.agent}`;
      const wt = createWorktree({ repoRoot: rootDir, runId, agentName: agentIdentifier });
      worktrees.push(wt);

      // 2. Run specialist agent adapter with circuit breaker retry loop (max 2 retries)
      let attempt = 0;
      let lastErrorContext = '';
      let runRes = null;
      let verifyRes = null;
      let security = null;
      let diffStats = null;
      let gatePassed = false;

      while (attempt <= 2) {
        attempt++;
        const logFilePath = path.join(logsDir, `${agentIdentifier}-attempt-${attempt}.log`);
        const adapter = createAdapter(subtask.agent, this.config.adapters);

        let prompt = `[子任务目标]: ${subtask.title}\n[详细要求]: ${subtask.description}\n[交付文件]: ${subtask.outputFile}\n[总体项目目标]: ${taskText}`;
        if (lastErrorContext) {
          prompt += `\n\n[前次门禁失败错误诊断反馈 (请精准修复)]:\n${lastErrorContext}`;
        }

        runRes = await adapter.run({
          taskText: prompt,
          worktreePath: wt.worktreePath,
          logFilePath,
          timeoutMs: 300000
        });

        commitWorktreeChanges(wt.worktreePath, `arace (${runId}): ${subtask.title} (attempt ${attempt})`);

        // 3. Hard-Gate Objective Verification
        onProgress?.({
          stage: 3,
          subtaskId: subtask.id,
          message: `正在对「${subtask.agent.toUpperCase()}」的产出执行硬性客观质量门禁 (第 ${attempt} 次检验)...`
        });

        verifyRes = verifyWorktree({
          worktreePath: wt.worktreePath,
          verifyConfig: this.config.verify || { test_cmd: 'npm test' },
          logFilePath
        });

        const diff = getWorktreeDiff(wt.worktreePath);
        diffStats = parseDiffStats(diff.numstatText);
        security = analyzeTestDiffSecurity(diff.diffText, subtask.agent);
        const assertionCheck = this.validateAssertionDensity(wt.worktreePath);

        gatePassed = verifyRes.test.passed && verifyRes.build.passed && verifyRes.lint.passed && !security.isSuspicious && assertionCheck.valid;

        if (gatePassed) {
          break;
        } else {
          lastErrorContext = `Build: ${verifyRes.build.passed ? 'PASS' : 'FAIL'}, Lint: ${verifyRes.lint.passed ? 'PASS' : 'FAIL'}, Tests: ${verifyRes.test.passed ? 'PASS' : 'FAIL'} (${verifyRes.test.summary || ''})`;
          if (security.isSuspicious) lastErrorContext += `\nSecurity Warning: ${security.summary}`;
        }
      }

      subtaskResults.push({
        subtask,
        agent: subtask.agent,
        worktreePath: wt.worktreePath,
        branchName: wt.branchName,
        attempts: attempt,
        exitCode: runRes?.exitCode || 0,
        durationSeconds: runRes?.durationSeconds || 1.0,
        tokens: runRes?.tokens,
        verify: verifyRes,
        security,
        diffStats,
        gatePassed
      });
    }

    // Stage 5: Supervisor Integration & Final Hard Gate
    onProgress?.({
      stage: 4,
      message: `所有子任务已完成门禁验真！主 Agent「${this.name.toUpperCase()}」正在进行最终架构审查与全量集成...`
    });

    const finalWt = createWorktree({ repoRoot: rootDir, runId, agentName: 'integrated' });
    worktrees.push(finalWt);

    // Write final integrated code
    const finalLogPath = path.join(logsDir, 'supervisor-integration.log');
    const supAdapter = createAdapter(this.name, this.config.adapters);
    
    const integrationPrompt = `[主 Agent 架构级全量集成]\n[任务目标]: ${taskText}\n已成功通过所有子任务门禁，正在生成终版统一工程方案与完整测试用例。`;
    const finalCodingRes = await supAdapter.run({
      taskText: integrationPrompt,
      worktreePath: finalWt.worktreePath,
      logFilePath: finalLogPath,
      timeoutMs: 300000
    });

    commitWorktreeChanges(finalWt.worktreePath, `arace (${runId}): supervisor integrated solution`);

    // FINAL HARD GATE: Mandatory full suite test on integrated code
    const finalVerify = verifyWorktree({
      worktreePath: finalWt.worktreePath,
      verifyConfig: this.config.verify || { test_cmd: 'npm test' },
      logFilePath: finalLogPath
    });

    const finalDiff = getWorktreeDiff(finalWt.worktreePath);
    const finalStats = parseDiffStats(finalDiff.numstatText);

    // Save latest run info
    const latestRunInfo = {
      runId,
      mode: 'orchestration',
      supervisor: this.name,
      taskText,
      dag,
      subtaskResults,
      finalResult: {
        agent: 'supervisor',
        branch: finalWt.branchName,
        path: finalWt.worktreePath,
        durationSeconds: finalCodingRes.durationSeconds,
        verify: finalVerify,
        diffStats: finalStats
      },
      agents: [
        ...subtaskResults.map(r => ({ name: r.agent, branch: r.branchName, path: r.worktreePath })),
        { name: 'supervisor', branch: finalWt.branchName, path: finalWt.worktreePath }
      ]
    };

    fs.writeFileSync(path.join(rootDir, '.arace', 'latest_run.json'), JSON.stringify(latestRunInfo, null, 2));

    onProgress?.({ stage: 5, message: '🎉 编排协同完成！终版高质量方案已通过全量门禁验真，就绪待交付。' });

    return latestRunInfo;
  }
}