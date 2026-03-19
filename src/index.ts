import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';
import { parseJUnit } from './parsers/junit';
import { parseJest } from './parsers/jest';
import { parsePytest } from './parsers/pytest';
import { formatPRComment, COMMENT_MARKER } from './reporter';
import {
  ParsedResults,
  FlakyTest,
  PreviousRunResults,
  PreviousRunTest,
  TestSuite,
} from './types';

function detectFormat(content: string, filePath: string): 'junit' | 'jest' | 'pytest' | null {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.xml') return 'junit';

  if (ext === '.json') {
    try {
      const data = JSON.parse(content) as Record<string, unknown>;
      // Jest: top-level testResults array where items have testFilePath
      if (Array.isArray(data['testResults'])) {
        const firstSuite = (data['testResults'] as Record<string, unknown>[])[0];
        if (firstSuite && 'testFilePath' in firstSuite) return 'jest';
        if (firstSuite && 'testResults' in firstSuite) return 'jest';
      }
      // pytest-json-report: top-level tests array with nodeid field
      if (Array.isArray(data['tests'])) {
        const firstTest = (data['tests'] as Record<string, unknown>[])[0];
        if (firstTest && 'nodeid' in firstTest) return 'pytest';
      }
    } catch {
      return null;
    }
  }

  return null;
}

function parseFile(filePath: string): ParsedResults | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    core.warning(`Could not read file: ${filePath}`);
    return null;
  }

  if (!content.trim()) {
    core.warning(`Empty file: ${filePath}`);
    return null;
  }

  const format = detectFormat(content, filePath);
  if (!format) {
    core.warning(`Could not detect format for: ${filePath}`);
    return null;
  }

  try {
    switch (format) {
      case 'junit':
        return parseJUnit(content);
      case 'jest':
        return parseJest(content);
      case 'pytest':
        return parsePytest(content);
    }
  } catch (err) {
    core.warning(`Failed to parse ${filePath}: ${err}`);
    return null;
  }
}

function mergeResults(results: ParsedResults[]): ParsedResults {
  const suites: TestSuite[] = [];
  let passed = 0,
    failed = 0,
    skipped = 0,
    duration = 0;

  for (const r of results) {
    suites.push(...r.suites);
    passed += r.passed;
    failed += r.failed;
    skipped += r.skipped;
    duration += r.duration;
  }

  return { suites, total: passed + failed + skipped, passed, failed, skipped, duration };
}

function detectFlakyTests(current: ParsedResults, previous: PreviousRunResults): FlakyTest[] {
  const prevMap = new Map<string, string>();
  for (const t of previous.tests) {
    const key = t.file ? `${t.file}::${t.name}` : t.name;
    prevMap.set(key, t.status);
  }

  const flaky: FlakyTest[] = [];
  for (const suite of current.suites) {
    for (const test of suite.tests) {
      if (test.status !== 'failed') continue;
      const key = test.file ? `${test.file}::${test.name}` : test.name;
      if (prevMap.get(key) === 'passed') {
        flaky.push({ name: test.name, file: test.file, suite: suite.name });
      }
    }
  }
  return flaky;
}

function buildPreviousRunResults(results: ParsedResults): PreviousRunResults {
  const tests: PreviousRunTest[] = [];
  for (const suite of results.suites) {
    for (const test of suite.tests) {
      tests.push({ name: test.name, file: test.file, suite: suite.name, status: test.status });
    }
  }
  return { tests, timestamp: new Date().toISOString() };
}

function setAnnotations(results: ParsedResults): void {
  for (const suite of results.suites) {
    for (const test of suite.tests) {
      if (test.status === 'failed') {
        core.error(test.errorMessage ?? `Test failed: ${test.name}`, {
          title: test.name,
          file: test.file,
          startLine: test.line,
        });
      } else if (test.status === 'skipped') {
        core.warning(`Test skipped: ${test.name}`, {
          title: test.name,
          file: test.file,
          startLine: test.line,
        });
      }
    }
  }
}

async function findOrUpdateComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<void> {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });

  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }
}

async function run(): Promise<void> {
  try {
    const patterns = core
      .getInput('test-results', { required: true })
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);

    const token = core.getInput('token', { required: true });
    const previousResultsPath = core.getInput('previous-results');
    const resultsOutputPath = core.getInput('results-output') || 'test-results-previous.json';

    // Glob for matching files
    const files = patterns.flatMap((pattern) => {
      try {
        return globSync(pattern, { nodir: true });
      } catch {
        core.warning(`Invalid glob pattern: ${pattern}`);
        return [];
      }
    });

    const uniqueFiles = [...new Set(files)];
    core.info(`Found ${uniqueFiles.length} test result file(s)`);

    if (uniqueFiles.length === 0) {
      core.warning('No test result files found matching the provided patterns');
    }

    // Parse each file
    const parsedResults = uniqueFiles
      .map((f) => parseFile(f))
      .filter((r): r is ParsedResults => r !== null);

    const merged = mergeResults(parsedResults);

    // Flaky test detection from previous run
    let flakyTests: FlakyTest[] = [];
    if (previousResultsPath && fs.existsSync(previousResultsPath)) {
      try {
        const prevContent = fs.readFileSync(previousResultsPath, 'utf-8');
        const previous: PreviousRunResults = JSON.parse(prevContent) as PreviousRunResults;
        flakyTests = detectFlakyTests(merged, previous);
        if (flakyTests.length > 0) {
          core.info(`Detected ${flakyTests.length} flaky test(s)`);
        }
      } catch (err) {
        core.warning(`Could not load previous results: ${err}`);
      }
    }

    // Persist current results for next run
    fs.writeFileSync(resultsOutputPath, JSON.stringify(buildPreviousRunResults(merged), null, 2));
    core.info(`Saved results snapshot to ${resultsOutputPath}`);

    // Build PR comment
    const comment = formatPRComment(merged, flakyTests);

    const ctx = github.context;
    const prNumber = ctx.payload.pull_request?.number;

    if (prNumber) {
      const octokit = github.getOctokit(token);
      const repo = process.env['GITHUB_REPOSITORY'] ?? '';
      const [owner, repoName] = repo.split('/');
      if (owner && repoName) {
        await findOrUpdateComment(octokit, owner, repoName, prNumber, comment);
        core.info('Posted/updated PR comment');
      } else {
        core.warning('Could not determine repository owner/name');
      }
    } else {
      core.warning('Not running in a PR context — skipping comment');
    }

    // GitHub Checks annotations
    setAnnotations(merged);

    // Outputs
    core.setOutput('passed', String(merged.passed));
    core.setOutput('failed', String(merged.failed));
    core.setOutput('skipped', String(merged.skipped));
    core.setOutput('total', String(merged.total));
    core.setOutput('flaky-count', String(flakyTests.length));
    core.setOutput('results-json', resultsOutputPath);

    if (merged.failed > 0) {
      core.setFailed(`${merged.failed} test(s) failed`);
    }
  } catch (err) {
    core.setFailed(`Action failed: ${err}`);
  }
}

run();
