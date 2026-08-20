import { runRace } from '../engine.js';
import { loadProjectConfig } from '../config.js';
import { detectInstalledAgents } from '../detector.js';
import { c } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function runCommand(args = []) {
  let taskText = '';
  let agents = [];
  let timeoutStr = null;
  let allowDirty = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--with' && args[i + 1]) {
      agents = args[i + 1].split(',').map(s => s.trim()).filter(Boolean);
      i++;
    } else if (arg.startsWith('--with=')) {
      agents = arg.slice(7).split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--timeout' && args[i + 1]) {
      timeoutStr = args[i + 1];
      i++;
    } else if (arg.startsWith('--timeout=')) {
      timeoutStr = arg.slice(10);
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
    console.error(c('red', 'Error: Please specify a task description. Example: arace run "Fix authentication timeout"'));
    return EXIT_CODES.GENERAL_ERROR;
  }

  const config = loadProjectConfig();

  // If no agents passed, use defaults from config
  if (agents.length === 0) {
    agents = config.defaults.agents || ['claude', 'codex'];
  }

  // Probe available agents
  const detected = detectInstalledAgents(config.adapters);
  const validAgents = [];

  for (const requested of agents) {
    const found = detected.find(d => d.name.toLowerCase() === requested.toLowerCase());
    if (found && found.available) {
      validAgents.push(found.name);
    } else if (process.env.ARACE_MOCK === '1' || process.env.ARACE_MOCK === 'true') {
      // In mock mode, allow requested agents
      validAgents.push(requested);
    } else {
      console.warn(c('yellow', `Warning: Agent '${requested}' is not installed or available in PATH.`));
    }
  }

  if (validAgents.length === 0) {
    console.error(c('red', '\nError: None of the requested agents are available on this machine.'));
    console.error(c('dim', 'Run `arace detect` to see available agents, or define custom adapters in .arace.yaml.\n'));
    return EXIT_CODES.NO_AGENTS_FOUND;
  }

  const res = await runRace({
    taskText,
    agents: validAgents,
    timeoutStr,
    allowDirty,
    config
  });

  return res.exitCode;
}
