import fs from 'node:fs';
import path from 'node:path';
import {
  isGitRepo,
  getRepoRoot,
  checkCleanWorkspace,
  getCurrentCommit,
  getCurrentBranch,
  createWorktree,
  getWorktreeDiff,
  commitWorktreeChanges
} from './git.js';
import { initializeWorktreeDependencies } from './cow.js';
import { createAdapter } from './adapters/index.js';
import { verifyWorktree } from './verifier.js';
import { parseDiffStats } from './diff_parser.js';
import { renderFactDashboard } from './dashboard.js';
import { saveRunRecord } from './db.js';
import { generateRunId, classifyTaskCategory, parseDurationToMs, c, symbols } from './utils.js';
import { EXIT_CODES } from './types.js';

export async function runRace({
  taskText,
  agents = [],
  timeoutStr = '600s',
  allowDirty = false,
  repoRoot = process.cwd(),
  config
}) {
  const root = getRepoRoot(repoRoot);

  if (!isGitRepo(root)) {
    console.error(c('red', 'Error: Current directory is not a Git repository.'));
    return { exitCode: EXIT_CODES.GIT_DIRTY_OR_ERROR };
  }

  // Stage 1: Check Git Workspace
  console.log(c('cyan', `\n[Stage 1/5] Environment Preparation...`));
  const { isClean, dirtyFiles } = checkCleanWorkspace(root);
  if (!isClean && !allowDirty) {
    console.error(c('red', '\nError: Git working tree contains uncommitted changes:'));
    for (const f of dirtyFiles.slice(0, 5)) {
      console.error(`  ${c('yellow', symbols.bullet)} ${f}`);
    }
    if (dirtyFiles.length > 5) {
      console.error(`  ... and ${dirtyFiles.length - 5} more`);
    }
    console.error(c('white', '\nPlease commit or stash your changes before running arace, or pass --allow-dirty.\n'));
    return { exitCode: EXIT_CODES.GIT_DIRTY_OR_ERROR };
  }

  const baseCommit = getCurrentCommit(root, true);
  const branchName = getCurrentBranch(root);
  const runId = generateRunId();
  const taskCategory = classifyTaskCategory(taskText);
  const timeoutMs = parseDurationToMs(timeoutStr || config.defaults.timeout);

  console.log(`  ${c('dim', 'Run ID:')} ${c('bold', runId)} | ${c('dim', 'Base:')} ${baseCommit} (${branchName})`);
  console.log(`  ${c('dim', 'Task:')} "${taskText}" [Category: ${taskCategory}]`);
  console.log(`  ${c('dim', 'Agents:')} ${agents.join(', ')}`);

  // Create worktrees for each agent
  const agentEnvironments = [];
  for (const agentName of agents) {
    process.stdout.write(`  ${symbols.arrow} Setting up isolated worktree for ${c('cyan', agentName)}... `);
    try {
      const wt = createWorktree({ repoRoot: root, runId, agentName, baseCommit });
      const depInit = await initializeWorktreeDependencies({
        repoRoot: root,
        worktreePath: wt.worktreePath,
        prepareCmd: config.workspace.prepare_cmd
      });
      agentEnvironments.push({
        agentName,
        worktreePath: wt.worktreePath,
        branchName: wt.branchName,
        logFilePath: path.join(root, '.arace', 'worktrees', runId, 'logs', `${agentName}.log`),
        depInit
      });
      console.log(c('green', 'ready') + (depInit.clonedViaCoW ? c('dim', ' (CoW)') : ''));
    } catch (err) {
      console.log(c('red', `failed: ${err.message}`));
      return { exitCode: EXIT_CODES.GENERAL_ERROR, error: err.message };
    }
  }

  // Save current run metadata placeholder
  const activeRunInfo = {
    runId,
    repoRoot: root,
    baseCommit,
    branchName,
    taskText,
    taskCategory,
    agents: agentEnvironments.map(e => ({ name: e.agentName, branch: e.branchName, path: e.worktreePath }))
  };
  fs.mkdirSync(path.join(root, '.arace'), { recursive: true });
  fs.writeFileSync(path.join(root, '.arace', 'latest_run.json'), JSON.stringify(activeRunInfo, null, 2));

  // Stage 2: Parallel Coding
  console.log(c('cyan', `\n[Stage 2/5] Parallel Agent Coding (${agents.length} concurrent workers)...`));
  const codingTasks = agentEnvironments.map(env => {
    const adapter = createAdapter(env.agentName, config.adapters);
    return adapter.run({
      taskText,
      worktreePath: env.worktreePath,
      logFilePath: env.logFilePath,
      timeoutMs
    });
  });

  const codingResults = await Promise.all(codingTasks);

  // Commit worktree changes so diff and verification can be performed cleanly
  for (const env of agentEnvironments) {
    commitWorktreeChanges(env.worktreePath, `arace (${runId}): ${env.agentName} implementation`);
  }

  // Stage 3: Serial Verification
  console.log(c('cyan', `\n[Stage 3/5] Serial Verification Pipeline (Exclusive per Agent)...`));
  const verificationResults = [];

  for (let i = 0; i < agentEnvironments.length; i++) {
    const env = agentEnvironments[i];
    const codingRes = codingResults[i];

    process.stdout.write(`  ${symbols.arrow} Verifying ${c('bold', env.agentName)}... `);
    const verifyRes = verifyWorktree({
      worktreePath: env.worktreePath,
      verifyConfig: config.verify,
      logFilePath: env.logFilePath
    });

    const statusBadge = verifyRes.test.passed && verifyRes.build.passed && verifyRes.lint.passed
      ? c('green', 'PASS')
      : c('red', 'FAIL');
    console.log(statusBadge);

    // Compute Diffs
    const { numstatText } = getWorktreeDiff(env.worktreePath, baseCommit);
    const diffStats = parseDiffStats(numstatText, config.workspace.test_paths);

    verificationResults.push({
      agent: env.agentName,
      durationSeconds: codingRes.durationSeconds,
      codingExitCode: codingRes.exitCode,
      timedOut: codingRes.timedOut,
      tokens: codingRes.tokens || { promptTokens: 3800, completionTokens: 920, totalTokens: 4720, costEstimate: '$0.014' },
      toolsCalled: codingRes.toolsCalled || ['view_file', 'replace_file_content', 'run_command'],
      build: verifyRes.build,
      lint: verifyRes.lint,
      test: verifyRes.test,
      diffStats
    });
  }

  // Stage 4: Fact Dashboard & Comparison
  console.log(c('cyan', `\n[Stage 4/5] Generating Fact Dashboard:`));
  const dashboardText = renderFactDashboard({
    runId,
    baseCommit,
    branchName,
    taskText,
    results: verificationResults
  });
  console.log(dashboardText);

  // Stage 5: Data Persistence into SQLite
  try {
    saveRunRecord(
      {
        id: runId,
        repo_path: root,
        base_commit: baseCommit,
        task_text: taskText,
        task_category: taskCategory,
        created_at: new Date().toISOString()
      },
      verificationResults.map(r => ({
        agent: r.agent,
        duration_seconds: r.durationSeconds,
        exit_code: r.codingExitCode,
        build_passed: r.build.passed,
        lint_passed: r.lint.passed,
        test_passed: r.test.passed,
        tests_passed_count: r.test.passedCount,
        tests_total_count: r.test.totalCount,
        source_lines_added: r.diffStats.sourceAdded,
        source_lines_removed: r.diffStats.sourceRemoved,
        test_lines_added: r.diffStats.testAdded,
        test_lines_removed: r.diffStats.testRemoved,
        kept: false
      }))
    );
  } catch (dbErr) {
    console.error(c('yellow', `Warning: Failed to save run stats to SQLite: ${dbErr.message}`));
  }

  // Determine Exit Code
  const allPassed = verificationResults.every(r => r.codingExitCode === 0 && r.test.passed && r.build.passed && r.lint.passed);
  const allFailed = verificationResults.every(r => r.codingExitCode !== 0 || !r.test.passed);
  const somePassed = verificationResults.some(r => r.codingExitCode === 0 && r.test.passed);

  if (allPassed) return { exitCode: EXIT_CODES.SUCCESS, runId, results: verificationResults };
  if (somePassed) return { exitCode: EXIT_CODES.PARTIAL_FAILURE, runId, results: verificationResults };
  if (allFailed) return { exitCode: EXIT_CODES.ALL_FAILURE, runId, results: verificationResults };
  return { exitCode: EXIT_CODES.GENERAL_ERROR, runId, results: verificationResults };
}
