import { c, symbols, formatDuration } from './utils.js';
import { formatDiffBadge } from './diff_parser.js';

export function renderFactDashboard({
  runId,
  baseCommit,
  branchName,
  taskText,
  results
}) {
  const line = symbols.line.repeat(76);
  const output = [];

  output.push('');
  output.push(`${c('bold', 'RACE RESULTS')} (Run ID: ${c('cyan', runId)})`);
  output.push(`Base Commit: ${c('yellow', baseCommit)} (${branchName || 'main'})`);
  output.push(`Task: "${c('white', taskText || 'No task description')}"`);
  output.push(c('gray', line));

  // Table header
  const headers = [
    pad('Agent', 9),
    pad('Duration', 11),
    pad('Build', 8),
    pad('Lint', 7),
    pad('Tests', 13),
    pad('Source Diff', 14),
    'Test Diff'
  ];
  output.push(c('bold', headers.join('')));

  for (const r of results) {
    const agentCol = pad(r.agent, 9);
    const durCol = pad(formatDuration(r.durationSeconds), 11);

    const buildSymbol = r.build.skipped ? '-' : (r.build.passed ? c('green', symbols.check) : c('red', symbols.cross));
    const buildCol = pad(buildSymbol, 8, r.build.skipped ? 1 : 1);

    const lintSymbol = r.lint.skipped ? '-' : (r.lint.passed ? c('green', symbols.check) : c('red', symbols.cross));
    const lintCol = pad(lintSymbol, 7, r.lint.skipped ? 1 : 1);

    let testStr = '-';
    if (!r.test.skipped) {
      if (r.test.totalCount > 0) {
        testStr = `${r.test.passedCount}/${r.test.totalCount} pass`;
      } else {
        testStr = r.test.passed ? 'pass' : 'fail';
      }
      testStr = r.test.passed ? c('green', testStr) : c('red', testStr);
    }
    const testCol = pad(testStr, 13, r.test.skipped ? 1 : (r.test.passed ? testStr.length - 9 : testStr.length - 9));

    const srcDiffBadge = formatDiffBadge(r.diffStats.sourceAdded, r.diffStats.sourceRemoved, false);
    const srcDiffCol = pad(srcDiffBadge, 14);

    const testDiffBadge = formatDiffBadge(r.diffStats.testAdded, r.diffStats.testRemoved, r.diffStats.testModified);
    const testDiffCol = r.diffStats.testModified ? c('yellow', testDiffBadge) : testDiffBadge;

    output.push(`${agentCol}${durCol}${buildCol}${lintCol}${testCol}${srcDiffCol}${testDiffCol}`);
  }

  output.push(c('gray', line));
  output.push('');
  output.push(c('bold', 'Commands:'));
  output.push(`  ${c('cyan', symbols.arrow)} ${c('white', 'arace diff')}          Show full diff`);
  const topAgent = results.find(r => r.test.passed && r.build.passed && r.lint.passed) || results[0];
  if (topAgent) {
    output.push(`  ${c('cyan', symbols.arrow)} ${c('green', `arace keep ${topAgent.agent}`)}   Merge changes to current branch & cleanup`);
  } else {
    output.push(`  ${c('cyan', symbols.arrow)} ${c('white', 'arace keep <agent>')}   Merge changes to current branch & cleanup`);
  }
  output.push(`  ${c('cyan', symbols.arrow)} ${c('red', 'arace discard')}       Discard all worktrees`);
  output.push('');

  return output.join('\n');
}

export function getVisibleWidth(str) {
  if (!str) return 0;
  const clean = stripAnsi(String(str));
  let width = 0;
  for (const ch of clean) {
    width += (ch.codePointAt(0) > 0xFF) ? 2 : 1;
  }
  return width;
}

function pad(str, length, visualLength = null) {
  const visibleLen = visualLength !== null ? visualLength : getVisibleWidth(str);
  const padding = Math.max(0, length - visibleLen);
  return str + ' '.repeat(padding);
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
