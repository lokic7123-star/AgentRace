import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function assertSafeGitRef(name) {
  if (!/^[\w][\w./-]*$/.test(String(name))) {
    throw new Error(`Unsafe git ref rejected: ${name}`);
  }
}

export function isGitRepo(cwd = process.cwd()) {
  try {
    const res = execSync('git rev-parse --is-inside-work-tree', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return res.trim() === 'true';
  } catch {
    return false;
  }
}

export function getRepoRoot(cwd = process.cwd()) {
  try {
    const res = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return res.trim();
  } catch {
    return cwd;
  }
}

export function checkCleanWorkspace(cwd = process.cwd()) {
  try {
    const status = execSync('git status --porcelain', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const isClean = status.trim().length === 0;
    return { isClean, dirtyFiles: status.trim().split('\n').filter(Boolean) };
  } catch (err) {
    throw new Error(`Failed to check git status: ${err.message}`);
  }
}

export function getCurrentCommit(cwd = process.cwd(), short = true) {
  try {
    const flag = short ? '--short HEAD' : 'HEAD';
    const hash = execSync(`git rev-parse ${flag}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return hash.trim();
  } catch {
    return 'unknown';
  }
}

export function getCurrentBranch(cwd = process.cwd()) {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return branch.trim();
  } catch {
    return 'main';
  }
}

export function createWorktree({ repoRoot, runId, agentName, baseCommit }) {
  assertSafeGitRef(runId);
  assertSafeGitRef(agentName);
  if (baseCommit) {
    assertSafeGitRef(baseCommit);
  }

  const worktreeRelPath = path.join('.arace', 'worktrees', runId, agentName);
  const worktreeAbsPath = path.resolve(repoRoot, worktreeRelPath);
  const branchName = `arace/${runId}/${agentName}`;

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(worktreeAbsPath), { recursive: true });

  // Delete existing branch or worktree if needed
  try {
    execSync(`git branch -D "${branchName}"`, { cwd: repoRoot, stdio: 'ignore' });
  } catch {}

  const commitTarget = baseCommit || 'HEAD';
  try {
    const res = spawnSync('git', ['worktree', 'add', '-b', branchName, worktreeAbsPath, commitTarget], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (res.status !== 0) {
      throw new Error(res.stderr || res.stdout || `Exit code ${res.status}`);
    }
    return {
      worktreePath: worktreeAbsPath,
      branchName
    };
  } catch (err) {
    throw new Error(`Failed to create git worktree for ${agentName}: ${err.message}`);
  }
}

export function removeWorktree(worktreePath, repoRoot = process.cwd(), branchName = null) {
  try {
    if (fs.existsSync(worktreePath)) {
      execSync(`git worktree remove --force "${worktreePath}"`, { cwd: repoRoot, stdio: 'ignore' });
    }
  } catch {}

  try {
    execSync('git worktree prune', { cwd: repoRoot, stdio: 'ignore' });
  } catch {}

  if (branchName) {
    try {
      assertSafeGitRef(branchName);
      execSync(`git branch -D "${branchName}"`, { cwd: repoRoot, stdio: 'ignore' });
    } catch (err) {
      if (err.message.includes('Unsafe git ref')) {
        console.warn(`[arace] Unsafe/suspicious ref skipped: ${branchName}`);
      }
    }
  }
}

export function pruneAllWorktrees(repoRoot = process.cwd()) {
  try {
    execSync('git worktree prune', { cwd: repoRoot, stdio: 'ignore' });
  } catch {}

  const araceDir = path.join(repoRoot, '.arace', 'worktrees');
  if (fs.existsSync(araceDir)) {
    try {
      fs.rmSync(araceDir, { recursive: true, force: true });
    } catch {}
  }
}

export function getWorktreeDiff(worktreePath, baseCommit) {
  try {
    // First, add all untracked files in worktree so diff includes them if any
    execSync('git add -N .', { cwd: worktreePath, stdio: 'ignore' });
    
    const diffTarget = baseCommit || 'HEAD';
    assertSafeGitRef(diffTarget);

    // Get diff against baseCommit
    const diffText = execSync(`git diff "${diffTarget}"`, {
      cwd: worktreePath,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024
    });

    const numstatText = execSync(`git diff --numstat "${diffTarget}"`, {
      cwd: worktreePath,
      encoding: 'utf8'
    });

    return { diffText, numstatText };
  } catch (err) {
    if (err.message && err.message.includes('Unsafe git ref')) {
      console.warn(`[arace] Unsafe/suspicious ref skipped: ${baseCommit}`);
    }
    return { diffText: '', numstatText: '' };
  }
}

export function commitWorktreeChanges(worktreePath, message = 'arace: agent auto-commit') {
  try {
    execSync('git add -A', { cwd: worktreePath, stdio: 'ignore' });
    const status = execSync('git status --porcelain', { cwd: worktreePath, encoding: 'utf8' });
    if (status.trim().length > 0) {
      const res = spawnSync('git', ['commit', '-m', message], { cwd: worktreePath, stdio: 'ignore' });
      return res.status === 0;
    }
    return false;
  } catch {
    return false;
  }
}

export function mergeBranchToCurrent(repoRoot, branchName, strategy = 'merge') {
  try {
    assertSafeGitRef(branchName);

    // Check if target branch has commits
    const logRes = spawnSync('git', ['log', '-n', '1', branchName], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    if (logRes.status !== 0 || !logRes.stdout.trim()) {
      throw new Error(`Branch ${branchName} has no commits.`);
    }

    // Try standard git merge
    const res = spawnSync('git', ['merge', '--no-ff', '-m', `Merge arace solution from ${branchName}`, branchName], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    if (res.status !== 0) {
      // Conflict detected!
      const status = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8' });
      return {
        success: false,
        conflict: true,
        conflictFiles: status.split('\n').filter(l => l.startsWith('UU') || l.startsWith('AA') || l.startsWith('DU') || l.startsWith('UD')),
        error: res.stderr || res.stdout
      };
    }

    return { success: true, conflict: false };
  } catch (err) {
    return { success: false, conflict: false, error: err.message };
  }
}
