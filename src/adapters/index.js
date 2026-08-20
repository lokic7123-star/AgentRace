import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export class BaseAdapter {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  buildCommand(taskText, worktreePath) {
    throw new Error('buildCommand must be implemented');
  }

  async run({ taskText, worktreePath, logFilePath, timeoutMs = 600000, signal }) {
    const startTime = Date.now();
    const logDir = path.dirname(logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

    // Mock execution mode for testing/demo
    if (process.env.ARACE_MOCK === 'true' || process.env.ARACE_MOCK === '1' || this.config.mock) {
      return this.runMock({ taskText, worktreePath, logStream, startTime });
    }

    const { command, args } = this.buildCommand(taskText, worktreePath);

    return new Promise((resolve) => {
      logStream.write(`\n=== ARACE AGENT START: ${this.name} ===\n`);
      logStream.write(`Command: ${command} ${args.join(' ')}\n`);
      logStream.write(`Worktree: ${worktreePath}\n\n`);

      const child = spawn(command, args, {
        cwd: worktreePath,
        shell: true,
        env: {
          ...process.env,
          CI: 'true',
          ARACE_RUN: 'true',
          ARACE_AGENT: this.name
        }
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        logStream.write(`\n[ARACE] Timeout of ${timeoutMs}ms reached. Terminating process...\n`);
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 3000);
      }, timeoutMs);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          child.kill('SIGKILL');
        });
      }

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        logStream.write(text);
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        logStream.write(text);
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        const durationSec = (Date.now() - startTime) / 1000;
        logStream.write(`\n[ARACE ERROR] Process error: ${err.message}\n`);
        logStream.end();
        resolve({
          agent: this.name,
          exitCode: 1,
          durationSeconds: durationSec,
          timedOut: false,
          error: err.message,
          stdout,
          stderr
        });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const durationSec = (Date.now() - startTime) / 1000;
        logStream.write(`\n=== ARACE AGENT FINISHED (Exit code: ${code}, Duration: ${durationSec.toFixed(1)}s) ===\n`);
        logStream.end();

        resolve({
          agent: this.name,
          exitCode: timedOut ? 124 : (code ?? 0),
          durationSeconds: durationSec,
          timedOut,
          stdout,
          stderr
        });
      });
    });
  }

  async runMock({ taskText, worktreePath, logStream, startTime }) {
    // Built-in smart mock for testing / dry-runs
    await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
    logStream.write(`[MOCK AGENT ${this.name}] Processing task: ${taskText}\n`);

    // Let's create or modify a mock file to simulate agent work
    const sampleFile = path.join(worktreePath, 'src', `${this.name}_solution.js`);
    fs.mkdirSync(path.dirname(sampleFile), { recursive: true });
    fs.writeFileSync(sampleFile, `// Solution by ${this.name}\n// Task: ${taskText}\nexport function solve() { return true; }\n`);
    logStream.write(`[MOCK AGENT ${this.name}] Generated ${sampleFile}\n`);
    logStream.end();

    const durationSec = (Date.now() - startTime) / 1000;
    return {
      agent: this.name,
      exitCode: 0,
      durationSeconds: durationSec,
      timedOut: false,
      stdout: `[Mock] Finished task successfully`,
      stderr: ''
    };
  }
}

export class ClaudeAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('claude', config);
  }

  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'claude';
    // Claude Code headless flags
    const args = ['-p', `"${taskText.replace(/"/g, '\\"')}"`, '--dangerously-skip-permissions'];
    if (this.config.flags) {
      args.push(...this.config.flags);
    }
    return { command: customCmd, args };
  }
}

export class CodexAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('codex', config);
  }

  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'codex';
    const args = ['-p', `"${taskText.replace(/"/g, '\\"')}"`];
    if (this.config.flags) {
      args.push(...this.config.flags);
    }
    return { command: customCmd, args };
  }
}

export class AiderAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('aider', config);
  }

  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'aider';
    const args = ['--message', `"${taskText.replace(/"/g, '\\"')}"`, '--yes-always', '--no-git'];
    return { command: customCmd, args };
  }
}

export class GeminiAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('gemini', config);
  }

  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'agy';
    const args = ['-p', `"${taskText.replace(/"/g, '\\"')}"`];
    return { command: customCmd, args };
  }
}

export class CustomAdapter extends BaseAdapter {
  constructor(name, config = {}) {
    super(name, config);
  }

  buildCommand(taskText, worktreePath) {
    const template = this.config.cmd || `${this.name} "{task}"`;
    const fullCmd = template
      .replace(/\{task\}/g, taskText.replace(/"/g, '\\"'))
      .replace(/\{worktree\}/g, worktreePath);

    return { command: fullCmd, args: [] };
  }
}

export function createAdapter(agentName, customAdapters = {}) {
  const config = customAdapters[agentName] || {};
  switch (agentName.toLowerCase()) {
    case 'claude':
      return new ClaudeAdapter(config);
    case 'codex':
      return new CodexAdapter(config);
    case 'aider':
      return new AiderAdapter(config);
    case 'gemini':
    case 'agy':
      return new GeminiAdapter(config);
    default:
      return new CustomAdapter(agentName, config);
  }
}
