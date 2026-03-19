import { XMLParser } from 'fast-xml-parser';
import { ParsedResults, TestResult, TestSuite } from '../types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['testsuite', 'testcase'].includes(name),
});

function parseTestcase(tc: Record<string, unknown>): TestResult {
  const name = String(tc['@_name'] ?? 'unknown');
  const classname = tc['@_classname'] ? String(tc['@_classname']) : undefined;
  const timeStr = tc['@_time'];
  const duration = timeStr != null ? parseFloat(String(timeStr)) : undefined;
  const lineAttr = tc['@_line'];
  const line = lineAttr != null ? parseInt(String(lineAttr), 10) : undefined;

  if (tc['failure']) {
    const failure = tc['failure'] as Record<string, unknown>;
    return {
      name,
      classname,
      duration,
      line,
      status: 'failed',
      errorMessage: failure['@_message'] ? String(failure['@_message']) : undefined,
      errorDetails: failure['#text'] ? String(failure['#text']).trim() : undefined,
    };
  }

  if (tc['error']) {
    const error = tc['error'] as Record<string, unknown>;
    return {
      name,
      classname,
      duration,
      line,
      status: 'failed',
      errorMessage: error['@_message'] ? String(error['@_message']) : undefined,
      errorDetails: error['#text'] ? String(error['#text']).trim() : undefined,
    };
  }

  if (tc['skipped'] !== undefined) {
    return { name, classname, duration, line, status: 'skipped' };
  }

  return { name, classname, duration, line, status: 'passed' };
}

function parseSuite(suite: Record<string, unknown>): TestSuite {
  const name = String(suite['@_name'] ?? 'unnamed');
  const timeStr = suite['@_time'];
  const duration = timeStr != null ? parseFloat(String(timeStr)) : undefined;

  const rawTestcases = suite['testcase'];
  const testcases: Record<string, unknown>[] = Array.isArray(rawTestcases)
    ? rawTestcases
    : rawTestcases
    ? [rawTestcases as Record<string, unknown>]
    : [];

  return {
    name,
    duration,
    tests: testcases.map(parseTestcase),
  };
}

export function parseJUnit(content: string): ParsedResults {
  const parsed = parser.parse(content) as Record<string, unknown>;
  let suites: TestSuite[] = [];

  if (parsed['testsuites']) {
    const testsuites = parsed['testsuites'] as Record<string, unknown>;
    const rawSuites = testsuites['testsuite'];
    const suiteArray: Record<string, unknown>[] = Array.isArray(rawSuites)
      ? rawSuites
      : rawSuites
      ? [rawSuites as Record<string, unknown>]
      : [];
    suites = suiteArray.map(parseSuite);
  } else if (parsed['testsuite']) {
    const rawSuite = parsed['testsuite'];
    const suiteArray: Record<string, unknown>[] = Array.isArray(rawSuite)
      ? rawSuite
      : [rawSuite as Record<string, unknown>];
    suites = suiteArray.map(parseSuite);
  }

  let passed = 0,
    failed = 0,
    skipped = 0,
    duration = 0;
  for (const suite of suites) {
    duration += suite.duration ?? 0;
    for (const test of suite.tests) {
      if (test.status === 'passed') passed++;
      else if (test.status === 'failed') failed++;
      else if (test.status === 'skipped') skipped++;
    }
  }

  return {
    suites,
    total: passed + failed + skipped,
    passed,
    failed,
    skipped,
    duration,
  };
}
