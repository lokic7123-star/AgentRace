import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function detectCoWSupport(testDir = process.cwd()) {
  const platform = os.platform();
  const testSrc = path.join(testDir, `.cow_test_src_${Date.now()}`);
  const testDst = path.join(testDir, `.cow_test_dst_${Date.now()}`);

  try {
    fs.writeFileSync(testSrc, 'arace_cow_probe');

    if (platform === 'darwin') {
      // macOS APFS supports cp -c
      const res = spawnSync('cp', ['-c', testSrc, testDst]);
      if (res.status === 0) {
        cleanup();
        return { supported: true, method: 'apfs_clone', command: 'cp -c -R' };
      }
    } else if (platform === 'linux') {
      // Linux supports cp --reflink=always
      const res = spawnSync('cp', ['--reflink=always', testSrc, testDst]);
      if (res.status === 0) {
        cleanup();
        return { supported: true, method: 'linux_reflink', command: 'cp --reflink=auto -R' };
      }
    }
  } catch {} finally {
    cleanup();
  }

  function cleanup() {
    try { if (fs.existsSync(testSrc)) fs.unlinkSync(testSrc); } catch {}
    try { if (fs.existsSync(testDst)) fs.unlinkSync(testDst); } catch {}
  }

  return { supported: false, method: 'fallback_prepare', command: null };
}

/**
 * Perform fast dependency cloning or fallback prepare command
 */
export async function initializeWorktreeDependencies({ repoRoot, worktreePath, prepareCmd }) {
  const cow = detectCoWSupport(repoRoot);

  // Common dependency directories
  const depDirs = ['node_modules', 'vendor', 'target'];
  let clonedViaCoW = false;

  if (cow.supported) {
    for (const dep of depDirs) {
      const srcDep = path.join(repoRoot, dep);
      const dstDep = path.join(worktreePath, dep);
      if (fs.existsSync(srcDep) && !fs.existsSync(dstDep)) {
        try {
          if (cow.method === 'apfs_clone') {
            execSync(`cp -c -R "${srcDep}" "${dstDep}"`, { stdio: 'ignore' });
            clonedViaCoW = true;
          } else if (cow.method === 'linux_reflink') {
            execSync(`cp --reflink=auto -R "${srcDep}" "${dstDep}"`, { stdio: 'ignore' });
            clonedViaCoW = true;
          }
        } catch {
          clonedViaCoW = false;
        }
      }
    }
  }

  // If not cloned via CoW, or if user specified a prepare command
  if (!clonedViaCoW && prepareCmd && prepareCmd.trim()) {
    try {
      execSync(prepareCmd, {
        cwd: worktreePath,
        encoding: 'utf8',
        stdio: ['ignore', 'ignore', 'ignore'],
        timeout: 120000
      });
    } catch (err) {
      // Non-fatal if prepare command returns error, continue
    }
  }

  return { clonedViaCoW, method: clonedViaCoW ? cow.method : 'prepare_cmd' };
}
