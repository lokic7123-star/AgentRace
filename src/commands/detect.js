import { detectInstalledAgents } from '../detector.js';
import { loadProjectConfig } from '../config.js';
import { c, symbols } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function detectCommand(args = []) {
  const config = loadProjectConfig();
  const agents = detectInstalledAgents(config.adapters);

  console.log(`\n${c('bold', 'AgentRace Agent Detection:')}\n`);

  let availableCount = 0;
  for (const a of agents) {
    if (a.available) {
      availableCount++;
      console.log(`  ${c('green', symbols.check)} ${c('bold', a.name.padEnd(10))} ${c('green', a.version)}`);
      console.log(`     ${c('dim', a.description)} (${a.path})`);
    } else {
      console.log(`  ${c('red', symbols.cross)} ${c('bold', a.name.padEnd(10))} ${c('gray', 'Not installed / not in PATH')}`);
      console.log(`     ${c('dim', a.description)}`);
    }
  }

  console.log(`\nFound ${c('bold', availableCount.toString())} available Agent(s) ready for racing.\n`);

  if (availableCount === 0) {
    console.log(c('yellow', 'Tip: You can configure custom agent runners in .arace.yaml or install Claude Code / Aider.\n'));
    return EXIT_CODES.NO_AGENTS_FOUND;
  }
  return EXIT_CODES.SUCCESS;
}
