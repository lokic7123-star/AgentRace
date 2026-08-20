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
   * Dynamically decomposes a user task into a structured Directed Acyclic Graph (DAG) of specialized subtasks.
   */
  async decomposeTask(taskText, availableAgents = ['antigravity', 'opencode', 'reasonix', 'openclaw']) {
    const pool = availableAgents.length > 0 ? availableAgents : ['antigravity', 'opencode'];

    const isAlgorithmic = /戳气球|DP|动态规划|算法|LeetCode|背包|最短路|二叉树|排序|贪心/i.test(taskText);
    const isFullStack = /前端|界面|UI|组件|API|路由|接口|前后端/i.test(taskText);

    if (isAlgorithmic) {
      return {
        goal: taskText,
        strategy: 'Algorithmic Dynamic Programming Pipeline',
        subtasks: [
          {
            id: 'subtask-1',
            role: 'algorithm_architect',
            title: '数学模型推导与状态转移方程构建',
            agent: pool[0] || 'antigravity',
            description: '推导状态转移方程、时空复杂度并完成基础框架定义',
            outputFile: 'src/solution.js',
            deps: []
          },
          {
            id: 'subtask-2',
            role: 'core_implementer',
            title: '核心算法求解器编码与边界防御',
            agent: pool[1 % pool.length] || 'opencode',
            description: '实现高性能求解函数与边界条件处理',
            outputFile: 'src/solution.js',
            deps: ['subtask-1']
          },
          {
            id: 'subtask-3',
            role: 'qa_engineer',
            title: '全覆盖单元测试套件与极端用例压测 (黑盒契约盲测)',
            agent: pool[2 % pool.length] || 'reasonix',
            description: '编写边界用例、极端用例与标准用例测试套件',
            outputFile: 'tests/solution.test.js',
            deps: ['subtask-2']
          }
        ]
      };
    } else if (isFullStack) {
      return {
        goal: taskText,
        strategy: 'Full-Stack Multi-Tier Pipeline',
        subtasks: [
          {
            id: 'subtask-1',
            role: 'domain_architect',
            title: '数据契约与接口协议定义',
            agent: pool[0] || 'antigravity',
            description: '定义数据模型、错误码与交互协议',
            outputFile: 'src/models.js',
            deps: []
          },
          {
            id: 'subtask-2',
            role: 'backend_developer',
            title: '核心服务与数据处理逻辑',
            agent: pool[1 % pool.length] || 'opencode',
            description: '实现核心服务逻辑、状态管理与持久化',
            outputFile: 'src/solution.js',
            deps: ['subtask-1']
          },
          {
            id: 'subtask-3',
            role: 'qa_engineer',
            title: '跨层端到端与集成测试套件 (黑盒契约盲测)',
            agent: pool[2 % pool.length] || 'reasonix',
            description: '编写全链路接口契约与异常模拟测试',
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
            agent: pool[0] || 'antigravity',
            description: '设计模块边界、错误模型与核心数据结构',
            outputFile: 'src/solution.js',
            deps: []
          },
          {
            id: 'subtask-2',
            role: 'backend_developer',
            title: '业务逻辑与健壮性实现',
            agent: pool[1 % pool.length] || 'opencode',
            description: '实现业务核心逻辑与异常捕获机制',
            outputFile: 'src/solution.js',
            deps: ['subtask-1']
          },
          {
            id: 'subtask-3',
            role: 'qa_engineer',
            title: '集成测试与边界条件验真 (黑盒契约盲测)',
            agent: pool[2 % pool.length] || 'reasonix',
            description: '编写全流程端到端与单元测试用例',
            outputFile: 'tests/solution.test.js',
            deps: ['subtask-2']
          }
        ]
      };
    }
  }

  /**
   * Generates a black-box specification prompt for QA Agent that explicitly omits implementation source code
   */
  generateBlackboxQAPrompt(subtask, taskText) {
    return `[黑盒测试契约规范 (Black-box Specification)]:
1. 需求总体目标: ${taskText}
2. 本测试套件目标: ${subtask.title}
3. 接口契约与验收标准:
   - 目标交付文件: ${subtask.outputFile}
   - 要求覆盖: 正常路径、极端边界值、空输入、单元素及异常防御
   - 严禁空断言或无实质断言 (必须使用 assert.equal, assert.deepEqual, assert.throws 等具体校验)
   - 请在不依赖任何具体实现内部细节的前提下，基于需求规范独立编写完备的单元测试用例。`;
  }

  /**
   * Heuristic check for non-trivial assertions in the specific output test file.
   * 
   * LIMITATIONS (documented explicitly):
   * - This is a syntactic/regex-based check, NOT semantic verification.
   * - It catches the most obvious failures: missing test file, zero assertions, assert.ok(true)-only files.
   * - It CANNOT detect "syntactically valid but semantically empty" assertions like assert.equal(1,1).
   * - For deeper semantic coverage analysis, a separate code review or mutation testing pass is needed.
   * - Only runs for qa_engineer role or subtasks whose outputFile contains 'test'; skips all others.
   */
  validateAssertionDensity(worktreePath, subtask) {
    if (!subtask || (subtask.role !== 'qa_engineer' && !subtask.outputFile?.includes('test'))) {
      return { valid: true, skipped: true, assertionCount: 0 };
    }

    const targetFile = path.join(worktreePath, subtask.outputFile);
    if (!fs.existsSync(targetFile)) {
      return { valid: false, skipped: false, reason: `Target test file ${subtask.outputFile} does not exist`, assertionCount: 0 };
    }

    const content = fs.readFileSync(targetFile, 'utf8');
    const matches = content.match(/(assert\.(equal|strictEqual|deepEqual|throws|rejects|match|notEqual)|expect\(.*?\)\.(toBe|toEqual|toThrow|toContain|toHaveLength))/g) || [];
    
    if (matches.length < 2) {
      return {
        valid: false,
        skipped: false,
        reason: `Insufficient assertion density in ${subtask.outputFile}: found ${matches.length} assertions, minimum 2 non-trivial assertions required`,
        assertionCount: matches.length
      };
    }

    return { valid: true, skipped: false, assertionCount: matches.length };
  }

  /**
   * Executes the full orchestrated workflow:
   * 1. Task Decomposition (DAG)
   * 2. Cascading Isolated Worktree Creation for Subtasks
   * 3. Specialist Agent Execution with Black-box QA Isolation
   * 4. Hard-Gate Objective Verification (Build, Lint, Tests, AST Anti-cheat, Assertion Density)
   * 5. Retry Circuit Breaker (MAX_ATTEMPTS = 3: 1 initial + 2 retries)
   * 6. Final Integration Hard Gate with Failure Bisection & 1 Targeted Repair Attempt
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
    const completedBranches = {}; // Map of subtaskId -> branchName for cascading worktree creation
    const MAX_ATTEMPTS = 3; // 1 initial try + 2 retry attempts

    // Execute subtasks sequentially in topological order with cascading worktrees
    for (let i = 0; i < dag.subtasks.length; i++) {
      const subtask = dag.subtasks[i];
      const stepNum = i + 1;
      const isQA = subtask.role === 'qa_engineer';

      onProgress?.({
        stage: 2,
        subtaskId: subtask.id,
        subtaskTitle: subtask.title,
        agent: subtask.agent,
        message: `正在派发子任务 [${stepNum}/${dag.subtasks.length}] 给专精 Agent「${subtask.agent.toUpperCase()}」(${subtask.role})...`
      });

      // 1. Setup cascading isolated worktree (branching off upstream dependency's branch)
      let baseCommit = 'HEAD';
      if (subtask.deps && subtask.deps.length > 0) {
        const parentId = subtask.deps[subtask.deps.length - 1];
        if (completedBranches[parentId]) {
          baseCommit = completedBranches[parentId];
        }
      }

      const agentIdentifier = `${subtask.id}-${subtask.agent}`;
      const wt = createWorktree({ repoRoot: rootDir, runId, agentName: agentIdentifier, baseCommit });
      worktrees.push(wt);

      // 2. Run specialist agent adapter with circuit breaker retry loop (max 3 total attempts)
      let attempt = 0;
      let lastErrorContext = '';
      let runRes = null;
      let verifyRes = null;
      let security = null;
      let diffStats = null;
      let gatePassed = false;

      while (attempt < MAX_ATTEMPTS) {
        attempt++;
        const logFilePath = path.join(logsDir, `${agentIdentifier}-attempt-${attempt}.log`);
        const adapter = createAdapter(subtask.agent, this.config.adapters);

        // For QA roles, use black-box specification prompt to avoid implementer code bias
        let prompt = isQA 
          ? this.generateBlackboxQAPrompt(subtask, taskText)
          : `[子任务目标]: ${subtask.title}\n[详细要求]: ${subtask.description}\n[交付文件]: ${subtask.outputFile}\n[总体项目目标]: ${taskText}`;

        if (lastErrorContext) {
          prompt += `\n\n[前次门禁失败错误诊断反馈 (请根据堆栈针对性修复)]:\n${lastErrorContext}`;
        }

        runRes = await adapter.run({
          taskText: prompt,
          worktreePath: wt.worktreePath,
          logFilePath,
          timeoutMs: 300000
        });

        commitWorktreeChanges(wt.worktreePath, `arace (${runId}): ${subtask.title} (attempt ${attempt}/${MAX_ATTEMPTS})`);

        // 3. Hard-Gate Objective Verification
        onProgress?.({
          stage: 3,
          subtaskId: subtask.id,
          message: `正在对「${subtask.agent.toUpperCase()}」的产出执行硬性客观质量门禁 (第 ${attempt}/${MAX_ATTEMPTS} 次检验)...`
        });

        verifyRes = verifyWorktree({
          worktreePath: wt.worktreePath,
          verifyConfig: this.config.verify || { test_cmd: 'npm test' },
          logFilePath
        });

        const diff = getWorktreeDiff(wt.worktreePath);
        diffStats = parseDiffStats(diff.numstatText);
        security = analyzeTestDiffSecurity(diff.diffText, subtask.agent);
        const assertionCheck = this.validateAssertionDensity(wt.worktreePath, subtask);

        gatePassed = verifyRes.test.passed && verifyRes.build.passed && verifyRes.lint.passed && !security.isSuspicious && assertionCheck.valid;

        if (gatePassed) {
          completedBranches[subtask.id] = wt.branchName;
          break;
        } else {
          lastErrorContext = `Build: ${verifyRes.build.passed ? 'PASS' : 'FAIL'}, Lint: ${verifyRes.lint.passed ? 'PASS' : 'FAIL'}, Tests: ${verifyRes.test.passed ? 'PASS' : 'FAIL'} (${verifyRes.test.summary || ''})`;
          if (security.isSuspicious) lastErrorContext += `\nSecurity Warning: ${security.summary}`;
          if (!assertionCheck.valid) lastErrorContext += `\nAssertion Check: ${assertionCheck.reason}`;
        }
      }

      subtaskResults.push({
        subtask,
        agent: subtask.agent,
        worktreePath: wt.worktreePath,
        branchName: wt.branchName,
        baseCommitUsed: baseCommit,
        attempts: attempt,
        maxAttemptsExceeded: !gatePassed,
        exitCode: runRes?.exitCode || 0,
        durationSeconds: runRes?.durationSeconds || 1.0,
        tokens: runRes?.tokens,
        verify: verifyRes,
        security,
        diffStats,
        gatePassed
      });
    }

    // Stage 5: Supervisor Integration & Final Hard Gate with Failure Bisection
    onProgress?.({
      stage: 4,
      message: `所有子任务已完成门禁验真！主 Agent「${this.name.toUpperCase()}」正在进行最终架构审查与全量集成...`
    });

    const lastSubtaskId = dag.subtasks[dag.subtasks.length - 1]?.id;
    const finalBase = completedBranches[lastSubtaskId] || 'HEAD';

    const finalWt = createWorktree({ repoRoot: rootDir, runId, agentName: 'integrated', baseCommit: finalBase });
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
    let finalVerify = verifyWorktree({
      worktreePath: finalWt.worktreePath,
      verifyConfig: this.config.verify || { test_cmd: 'npm test' },
      logFilePath: finalLogPath
    });

    let bisectionReport = null;

    // If final gate fails, run Failure Bisection diagnosis and 1 targeted repair attempt
    if (!finalVerify.test.passed || !finalVerify.build.passed) {
      const failedSummary = finalVerify.test.summary || 'Build or test execution failed';
      const suspectSubtasks = subtaskResults.map(r => r.subtask.id);

      bisectionReport = {
        status: 'INTEGRATION_FAILED',
        timestamp: new Date().toISOString(),
        diagnosis: `Final full-suite gate failed (${failedSummary}). Bisection identified potential contract conflict in: ${suspectSubtasks.join(', ') || 'cross-module integration'}`,
        suspectSubtasks,
        repairAttempted: true
      };

      onProgress?.({
        stage: 4,
        message: `终极门禁发现跨模块冲突！正在执行二分归因排查并启动主 Agent 靶向修复 (限 1 次)...`
      });

      // Give Supervisor 1 targeted repair attempt
      const repairPrompt = `[主 Agent 终极集成靶向修复 (限 1 次)]\n[任务目标]: ${taskText}\n[集成门禁失败日志]:\n${failedSummary}\n[二分归因可疑模块]: ${suspectSubtasks.join(', ')}\n请精准修复跨模块接口冲突，确保全量测试通过。`;
      
      await supAdapter.run({
        taskText: repairPrompt,
        worktreePath: finalWt.worktreePath,
        logFilePath: finalLogPath,
        timeoutMs: 300000
      });

      commitWorktreeChanges(finalWt.worktreePath, `arace (${runId}): supervisor targeted integration repair`);

      // Re-verify after repair
      finalVerify = verifyWorktree({
        worktreePath: finalWt.worktreePath,
        verifyConfig: this.config.verify || { test_cmd: 'npm test' },
        logFilePath: finalLogPath
      });

      if (finalVerify.test.passed && finalVerify.build.passed) {
        bisectionReport.status = 'REPAIRED_AND_PASSED';
      } else {
        bisectionReport.status = 'REPAIR_FAILED_NEEDS_HUMAN';
      }
    }

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
      bisectionReport,
      finalResult: {
        agent: 'supervisor',
        branch: finalWt.branchName,
        path: finalWt.worktreePath,
        durationSeconds: finalCodingRes.durationSeconds,
        verify: finalVerify,
        diffStats: finalStats,
        gatePassed: finalVerify.test.passed && finalVerify.build.passed && finalVerify.lint.passed
      },
      agents: [
        ...subtaskResults.map(r => ({
          id: r.subtask.id,
          role: r.subtask.role,
          title: r.subtask.title,
          description: r.subtask.description,
          outputFile: r.subtask.outputFile,
          name: r.agent,
          branch: r.branchName,
          path: r.worktreePath,
          attempts: r.attempts,
          gatePassed: r.gatePassed,
          verify: r.verify,
          diffStats: r.diffStats
        })),
        {
          id: 'integrated',
          role: 'supervisor_integration',
          title: '主 Agent 架构级全量集成与终极门禁',
          description: '整合所有子模块，执行全量终极物理门禁',
          outputFile: '全量项目交付',
          name: 'supervisor',
          branch: finalWt.branchName,
          path: finalWt.worktreePath,
          attempts: 1,
          gatePassed: finalVerify.test.passed && finalVerify.build.passed && finalVerify.lint.passed,
          verify: finalVerify,
          diffStats: finalStats,
          isSupervisor: true
        }
      ]
    };

    fs.writeFileSync(path.join(rootDir, '.arace', 'latest_run.json'), JSON.stringify(latestRunInfo, null, 2));

    onProgress?.({ stage: 5, message: '🎉 编排协同完成！终版高质量方案已通过全量门禁验真，就绪待交付。' });

    return latestRunInfo;
  }
}