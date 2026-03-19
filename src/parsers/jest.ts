import { ParsedResults, TestResult, TestSuite, TestStatus } from '../types';

interface JestTestResult {
  ancestorTitles: string[];
  title: string;
  fullName: string;
  status: string;
  duration: number | null;
  failureMessages: string[];
  location?: { line: number; column: number };
}

interface JestSuiteResult {
  testFilePath: string;
  testResults: JestTestResult[];
  perfStats: { start: number; end: number };
}

interface JestJSON {
  testResults: JestSuiteResult[];
}

function mapStatus(status: string): TestStatus {
  switch (status) {
    case 'passed':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'pending':
    case 'todo':
    default:
      return 'skipped';
  }
}

export function parseJest(content: string): ParsedResults {
  const data: JestJSON = JSON.parse(content);

  const suites: TestSuite[] = data.testResults.map((suite) => {
    const duration = (suite.perfStats.end - suite.perfStats.start) / 1000;

    const tests: TestResult[] = suite.testResults.map((t) => {
      const status = mapStatus(t.status);
      const errorMessage =
        t.failureMessages.length > 0 ? t.failureMessages[0].split('\n')[0] : undefined;
      const errorDetails =
        t.failureMessages.length > 0 ? t.failureMessages.join('\n') : undefined;

      return {
        name: t.fullName,
        file: suite.testFilePath,
        line: t.location?.line,
        duration: t.duration != null ? t.duration / 1000 : undefined,
        status,
        errorMessage,
        errorDetails,
      };
    });

    return {
      name: suite.testFilePath,
      file: suite.testFilePath,
      duration,
      tests,
    };
  });

  let passed = 0,
    failed = 0,
    skipped = 0,
    totalDuration = 0;
  for (const suite of suites) {
    totalDuration += suite.duration ?? 0;
    for (const test of suite.tests) {
      if (test.status === 'passed') passed++;
      else if (test.status === 'failed') failed++;
      else skipped++;
    }
  }

  return {
    suites,
    total: passed + failed + skipped,
    passed,
    failed,
    skipped,
    duration: totalDuration,
  };
}
