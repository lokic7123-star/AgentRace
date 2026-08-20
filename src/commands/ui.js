import { exec } from 'node:child_process';
import os from 'node:os';
import { createServer } from '../server/api.js';
import { getRepoRoot } from '../git.js';
import { c, symbols } from '../utils.js';
import { EXIT_CODES } from '../types.js';

export async function uiCommand(args = []) {
  let port = 3333;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10) || 3333;
      i++;
    } else if (args[i].startsWith('--port=')) {
      port = parseInt(args[i].slice(7), 10) || 3333;
    }
  }

  const repoRoot = getRepoRoot();
  const server = createServer(repoRoot);

  return new Promise((resolve) => {
    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`\n${c('bold', 'AgentRace Web Dashboard & Ensemble Studio')}\n`);
      console.log(`  ${c('green', symbols.check)} Local Server: ${c('cyan', url)}`);
      console.log(`  ${c('cyan', symbols.arrow)} Press ${c('bold', 'Ctrl+C')} to stop\n`);

      // Open browser automatically if not headless
      if (!args.includes('--no-open')) {
        const platform = os.platform();
        let openCmd = `start ${url}`;
        if (platform === 'darwin') openCmd = `open ${url}`;
        else if (platform === 'linux') openCmd = `xdg-open ${url}`;
        try { exec(openCmd); } catch {}
      }
    });

    server.on('error', (err) => {
      console.error(c('red', `Failed to start Web UI server: ${err.message}`));
      resolve(EXIT_CODES.GENERAL_ERROR);
    });

    process.on('SIGINT', () => {
      console.log(c('dim', '\nStopping AgentRace Web Server...'));
      server.close();
      resolve(EXIT_CODES.SUCCESS);
    });
  });
}
