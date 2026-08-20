/**
 * AST & Static Guard for detecting test mutation / weakening
 */

export function analyzeTestDiffSecurity(diffText, filePath) {
  if (!diffText || !diffText.trim()) {
    return { isSuspicious: false, score: 100, warnings: [] };
  }

  const warnings = [];
  const lines = diffText.split(/\r?\n/);

  let removedAssertions = 0;
  let addedSkips = 0;
  let addedTrivialAssertions = 0;

  for (const line of lines) {
    // Only check added or modified lines in tests
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const addedContent = line.slice(1);

      // Check test.skip, it.skip, test.todo, it.todo, describe.skip, @pytest.mark.skip, @unittest.skip, #[ignore], t.Skip()
      if (/(test\.skip|it\.skip|test\.todo|it\.todo|describe\.skip|xit\(|xtest\(|@pytest\.mark\.skip|@unittest\.skip|#\[ignore\]|t\.Skip\()/i.test(addedContent)) {
        addedSkips++;
        warnings.push(`Added test skip: "${addedContent.trim()}"`);
      }

      // Check test.only / it.only (which ignores other tests)
      if (/(test\.only|it\.only|describe\.only)/i.test(addedContent)) {
        warnings.push(`Added test.only (disables entire test suite): "${addedContent.trim()}"`);
      }

      // Check trivial/fake assertions e.g. expect(true).toBe(true), assert.ok(true), assert.equal(1, 1), assert True
      if (/(expect\(\s*true\s*\)\.to(Be|Equal)\(\s*true\s*\)|expect\(\s*true\s*\)\.toBeTruthy\(\s*\)|expect\(\s*false\s*\)\.toBeFalsy\(\s*\)|assert(\.ok)?\(\s*(true|1)\s*\)|assert\s+True\b|assert\s+1\s*==\s*1|expect\(\s*1\s*\)\.toBe\(\s*1\s*\)|assert\.(equal|strictEqual|deepEqual)\(\s*(1\s*,\s*1|true\s*,\s*true|\[\]\s*,\s*\[\]|\{\}\s*,\s*\{\})\s*\))/i.test(addedContent)) {
        addedTrivialAssertions++;
        warnings.push(`Added trivial/fake assertion: "${addedContent.trim()}"`);
      }
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      const removedContent = line.slice(1);
      // Detect deleted assertions
      if (/\b(expect\(|assert\b|assert\.|self\.assert|t\.Assert|t\.Equal)/i.test(removedContent)) {
        removedAssertions++;
      }
    }
  }

  if (removedAssertions > 3) {
    warnings.push(`Deleted ${removedAssertions} test assertions in ${filePath}`);
  }

  const isSuspicious = warnings.length > 0 || (removedAssertions > 0 && addedSkips > 0);
  let score = 100 - (addedSkips * 30 + addedTrivialAssertions * 40 + removedAssertions * 10);
  if (score < 0) score = 0;

  return {
    isSuspicious,
    score,
    warnings,
    summary: isSuspicious ? 'Suspicious Weakened ⚠️' : 'Safe Added ✓'
  };
}
