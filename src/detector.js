import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
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

let _pathBinaryMap = null;
let _lastPathScanTime = 0;

/**
 * Ultra-fast PATH scanner (5ms instead of 3000ms spawned subprocesses)
 */
function getPathBinaryMap(forceRefresh = false) {
  const now = Date.now();
  if (_pathBinaryMap && !forceRefresh && (now - _lastPathScanTime < 30000)) {
    return _pathBinaryMap;
  }

  const map = new Map();
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);

  for (const dir of pathDirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const lower = file.toLowerCase();
          if (!map.has(lower)) {
            map.set(lower, path.join(dir, file));
          }
          // Also map without extension on Windows (e.g. 'claude' -> 'claude.cmd')
          const baseNoExt = path.parse(lower).name;
          if (!map.has(baseNoExt)) {
            map.set(baseNoExt, path.join(dir, file));
          }
        }
      }
    } catch {}
  }

  _pathBinaryMap = map;
  _lastPathScanTime = now;
  return map;
}

export function checkBinaryExists(binaryName) {
  const map = getPathBinaryMap();
  const lowerName = binaryName.toLowerCase();
  if (map.has(lowerName)) {
    return { found: true, path: map.get(lowerName) };
  }

  // Fallback check
  const isWin = os.platform() === 'win32';
  if (isWin) {
    for (const ext of ['.exe', '.cmd', '.bat', '.ps1']) {
      const withExt = lowerName + ext;
      if (map.has(withExt)) {
        return { found: true, path: map.get(withExt) };
      }
    }
  }

  return { found: false, path: null };
}

export function detectInstalledAgents(customAdapters = {}, forceRefresh = false) {
  const binaryMap = getPathBinaryMap(forceRefresh);
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
        version = 'available';
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
