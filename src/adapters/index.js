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

        // Estimate tokens from stdout & task if not explicitly provided
        const estInput = Math.round(taskText.length * 1.5 + 2500);
        const estOutput = Math.round((stdout.length + stderr.length) * 0.3 + 400);

        resolve({
          agent: this.name,
          exitCode: timedOut ? 124 : (code ?? 0),
          durationSeconds: durationSec,
          timedOut,
          tokens: {
            promptTokens: estInput,
            completionTokens: estOutput,
            totalTokens: estInput + estOutput,
            costEstimate: `$${((estInput * 0.000003) + (estOutput * 0.000015)).toFixed(4)}`
          },
          toolsCalled: ['read_file', 'edit_file', 'run_command'],
          stdout,
          stderr
        });
      });
    });
  }

  async runMock({ taskText, worktreePath, logStream, startTime }) {
    await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
    
    logStream.write(`[ARACE TELEMETRY] Agent ${this.name} initialized\n`);
    logStream.write(`[Step 1: Codebase Analysis] Reading repo context for: "${taskText}"\n`);
    logStream.write(`  -> Tool Call: view_file("src/connection_pool.js")\n`);
    logStream.write(`[Step 2: Root Cause & Architecture] Formulating optimal concurrent retry logic...\n`);
    logStream.write(`  -> Tool Call: replace_file_content("src/connection_pool.js")\n`);
    
    const sampleFile = path.join(worktreePath, 'src', `${this.name}_solution.js`);
    fs.mkdirSync(path.dirname(sampleFile), { recursive: true });
    fs.writeFileSync(sampleFile, `// Solution by ${this.name}\n// Task: ${taskText}\nexport function solve() { return true; }\n`);
    
    logStream.write(`[Step 3: Boundary Testing] Adding stress test cases...\n`);
    logStream.write(`  -> Tool Call: write_to_file("tests/${this.name}.test.js")\n`);
    logStream.write(`[Step 4: Quality Gate] Executing build & test suite verification...\n`);
    logStream.write(`  -> Verification Result: All tests passed\n`);
    logStream.write(`[ARACE TELEMETRY] Completed successfully. Total Tokens: 4,820 (Prompt: 3,920, Completion: 900)\n`);
    logStream.end();

    const durationSec = (Date.now() - startTime) / 1000;
    const estInput = 3920 + Math.floor(Math.random() * 600);
    const estOutput = 900 + Math.floor(Math.random() * 200);

    return {
      agent: this.name,
      exitCode: 0,
      durationSeconds: durationSec,
      timedOut: false,
      tokens: {
        promptTokens: estInput,
        completionTokens: estOutput,
        totalTokens: estInput + estOutput,
        costEstimate: `$${((estInput * 0.000003) + (estOutput * 0.000015)).toFixed(4)}`
      },
      toolsCalled: ['view_file', 'replace_file_content', 'write_to_file', 'run_command'],
      stdout: `[Mock] Finished task successfully`,
      stderr: ''
    };
  }
}

