import fs from 'node:fs';
import path from 'node:path';
import {
  getRepoRoot,
  createWorktree,
  getWorktreeDiff,
  commitWorktreeChanges
} from './git.js';
import { initializeWorktreeDependencies } from './cow.js';
import { createAdapter } from './adapters/index.js';
import { verifyWorktree } from './verifier.js';
import { parseDiffStats } from './diff_parser.js';
import { c, symbols } from './utils.js';

export async function synthesizeEnsemble({
  repoRoot = process.cwd(),
  judgeAgent = 'dsh',
  config,
  runInfo
}) {
  const root = getRepoRoot(repoRoot);
  const runId = runInfo.runId;
  const taskText = runInfo.taskText;
  const baseCommit = runInfo.baseCommit;

  console.log(c('cyan', `\n[AI Ensemble Synthesis] Initializing Judge & Synthesizer: ${c('bold', judgeAgent)}...`));

  // 1. Gather all agent diffs & insights
  const agentSummaries = [];
  for (const a of runInfo.agents) {
    if (fs.existsSync(a.path)) {
      const { diffText, numstatText } = getWorktreeDiff(a.path, baseCommit);
      agentSummaries.push({
        agent: a.name,
        branch: a.branch,
        numstat: numstatText,
        diff: diffText.slice(0, 8000) // Truncate if too huge
      });
    }
  }

  if (agentSummaries.length === 0) {
    throw new Error('No agent worktrees found to synthesize.');
  }

  // 2. Create ensemble worktree
  process.stdout.write(`  ${symbols.arrow} Creating isolated ensemble worktree (${c('bold', `arace/${runId}/ensemble`)})... `);
  const ensembleWt = createWorktree({
    repoRoot: root,
    runId,
    agentName: 'ensemble',
    baseCommit
  });

  await initializeWorktreeDependencies({
    repoRoot: root,
    worktreePath: ensembleWt.worktreePath,
    prepareCmd: config.workspace.prepare_cmd
  });
  console.log(c('green', 'ready'));

  // 3. Compose synthesis prompt
  let synthesisPrompt = `Task: "${taskText}"\n\n`;
  synthesisPrompt += `You are the Synthesizer in AgentRace. Multiple AI agents proposed solutions:\n\n`;

  for (const s of agentSummaries) {
    synthesisPrompt += `=== AGENT: ${s.agent} ===\n`;
    synthesisPrompt += `Files changed:\n${s.numstat}\n`;
    synthesisPrompt += `Diff snippet:\n${s.diff}\n\n`;
  }

  synthesisPrompt += `Goal:\nSynthesize the optimal solution by taking the cleanest architectural implementation, incorporating all valid edge-case tests, fixing any syntax/lint defects, and writing the final unified code into the workspace.`;

  // 4. Run Synthesizer Agent
  console.log(`  ${symbols.arrow} Running Synthesizer (${judgeAgent}) to merge best traits...`);
  const logFilePath = path.join(root, '.arace', 'worktrees', runId, 'logs', 'ensemble.log');
  const adapter = createAdapter(judgeAgent, config.adapters);

  // In mock mode or live mode
  const codingRes = await adapter.run({
    taskText: synthesisPrompt,
    worktreePath: ensembleWt.worktreePath,
    logFilePath,
    timeoutMs: 600000
  });

  commitWorktreeChanges(ensembleWt.worktreePath, `arace (${runId}): AI ensemble synthesis`);

  // 5. Verify the synthesized ensemble
  process.stdout.write(`  ${symbols.arrow} Verifying synthesized ensemble solution... `);
  const verifyRes = verifyWorktree({
    worktreePath: ensembleWt.worktreePath,
    verifyConfig: config.verify,
    logFilePath
  });

  const isPassed = verifyRes.test.passed && verifyRes.build.passed && verifyRes.lint.passed;
  console.log(isPassed ? c('green', 'PASS ✓') : c('yellow', 'VERIFY FAILED'));

  const { numstatText } = getWorktreeDiff(ensembleWt.worktreePath, baseCommit);
  const diffStats = parseDiffStats(numstatText, config.workspace.test_paths);

  // Add ensemble to runInfo agents list
  if (!runInfo.agents.some(a => a.name === 'ensemble')) {
    runInfo.agents.push({
      name: 'ensemble',
      branch: ensembleWt.branchName,
      path: ensembleWt.worktreePath
    });
    fs.writeFileSync(path.join(root, '.arace', 'latest_run.json'), JSON.stringify(runInfo, null, 2));
  }

  return {
    agent: 'ensemble',
    judge: judgeAgent,
    worktreePath: ensembleWt.worktreePath,
    branchName: ensembleWt.branchName,
    durationSeconds: codingRes.durationSeconds,
    build: verifyRes.build,
    lint: verifyRes.lint,
    test: verifyRes.test,
    diffStats
  };
}
