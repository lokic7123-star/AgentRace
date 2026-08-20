import fs from 'node:fs';
import path from 'node:path';
import { isGitRepo, getRepoRoot, checkCleanWorkspace, pruneAllWorktrees } from '../git.js';
import { detectCoWSupport } from '../cow.js';
import { loadProjectConfig } from '../config.js';
import { getDatabase } from '../db.js';
import { c, symbols } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function doctorCommand(args = []) {
  const isFix = args.includes('--fix');
  const repoRoot = getRepoRoot();
  console.log(`\n${c('bold', 'AgentRace Environment Doctor:')}\n`);

  let allOk = true;

  // 1. Git Repository Check
  const isGit = isGitRepo(repoRoot);
  if (isGit) {
    console.log(`  ${c('green', symbols.check)} Git Repository: ${c('bold', repoRoot)}`);
    const { isClean, dirtyFiles } = checkCleanWorkspace(repoRoot);
    if (isClean) {
      console.log(`  ${c('green', symbols.check)} Git Working Tree: Clean`);
    } else {
      console.log(`  ${c('yellow', symbols.warning)} Git Working Tree: ${dirtyFiles.length} uncommitted file(s)`);
    }
  } else {
    console.log(`  ${c('red', symbols.cross)} Git Repository: Not inside a git repository`);
    allOk = false;
  }

  // 2. CoW (Copy-on-Write) Support
  const cow = detectCoWSupport(repoRoot);
  if (cow.supported) {
    console.log(`  ${c('green', symbols.check)} Fast CoW Support: Available (${cow.method})`);
  } else {
    console.log(`  ${c('cyan', symbols.bullet)} Fast CoW Support: Not native on this filesystem (will use prepare_cmd fallback)`);
  }

  // 3. Config Validation
  const config = loadProjectConfig(repoRoot);
  if (config.configPath) {
    console.log(`  ${c('green', symbols.check)} Configuration: Loaded from ${config.configPath}`);
  } else {
    console.log(`  ${c('cyan', symbols.bullet)} Configuration: Using default built-in configuration`);
  }

  // 4. Database Check
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT COUNT(*) as count FROM runs').get();
    console.log(`  ${c('green', symbols.check)} SQLite Database: Connected (${row.count} historical runs)`);
  } catch (err) {
    console.log(`  ${c('red', symbols.cross)} SQLite Database Error: ${err.message}`);
    allOk = false;
  }

  // 5. Worktrees / Orphan cleanup
  const worktreeDir = path.join(repoRoot, '.arace', 'worktrees');
  if (fs.existsSync(worktreeDir)) {
    const orphans = fs.readdirSync(worktreeDir);
    if (orphans.length > 0) {
      if (isFix) {
        pruneAllWorktrees(repoRoot);
        console.log(`  ${c('green', symbols.check)} Orphan Worktrees: Cleaned up ${orphans.length} leftover directory(s)`);
      } else {
        console.log(`  ${c('yellow', symbols.warning)} Orphan Worktrees: Found ${orphans.length} leftover runs. Run ${c('bold', 'arace doctor --fix')} to prune.`);
      }
    }
  } else {
    console.log(`  ${c('green', symbols.check)} Orphan Worktrees: None (clean)`);
  }

  console.log('');
  return allOk ? EXIT_CODES.SUCCESS : EXIT_CODES.GENERAL_ERROR;
}