export class DshAdapter extends BaseAdapter {
  constructor(config = {}) { super('dsh', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'dsh';
    return { command: customCmd, args: ['run', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class ClaudeAdapter extends BaseAdapter {
  constructor(config = {}) { super('claude', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'claude';
    return { command: customCmd, args: ['-p', `"${taskText.replace(/"/g, '\\"')}"`, '--dangerously-skip-permissions'] };
  }
}

export class CodexAdapter extends BaseAdapter {
  constructor(config = {}) { super('codex', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'codex';
    return { command: customCmd, args: ['-p', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class AiderAdapter extends BaseAdapter {
  constructor(config = {}) { super('aider', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'aider';
    return { command: customCmd, args: ['--message', `"${taskText.replace(/"/g, '\\"')}"`, '--yes-always', '--no-git'] };
  }
}

export class GeminiAdapter extends BaseAdapter {
  constructor(config = {}) { super('gemini', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'agy';
    return { command: customCmd, args: ['-p', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class AntigravityAdapter extends BaseAdapter {
  constructor(config = {}) { super('antigravity', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'agy';
    return { command: customCmd, args: ['-p', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class CursorAdapter extends BaseAdapter {
  constructor(config = {}) { super('cursor', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'cursor-agent';
    return { command: customCmd, args: ['-p', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class WindsurfAdapter extends BaseAdapter {
  constructor(config = {}) { super('windsurf', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'windsurf';
    return { command: customCmd, args: ['--prompt', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class CopilotAdapter extends BaseAdapter {
  constructor(config = {}) { super('copilot', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'copilot';
    return { command: customCmd, args: ['-p', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class OpenHandsAdapter extends BaseAdapter {
  constructor(config = {}) { super('openhands', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'openhands';
    return { command: customCmd, args: ['--prompt', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class CodyAdapter extends BaseAdapter {
  constructor(config = {}) { super('cody', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'cody';
    return { command: customCmd, args: ['chat', '-m', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class GooseAdapter extends BaseAdapter {
  constructor(config = {}) { super('goose', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'goose';
    return { command: customCmd, args: ['run', '--instruction', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class ClineAdapter extends BaseAdapter {
  constructor(config = {}) { super('cline', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'cline';
    return { command: customCmd, args: ['-p', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class PlandexAdapter extends BaseAdapter {
  constructor(config = {}) { super('plandex', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'plandex';
    return { command: customCmd, args: ['tell', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class MentatAdapter extends BaseAdapter {
  constructor(config = {}) { super('mentat', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'mentat';
    return { command: customCmd, args: ['-p', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class OllamaAdapter extends BaseAdapter {
  constructor(config = {}) { super('ollama', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'ollama';
    const model = this.config.model || 'deepseek-coder';
    return { command: customCmd, args: ['run', model, `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class SgptAdapter extends BaseAdapter {
  constructor(config = {}) { super('sgpt', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'sgpt';
    return { command: customCmd, args: ['--code', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class OpenCodeAdapter extends BaseAdapter {
  constructor(config = {}) { super('opencode', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'opencode';
    return { command: customCmd, args: ['-p', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class LmStudioAdapter extends BaseAdapter {
  constructor(config = {}) { super('lmstudio', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'lms';
    return { command: customCmd, args: ['run', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class OpenClawAdapter extends BaseAdapter {
  constructor(config = {}) { super('openclaw', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'openclaw';
    return { command: customCmd, args: ['run', `"${taskText.replace(/"/g, '\\"')}"`] };
  }
}

export class ReasonixAdapter extends BaseAdapter {
  constructor(config = {}) { super('reasonix', config); }
  buildCommand(taskText) {
    const customCmd = this.config.cmd || 'reasonix';
    return { command: customCmd, args: ['-p', `"${taskText.replace(/"/g, '\\"')}"`] };
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
    case 'dsh': return new DshAdapter(config);
    case 'claude': return new ClaudeAdapter(config);
    case 'codex': return new CodexAdapter(config);
    case 'aider': return new AiderAdapter(config);
    case 'antigravity': return new AntigravityAdapter(config);
    case 'gemini':
    case 'agy': return new GeminiAdapter(config);
    case 'opencode': return new OpenCodeAdapter(config);
    case 'openclaw': return new OpenClawAdapter(config);
    case 'reasonix': return new ReasonixAdapter(config);
    case 'lmstudio':
    case 'lms': return new LmStudioAdapter(config);
    case 'cursor': return new CursorAdapter(config);
    case 'windsurf': return new WindsurfAdapter(config);
    case 'copilot': return new CopilotAdapter(config);
    case 'openhands':
    case 'opendevin': return new OpenHandsAdapter(config);
    case 'cody': return new CodyAdapter(config);
    case 'goose': return new GooseAdapter(config);
    case 'cline':
    case 'roo': return new ClineAdapter(config);
    case 'plandex': return new PlandexAdapter(config);
    case 'mentat': return new MentatAdapter(config);
    case 'ollama': return new OllamaAdapter(config);
    case 'sgpt': return new SgptAdapter(config);
    case 'tabnine': return new TabnineAdapter(config);
    default:
      return new CustomAdapter(agentName, config);
  }
}
