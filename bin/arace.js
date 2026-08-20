#!/usr/bin/env node

import process from 'node:process';
import { detectCommand } from '../src/commands/detect.js';
import { doctorCommand } from '../src/commands/doctor.js';
import { runCommand } from '../src/commands/run.js';
import { diffCommand } from '../src/commands/diff.js';
import { keepCommand } from '../src/commands/keep.js';
import { discardCommand } from '../src/commands/discard.js';
import { statsCommand } from '../src/commands/stats.js';
import { blendCommand } from '../src/commands/blend.js';
import { pickCommand } from '../src/commands/pick.js';
import { uiCommand } from '../src/commands/ui.js';
import { orchestrateCommand } from '../src/commands/orchestrate.js';
import { c, symbols } from '../src/utils.js';
import { EXIT_CODES } from '../src/types.js';

const VERSION = '0.2.0';

function printHelp() {
  console.log(`
${c('bold', 'AgentRace (arace)')} v${VERSION}
${c('dim', '主 Agent 智能编排分工 + 专精子 Agent 协同 + 硬性客观质量门禁引擎')}

${c('bold', 'USAGE:')}
  arace <command> [options]
  arace "<task>" [options]               (Shortcut for \`arace run\`)

${c('bold', 'SUPERVISOR ORCHESTRATION COMMANDS (DEFAULT):')}
  ${c('magenta', 'orchestrate')} <task>    Decompose task into DAG, dispatch to specialist agents, verify with hard gates
  ${c('cyan', 'ui')} [--port 3333]        Launch modern interactive Web Orchestrator & Multi-Agent Matrix

${c('bold', 'TOURNAMENT RACING & VERIFICATION:')}
  ${c('cyan', 'run')} <task>              Start multi-agent race in isolated worktrees (benchmark mode)
  ${c('cyan', 'detect')}                  Scan local machine for available Agent CLIs
  ${c('cyan', 'doctor')}                  Environment self-check & diagnosis
  ${c('cyan', 'diff')} [agent]            Inspect unified diff vs base commit

${c('bold', 'SYNTHESIS & INTEGRATION COMMANDS:')}
  ${c('cyan', 'blend')} [--judge <agent>] Merge best traits using AI Synthesizer
  ${c('cyan', 'keep')} <agent>            Merge winning or supervisor-integrated solution and cleanup
  ${c('cyan', 'discard')}                 Discard all temporary worktrees and branches

${c('bold', 'WEB DASHBOARD & ANALYTICS:')}
  ${c('cyan', 'ui')} [--port 3333]        Launch modern interactive Web Arena & Ensemble Studio
  ${c('cyan', 'stats')}                   Historical analytics and agent benchmark metrics

${c('bold', 'OPTIONS for `run`:')}
  --with <agent1,agent2>    Specify agents to compete (default: dsh, claude, codex)
  --timeout <duration>      Overall task timeout (e.g. 600s, 5m, default: 600s)
  --allow-dirty             Allow running with uncommitted working tree changes
  --ui                      Launch web UI after starting race

${c('bold', 'EXAMPLES:')}
  arace "Fix connection pool memory leak in redis client" --with dsh,claude,codex
  arace blend --judge dsh
  arace pick src/service.js:claude test/service.test.js:dsh
  arace keep ensemble
  arace ui
`);
}

async function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0 || rawArgs.includes('-h') || rawArgs.includes('--help') || rawArgs.includes('help')) {
    printHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }

  if (rawArgs.includes('-v') || rawArgs.includes('--version') || rawArgs.includes('version')) {
    console.log(`arace v${VERSION}`);
    process.exit(EXIT_CODES.SUCCESS);
  }

  const firstArg = rawArgs[0];
  let exitCode = EXIT_CODES.SUCCESS;

  try {
    switch (firstArg) {
      case 'orchestrate':
      case 'orch':
        exitCode = await orchestrateCommand(rawArgs.slice(1));
        break;
      case 'detect':
        exitCode = await detectCommand(rawArgs.slice(1));
        break;
      case 'doctor':
        exitCode = await doctorCommand(rawArgs.slice(1));
        break;
      case 'run':
        exitCode = await runCommand(rawArgs.slice(1));
        break;
      case 'diff':
        exitCode = await diffCommand(rawArgs.slice(1));
        break;
      case 'blend':
        exitCode = await blendCommand(rawArgs.slice(1));
        break;
      case 'pick':
        exitCode = await pickCommand(rawArgs.slice(1));
        break;
      case 'keep':
        exitCode = await keepCommand(rawArgs.slice(1));
        break;
      case 'discard':
        exitCode = await discardCommand(rawArgs.slice(1));
        break;
      case 'ui':
        exitCode = await uiCommand(rawArgs.slice(1));
        break;
      case 'stats':
        exitCode = await statsCommand(rawArgs.slice(1));
        break;
      default:
        // Shortcut: arace "task text" [options]
        exitCode = await runCommand(rawArgs);
        break;
    }
  } catch (err) {
    console.error(c('red', `\nUnexpected Error: ${err.message}`));
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    exitCode = EXIT_CODES.GENERAL_ERROR;
  }

  process.exit(exitCode ?? EXIT_CODES.SUCCESS);
}

main();
