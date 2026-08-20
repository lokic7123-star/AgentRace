import { Supervisor } from '../supervisor.js';
import { loadProjectConfig } from '../config.js';
import { detectInstalledAgents } from '../detector.js';
import { c, symbols } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function orchestrateCommand(args = []) {
  let taskText = '';
  let supervisor = 'antigravity';
  let agents = [];
  let allowDirty = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--supervisor' || arg === '-s') && args[i + 1]) {
      supervisor = args[i + 1].trim();
      i++;
    } else if (arg.startsWith('--supervisor=')) {
      supervisor = arg.slice(13).trim();
    } else if ((arg === '--with' || arg === '-w' || arg === '-a' || arg === '--agents') && args[i + 1]) {
      agents = args[i + 1].split(',').map(s => s.trim()).filter(Boolean);
      i++;
    } else if (arg.startsWith('--with=') || arg.startsWith('--agents=')) {
      const val = arg.includes('--with=') ? arg.slice(7) : arg.slice(9);
      agents = val.split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--allow-dirty') {
      allowDirty = true;
    } else if (!arg.startsWith('-')) {
      if (!taskText) {
        taskText = arg;
      } else {
        taskText += ' ' + arg;
      }
    }
  }

  if (!taskText || !taskText.trim()) {
    console.error(c('red', 'Error: Please specify a task description. Example: arace orchestrate "优化 Redis 连接池并发锁"'));
    return EXIT_CODES.GENERAL_ERROR;
  }

  const config = loadProjectConfig();
  if (agents.length === 0) {
    agents = ['antigravity', 'opencode', 'reasonix'];
  }

  console.log(`\n${c('bold', 'AgentRace 2.0 Supervisor Orchestration Engine')}`);
  console.log(`Supervisor: ${c('magenta', supervisor.toUpperCase())} | Workers: ${c('cyan', agents.join(', '))}`);
  console.log(`Task: "${c('green', taskText)}"\n`);

  const sup = new Supervisor(supervisor, config);

  try {
    const result = await sup.runOrchestration({
      taskText,
      rootDir: process.cwd(),
      availableAgents: agents,
      onProgress: (p) => {
        if (p.message) console.log(`  ${symbols.arrow} ${p.message}`);
      }
    });

    console.log(`\n${c('green', '✓ Orchestration finished successfully!')}`);
    console.log(`Final branch: ${c('cyan', result.finalResult.branch)}`);
    console.log(`\nRun \`arace keep supervisor\` to merge final integrated solution into your working branch.\n`);
    return EXIT_CODES.SUCCESS;
  } catch (err) {
    console.error(c('red', `\nOrchestration failed: ${err.message}`));
    return EXIT_CODES.GENERAL_ERROR;
  }
}