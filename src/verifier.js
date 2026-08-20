import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseDurationToMs } from './utils.js';

/**
 * Serial verifier for a single worktree
 */
export function verifyWorktree({
  worktreePath,
  verifyConfig,
  logFilePath
}) {
  const timeoutMs = parseDurationToMs(verifyConfig.timeout_per_step || '180s');

  const logDir = path.dirname(logFilePath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logStream = (stepName, cmd, res) => {
    fs.appendFileSync(
      logFilePath,
      `\n--- VERIFY STEP: ${stepName} ---\nCommand: ${cmd}\nExit Code: ${res.status}\nStdout:\n${res.stdout}\nStderr:\n${res.stderr}\n`
    );
  };

  const results = {
    build: { passed: true, exitCode: 0, duration: 0, skipped: false },
    lint: { passed: true, exitCode: 0, duration: 0, skipped: false },
    test: {
      passed: true,
      exitCode: 0,
      duration: 0,
      skipped: false,
      passedCount: 0,
      totalCount: 0,
      summary: ''
    }
  };

  // Inspect package.json scripts if available
  const pkgJsonPath = path.join(worktreePath, 'package.json');
  let pkgScripts = null;
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      pkgScripts = pkg.scripts || {};
    } catch {}
  }

  // Step 1: Build
  if (verifyConfig.build_cmd && verifyConfig.build_cmd.trim()) {
    const isNpmRun = verifyConfig.build_cmd.startsWith('npm run ');
    const scriptName = isNpmRun ? verifyConfig.build_cmd.replace('npm run ', '').trim() : null;
    if (pkgScripts && isNpmRun && !pkgScripts[scriptName]) {
      results.build = { passed: true, exitCode: 0, duration: 0, skipped: true };
    } else {
      const start = Date.now();
      const res = runStep(verifyConfig.build_cmd, worktreePath, timeoutMs);
      const dur = (Date.now() - start) / 1000;
      results.build = {
        passed: res.status === 0,
        exitCode: res.status ?? 1,
        duration: dur,
        skipped: false
      };
      logStream('BUILD', verifyConfig.build_cmd, res);
    }
  } else {
    results.build.skipped = true;
  }

  // Step 2: Lint
  if (verifyConfig.lint_cmd && verifyConfig.lint_cmd.trim()) {
    const isNpmRun = verifyConfig.lint_cmd.startsWith('npm run ');
    const scriptName = isNpmRun ? verifyConfig.lint_cmd.replace('npm run ', '').trim() : null;
    if (pkgScripts && isNpmRun && !pkgScripts[scriptName]) {
      results.lint = { passed: true, exitCode: 0, duration: 0, skipped: true };
    } else {
      const start = Date.now();
      const res = runStep(verifyConfig.lint_cmd, worktreePath, timeoutMs);
      const dur = (Date.now() - start) / 1000;
      results.lint = {
        passed: res.status === 0,
        exitCode: res.status ?? 1,
        duration: dur,
        skipped: false
      };
      logStream('LINT', verifyConfig.lint_cmd, res);
    }
  } else {
    results.lint.skipped = true;
  }

  // Step 3: Test
  if (verifyConfig.test_cmd && verifyConfig.test_cmd.trim()) {
    const start = Date.now();
    const res = runStep(verifyConfig.test_cmd, worktreePath, timeoutMs);
    const dur = (Date.now() - start) / 1000;
    const testCounts = parseTestOutput(res.stdout + '\n' + res.stderr, res.status === 0);

    results.test = {
      passed: res.status === 0,
      exitCode: res.status ?? 1,
      duration: dur,
      skipped: false,
      passedCount: testCounts.passed,
      totalCount: testCounts.total,
      summary: testCounts.summary
    };
    logStream('TEST', verifyConfig.test_cmd, res);
  } else {
    results.test.skipped = true;
  }

  return results;
}

function runStep(command, cwd, timeoutMs) {
  try {
    const res = spawnSync(command, {
      cwd,
      shell: true,
      encoding: 'utf8',
      timeout: timeoutMs,
      env: {
        ...process.env,
        CI: 'true'
      }
    });

    return {
      status: res.status ?? (res.error ? 1 : 0),
      stdout: res.stdout || '',
      stderr: res.stderr || (res.error ? res.error.message : '')
    };
  } catch (err) {
    return {
      status: 1,
      stdout: '',
      stderr: err.message
    };
  }
}

/**
 * Robust regex test parser for Jest, Vitest, Pytest, Go, Cargo, Mocha, Node.js test runner
 */
export function parseTestOutput(output, isExitZero) {
  if (!output) {
    return { passed: isExitZero ? 1 : 0, total: 1, summary: isExitZero ? 'pass' : 'fail' };
  }

  // Jest / Vitest: Tests: 14 passed, 14 total
  const jestMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,?\s*)?(?:(\d+)\s+passed,?\s*)?(?:(\d+)\s+total)/i);
  if (jestMatch) {
    const failed = parseInt(jestMatch[1] || '0', 10);
    const passed = parseInt(jestMatch[2] || '0', 10);
    const total = parseInt(jestMatch[3] || '0', 10);
    return {
      passed,
      total,
      summary: `${passed}/${total} pass`
    };
  }

  // Node.js test runner: ℹ pass 14 / ℹ tests 14 / ℹ fail 0
  const passMatch = output.match(/(?:ℹ|#)\s+pass\s+(\d+)/i);
  const testsMatch = output.match(/(?:ℹ|#)\s+tests\s+(\d+)/i);
  if (passMatch && testsMatch) {
    const passed = parseInt(passMatch[1], 10);
    const total = parseInt(testsMatch[1], 10);
    return {
      passed,
      total,
      summary: `${passed}/${total} pass`
    };
  }

  // Pytest: 14 passed, 2 failed
  const pytestMatch = output.match(/(\d+)\s+passed(?:,\s+(\d+)\s+failed)?/i);
  if (pytestMatch) {
    const passed = parseInt(pytestMatch[1] || '0', 10);
    const failed = parseInt(pytestMatch[2] || '0', 10);
    const total = passed + failed;
    return {
      passed,
      total,
      summary: `${passed}/${total} pass`
    };
  }

  // Cargo test: test result: ok. 14 passed; 0 failed
  const cargoMatch = output.match(/test result:\s+\w+\.\s+(\d+)\s+passed;\s+(\d+)\s+failed/i);
  if (cargoMatch) {
    const passed = parseInt(cargoMatch[1] || '0', 10);
    const failed = parseInt(cargoMatch[2] || '0', 10);
    const total = passed + failed;
    return {
      passed,
      total,
      summary: `${passed}/${total} pass`
    };
  }

  // Mocha: 14 passing (2s)
  const mochaMatch = output.match(/(\d+)\s+passing(?:[^\d]+(\d+)\s+failing)?/i);
  if (mochaMatch) {
    const passed = parseInt(mochaMatch[1] || '0', 10);
    const failed = parseInt(mochaMatch[2] || '0', 10);
    const total = passed + failed;
    return {
      passed,
      total,
      summary: `${passed}/${total} pass`
    };
  }

  // Fallback if exit code is 0
  if (isExitZero) {
    return { passed: 1, total: 1, summary: 'pass' };
  } else {
    return { passed: 0, total: 1, summary: 'fail' };
  }
}
