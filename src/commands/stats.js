import { getRepoRoot } from '../git.js';
import { getStats } from '../db.js';
import { c, formatDuration } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function statsCommand(args = []) {
  let sinceDays = 30;
  let category = null;
  let isJson = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--since' && args[i + 1]) {
      const match = args[i + 1].match(/^(\d+)d?$/i);
      if (match) sinceDays = parseInt(match[1], 10);
      i++;
    } else if (arg.startsWith('--since=')) {
      const match = arg.slice(8).match(/^(\d+)d?$/i);
      if (match) sinceDays = parseInt(match[1], 10);
    } else if (arg === '--category' && args[i + 1]) {
      category = args[i + 1];
      i++;
    } else if (arg.startsWith('--category=')) {
      category = arg.slice(11);
    } else if (arg === '--json') {
      isJson = true;
    }
  }

  const repoRoot = getRepoRoot();
  const stats = getStats({ repoPath: repoRoot, sinceDays, category });

  if (isJson) {
    console.log(JSON.stringify(stats, null, 2));
    return EXIT_CODES.SUCCESS;
  }

  console.log(`\nRepository: ${c('bold', stats.repoPath)}`);
  console.log(`History: ${c('cyan', stats.totalRuns.toString())} runs in last ${sinceDays} days\n`);

  if (stats.totalRuns === 0) {
    console.log(c('dim', 'No race history recorded for this repository yet. Run `arace run "<task>"` to start.\n'));
    return EXIT_CODES.SUCCESS;
  }

  // Category Breakdown
  console.log(c('bold', 'Category Breakdown:'));
  for (const [catName, catData] of Object.entries(stats.categories)) {
    const keptList = [];
    const totalKeptInCat = Object.values(catData.keptByAgent).reduce((a, b) => a + b, 0);

    for (const [agent, keptCount] of Object.entries(catData.keptByAgent)) {
      const pct = totalKeptInCat > 0 ? Math.round((keptCount / totalKeptInCat) * 100) : 0;
      keptList.push(`${agent}: ${keptCount} kept (${pct}%)`);
    }

    const keptStr = keptList.length > 0 ? keptList.join(' | ') : 'None kept';
    console.log(`  ${c('yellow', catName.padEnd(10))} (${catData.total} runs)  ${keptStr}`);
  }

  console.log(`\n${c('bold', 'Overall Metrics:')}`);

  // Metric 1: Test Pass Rate
  const passRates = [];
  for (const [agent, m] of Object.entries(stats.agentMetrics)) {
    const rate = m.totalAttempts > 0 ? ((m.testPassedRuns / m.totalAttempts) * 100).toFixed(1) : '0.0';
    passRates.push(`${agent}: ${rate}%`);
  }
  console.log(`  ${'Test Pass Rate:'.padEnd(18)} ${passRates.join(' | ')}`);

  // Metric 2: Average Latency
  const latencies = [];
  for (const [agent, m] of Object.entries(stats.agentMetrics)) {
    const avgSec = m.totalAttempts > 0 ? (m.totalDuration / m.totalAttempts) : 0;
    latencies.push(`${agent}: ${formatDuration(avgSec)}`);
  }
  console.log(`  ${'Average Latency:'.padEnd(18)} ${latencies.join(' | ')}`);

  // Metric 3: Avg Diff Size
  const diffSizes = [];
  for (const [agent, m] of Object.entries(stats.agentMetrics)) {
    const avgAdd = m.totalAttempts > 0 ? Math.round(m.totalSourceAdded / m.totalAttempts) : 0;
    const avgRem = m.totalAttempts > 0 ? Math.round(m.totalSourceRemoved / m.totalAttempts) : 0;
    diffSizes.push(`${agent}: +${avgAdd}/-${avgRem}`);
  }
  console.log(`  ${'Avg Diff Size:'.padEnd(18)} ${diffSizes.join(' | ')}\n`);

  return EXIT_CODES.SUCCESS;
}
