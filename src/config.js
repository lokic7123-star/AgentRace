import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DEFAULT_CONFIG } from './types.js';

/**
 * Clean YAML parser for standard key-value, nested maps, and array lists
 */
export function parseSimpleYaml(content) {
  if (!content || typeof content !== 'string') return {};
  const lines = content.split(/\r?\n/);

  function parseBlock(startIdx, minIndent) {
    let result = null;
    let i = startIdx;

    while (i < lines.length) {
      const rawLine = lines[i];
      const commentIdx = rawLine.indexOf('#');
      const lineWithoutComment = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
      if (!lineWithoutComment.trim()) {
        i++;
        continue;
      }

      const indent = lineWithoutComment.search(/\S/);
      if (indent < minIndent) {
        break;
      }

      const trimmed = lineWithoutComment.trim();

      if (trimmed.startsWith('- ')) {
        if (result === null) result = [];
        if (!Array.isArray(result)) break;

        const valPart = trimmed.slice(2).trim();
        if (valPart.includes(': ') && !valPart.startsWith('"') && !valPart.startsWith("'")) {
          // Object item in list
          const colonIdx = valPart.indexOf(':');
          const k = valPart.slice(0, colonIdx).trim();
          const v = cleanYamlValue(valPart.slice(colonIdx + 1).trim());
          result.push({ [k]: v });
          i++;
        } else if (valPart === '') {
          // Nested block under list item
          const [nestedVal, nextIdx] = parseBlock(i + 1, indent + 2);
          result.push(nestedVal);
          i = nextIdx;
        } else {
          result.push(cleanYamlValue(valPart));
          i++;
        }
      } else {
        if (result === null) result = {};
        if (Array.isArray(result)) break;

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0) {
          const key = trimmed.slice(0, colonIdx).trim();
          const rawVal = trimmed.slice(colonIdx + 1).trim();

          if (rawVal === '') {
            // Nested block or list
            const [nestedVal, nextIdx] = parseBlock(i + 1, indent + 1);
            result[key] = nestedVal;
            i = nextIdx;
          } else {
            result[key] = cleanYamlValue(rawVal);
            i++;
          }
        } else {
          i++;
        }
      }
    }

    return [result, i];
  }

  const [parsed] = parseBlock(0, 0);
  return parsed || {};
}

function cleanYamlValue(val) {
  if (val.startsWith('"') && val.endsWith('"')) {
    return val.slice(1, -1).replace(/\\"/g, '"');
  }
  if (val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1).replace(/\\'/g, "'");
  }
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null' || val === '~') return null;
  if (!isNaN(Number(val)) && val !== '') return Number(val);
  return val;
}

export function loadConfigFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.json')) {
    return JSON.parse(content);
  }
  return parseSimpleYaml(content);
}

export function getGlobalConfigDir() {
  return path.join(os.homedir(), '.arace');
}

export function loadGlobalConfig() {
  const dir = getGlobalConfigDir();
  const yamlPath = path.join(dir, 'config.yaml');
  const ymlPath = path.join(dir, 'config.yml');
  const jsonPath = path.join(dir, 'config.json');

  let config = {};
  if (fs.existsSync(yamlPath)) config = loadConfigFile(yamlPath) || {};
  else if (fs.existsSync(ymlPath)) config = loadConfigFile(ymlPath) || {};
  else if (fs.existsSync(jsonPath)) config = loadConfigFile(jsonPath) || {};

  return {
    version: 1,
    storage: {
      db_path: path.join(dir, 'history.db'),
      ...(config.storage || {})
    },
    execution: {
      max_parallel_agents: 3,
      ...(config.execution || {})
    }
  };
}

export function loadProjectConfig(repoPath = process.cwd()) {
  const yamlPath = path.join(repoPath, '.arace.yaml');
  const ymlPath = path.join(repoPath, '.arace.yml');
  const jsonPath = path.join(repoPath, '.arace.json');

  let custom = {};
  let foundPath = null;

  if (fs.existsSync(yamlPath)) {
    custom = loadConfigFile(yamlPath) || {};
    foundPath = yamlPath;
  } else if (fs.existsSync(ymlPath)) {
    custom = loadConfigFile(ymlPath) || {};
    foundPath = ymlPath;
  } else if (fs.existsSync(jsonPath)) {
    custom = loadConfigFile(jsonPath) || {};
    foundPath = jsonPath;
  }

  const globalConf = loadGlobalConfig();

  return {
    configPath: foundPath,
    version: custom.version || 1,
    workspace: {
      prepare_cmd: custom.workspace?.prepare_cmd || DEFAULT_CONFIG.workspace.prepare_cmd,
      test_paths: custom.workspace?.test_paths || DEFAULT_CONFIG.workspace.test_paths
    },
    verify: {
      build_cmd: custom.verify?.build_cmd || DEFAULT_CONFIG.verify.build_cmd,
      lint_cmd: custom.verify?.lint_cmd || DEFAULT_CONFIG.verify.lint_cmd,
      test_cmd: custom.verify?.test_cmd || DEFAULT_CONFIG.verify.test_cmd,
      timeout_per_step: custom.verify?.timeout_per_step || DEFAULT_CONFIG.verify.timeout_per_step
    },
    defaults: {
      agents: custom.defaults?.agents || DEFAULT_CONFIG.defaults.agents,
      timeout: custom.defaults?.timeout || DEFAULT_CONFIG.defaults.timeout
    },
    adapters: custom.adapters || {},
    global: globalConf
  };
}
