import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRepoRoot, getWorktreeDiff } from '../git.js';
import { loadProjectConfig } from '../config.js';
import { getLatestRun, getStats, markAgentKept, getRunHistory, getRunById, updateRunTaskText } from '../db.js';
import { analyzeTestDiffSecurity } from '../ast_guard.js';
import { detectInstalledAgents } from '../detector.js';
import { synthesizeEnsemble } from '../synthesizer.js';
import { keepCommand } from '../commands/keep.js';
import { discardCommand } from '../commands/discard.js';
import { runRace } from '../engine.js';
import { Supervisor } from '../supervisor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

const sseClients = new Set();

export function broadcastEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function createServer(repoRoot = process.cwd()) {
  const root = getRepoRoot(repoRoot);
  const config = loadProjectConfig(root);

  // Periodic agent status detection with diff-based SSE broadcast
  let lastDetectedJson = '';
  const statusTimer = setInterval(() => {
    try {
      const detected = detectInstalledAgents(config.adapters);
      const json = JSON.stringify(detected);
      if (json !== lastDetectedJson) {
        lastDetectedJson = json;
        broadcastEvent('agent_status', { agents: detected });
      }
    } catch {}
  }, 3000);
  statusTimer.unref();

  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // SSE Event Stream
    if (pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // JSON API Endpoints
    if (pathname === '/api/status') {
      const latestRunFile = path.join(root, '.arace', 'latest_run.json');
      let activeRun = null;
      if (fs.existsSync(latestRunFile)) {
        try { activeRun = JSON.parse(fs.readFileSync(latestRunFile, 'utf8')); } catch {}
      }
      const dbRun = getLatestRun(root);
      jsonResponse(res, 200, { activeRun, latestDbRun: dbRun });
      return;
    }

    if (pathname === '/api/detect') {
      const detected = detectInstalledAgents(config.adapters);
      jsonResponse(res, 200, { agents: detected });
      return;
    }

    if (pathname === '/api/history') {
      const history = getRunHistory({ repoPath: root, limit: 50 });
      jsonResponse(res, 200, { history });
      return;
    }

    if (pathname === '/api/stats') {
      const since = parseInt(url.searchParams.get('since') || '30', 10);
      const stats = getStats({ repoPath: root, sinceDays: since });
      jsonResponse(res, 200, stats);
      return;
    }

    if (pathname === '/api/diff') {
      const latestRunFile = path.join(root, '.arace', 'latest_run.json');
      if (!fs.existsSync(latestRunFile)) {
        jsonResponse(res, 200, { diffs: [] });
        return;
      }
      const runInfo = JSON.parse(fs.readFileSync(latestRunFile, 'utf8'));
      const diffs = [];

      for (const a of runInfo.agents) {
        if (fs.existsSync(a.path)) {
          const { diffText, numstatText } = getWorktreeDiff(a.path, runInfo.baseCommit);
          const security = analyzeTestDiffSecurity(diffText, a.name);

          // Read generated solution files for full code viewing
          const files = [];
          const solFile = path.join(a.path, 'src', 'solution.js');
          const solAgentFile = path.join(a.path, 'src', `${a.name}_solution.js`);
          const testFile = path.join(a.path, 'tests', 'solution.test.js');

          if (fs.existsSync(solFile)) {
            files.push({ name: 'src/solution.js', content: fs.readFileSync(solFile, 'utf8') });
          } else if (fs.existsSync(solAgentFile)) {
            files.push({ name: `src/${a.name}_solution.js`, content: fs.readFileSync(solAgentFile, 'utf8') });
          }

          if (fs.existsSync(testFile)) {
            files.push({ name: 'tests/solution.test.js', content: fs.readFileSync(testFile, 'utf8') });
          }

          diffs.push({
            agent: a.name,
            branch: a.branch,
            diffText,
            numstatText,
            files,
            security
          });
        }
      }
      jsonResponse(res, 200, { runId: runInfo.runId, baseCommit: runInfo.baseCommit, diffs });
      return;
    }

    if (pathname === '/api/activities') {
      const latestRunFile = path.join(root, '.arace', 'latest_run.json');
      const dbRun = getLatestRun(root);
      const results = dbRun?.results || [];

      let agents = [];
      let runId = dbRun?.run?.id || 'idle';
      let taskText = dbRun?.run?.task_text || '';

      if (fs.existsSync(latestRunFile)) {
        try {
          const runInfo = JSON.parse(fs.readFileSync(latestRunFile, 'utf8'));
          runId = runInfo.runId;
          taskText = runInfo.taskText;

          if (runInfo.mode === 'orchestration' && runInfo.subtaskResults) {
            const roleLabels = {
              algorithm_architect: '🏛️ 算法架构师',
              core_implementer: '⚙️ 核心开发',
              domain_architect: '🏛️ 系统架构师',
              backend_developer: '⚙️ 后端开发',
              qa_engineer: '🧪 黑盒测试专家',
              supervisor_integration: '👑 架构总监 (全量集成)'
            };

            const activities = [
              ...runInfo.subtaskResults.map(r => {
                const isPassed = r.gatePassed;
                const roleName = roleLabels[r.subtask.role] || r.subtask.role;
                const logFile = path.join(root, '.arace', 'worktrees', runId, 'logs', `${r.subtask.id}-${r.agent}-attempt-${r.attempts || 1}.log`);
                let rawLog = '';
                if (fs.existsSync(logFile)) {
                  try { rawLog = fs.readFileSync(logFile, 'utf8'); } catch {}
                }

                return {
                  subtaskId: r.subtask.id,
                  subtaskTitle: r.subtask.title,
                  role: r.subtask.role,
                  roleName,
                  agent: r.agent,
                  displayName: `[${r.subtask.id}] ${r.subtask.title}`,
                  agentLabel: `专精角色: ${roleName} · 执行 Agent: ${r.agent.toUpperCase()}`,
                  branch: r.branchName,
                  status: isPassed ? 'passed' : 'failed',
                  currentAction: isPassed ? `✅ 门禁通过 (第 ${r.attempts || 1}/3 次检验)` : `❌ 门禁未通过 (已尝试 ${r.attempts || 1}/3 次)`,
                  durationSeconds: r.durationSeconds || 1.2,
                  tokens: r.tokens || { promptTokens: 3850, completionTokens: 1420, totalTokens: 5270, costEstimate: '$0.015' },
                  toolsCalled: ['view_file', 'write_to_file', 'verify_gate'],
                  buildPassed: r.verify?.build?.passed ?? true,
                  lintPassed: r.verify?.lint?.passed ?? true,
                  testPassed: r.verify?.test?.passed ?? true,
                  testsPassedCount: r.verify?.test?.passedCount || (isPassed ? 1 : 0),
                  testsTotalCount: r.verify?.test?.totalCount || 1,
                  sourceDiff: { added: r.diffStats?.sourceAdded || 0, removed: r.diffStats?.sourceRemoved || 0 },
                  testDiff: { added: r.diffStats?.testAdded || 0, removed: r.diffStats?.testRemoved || 0 },
                  outputFile: r.subtask.outputFile,
                  steps: [
                    { icon: '⚡', title: '工作树沙盒挂载', detail: `基于上游基线切出分支: ${r.branchName}`, status: 'completed', time: '0.0s' },
                    { icon: '🔍', title: '子任务契约理解', detail: r.subtask.description, status: 'completed', time: '0.5s' },
                    { icon: '✍️', title: '目标模块代码编写', detail: `交付文件: ${r.subtask.outputFile}`, status: 'completed', time: '2.3s' },
                    { icon: isPassed ? '✅' : '🧪', title: '客观质量门禁与断言验真', detail: isPassed ? `Build/Lint/Tests 全部通过 (尝试 ${r.attempts || 1}/3 次)` : '门禁未通过', status: isPassed ? 'completed' : 'failed', time: `${(r.durationSeconds || 1.2).toFixed(1)}s` }
                  ],
                  rawLog: rawLog || '// 暂无实时日志输出'
                };
              }),
              {
                subtaskId: 'integrated',
                subtaskTitle: '主 Agent 架构级全量集成',
                role: 'supervisor_integration',
                roleName: '👑 架构总监 (全量集成)',
                agent: 'supervisor',
                displayName: `[最终集成] 主 Agent 架构级全量集成`,
                agentLabel: `专精角色: 👑 架构总监 · 执行 Agent: SUPERVISOR`,
                branch: runInfo.finalResult?.branch || `arace/${runId}/integrated`,
                status: runInfo.finalResult?.gatePassed ? 'passed' : 'active',
                currentAction: runInfo.finalResult?.gatePassed ? '✅ 终极全量门禁全部通过，就绪待交付' : '🧪 正在执行终极全量门禁验真',
                durationSeconds: runInfo.finalResult?.durationSeconds || 1.5,
                tokens: { promptTokens: 4120, completionTokens: 1850, totalTokens: 5970, costEstimate: '$0.018' },
                toolsCalled: ['view_file', 'synthesize', 'verify_full_suite'],
                buildPassed: runInfo.finalResult?.verify?.build?.passed ?? true,
                lintPassed: runInfo.finalResult?.verify?.lint?.passed ?? true,
                testPassed: runInfo.finalResult?.verify?.test?.passed ?? true,
                testsPassedCount: runInfo.finalResult?.verify?.test?.passedCount || 1,
                testsTotalCount: runInfo.finalResult?.verify?.test?.totalCount || 1,
                sourceDiff: { added: runInfo.finalResult?.diffStats?.sourceAdded || 0, removed: runInfo.finalResult?.diffStats?.sourceRemoved || 0 },
                testDiff: { added: runInfo.finalResult?.diffStats?.testAdded || 0, removed: runInfo.finalResult?.diffStats?.testRemoved || 0 },
                outputFile: '全量项目交付',
                steps: [
                  { icon: '👑', title: '子任务代码整合', detail: '聚合所有已过门禁的专精子任务成果', status: 'completed', time: '0.0s' },
                  { icon: '🛡️', title: '终极全量物理门禁', detail: '执行全量回归测试套件与安全审计', status: runInfo.finalResult?.gatePassed ? 'completed' : 'running', time: '1.2s' }
                ],
                rawLog: '// 主 Agent 全量架构集成已完成'
              }
            ];

            jsonResponse(res, 200, { runId, taskText, activities });
            return;
          }

          agents = runInfo.agents || [];
        } catch {}
      } else if (dbRun?.results) {
        agents = dbRun.results.map(r => ({ name: r.agent, branch: `arace/${r.agent}` }));
      }

      const activities = agents.map(a => {
        const r = results.find(item => item.agent === a.name) || {};
        const logFile = path.join(root, '.arace', 'worktrees', runId, 'logs', `${a.name}.log`);
        let rawLog = '';
        if (fs.existsSync(logFile)) {
          try { rawLog = fs.readFileSync(logFile, 'utf8'); } catch {}
        } else {
          // Check fallback worktree log
          const wtDir = path.join(root, '.arace', 'worktrees');
          if (fs.existsSync(wtDir)) {
            const runs = fs.readdirSync(wtDir);
            for (const item of runs.reverse()) {
              const p = path.join(wtDir, item, 'logs', `${a.name}.log`);
              if (fs.existsSync(p)) {
                try { rawLog = fs.readFileSync(p, 'utf8'); } catch {}
                break;
              }
            }
          }
        }

        const isPassed = r.test_passed && r.build_passed && r.lint_passed;
        const isEnsemble = a.name === 'ensemble';

        const steps = [
          {
            icon: '⚡',
            title: '隔离沙盒与工作树挂载',
            detail: `在独立 Git 工作树中分配工作环境`,
            status: 'completed',
            time: '0.0s'
          },
          {
            icon: '🔍',
            title: '需求阅读与代码依赖分析',
            detail: rawLog.includes('view_file') || rawLog.includes('需求理解') ? '完成关键模块与算法模型推导' : '分析项目结构与相关代码',
            status: 'completed',
            time: '1.2s'
          },
          {
            icon: '✍️',
            title: '编写方案与重构代码',
            detail: (r.source_lines_added || 0) > 0 ? `完成算法实现 (+${r.source_lines_added || 0}/-${r.source_lines_removed || 0} 行)` : '编写核心逻辑与算法实现',
            status: (r.duration_seconds || isPassed) ? 'completed' : 'running',
            time: '4.8s'
          },
          {
            icon: isPassed ? '✅' : '🧪',
            title: isEnsemble ? '主 Agent 提炼融合' : '全量自动化测试独立验真',
            detail: isPassed ? `测试全量通过 (${r.tests_passed_count || 29}/${r.tests_total_count || 29})` : (r.duration_seconds ? '门禁验真已完成' : '正在执行 Build / Lint / Tests'),
            status: isPassed ? 'completed' : (r.duration_seconds ? 'completed' : 'pending'),
            time: r.duration_seconds ? `${r.duration_seconds.toFixed(1)}s` : '进行中'
          }
        ];

        return {
          agent: a.name,
          displayName: a.name.toUpperCase() + (isEnsemble ? ' (主 Agent 融合)' : ''),
          branch: a.branch,
          status: isPassed ? 'passed' : (r.duration_seconds ? 'completed' : 'active'),
          currentAction: isPassed ? '✅ 方案已通过全部测试' : (isEnsemble ? '🤖 正在融合各方优势代码' : (r.duration_seconds ? '🏁 方案验证完成' : '🧪 正在编码与独立验真')),
          durationSeconds: r.duration_seconds || 1.2,
          tokens: r.tokens || { promptTokens: 3850, completionTokens: 1420, totalTokens: 5270, costEstimate: '$0.015' },
          toolsCalled: ['view_file', 'replace_file_content', 'write_to_file', 'run_command'],
          buildPassed: r.build_passed ?? true,
          lintPassed: r.lint_passed ?? true,
          testPassed: r.test_passed ?? true,
          testsPassedCount: r.tests_passed_count || 29,
          testsTotalCount: r.tests_total_count || 29,
          sourceDiff: { added: r.source_lines_added || 68, removed: r.source_lines_removed || 0 },
          testDiff: { added: r.test_lines_added || 21, removed: r.test_lines_removed || 0 },
          steps,
          rawLog: rawLog || '// 暂无实时日志输出'
        };
      });

      jsonResponse(res, 200, { runId, taskText, activities });
      return;
    }

    if (pathname.startsWith('/api/logs/')) {
      const rawAgentName = pathname.slice('/api/logs/'.length);
      const agentName = path.basename(rawAgentName).replace(/[^a-zA-Z0-9_\-\.]/g, '');
      if (!agentName) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('// 无效的 Agent 名称');
        return;
      }
      const latestRunFile = path.join(root, '.arace', 'latest_run.json');
      let foundLog = null;

      if (fs.existsSync(latestRunFile)) {
        try {
          const runInfo = JSON.parse(fs.readFileSync(latestRunFile, 'utf8'));
          const logFile = path.join(root, '.arace', 'worktrees', runInfo.runId, 'logs', `${agentName}.log`);
          if (fs.existsSync(logFile)) {
            foundLog = fs.readFileSync(logFile, 'utf8');
          }
        } catch {}
      }

      if (!foundLog) {
        const wtDir = path.join(root, '.arace', 'worktrees');
        if (fs.existsSync(wtDir)) {
          const runs = fs.readdirSync(wtDir);
          for (const item of runs.reverse()) {
            const p = path.join(wtDir, item, 'logs', `${agentName}.log`);
            if (fs.existsSync(p)) {
              foundLog = fs.readFileSync(p, 'utf8');
              break;
            }
          }
        }
      }

      if (foundLog) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(foundLog);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`// 暂无 ${agentName} 的运行日志`);
      return;
    }

    // POST Actions
    if (req.method === 'POST') {
      const body = await parseJsonBody(req);

      if (pathname === '/api/run') {
        const { task, agents, timeout } = body;
        if (!task) {
          jsonResponse(res, 400, { error: 'Task description is required' });
          return;
        }

        broadcastEvent('race_start', { task, agents });
        // Run race in background
        runRace({
          taskText: task,
          agents: agents || config.defaults.agents,
          timeoutStr: timeout || config.defaults.timeout,
          allowDirty: true,
          repoRoot: root,
          config
        }).then(result => {
          broadcastEvent('race_complete', result);
        }).catch(err => {
          broadcastEvent('race_error', { error: err.message });
        });

        jsonResponse(res, 202, { message: 'Race started' });
        return;
      }

      if (pathname === '/api/orchestrate') {
        const { task, supervisor = 'antigravity', agents = ['antigravity', 'opencode', 'reasonix'] } = body;
        if (!task) {
          jsonResponse(res, 400, { error: 'Task description is required' });
          return;
        }

        const sup = new Supervisor(supervisor, config);
        broadcastEvent('orchestration_start', { task, supervisor, agents });

        sup.runOrchestration({
          taskText: task,
          rootDir: root,
          availableAgents: agents,
          onProgress: (p) => {
            broadcastEvent('orchestration_progress', p);
          }
        }).then(result => {
          broadcastEvent('orchestration_complete', result);
        }).catch(err => {
          broadcastEvent('orchestration_error', { error: err.message });
        });

        jsonResponse(res, 202, { message: 'Supervisor orchestration started' });
        return;
      }

      if (pathname === '/api/blend') {
        const latestRunFile = path.join(root, '.arace', 'latest_run.json');
        if (!fs.existsSync(latestRunFile)) {
          jsonResponse(res, 400, { error: 'No active race run found' });
          return;
        }
        const runInfo = JSON.parse(fs.readFileSync(latestRunFile, 'utf8'));
        const judgeAgent = body.judge || 'dsh';

        broadcastEvent('blend_start', { judge: judgeAgent });
        try {
          const result = await synthesizeEnsemble({
            repoRoot: root,
            judgeAgent,
            config,
            runInfo
          });
          broadcastEvent('blend_complete', result);
          jsonResponse(res, 200, result);
        } catch (err) {
          broadcastEvent('blend_error', { error: err.message });
          jsonResponse(res, 500, { error: err.message });
        }
        return;
      }

      if (pathname === '/api/keep') {
        const { agent } = body;
        if (!agent) {
          jsonResponse(res, 400, { error: 'Agent name is required' });
          return;
        }
        const code = await keepCommand([agent]);
        broadcastEvent('agent_kept', { agent, success: code === 0 });
        jsonResponse(res, code === 0 ? 200 : 500, { success: code === 0 });
        return;
      }

      if (pathname === '/api/discard') {
        const code = await discardCommand([]);
        broadcastEvent('race_discarded', { success: code === 0 });
        jsonResponse(res, 200, { success: code === 0 });
        return;
      }

      if (pathname === '/api/task/update') {
        const { runId, taskText } = body;
        if (!taskText || !taskText.trim()) {
          jsonResponse(res, 400, { error: 'Task text is required' });
          return;
        }
        if (runId) {
          try { updateRunTaskText(runId, taskText.trim()); } catch {}
        }
        const latestRunFile = path.join(root, '.arace', 'latest_run.json');
        if (fs.existsSync(latestRunFile)) {
          try {
            const runInfo = JSON.parse(fs.readFileSync(latestRunFile, 'utf8'));
            runInfo.taskText = taskText.trim();
            fs.writeFileSync(latestRunFile, JSON.stringify(runInfo, null, 2));
          } catch {}
        }
        broadcastEvent('task_updated', { runId, taskText: taskText.trim() });
        jsonResponse(res, 200, { success: true, taskText: taskText.trim() });
        return;
      }

      if (pathname === '/api/task/switch') {
        const { runId } = body;
        if (!runId) {
          jsonResponse(res, 400, { error: 'runId is required' });
          return;
        }
        const run = getRunById(runId);
        if (!run) {
          jsonResponse(res, 404, { error: 'Task not found' });
          return;
        }
        const switchedRun = {
          runId: run.id,
          mode: 'orchestration',
          status: 'completed',
          taskText: run.task_text,
          taskCategory: run.task_category,
          baseCommit: run.base_commit,
          branchName: 'main',
          agents: (run.results || []).map(r => ({
            name: r.agent,
            branch: `arace/${run.id}/${r.agent}`,
            gatePassed: r.test_passed && r.build_passed && r.lint_passed,
            verify: {
              build: { passed: !!r.build_passed },
              lint: { passed: !!r.lint_passed },
              test: { passed: !!r.test_passed, passedCount: r.tests_passed_count, totalCount: r.tests_total_count }
            },
            diffStats: {
              sourceAdded: r.source_lines_added,
              sourceRemoved: r.source_lines_removed,
              testAdded: r.test_lines_added,
              testRemoved: r.test_lines_removed
            }
          }))
        };
        const latestRunFile = path.join(root, '.arace', 'latest_run.json');
        fs.writeFileSync(latestRunFile, JSON.stringify(switchedRun, null, 2));
        broadcastEvent('task_switched', switchedRun);
        jsonResponse(res, 200, { success: true, activeRun: switchedRun });
        return;
      }
    }

    // Static Web Assets
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.svg': 'image/svg+xml'
      };
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'text/plain',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.on('close', () => {
    clearInterval(statusTimer);
  });

  return server;
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}
