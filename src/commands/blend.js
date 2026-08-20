import fs from 'node:fs';
import path from 'node:path';
import { getRepoRoot } from '../git.js';
import { loadProjectConfig } from '../config.js';
import { synthesizeEnsemble } from '../synthesizer.js';
import { renderFactDashboard } from '../dashboard.js';
import { c, symbols } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function blendCommand(args = []) {
  const repoRoot = getRepoRoot();
  const latestRunFile = path.join(repoRoot, '.arace', 'latest_run.json');

  if (!fs.existsSync(latestRunFile)) {
    console.error(c('red', 'Error: No active race run found. Run `arace run` first.'));
    return EXIT_CODES.GENERAL_ERROR;
  }

  let judgeAgent = 'dsh';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--with-judge' || arg === '--judge') && args[i + 1]) {
      judgeAgent = args[i + 1];
      i++;
    } else if (arg.startsWith('--with-judge=')) {
      judgeAgent = arg.slice(13);
    } else if (!arg.startsWith('-')) {
      judgeAgent = arg;
    }
  }

  const runInfo = JSON.parse(fs.readFileSync(latestRunFile, 'utf8'));
  const config = loadProjectConfig(repoRoot);

  try {
    const ensembleResult = await synthesizeEnsemble({
      repoRoot,
      judgeAgent,
      config,
      runInfo
    });

    console.log(c('green', `\n${symbols.check} AI Ensemble successfully generated on branch: ${c('bold', ensembleResult.branchName)}\n`));
    
    // Display dashboard for ensemble
    const dashboard = renderFactDashboard({
      runId: runInfo.runId,
      baseCommit: runInfo.baseCommit,
      branchName: runInfo.branchName,
      taskText: `[Ensemble Blend] ${runInfo.taskText}`,
      results: [ensembleResult]
    });
    console.log(dashboard);

    console.log(c('bold', 'Next Step:'));
    console.log(`  ${c('cyan', symbols.arrow)} Run ${c('green', 'arace keep ensemble')} to merge the synthesized solution into your branch.\n`);

    return EXIT_CODES.SUCCESS;
  } catch (err) {
    console.error(c('red', `\nEnsemble Blend Failed: ${err.message}`));
    return EXIT_CODES.GENERAL_ERROR;
  }
}
