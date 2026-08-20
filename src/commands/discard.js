import fs from 'node:fs';
import path from 'node:path';
import { getRepoRoot, removeWorktree, pruneAllWorktrees } from '../git.js';
import { c, symbols } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function discardCommand(args = []) {
  const repoRoot = getRepoRoot();
  const latestRunFile = path.join(repoRoot, '.arace', 'latest_run.json');

  if (fs.existsSync(latestRunFile)) {
    const runInfo = JSON.parse(fs.readFileSync(latestRunFile, 'utf8'));
    console.log(`\nDiscarding race run ${c('cyan', runInfo.runId)}...`);

    for (const a of runInfo.agents) {
      removeWorktree(a.path, repoRoot, a.branch);
    }

    try {
      fs.unlinkSync(latestRunFile);
    } catch {}
  } else {
    console.log(`Pruning all temporary worktrees...`);
    pruneAllWorktrees(repoRoot);
  }

  console.log(c('green', `${symbols.check} All temporary race worktrees and branches discarded.\n`));
  return EXIT_CODES.SUCCESS;
}
