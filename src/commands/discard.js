import fs from 'node:fs';
import path from 'node:path';
import { getRepoRoot, removeWorktree, pruneAllWorktrees } from '../git.js';
import { c, symbols } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function discardCommand(args = []) {
  const repoRoot = getRepoRoot();
  const latestRunFile = path.join(repoRoot, '.arace', 'latest_run.json');
  const failedWorktrees = [];

  if (fs.existsSync(latestRunFile)) {
    const runInfo = JSON.parse(fs.readFileSync(latestRunFile, 'utf8'));
    console.log(`\nDiscarding race run ${c('cyan', runInfo.runId)}...`);

    for (const a of runInfo.agents) {
      removeWorktree(a.path, repoRoot, a.branch);
      if (fs.existsSync(a.path)) {
        failedWorktrees.push(a.path);
      }
    }

    try {
      fs.unlinkSync(latestRunFile);
    } catch {}
  } else {
    console.log(`Pruning all temporary worktrees...`);
    pruneAllWorktrees(repoRoot);
  }

  if (failedWorktrees.length > 0) {
    console.warn(c('yellow', `\n${symbols.warning} Failed to remove ${failedWorktrees.length} worktree directory(s):`));
    for (const p of failedWorktrees) {
      console.warn(`  - ${p}`);
    }
    return EXIT_CODES.GENERAL_ERROR;
  }

  console.log(c('green', `${symbols.check} All temporary race worktrees and branches discarded.\n`));
  return EXIT_CODES.SUCCESS;
}
