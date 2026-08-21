import crypto from 'node:crypto';
import path from 'node:path';

// Terminal colors (ANSI)
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightGreen: '\x1b[92m',
  brightRed: '\x1b[91m',
  brightYellow: '\x1b[93m',
  brightCyan: '\x1b[96m'
};

export const symbols = {
  check: '✓',
  cross: '✗',
  warning: '⚠',
  bullet: '•',
  arrow: '→',
  line: '━'
};

export function c(colorKey, text) {
  return `${colors[colorKey] || ''}${text}${colors.reset}`;
}

export function parseDurationToMs(durationStr, defaultSeconds = 600) {
  if (typeof durationStr === 'number') return durationStr * 1000;
  if (!durationStr || typeof durationStr !== 'string') return defaultSeconds * 1000;
  const match = durationStr.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/i);
  if (!match) return defaultSeconds * 1000;
  const val = parseFloat(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  switch (unit) {
    case 'ms': return Math.round(val);
    case 's': return Math.round(val * 1000);
    case 'm': return Math.round(val * 60 * 1000);
    case 'h': return Math.round(val * 3600 * 1000);
    default: return Math.round(val * 1000);
  }
}

export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '0.0s';
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const remSec = (seconds % 60).toFixed(1);
  return `${mins}m ${remSec}s`;
}

export function generateRunId() {
  return crypto.randomBytes(8).toString('hex'); // 16-character secure hash
}

export function classifyTaskCategory(taskText) {
  if (!taskText) return 'other';
  const text = taskText.toLowerCase();
  if (/\b(fix|bug|issue|defect|error|panic|crash|patch|repair|resolve|exception)\b/i.test(text)) {
    return 'bugfix';
  }
  if (/\b(refactor|cleanup|clean\s*up|optimize|perf|restructure|simplify|migrate|rename|modernize)\b/i.test(text)) {
    return 'refactor';
  }
  if (/\b(test|spec|coverage|assert|mock|e2e|unit\s*test)\b/i.test(text)) {
    return 'test';
  }
  if (/\b(feat|feature|add|implement|support|create|new|enhance|build)\b/i.test(text)) {
    return 'feature';
  }
  return 'other';
}

/**
 * Simple glob matching for paths (supports **, *, ?)
 */
export function matchGlob(filePath, pattern) {
  const normPath = filePath.replace(/\\/g, '/');
  const normPattern = pattern.replace(/\\/g, '/');

  // Convert glob pattern to regex
  const regexStr = normPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex chars except * and ?
    .replace(/\*\*/g, '§§GLOBSTAR§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§GLOBSTAR§§/g, '.*')
    .replace(/\?/g, '[^/]');

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(normPath) || regex.test(`/${normPath}`);
}

export function isTestFile(filePath, testPatterns = []) {
  if (!testPatterns || testPatterns.length === 0) {
    testPatterns = [
      'test/**',
      'tests/**',
      '**/*.spec.*',
      '**/*.test.*',
      '**/test_*.*',
      '**/*_test.*'
    ];
  }
  const normPath = filePath.replace(/\\/g, '/');
  return testPatterns.some(pattern => matchGlob(normPath, pattern));
}
