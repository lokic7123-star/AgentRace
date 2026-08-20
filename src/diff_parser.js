import { isTestFile } from './utils.js';

/**
 * Parse git diff numstat output and categorize into Source vs Test diffs
 */
export function parseDiffStats(numstatText, testPatterns = []) {
  if (!numstatText || !numstatText.trim()) {
    return {
      sourceAdded: 0,
      sourceRemoved: 0,
      testAdded: 0,
      testRemoved: 0,
      testModified: false,
      files: []
    };
  }

  const lines = numstatText.trim().split(/\r?\n/);
  let sourceAdded = 0;
  let sourceRemoved = 0;
  let testAdded = 0;
  let testRemoved = 0;
  let testModified = false;
  const files = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(/\t+/);
    if (parts.length < 3) continue;

    const addedStr = parts[0];
    const removedStr = parts[1];
    const filePath = parts.slice(2).join('\t'); // in case path has spaces

    const added = addedStr === '-' ? 0 : parseInt(addedStr, 10) || 0;
    const removed = removedStr === '-' ? 0 : parseInt(removedStr, 10) || 0;
    const isTest = isTestFile(filePath, testPatterns);

    files.push({
      path: filePath,
      added,
      removed,
      isTest
    });

    if (isTest) {
      testAdded += added;
      testRemoved += removed;
      if (added > 0 || removed > 0) {
        testModified = true;
      }
    } else {
      sourceAdded += added;
      sourceRemoved += removed;
    }
  }

  return {
    sourceAdded,
    sourceRemoved,
    testAdded,
    testRemoved,
    testModified,
    files
  };
}

export function formatDiffBadge(added, removed, isModified = false) {
  const diffStr = `+${added} / -${removed}`;
  if (isModified && (added > 0 || removed > 0)) {
    return `${diffStr} (Modified)`;
  }
  return diffStr;
}
