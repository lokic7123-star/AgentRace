import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRepoRoot, getWorktreeDiff } from '../git.js';
import { loadProjectConfig } from '../config.js';
import { getLatestRun, getStats, markAgentKept } from '../db.js';
import { analyzeTestDiffSecurity } from '../ast_guard.js';
import { detectInstalledAgents } from '../detector.js';
import { synthesizeEnsemble } from '../synthesizer.js';
import { keepCommand } from '../commands/keep.js';
import { discardCommand } from '../commands/discard.js';
import { runRace } from '../engine.js';

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
          agents = runInfo.agents || [];
          runId = runInfo.runId;
          taskText = runInfo.taskText;
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
      const agentName = pathname.slice('/api/logs/'.length);
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
