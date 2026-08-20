import { execSync, spawnSync } from 'node:child_process';
import os from 'node:os';

export const KNOWN_AGENTS = [
  {
    name: 'dsh',
    displayName: 'DeepSeek Harness (DSH)',
    binaries: ['dsh', 'dsh.cmd', 'dsh.exe'],
    versionFlag: '--version',
    description: 'DeepSeek Harness multi-agent orchestrator & router'
  },
  {
    name: 'claude',
    displayName: 'Claude Code',
    binaries: ['claude', 'claude.cmd', 'claude.exe'],
    versionFlag: '--version',
    description: 'Anthropic Claude Code CLI'
  },
  {
    name: 'codex',
    displayName: 'OpenAI Codex / CLI',
    binaries: ['codex', 'codex.cmd', 'openai', 'openai.cmd'],
    versionFlag: '--version',
    description: 'OpenAI Codex / CLI Agent'
  },
  {
    name: 'gemini',
    displayName: 'Google Gemini / AGY',
    binaries: ['gemini', 'gemini.cmd', 'agy', 'agy.cmd'],
    versionFlag: '--version',
    description: 'Google Gemini & Antigravity CLI'
  },
  {
    name: 'aider',
    displayName: 'Aider AI Pair Programmer',
    binaries: ['aider', 'aider.cmd', 'aider.exe'],
    versionFlag: '--version',
    description: 'Aider AI multi-model pair programming CLI'
  },
  {
    name: 'cursor',
    displayName: 'Cursor Agent',
    binaries: ['cursor-agent', 'cursor-agent.cmd', 'cursor'],
    versionFlag: '--version',
    description: 'Cursor IDE headless coding agent'
  },
  {
    name: 'windsurf',
    displayName: 'Codeium Windsurf CLI',
    binaries: ['windsurf', 'windsurf.cmd'],
    versionFlag: '--version',
    description: 'Codeium Windsurf AI CLI'
  },
  {
    name: 'copilot',
    displayName: 'GitHub Copilot CLI',
    binaries: ['copilot', 'copilot.cmd', 'gh-copilot'],
    versionFlag: '--version',
    description: 'GitHub Copilot CLI tool'
  },
  {
    name: 'openhands',
    displayName: 'OpenHands (OpenDevin)',
    binaries: ['openhands', 'openhands.cmd', 'opendevin'],
    versionFlag: '--version',
    description: 'OpenHands autonomous software development agent'
  },
  {
    name: 'cody',
    displayName: 'Sourcegraph Cody CLI',
    binaries: ['cody', 'cody.cmd'],
    versionFlag: '--version',
    description: 'Sourcegraph Cody AI coding assistant'
  },
  {
    name: 'goose',
    displayName: 'Block Goose AI Agent',
    binaries: ['goose', 'goose.cmd', 'goose.exe'],
    versionFlag: '--version',
    description: 'Block Goose open-source on-machine developer agent'
  },
  {
    name: 'cline',
    displayName: 'Roo Code / Cline CLI',
    binaries: ['cline', 'cline.cmd', 'roo', 'roo.cmd'],
    versionFlag: '--version',
    description: 'Cline / Roo Code autonomous CLI'
  },
  {
    name: 'plandex',
    displayName: 'Plandex AI Agent',
    binaries: ['plandex', 'plandex.cmd', 'plandex.exe'],
    versionFlag: '--version',
    description: 'Plandex terminal-based multi-file coding agent'
  },
  {
    name: 'mentat',
    displayName: 'Mentat AI Assistant',
    binaries: ['mentat', 'mentat.cmd', 'mentat.exe'],
    versionFlag: '--version',
    description: 'Mentat interactive AI coding partner'
  },
  {
    name: 'ollama',
    displayName: 'Ollama Local LLM Agent',
    binaries: ['ollama', 'ollama.cmd', 'ollama.exe'],
    versionFlag: '--version',
    description: 'Ollama local models (DeepSeek, Llama, Qwen)'
  },
  {
    name: 'sgpt',
    displayName: 'Shell-GPT (SGPT)',
    binaries: ['sgpt', 'sgpt.cmd', 'sgpt.exe'],
    versionFlag: '--version',
    description: 'Shell-GPT command-line AI assistant'
  },
  {
    name: 'opencode',
    displayName: 'OpenCode Assistant',
    binaries: ['opencode', 'opencode.cmd'],
    versionFlag: '--version',
    description: 'OpenCode local code intelligence CLI'
  },
  {
    name: 'tabnine',
    displayName: 'Tabnine CLI',
    binaries: ['tabnine', 'tabnine.cmd'],
    versionFlag: '--version',
    description: 'Tabnine enterprise AI code assistant'
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
