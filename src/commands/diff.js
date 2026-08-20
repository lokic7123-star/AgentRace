import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { getRepoRoot, getWorktreeDiff } from '../git.js';
import { c, symbols } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function diffCommand(args = []) {
  const repoRoot = getRepoRoot();
  const latestRunFile = path.join(repoRoot, '.arace', 'latest_run.json');

  if (!fs.existsSync(latestRunFile)) {
    console.error(c('red', 'Error: No active race run found in this repository. Run `arace run` first.'));
    return EXIT_CODES.GENERAL_ERROR;
  }

  const runInfo = JSON.parse(fs.readFileSync(latestRunFile, 'utf8'));
  const isStatOnly = args.includes('--stat');
  const targetAgent = args.find(a => !a.startsWith('-'))?.toLowerCase();

  const agentsToDiff = targetAgent
    ? runInfo.agents.filter(a => 
        a.name.toLowerCase() === targetAgent ||
        (a.id && a.id.toLowerCase() === targetAgent) ||
        (a.role && a.role.toLowerCase() === targetAgent)
      )
    : runInfo.agents;

  if (agentsToDiff.length === 0) {
    const available = runInfo.agents.map(a => a.id ? `${a.name} (${a.id})` : a.name).join(', ');
    console.error(c('red', `Error: Agent/Subtask '${targetAgent}' was not part of run ${runInfo.runId}. Available: ${available}`));
    return EXIT_CODES.GENERAL_ERROR;
  }

  console.log(`\n${c('bold', 'AgentRace Diff Comparison')} (Run: ${c('cyan', runInfo.runId)} | Base: ${runInfo.baseCommit})\n`);

  for (const agent of agentsToDiff) {
    console.log(c('gray', symbols.line.repeat(60)));
    console.log(`${c('bold', 'Agent:')} ${c('cyan', agent.name)} (${agent.branch})`);
    console.log(c('gray', symbols.line.repeat(60)));

    if (!fs.existsSync(agent.path)) {
      console.log(c('yellow', `Worktree path ${agent.path} no longer exists.`));
      continue;
    }

    if (isStatOnly) {
      const { numstatText } = getWorktreeDiff(agent.path, runInfo.baseCommit);
      console.log(numstatText || 'No changes');
    } else {
      const { diffText } = getWorktreeDiff(agent.path, runInfo.baseCommit);
      if (!diffText.trim()) {
        console.log(c('dim', 'No modifications made by this agent.'));
      } else {
        // Colorize unified diff
        const coloredLines = diffText.split('\n').map(line => {
          if (line.startsWith('+') && !line.startsWith('+++')) return c('green', line);
          if (line.startsWith('-') && !line.startsWith('---')) return c('red', line);
          if (line.startsWith('@@')) return c('cyan', line);
          if (line.startsWith('diff --git')) return c('bold', line);
          return line;
        });
        console.log(coloredLines.join('\n'));
      }
    }
    console.log('');
  }

  return EXIT_CODES.SUCCESS;
}
