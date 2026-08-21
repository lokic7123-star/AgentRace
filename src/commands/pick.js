import fs from 'node:fs';
import path from 'node:path';
import { getRepoRoot, removeWorktree } from '../git.js';
import { c, symbols } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function pickCommand(args = []) {
  const repoRoot = getRepoRoot();
  const latestRunFile = path.join(repoRoot, '.arace', 'latest_run.json');

  if (!fs.existsSync(latestRunFile)) {
    console.error(c('red', 'Error: No active race run found. Run `arace run` first.'));
    return EXIT_CODES.GENERAL_ERROR;
  }

  const runInfo = JSON.parse(fs.readFileSync(latestRunFile, 'utf8'));

  if (args.length === 0) {
    console.log(`\n${c('bold', 'AgentRace File-Level Pick Studio:')}\n`);
    console.log(`Usage: arace pick <file_path>:<agent_name> [more_files...]\n`);
    console.log('Available agents in current run:');
    for (const a of runInfo.agents) {
      console.log(`  ${symbols.bullet} ${c('cyan', a.name)} (${a.path})`);
    }
    console.log('\nExample:');
    console.log(`  arace pick src/service.js:claude test/service.test.js:codex\n`);
    return EXIT_CODES.SUCCESS;
  }

  console.log(`\nApplying selected files to working tree...`);
  let appliedCount = 0;

  for (const pair of args) {
    const colonIdx = pair.lastIndexOf(':');
    if (colonIdx === -1) {
      console.error(c('yellow', `Warning: Invalid format '${pair}'. Expected <filepath>:<agent>`));
      continue;
    }

    const relFilePath = pair.slice(0, colonIdx);
    const agentName = pair.slice(colonIdx + 1).toLowerCase();

    const targetAgent = runInfo.agents.find(a =>
      a.name.toLowerCase() === agentName ||
      (a.id && a.id.toLowerCase() === agentName) ||
      (a.role && a.role.toLowerCase() === agentName)
    );
    if (!targetAgent) {
      console.error(c('red', `Error: Agent '${agentName}' not found in current run.`));
      continue;
    }

    const srcFile = path.resolve(targetAgent.path, relFilePath);
    const dstFile = path.resolve(repoRoot, relFilePath);

    if (!fs.existsSync(srcFile)) {
      console.error(c('red', `Error: File '${relFilePath}' does not exist in ${agentName}'s worktree.`));
      continue;
    }

    fs.mkdirSync(path.dirname(dstFile), { recursive: true });
    fs.copyFileSync(srcFile, dstFile);
    console.log(`  ${c('green', symbols.check)} Copied ${c('bold', relFilePath)} from ${c('cyan', agentName)}`);
    appliedCount++;
  }

  if (appliedCount > 0) {
    console.log(c('green', `\nSuccessfully picked ${appliedCount} file(s) into your current workspace!`));
    console.log(c('dim', 'Run `arace discard` when finished to cleanup temporary worktrees.\n'));
    return EXIT_CODES.SUCCESS;
  }

  return EXIT_CODES.GENERAL_ERROR;
}
