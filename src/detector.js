import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const KNOWN_AGENTS = [
  {
    name: 'antigravity',
    displayName: 'Google Antigravity / Gemini',
    type: 'autonomous_agent',
    binaries: ['Antigravity.exe', 'antigravity', 'gemini.cmd', 'gemini', 'agy.cmd', 'agy'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'antigravity', 'Antigravity.exe'),
      path.join(os.homedir(), '.gemini', 'antigravity', 'bin', 'agy.cmd'),
      path.join(os.homedir(), '.gemini', 'bin', 'gemini.cmd')
    ],
    versionFlag: '--version',
    description: 'Google Antigravity IDE & Gemini Autonomous Agent'
  },
  {
    name: 'opencode',
    displayName: 'OpenCode Assistant',
    type: 'autonomous_agent',
    binaries: ['opencode.exe', 'opencode', 'opencode.cmd'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', '@opencode-aidesktop', 'OpenCode.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', '@openchamberelectron', 'resources', 'opencode-cli', 'opencode.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Temp', 'opencode')
    ],
    versionFlag: '--version',
    description: 'OpenCode Local AI Coding Agent'
  },
  {
    name: 'dsh',
    displayName: 'DeepSeek Harness (DSH)',
    type: 'autonomous_agent',
    binaries: ['dsh', 'dsh.cmd', 'dsh.exe'],
    extraPaths: [
      path.join(os.homedir(), '.dsh', 'bin', 'dsh.exe'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'dsh.cmd')
    ],
    versionFlag: '--version',
    description: 'DeepSeek Harness Multi-Agent Orchestrator'
  },
  {
    name: 'claude',
    displayName: 'Claude Code',
    type: 'autonomous_agent',
    binaries: ['claude', 'claude.cmd', 'claude.exe'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      path.join(os.homedir(), '.npm-global', 'bin', 'claude')
    ],
    versionFlag: '--version',
    description: 'Anthropic Claude Code CLI Agent'
  },
  {
    name: 'codex',
    displayName: 'OpenAI Codex / CLI',
    type: 'autonomous_agent',
    binaries: ['codex', 'codex.cmd', 'openai', 'openai.cmd'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'codex.cmd'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'Scripts', 'openai.exe')
    ],
    versionFlag: '--version',
    description: 'OpenAI Codex / CLI Coding Agent'
  },
  {
    name: 'aider',
    displayName: 'Aider AI Pair Programmer',
    type: 'autonomous_agent',
    binaries: ['aider', 'aider.cmd', 'aider.exe'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'Scripts', 'aider.exe'),
      path.join(os.homedir(), '.local', 'bin', 'aider')
    ],
    versionFlag: '--version',
    description: 'Aider Multi-Model Git Pair Programmer'
  },
  {
    name: 'cursor',
    displayName: 'Cursor Agent',
    type: 'autonomous_agent',
    binaries: ['cursor-agent', 'cursor-agent.cmd', 'cursor', 'cursor.cmd'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'cursor', 'resources', 'app', 'bin', 'cursor.cmd'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'cursor', 'Cursor.exe')
    ],
    versionFlag: '--version',
    description: 'Cursor IDE Headless Coding Agent'
  },
  {
    name: 'openhands',
    displayName: 'OpenHands (OpenDevin)',
    type: 'autonomous_agent',
    binaries: ['openhands', 'openhands.cmd', 'opendevin'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'OpenHands Autonomous Software Engineer'
  },
  {
    name: 'goose',
    displayName: 'Block Goose AI Agent',
    type: 'autonomous_agent',
    binaries: ['goose', 'goose.cmd', 'goose.exe'],
    extraPaths: [
      path.join(os.homedir(), '.local', 'bin', 'goose.exe')
    ],
    versionFlag: '--version',
    description: 'Block Goose On-Machine Developer Agent'
  },
  {
    name: 'cline',
    displayName: 'Roo Code / Cline CLI',
    type: 'autonomous_agent',
    binaries: ['cline', 'cline.cmd', 'roo', 'roo.cmd'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'Cline / Roo Autonomous Coding CLI'
  },
  {
    name: 'windsurf',
    displayName: 'Codeium Windsurf CLI',
    type: 'autonomous_agent',
    binaries: ['windsurf', 'windsurf.cmd'],
    extraPaths: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'windsurf', 'bin', 'windsurf.cmd')
    ],
    versionFlag: '--version',
    description: 'Codeium Windsurf Agent CLI'
  },
  {
    name: 'copilot',
    displayName: 'GitHub Copilot CLI',
    type: 'autonomous_agent',
    binaries: ['copilot', 'copilot.cmd', 'gh-copilot'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'GitHub Copilot Workspace CLI'
  },
  {
    name: 'cody',
    displayName: 'Sourcegraph Cody CLI',
    type: 'autonomous_agent',
    binaries: ['cody', 'cody.cmd'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'Sourcegraph Cody AI Assistant'
  },
  {
    name: 'plandex',
    displayName: 'Plandex AI Agent',
    type: 'autonomous_agent',
    binaries: ['plandex', 'plandex.cmd', 'plandex.exe'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'Plandex Terminal Multi-File Agent'
  },
  {
    name: 'mentat',
    displayName: 'Mentat AI Assistant',
    type: 'autonomous_agent',
    binaries: ['mentat', 'mentat.cmd', 'mentat.exe'],
    extraPaths: [],
    versionFlag: '--version',
    description: 'Mentat Interactive Coding Agent'
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
  if (extraPaths && extraPaths.length > 0) {
    for (const p of extraPaths) {
      if (fs.existsSync(p)) {
        return { found: true, path: p };
      }
    }
  }

  const map = getPathBinaryMap();
  const lowerName = binaryName.toLowerCase();
  if (map.has(lowerName)) {
    return { found: true, path: map.get(lowerName) };
  }

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
      type: agent.type || 'autonomous_agent',
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
        type: 'custom_agent',
        available: probe.found || Boolean(config.mock),
        path: probe.path || (config.mock ? 'mock-builtin' : null),
        version: probe.found ? 'configured' : (config.mock ? 'mock-mode' : 'command not found'),
        description: config.description || 'Custom configured agent'
      });
    }
  }

  return results;
}
