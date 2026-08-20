import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const KNOWN_AGENTS = [
  {
    name: 'antigravity',
    displayName: 'Google Antigravity / Gemini',
    binaries: ['Antigravity.exe', 'antigravity', 'gemini.cmd', 'gemini', 'agy.cmd', 'agy'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'antigravity', 'Antigravity.exe'),
      path.join(os.homedir(), '.gemini', 'antigravity', 'bin', 'agy.cmd'),
      path.join(os.homedir(), '.gemini', 'bin', 'gemini.cmd')
    ],
    versionFlag: '--version',
    description: 'Google Antigravity IDE & Gemini Agent'
  },
  {
    name: 'opencode',
    displayName: 'OpenCode Assistant',
    binaries: ['opencode.exe', 'opencode', 'opencode.cmd'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', '@opencode-aidesktop', 'OpenCode.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', '@openchamberelectron', 'resources', 'opencode-cli', 'opencode.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Temp', 'opencode')
    ],
    versionFlag: '--version',
    description: 'OpenCode local code intelligence CLI'
  },
  {
    name: 'lmstudio',
    displayName: 'LM Studio Local LLM (lms)',
    binaries: ['lms.exe', 'lms', 'lms.cmd'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'LM Studio', 'resources', 'app', '.webpack', 'lms.exe'),
      path.join(os.homedir(), '.cache', 'lm-studio', 'bin', 'lms.exe'),
      path.join(os.homedir(), '.lmstudio', 'bin', 'lms')
    ],
    versionFlag: 'version',
    description: 'LM Studio local model CLI & server'
  },
  {
    name: 'dsh',
    displayName: 'DeepSeek Harness (DSH)',
    binaries: ['dsh', 'dsh.cmd', 'dsh.exe'],
    extraPaths: [
      path.join(os.homedir(), '.dsh', 'bin', 'dsh.exe'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'dsh.cmd')
    ],
    versionFlag: '--version',
    description: 'DeepSeek Harness multi-agent orchestrator & router'
  },
  {
    name: 'claude',
    displayName: 'Claude Code',
    binaries: ['claude', 'claude.cmd', 'claude.exe'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      path.join(os.homedir(), '.npm-global', 'bin', 'claude')
    ],
    versionFlag: '--version',
    description: 'Anthropic Claude Code CLI'
  },
  {
    name: 'codex',
    displayName: 'OpenAI Codex / CLI',
    binaries: ['codex', 'codex.cmd', 'openai', 'openai.cmd'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'codex.cmd'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'Scripts', 'openai.exe')
    ],
    versionFlag: '--version',
    description: 'OpenAI Codex / CLI Agent'
  },
  {
    name: 'aider',
    displayName: 'Aider AI Pair Programmer',
    binaries: ['aider', 'aider.cmd', 'aider.exe'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'Scripts', 'aider.exe'),
      path.join(os.homedir(), '.local', 'bin', 'aider')
    ],
    versionFlag: '--version',
    description: 'Aider AI multi-model pair programming CLI'
  },
  {
    name: 'cursor',
    displayName: 'Cursor Agent',
    binaries: ['cursor-agent', 'cursor-agent.cmd', 'cursor', 'cursor.cmd'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'cursor', 'resources', 'app', 'bin', 'cursor.cmd'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'cursor', 'Cursor.exe')
    ],
    versionFlag: '--version',
    description: 'Cursor IDE headless coding agent'
  },
  {
    name: 'ollama',
    displayName: 'Ollama Local LLM Agent',
    binaries: ['ollama', 'ollama.cmd', 'ollama.exe'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe')
    ],
    versionFlag: '--version',
    description: 'Ollama local models (DeepSeek, Llama, Qwen)'
  },
  {
    name: 'windsurf',
    displayName: 'Codeium Windsurf CLI',
    binaries: ['windsurf', 'windsurf.cmd'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'windsurf', 'bin', 'windsurf.cmd')
    ],
    versionFlag: '--version',
    description: 'Codeium Windsurf AI CLI'
  },
  {
    name: 'copilot',
    displayName: 'GitHub Copilot CLI',
    binaries: ['copilot', 'copilot.cmd', 'gh-copilot'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'GitHub Copilot CLI tool'
  },
  {
    name: 'openhands',
    displayName: 'OpenHands (OpenDevin)',
    binaries: ['openhands', 'openhands.cmd', 'opendevin'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'OpenHands autonomous software development agent'
  },
  {
    name: 'cody',
    displayName: 'Sourcegraph Cody CLI',
    binaries: ['cody', 'cody.cmd'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'Sourcegraph Cody AI coding assistant'
  },
  {
    name: 'goose',
    displayName: 'Block Goose AI Agent',
    binaries: ['goose', 'goose.cmd', 'goose.exe'],
    extraPaths: [
      path.join(os.homedir(), '.local', 'bin', 'goose.exe')
    ],
    versionFlag: '--version',
    description: 'Block Goose open-source on-machine developer agent'
  },
  {
    name: 'cline',
    displayName: 'Roo Code / Cline CLI',
    binaries: ['cline', 'cline.cmd', 'roo', 'roo.cmd'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'Cline / Roo Code autonomous CLI'
  },
  {
    name: 'plandex',
    displayName: 'Plandex AI Agent',
    binaries: ['plandex', 'plandex.cmd', 'plandex.exe'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'Plandex terminal-based multi-file coding agent'
  },
  {
    name: 'mentat',
    displayName: 'Mentat AI Assistant',
    binaries: ['mentat', 'mentat.cmd', 'mentat.exe'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'Mentat interactive AI coding partner'
  },
  {
    name: 'sgpt',
    displayName: 'Shell-GPT (SGPT)',
    binaries: ['sgpt', 'sgpt.cmd', 'sgpt.exe'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'Shell-GPT command-line AI assistant'
  },
  {
    name: 'tabnine',
    displayName: 'Tabnine CLI',
    binaries: ['tabnine', 'tabnine.cmd'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'Tabnine enterprise AI code assistant'
  }
];

let _pathBinaryMap = null;
let _lastPathScanTime = 0;

/**
 * Scan PATH and common app directories into an in-memory index (5ms)
 */
function getPathBinaryMap(forceRefresh = false) {
  const now = Date.now();
  if (_pathBinaryMap && !forceRefresh && (now - _lastPathScanTime < 30000)) {
    return _pathBinaryMap;
  }

  const map = new Map();
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);

  // Common user app directories on Windows / macOS / Linux
  const extraSearchDirs = [
    path.join(os.homedir(), 'AppData', 'Local', 'Programs'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm'),
    path.join(os.homedir(), '.cargo', 'bin'),
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), '.dsh', 'bin'),
    path.join(os.homedir(), '.gemini', 'bin'),
    'C:\\Program Files',
    'C:\\Program Files (x86)'
  ];

  for (const dir of [...pathDirs, ...extraSearchDirs]) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const lower = file.toLowerCase();
          const fullPath = path.join(dir, file);
          if (!map.has(lower)) {
            map.set(lower, fullPath);
          }
          const baseNoExt = path.parse(lower).name;
          if (!map.has(baseNoExt)) {
            map.set(baseNoExt, fullPath);
          }
        }
      }
    } catch {}
  }

  _pathBinaryMap = map;
  _lastPathScanTime = now;
  return map;
}

export function checkBinaryExists(binaryName, extraPaths = []) {
  // 1. Check extra explicit paths
  if (extraPaths && extraPaths.length > 0) {
    for (const p of extraPaths) {
      if (fs.existsSync(p)) {
        return { found: true, path: p };
      }
    }
  }

  // 2. Check binary map
  const map = getPathBinaryMap();
  const lowerName = binaryName.toLowerCase();
  if (map.has(lowerName)) {
    return { found: true, path: map.get(lowerName) };
  }

  // 3. Check with extensions on Windows
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

    // Check extra paths first
    if (agent.extraPaths) {
      for (const p of agent.extraPaths) {
        if (fs.existsSync(p)) {
          installed = true;
          binaryPath = p;
          version = 'installed';
          break;
        }
      }
    }

    // Check binaries in PATH
    if (!installed) {
      for (const bin of agent.binaries) {
        const probe = checkBinaryExists(bin, agent.extraPaths);
        if (probe.found) {
          installed = true;
          binaryPath = probe.path;
          version = 'installed';
          break;
        }
      }
    }

    results.push({
      name: agent.name,
      displayName: agent.displayName,
      available: installed,
      path: binaryPath,
      version: version || (installed ? 'installed' : 'not found'),
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
