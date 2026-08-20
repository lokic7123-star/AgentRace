import fs from 'node:fs';
import path from 'node:path';
import { getRepoRoot, mergeBranchToCurrent, removeWorktree } from '../git.js';
import { markAgentKept } from '../db.js';
import { c, symbols } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function keepCommand(args = []) {
  const agentName = args.find(a => !a.startsWith('-'))?.toLowerCase();
  const repoRoot = getRepoRoot();
  const latestRunFile = path.join(repoRoot, '.arace', 'latest_run.json');

  if (!agentName) {
    console.error(c('red', 'Error: Please specify which agent to keep. Example: arace keep claude'));
    return EXIT_CODES.GENERAL_ERROR;
  }

  if (!fs.existsSync(latestRunFile)) {
    console.error(c('red', 'Error: No active race run found. Run `arace run` first.'));
    return EXIT_CODES.GENERAL_ERROR;
  }

  const runInfo = JSON.parse(fs.readFileSync(latestRunFile, 'utf8'));
  const targetAgent = runInfo.agents.find(a => a.name.toLowerCase() === agentName);

  if (!targetAgent) {
    console.error(c('red', `Error: Agent '${agentName}' was not found in run ${runInfo.runId}. Available: ${runInfo.agents.map(a => a.name).join(', ')}`));
    return EXIT_CODES.GENERAL_ERROR;
  }

  console.log(`\nMerging changes from ${c('bold', targetAgent.name)} (${targetAgent.branch}) into current branch...`);

  const mergeRes = mergeBranchToCurrent(repoRoot, targetAgent.branch);

  if (!mergeRes.success) {
    if (mergeRes.conflict) {
      console.error(c('red', `\nMerge Conflict detected! Conflicts in files:`));
      for (const f of mergeRes.conflictFiles || []) {
        console.error(`  ${c('yellow', symbols.bullet)} ${f}`);
      }
      console.error(c('white', '\nPlease resolve conflicts manually, or abort with git merge --abort.\n'));
    } else {
      console.error(c('red', `Failed to merge: ${mergeRes.error}`));
    }
    return EXIT_CODES.GENERAL_ERROR;
  }

  // Update DB
  try {
    markAgentKept(runInfo.runId, targetAgent.name);
  } catch {}

  // Cleanup worktrees and branches
  console.log(`Cleaning up temporary worktrees and branches...`);
  for (const a of runInfo.agents) {
    removeWorktree(a.path, repoRoot, a.branch);
  }

  // Remove latest_run marker
  try {
    fs.unlinkSync(latestRunFile);
  } catch {}

  console.log(c('green', `\n${symbols.check} Successfully merged ${targetAgent.name}'s changes and cleaned up all temporary environments!\n`));
  return EXIT_CODES.SUCCESS;
}
