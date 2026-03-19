import { formatPRComment } from '../reporter';
import { ParsedResults, FlakyTest } from '../types';

describe('PR Comment Reporter', () => {
  const makeResults = (overrides: Partial<ParsedResults> = {}): ParsedResults => ({
    suites: [],
    total: 5,
    passed: 5,
    failed: 0,
    skipped: 0,
    duration: 1.5,
    ...overrides,
  });

  it('includes the sentinel marker for idempotent updates', () => {
    const results = makeResults();
    const comment = formatPRComment(results, []);
    expect(comment).toContain('<!-- test-results-reporter -->');
  });

  it('generates summary table with correct counts', () => {
    const results = makeResults({ passed: 3, failed: 1, skipped: 1, total: 5 });
    const comment = formatPRComment(results, []);
    expect(comment).toContain('3');
    expect(comment).toContain('1');
  });

  it('includes failure details in expandable section', () => {
    const results = makeResults({
      passed: 0,
      failed: 1,
      total: 1,
      suites: [
        {
          name: 'My Suite',
          tests: [
            {
              name: 'test_fail',
              status: 'failed',
              file: 'tests/test_example.py',
              line: 42,
              errorMessage: 'AssertionError: expected 1 got 2',
              errorDetails: 'AssertionError: expected 1 got 2\n  at line 42',
            },
          ],
        },
      ],
    });

    const comment = formatPRComment(results, []);

    expect(comment).toContain('<details>');
    expect(comment).toContain('test_fail');
    expect(comment).toContain('AssertionError');
  });

  it('marks flaky tests with flaky indicator', () => {
    const results = makeResults({
      passed: 0,
      failed: 1,
      total: 1,
      suites: [
        {
          name: 'My Suite',
          tests: [
            {
              name: 'test_flaky',
              status: 'failed',
              file: 'tests/test_example.py',
              line: 10,
              errorMessage: 'Intermittent failure',
            },
          ],
        },
      ],
    });
    const flakyTests: FlakyTest[] = [{ name: 'test_flaky', file: 'tests/test_example.py' }];

    const comment = formatPRComment(results, flakyTests);

    expect(comment.toLowerCase()).toContain('flaky');
  });

  it('shows all-green message when no failures', () => {
    const results = makeResults({ passed: 5, failed: 0, skipped: 0, total: 5 });

    const comment = formatPRComment(results, []);

    expect(comment).not.toContain('<details>');
    expect(comment).toContain('✅');
  });

  it('handles empty results gracefully', () => {
    const results = makeResults({ passed: 0, failed: 0, skipped: 0, total: 0 });

    const comment = formatPRComment(results, []);

    expect(comment).toContain('No test results');
  });

  it('formats duration in seconds', () => {
    const results = makeResults({ duration: 12.5 });

    const comment = formatPRComment(results, []);

    expect(comment).toContain('12.5s');
  });

  it('includes file and line number in failure output', () => {
    const results = makeResults({
      failed: 1,
      passed: 0,
      total: 1,
      suites: [
        {
          name: 'Suite',
          tests: [
            {
              name: 'test_fail',
              status: 'failed',
              file: 'src/test_file.py',
              line: 42,
              errorMessage: 'Error occurred',
            },
          ],
        },
      ],
    });

    const comment = formatPRComment(results, []);

    expect(comment).toContain('src/test_file.py');
    expect(comment).toContain('42');
  });

  it('includes flaky tests section when flaky tests present', () => {
    const results = makeResults({
      failed: 1,
      passed: 0,
      total: 1,
      suites: [
        {
          name: 'Suite',
          tests: [{ name: 'flaky_test', status: 'failed', file: 'test.py', line: 1, errorMessage: 'err' }],
        },
      ],
    });
    const flakyTests: FlakyTest[] = [{ name: 'flaky_test', file: 'test.py' }];

    const comment = formatPRComment(results, flakyTests);

    expect(comment).toContain('Flaky Tests');
    expect(comment).toContain('flaky_test');
  });
});
