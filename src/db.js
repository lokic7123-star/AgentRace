import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { getGlobalConfigDir, loadGlobalConfig } from './config.js';

let _db = null;

export function getDatabase() {
  if (_db) return _db;
  const globalConfig = loadGlobalConfig();
  const dbPath = globalConfig.storage.db_path;
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _db = new DatabaseSync(dbPath);
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      repo_path TEXT NOT NULL,
      base_commit TEXT NOT NULL,
      task_text TEXT,
      task_category TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      agent TEXT NOT NULL,
      duration_seconds REAL DEFAULT 0,
      exit_code INTEGER DEFAULT 0,
      build_passed INTEGER DEFAULT 0,
      lint_passed INTEGER DEFAULT 0,
      test_passed INTEGER DEFAULT 0,
      tests_passed_count INTEGER DEFAULT 0,
      tests_total_count INTEGER DEFAULT 0,
      source_lines_added INTEGER DEFAULT 0,
      source_lines_removed INTEGER DEFAULT 0,
      test_lines_added INTEGER DEFAULT 0,
      test_lines_removed INTEGER DEFAULT 0,
      kept INTEGER DEFAULT 0,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_runs_repo ON runs(repo_path);
    CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at);
    CREATE INDEX IF NOT EXISTS idx_results_run ON run_results(run_id);
  `);
}

export function saveRunRecord(runData, resultsData) {
  const db = getDatabase();
  const insertRun = db.prepare(`
    INSERT INTO runs (id, repo_path, base_commit, task_text, task_category, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertRun.run(
    runData.id,
    runData.repo_path,
    runData.base_commit,
    runData.task_text || '',
    runData.task_category || 'other',
    runData.created_at || new Date().toISOString()
  );

  const insertResult = db.prepare(`
    INSERT INTO run_results (
      run_id, agent, duration_seconds, exit_code,
      build_passed, lint_passed, test_passed,
      tests_passed_count, tests_total_count,
      source_lines_added, source_lines_removed,
      test_lines_added, test_lines_removed,
      kept
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const r of resultsData) {
    insertResult.run(
      runData.id,
      r.agent,
      r.duration_seconds || 0,
      r.exit_code ?? 0,
      r.build_passed ? 1 : 0,
      r.lint_passed ? 1 : 0,
      r.test_passed ? 1 : 0,
      r.tests_passed_count || 0,
      r.tests_total_count || 0,
      r.source_lines_added || 0,
      r.source_lines_removed || 0,
      r.test_lines_added || 0,
      r.test_lines_removed || 0,
      r.kept ? 1 : 0
    );
  }
}

export function markAgentKept(runId, agentName) {
  const db = getDatabase();
  // Clear kept for others in same run
  db.prepare(`UPDATE run_results SET kept = 0 WHERE run_id = ?`).run(runId);
  // Mark chosen agent
  const update = db.prepare(`UPDATE run_results SET kept = 1 WHERE run_id = ? AND agent = ?`);
  update.run(runId, agentName);
}

export function getLatestRun(repoPath) {
  const db = getDatabase();
  let query = `SELECT * FROM runs`;
  const params = [];
  if (repoPath) {
    query += ` WHERE repo_path = ?`;
    params.push(repoPath);
  }
  query += ` ORDER BY created_at DESC LIMIT 1`;
  const run = db.prepare(query).get(...params);
  if (!run) return null;

  const results = db.prepare(`SELECT * FROM run_results WHERE run_id = ?`).all(run.id);
  return { ...run, results };
}

export function getStats({ repoPath, sinceDays = 30, category = null }) {
  const db = getDatabase();
  const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  let runsQuery = `SELECT * FROM runs WHERE created_at >= ?`;
  const runsParams = [sinceDate];

  if (repoPath) {
    runsQuery += ` AND repo_path = ?`;
    runsParams.push(repoPath);
  }
  if (category) {
    runsQuery += ` AND task_category = ?`;
    runsParams.push(category);
  }
  runsQuery += ` ORDER BY created_at DESC`;

  const runs = db.prepare(runsQuery).all(...runsParams);
  const runIds = runs.map(r => r.id);

  if (runs.length === 0) {
    return {
      repoPath: repoPath || 'All',
      sinceDays,
      totalRuns: 0,
      categories: {},
      agentMetrics: {}
    };
  }

  let resultsQuery = `
    SELECT r.*, m.task_category 
    FROM run_results r 
    JOIN runs m ON r.run_id = m.id 
    WHERE m.created_at >= ?
  `;
  const resultsParams = [sinceDate];
  if (repoPath) {
    resultsQuery += ` AND m.repo_path = ?`;
    resultsParams.push(repoPath);
  }
  if (category) {
    resultsQuery += ` AND m.task_category = ?`;
    resultsParams.push(category);
  }
  const results = db.prepare(resultsQuery).all(...resultsParams);

  // Group by category
  const categories = {};
  for (const r of runs) {
    const cat = r.task_category || 'other';
    if (!categories[cat]) categories[cat] = { total: 0, keptByAgent: {} };
    categories[cat].total += 1;
  }

  // Agent metrics
  const agentMetrics = {};

  for (const res of results) {
    const cat = res.task_category || 'other';
    const agent = res.agent;

    if (!agentMetrics[agent]) {
      agentMetrics[agent] = {
        totalAttempts: 0,
        testsPassedCount: 0,
        testsAttemptedCount: 0,
        testPassedRuns: 0,
        totalDuration: 0,
        totalSourceAdded: 0,
        totalSourceRemoved: 0,
        totalKept: 0
      };
    }

    const m = agentMetrics[agent];
    m.totalAttempts += 1;
    m.totalDuration += res.duration_seconds;
    m.totalSourceAdded += res.source_lines_added;
    m.totalSourceRemoved += res.source_lines_removed;
    if (res.test_passed) m.testPassedRuns += 1;
    if (res.tests_total_count > 0) {
      m.testsPassedCount += res.tests_passed_count;
      m.testsAttemptedCount += res.tests_total_count;
    }
    if (res.kept) {
      m.totalKept += 1;
      if (categories[cat]) {
        categories[cat].keptByAgent[agent] = (categories[cat].keptByAgent[agent] || 0) + 1;
      }
    }
  }

  return {
    repoPath: repoPath || 'All',
    sinceDays,
    totalRuns: runs.length,
    categories,
    agentMetrics
  };
}

export function getRunHistory({ repoPath, limit = 50 } = {}) {
  const db = getDatabase();
  let query = `SELECT * FROM runs`;
  const params = [];
  if (repoPath) {
    query += ` WHERE repo_path = ?`;
    params.push(repoPath);
  }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  const runs = db.prepare(query).all(...params);
  return runs.map(run => {
    const results = db.prepare(`SELECT * FROM run_results WHERE run_id = ?`).all(run.id);
    return { ...run, results };
  });
}

export function getRunById(runId) {
  const db = getDatabase();
  const run = db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId);
  if (!run) return null;
  const results = db.prepare(`SELECT * FROM run_results WHERE run_id = ?`).all(runId);
  return { ...run, results };
}

export function updateRunTaskText(runId, taskText) {
  const db = getDatabase();
  db.prepare(`UPDATE runs SET task_text = ? WHERE id = ?`).run(taskText, runId);
}

