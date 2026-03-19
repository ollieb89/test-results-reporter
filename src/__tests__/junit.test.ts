import { parseJUnit } from '../parsers/junit';

describe('JUnit XML Parser', () => {
  it('parses basic passing tests', () => {
    const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="MyTests" tests="2" failures="0" time="1.5">
    <testcase name="test_pass_one" classname="com.example.MyTest" time="0.8"/>
    <testcase name="test_pass_two" classname="com.example.MyTest" time="0.7"/>
  </testsuite>
</testsuites>`;

    const result = parseJUnit(xml);

    expect(result.passed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.total).toBe(2);
  });

  it('parses failing tests with error messages', () => {
    const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="MyTests" tests="1" failures="1" time="0.3">
    <testcase name="test_fail" classname="com.example.MyTest" time="0.3">
      <failure message="Expected 1 but was 2" type="AssertionError">
        at com.example.MyTest.test_fail(MyTest.java:42)
      </failure>
    </testcase>
  </testsuite>
</testsuites>`;

    const result = parseJUnit(xml);

    expect(result.failed).toBe(1);
    const failedTest = result.suites[0].tests[0];
    expect(failedTest.status).toBe('failed');
    expect(failedTest.errorMessage).toBe('Expected 1 but was 2');
  });

  it('parses skipped tests', () => {
    const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="MyTests" tests="2" skipped="1" time="0.5">
    <testcase name="test_pass" classname="com.example.MyTest" time="0.5"/>
    <testcase name="test_skip" classname="com.example.MyTest" time="0.0">
      <skipped/>
    </testcase>
  </testsuite>
</testsuites>`;

    const result = parseJUnit(xml);

    expect(result.skipped).toBe(1);
    expect(result.passed).toBe(1);
    const skippedTest = result.suites[0].tests[1];
    expect(skippedTest.status).toBe('skipped');
  });

  it('handles single testsuite root without testsuites wrapper', () => {
    const xml = `<?xml version="1.0"?>
<testsuite name="MyTests" tests="1" time="0.5">
  <testcase name="test_pass" classname="com.example.MyTest" time="0.5"/>
</testsuite>`;

    const result = parseJUnit(xml);

    expect(result.total).toBe(1);
    expect(result.passed).toBe(1);
  });

  it('handles error elements as failures', () => {
    const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="MyTests" tests="1" errors="1" time="0.1">
    <testcase name="test_error" classname="com.example.MyTest" time="0.1">
      <error message="NullPointerException" type="java.lang.NullPointerException">
        at com.example.MyTest.test_error(MyTest.java:10)
      </error>
    </testcase>
  </testsuite>
</testsuites>`;

    const result = parseJUnit(xml);

    expect(result.failed).toBe(1);
    expect(result.suites[0].tests[0].status).toBe('failed');
    expect(result.suites[0].tests[0].errorMessage).toBe('NullPointerException');
  });

  it('aggregates duration across suites', () => {
    const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="Suite1" tests="1" time="1.0">
    <testcase name="test_a" classname="com.example.A" time="1.0"/>
  </testsuite>
  <testsuite name="Suite2" tests="1" time="2.0">
    <testcase name="test_b" classname="com.example.B" time="2.0"/>
  </testsuite>
</testsuites>`;

    const result = parseJUnit(xml);

    expect(result.duration).toBeCloseTo(3.0);
    expect(result.total).toBe(2);
  });

  it('handles empty testsuites', () => {
    const xml = `<?xml version="1.0"?><testsuites/>`;

    const result = parseJUnit(xml);

    expect(result.total).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('extracts line number from testcase line attribute', () => {
    const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="MyTests" tests="1" failures="1" time="0.1">
    <testcase name="test_fail" classname="com.example.MyTest" time="0.1" line="42">
      <failure message="fail"/>
    </testcase>
  </testsuite>
</testsuites>`;

    const result = parseJUnit(xml);

    expect(result.suites[0].tests[0].line).toBe(42);
  });
});
