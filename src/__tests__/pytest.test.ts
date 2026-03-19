import { parsePytest } from '../parsers/pytest';

describe('pytest JSON Parser', () => {
  it('parses passing tests', () => {
    const json = JSON.stringify({
      created: 1234567890,
      duration: 1.5,
      exitcode: 0,
      root: '/project',
      summary: { passed: 2, total: 2 },
      tests: [
        {
          nodeid: 'tests/test_example.py::test_one',
          lineno: 5,
          outcome: 'passed',
          setup: { duration: 0.001, outcome: 'passed' },
          call: { duration: 0.5, outcome: 'passed' },
          teardown: { duration: 0.001, outcome: 'passed' },
        },
        {
          nodeid: 'tests/test_example.py::test_two',
          lineno: 10,
          outcome: 'passed',
          setup: { duration: 0.001, outcome: 'passed' },
          call: { duration: 1.0, outcome: 'passed' },
          teardown: { duration: 0.001, outcome: 'passed' },
        },
      ],
    });

    const result = parsePytest(json);

    expect(result.passed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(2);
  });

  it('parses failing tests with longrepr', () => {
    const json = JSON.stringify({
      created: 1234567890,
      duration: 0.5,
      exitcode: 1,
      summary: { passed: 0, failed: 1, total: 1 },
      tests: [
        {
          nodeid: 'tests/test_example.py::TestClass::test_fail',
          lineno: 20,
          outcome: 'failed',
          setup: { duration: 0.001, outcome: 'passed' },
          call: {
            duration: 0.05,
            outcome: 'failed',
            longrepr: 'AssertionError: assert 1 == 2\n  where 1 = func()',
          },
          teardown: { duration: 0.001, outcome: 'passed' },
        },
      ],
    });

    const result = parsePytest(json);

    expect(result.failed).toBe(1);
    const failedTest = result.suites[0].tests[0];
    expect(failedTest.status).toBe('failed');
    expect(failedTest.errorMessage).toContain('AssertionError');
  });

  it('parses skipped tests', () => {
    const json = JSON.stringify({
      created: 1234567890,
      duration: 0.1,
      exitcode: 0,
      summary: { skipped: 1, total: 1 },
      tests: [
        {
          nodeid: 'tests/test_example.py::test_skip',
          lineno: 30,
          outcome: 'skipped',
          setup: { duration: 0.001, outcome: 'passed' },
          call: { duration: 0.001, outcome: 'skipped', longrepr: 'Skipped: not supported' },
          teardown: { duration: 0.001, outcome: 'passed' },
        },
      ],
    });

    const result = parsePytest(json);

    expect(result.skipped).toBe(1);
    expect(result.suites[0].tests[0].status).toBe('skipped');
  });

  it('extracts file and line from nodeid', () => {
    const json = JSON.stringify({
      created: 1234567890,
      duration: 0.5,
      exitcode: 0,
      summary: { passed: 1, total: 1 },
      tests: [
        {
          nodeid: 'tests/test_example.py::TestClass::test_method',
          lineno: 42,
          outcome: 'passed',
          setup: { duration: 0.001, outcome: 'passed' },
          call: { duration: 0.1, outcome: 'passed' },
          teardown: { duration: 0.001, outcome: 'passed' },
        },
      ],
    });

    const result = parsePytest(json);

    expect(result.suites[0].tests[0].file).toBe('tests/test_example.py');
    expect(result.suites[0].tests[0].line).toBe(42);
  });

  it('handles setup failures as failed tests', () => {
    const json = JSON.stringify({
      created: 1234567890,
      duration: 0.1,
      exitcode: 1,
      summary: { failed: 1, total: 1 },
      tests: [
        {
          nodeid: 'tests/test_example.py::test_fixture_fail',
          lineno: 5,
          outcome: 'error',
          setup: {
            duration: 0.01,
            outcome: 'error',
            longrepr: 'fixture "missing_fixture" not found',
          },
        },
      ],
    });

    const result = parsePytest(json);

    expect(result.failed).toBe(1);
    expect(result.suites[0].tests[0].status).toBe('failed');
  });

  it('groups tests by file into suites', () => {
    const json = JSON.stringify({
      created: 1234567890,
      duration: 1.0,
      exitcode: 0,
      summary: { passed: 2, total: 2 },
      tests: [
        {
          nodeid: 'tests/test_a.py::test_one',
          lineno: 5,
          outcome: 'passed',
          setup: { duration: 0.001, outcome: 'passed' },
          call: { duration: 0.5, outcome: 'passed' },
          teardown: { duration: 0.001, outcome: 'passed' },
        },
        {
          nodeid: 'tests/test_b.py::test_two',
          lineno: 10,
          outcome: 'passed',
          setup: { duration: 0.001, outcome: 'passed' },
          call: { duration: 0.5, outcome: 'passed' },
          teardown: { duration: 0.001, outcome: 'passed' },
        },
      ],
    });

    const result = parsePytest(json);

    expect(result.suites).toHaveLength(2);
  });
});
