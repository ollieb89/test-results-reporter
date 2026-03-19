import { ParsedResults, FlakyTest, TestResult } from './types';

export const COMMENT_MARKER = '<!-- test-results-reporter -->';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(0).padStart(2, '0');
  return `${mins}m ${secs}s`;
}

function isFlakyTest(test: TestResult, suiteName: string, flakyTests: FlakyTest[]): boolean {
  return flakyTests.some(
    (f) =>
      f.name === test.name &&
      (f.file === undefined || f.file === test.file || f.suite === suiteName)
  );
}

function formatFailureDetail(test: TestResult, isFlaky: boolean): string {
  const location =
    test.file ? (test.line ? `${test.file}:${test.line}` : test.file) : undefined;

  const flakyBadge = isFlaky ? ' ⚠️ **flaky**' : '';
  const locationStr = location ? ` — \`${location}\`` : '';
  const summary = `${test.name}${locationStr}${flakyBadge}`;

  const body = test.errorDetails ?? test.errorMessage;
  const errorBlock = body
    ? `\n\n\`\`\`\n${body.slice(0, 1500)}${body.length > 1500 ? '\n...(truncated)' : ''}\n\`\`\``
    : '';

  return `<details>\n<summary>${summary}</summary>${errorBlock}\n</details>`;
}

export function formatPRComment(results: ParsedResults, flakyTests: FlakyTest[]): string {
  const { passed, failed, skipped, total, duration, suites } = results;

  if (total === 0) {
    return `${COMMENT_MARKER}\n## Test Results\n\nNo test results found.\n`;
  }

  const overallEmoji = failed > 0 ? '❌' : '✅';
  const flakyCount = flakyTests.length;

  const lines: string[] = [];
  lines.push(COMMENT_MARKER);
  lines.push(`## ${overallEmoji} Test Results\n`);

  // Summary table
  lines.push('| Status | Count |');
  lines.push('|--------|-------|');
  lines.push(`| ✅ Passed | **${passed}** |`);
  lines.push(`| ❌ Failed | **${failed}** |`);
  lines.push(`| ⏭️ Skipped | **${skipped}** |`);
  if (flakyCount > 0) {
    lines.push(`| ⚠️ Flaky | **${flakyCount}** |`);
  }
  lines.push(`| ⏱️ Duration | ${formatDuration(duration)} |`);
  lines.push('');

  // Failure details
  const failedTests: Array<{ test: TestResult; suiteName: string }> = [];
  for (const suite of suites) {
    for (const test of suite.tests) {
      if (test.status === 'failed') {
        failedTests.push({ test, suiteName: suite.name });
      }
    }
  }

  if (failedTests.length > 0) {
    lines.push('### ❌ Failures\n');
    for (const { test, suiteName } of failedTests) {
      const isFlaky = isFlakyTest(test, suiteName, flakyTests);
      lines.push(formatFailureDetail(test, isFlaky));
    }
    lines.push('');
  }

  // Flaky tests section
  if (flakyCount > 0) {
    lines.push('### ⚠️ Flaky Tests\n');
    lines.push('These tests failed in this run but passed in the previous run:\n');
    for (const flaky of flakyTests) {
      const location = flaky.file ? ` in \`${flaky.file}\`` : '';
      lines.push(`- \`${flaky.name}\`${location}`);
    }
    lines.push('');
  }

  // All-green message
  if (failed === 0) {
    lines.push('> All tests passed! 🎉');
    lines.push('');
  }

  return lines.join('\n');
}
