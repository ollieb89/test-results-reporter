import { ParsedResults, TestResult, TestSuite, TestStatus } from '../types';

interface PytestPhaseResult {
  duration?: number;
  outcome: string;
  longrepr?: string;
}

interface PytestTest {
  nodeid: string;
  lineno?: number;
  outcome: string;
  setup?: PytestPhaseResult;
  call?: PytestPhaseResult;
  teardown?: PytestPhaseResult;
}

interface PytestJSON {
  duration?: number;
  tests?: PytestTest[];
}

function parseNodeId(nodeid: string): { file: string; name: string } {
  const parts = nodeid.split('::');
  const file = parts[0];
  const name = parts.slice(1).join('::') || nodeid;
  return { file, name };
}

function mapOutcome(outcome: string): TestStatus {
  switch (outcome) {
    case 'passed':
      return 'passed';
    case 'failed':
    case 'error':
      return 'failed';
    case 'skipped':
      return 'skipped';
    default:
      return 'skipped';
  }
}

export function parsePytest(content: string): ParsedResults {
  const data: PytestJSON = JSON.parse(content);
  const tests = data.tests ?? [];

  // Group tests by file
  const fileMap = new Map<string, PytestTest[]>();
  for (const test of tests) {
    const { file } = parseNodeId(test.nodeid);
    if (!fileMap.has(file)) fileMap.set(file, []);
    fileMap.get(file)!.push(test);
  }

  const suites: TestSuite[] = [];
  for (const [file, fileTests] of fileMap) {
    const suiteTests: TestResult[] = fileTests.map((t) => {
      const { name } = parseNodeId(t.nodeid);
      const status = mapOutcome(t.outcome);

      // Get error info from call phase, falling back to setup if call is absent
      const failPhase =
        t.call?.outcome === 'failed' || t.call?.outcome === 'error'
          ? t.call
          : t.setup?.outcome === 'error'
          ? t.setup
          : undefined;

      const duration = t.call?.duration;
      const errorMessage = failPhase?.longrepr
        ? failPhase.longrepr.split('\n')[0]
        : undefined;
      const errorDetails = failPhase?.longrepr;

      return {
        name,
        file,
        line: t.lineno,
        duration,
        status,
        errorMessage,
        errorDetails,
      };
    });

    const suiteDuration = suiteTests.reduce((sum, t) => sum + (t.duration ?? 0), 0);

    suites.push({
      name: file,
      file,
      tests: suiteTests,
      duration: suiteDuration,
    });
  }

  let passed = 0,
    failed = 0,
    skipped = 0;
  for (const suite of suites) {
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
    duration: data.duration ?? 0,
  };
}
