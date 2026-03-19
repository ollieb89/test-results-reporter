import { parseJest } from '../parsers/jest';

describe('Jest JSON Parser', () => {
  const makeJestJson = (
    testResults: object[],
    filePath = '/repo/__tests__/example.test.ts'
  ) =>
    JSON.stringify({
      numFailedTestSuites: 0,
      numFailedTests: 0,
      numPassedTestSuites: 1,
      numPassedTests: testResults.length,
      numPendingTestSuites: 0,
      numPendingTests: 0,
      numTotalTestSuites: 1,
      numTotalTests: testResults.length,
      testResults: [
        {
          testFilePath: filePath,
          testResults,
          perfStats: { start: 1000000, end: 1000500 },
        },
      ],
    });

  it('parses passing tests correctly', () => {
    const json = makeJestJson([
      {
        ancestorTitles: ['Suite'],
        title: 'renders correctly',
        fullName: 'Suite renders correctly',
        status: 'passed',
        duration: 50,
        failureMessages: [],
        location: { line: 10, column: 3 },
      },
    ]);

    const result = parseJest(json);

    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(1);
  });

  it('parses failed tests with failure messages', () => {
    const json = makeJestJson([
      {
        ancestorTitles: [],
        title: 'fails on bad input',
        fullName: 'fails on bad input',
        status: 'failed',
        duration: 30,
        failureMessages: [
          'Error: Expected true but received false\n    at Object.<anonymous> (__tests__/example.test.ts:20:5)',
        ],
        location: { line: 18, column: 3 },
      },
    ]);

    const result = parseJest(json);

    expect(result.failed).toBe(1);
    const failedTest = result.suites[0].tests[0];
    expect(failedTest.status).toBe('failed');
    expect(failedTest.errorMessage).toContain('Expected true but received false');
    expect(failedTest.line).toBe(18);
  });

  it('maps pending status to skipped', () => {
    const json = makeJestJson([
      {
        ancestorTitles: [],
        title: 'todo test',
        fullName: 'todo test',
        status: 'pending',
        duration: null,
        failureMessages: [],
        location: { line: 30, column: 1 },
      },
    ]);

    const result = parseJest(json);

    expect(result.skipped).toBe(1);
    expect(result.suites[0].tests[0].status).toBe('skipped');
  });

  it('extracts file path from testFilePath', () => {
    const json = makeJestJson(
      [
        {
          ancestorTitles: [],
          title: 'test',
          fullName: 'test',
          status: 'passed',
          duration: 10,
          failureMessages: [],
          location: { line: 5, column: 1 },
        },
      ],
      '/repo/__tests__/example.test.ts'
    );

    const result = parseJest(json);

    expect(result.suites[0].file).toBe('/repo/__tests__/example.test.ts');
    expect(result.suites[0].tests[0].file).toBe('/repo/__tests__/example.test.ts');
  });

  it('handles null duration', () => {
    const json = makeJestJson([
      {
        ancestorTitles: [],
        title: 'test',
        fullName: 'test',
        status: 'passed',
        duration: null,
        failureMessages: [],
        location: { line: 5, column: 1 },
      },
    ]);

    const result = parseJest(json);

    expect(result.suites[0].tests[0].duration).toBeUndefined();
  });

  it('calculates suite duration from perfStats', () => {
    const json = JSON.stringify({
      numTotalTests: 1,
      testResults: [
        {
          testFilePath: '/repo/test.ts',
          testResults: [
            {
              title: 'test',
              fullName: 'test',
              status: 'passed',
              duration: 200,
              failureMessages: [],
              ancestorTitles: [],
              location: { line: 1, column: 1 },
            },
          ],
          perfStats: { start: 1000000, end: 1000500 },
        },
      ],
    });

    const result = parseJest(json);

    expect(result.suites[0].duration).toBeCloseTo(0.5);
  });

  it('handles multiple test suites', () => {
    const json = JSON.stringify({
      numTotalTests: 2,
      testResults: [
        {
          testFilePath: '/repo/a.test.ts',
          testResults: [
            {
              title: 'test a',
              fullName: 'test a',
              status: 'passed',
              duration: 10,
              failureMessages: [],
              ancestorTitles: [],
              location: { line: 1, column: 1 },
            },
          ],
          perfStats: { start: 1000000, end: 1000010 },
        },
        {
          testFilePath: '/repo/b.test.ts',
          testResults: [
            {
              title: 'test b',
              fullName: 'test b',
              status: 'failed',
              duration: 20,
              failureMessages: ['Error: something wrong'],
              ancestorTitles: [],
              location: { line: 5, column: 1 },
            },
          ],
          perfStats: { start: 1000010, end: 1000030 },
        },
      ],
    });

    const result = parseJest(json);

    expect(result.suites).toHaveLength(2);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
  });
});
