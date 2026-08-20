import { execSync, spawnSync } from 'node:child_process';
import os from 'node:os';

export const KNOWN_AGENTS = [
  {
    name: 'claude',
    displayName: 'Claude Code',
    binaries: ['claude', 'claude.cmd'],
    versionFlag: '--version',
    description: 'Anthropic Claude Code CLI'
  },
  {
    name: 'codex',
    displayName: 'OpenAI Codex / CLI',
    binaries: ['codex', 'codex.cmd', 'openai'],
    versionFlag: '--version',
    description: 'OpenAI Codex CLI or Agent'
  },
  {
    name: 'aider',
    displayName: 'Aider AI Pair Programmer',
    binaries: ['aider', 'aider.cmd', 'aider.exe'],
    versionFlag: '--version',
    description: 'Aider AI Git-integrated coding assistant'
  },
  {
    name: 'gemini',
    displayName: 'Gemini / Antigravity CLI',
    binaries: ['gemini', 'gemini.cmd', 'agy', 'agy.cmd'],
    versionFlag: '--version',
    description: 'Google Gemini / Antigravity CLI'
  },
  {
    name: 'cursor',
    displayName: 'Cursor Agent',
    binaries: ['cursor-agent', 'cursor'],
    versionFlag: '--version',
    description: 'Cursor IDE headless agent'
  }
];

export function checkBinaryExists(binaryName) {
  const isWin = os.platform() === 'win32';
  const whichCmd = isWin ? 'where' : 'which';
  try {
    const res = spawnSync(whichCmd, [binaryName], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (res.status === 0 && res.stdout.trim()) {
      const paths = res.stdout.trim().split(/\r?\n/);
      return { found: true, path: paths[0] };
    }
    return { found: false, path: null };
  } catch {
    return { found: false, path: null };
  }
}

export function detectInstalledAgents(customAdapters = {}) {
  const results = [];

  for (const agent of KNOWN_AGENTS) {
    let installed = false;
    let binaryPath = null;
    let version = null;

    for (const bin of agent.binaries) {
      const probe = checkBinaryExists(bin);
      if (probe.found) {
        installed = true;
        binaryPath = probe.path;
        try {
          const v = execSync(`"${binaryPath}" ${agent.versionFlag}`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 5000
          });
          version = v.trim().split(/\r?\n/)[0];
        } catch {
          version = 'installed (version unknown)';
        }
        break;
      }
    }

    results.push({
      name: agent.name,
      displayName: agent.displayName,
      available: installed,
      path: binaryPath,
      version: version || (installed ? 'available' : 'not found'),
      description: agent.description
    });
  }

  // Check custom adapters defined in .arace.yaml
  for (const [name, config] of Object.entries(customAdapters)) {
    if (!results.some(r => r.name === name)) {
      const cmdParts = (config.cmd || name).split(' ');
      const bin = cmdParts[0];
      const probe = checkBinaryExists(bin);
      results.push({
        name,
        displayName: config.displayName || name,
        available: probe.found || Boolean(config.mock),
        path: probe.path || (config.mock ? 'mock-builtin' : null),
        version: probe.found ? 'configured' : (config.mock ? 'mock-mode' : 'command not found'),
        description: config.description || 'Custom configured agent'
      });
    }
  }

  return results;
}
