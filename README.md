# Test Results Reporter

> Aggregates JUnit XML, Jest JSON, and pytest JSON test results into a clean GitHub PR comment — with flaky test detection.

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Test%20Results%20Reporter-blue?logo=github)](https://github.com/marketplace/actions/test-results-reporter)

---

## Features

- 📊 **Unified summary** — Total passed / failed / skipped across all test suites
- 🔴 **Failure details** — File, test name, error message, and line number in a collapsible section
- 🌊 **Flaky test detection** — Flags tests that fail in the current run but passed previously
- 🔄 **Single comment** — Updates the same PR comment on every push (no spam)
- 📝 **Multi-format** — JUnit XML, Jest `--json`, and pytest `pytest-json-report`
- ✅ **Annotations** — Inline PR annotations for failures

---

## Usage

### Jest

```yaml
- name: Run tests
  run: npx jest --json --outputFile=jest-results.json

- name: Report results
  uses: ollieb89/test-results-reporter@v1
  if: always()
  with:
    test-results: jest-results.json
    token: ${{ secrets.GITHUB_TOKEN }}
```

### pytest

```yaml
- name: Run tests
  run: pytest --json-report --json-report-file=pytest-results.json

- name: Report results
  uses: ollieb89/test-results-reporter@v1
  if: always()
  with:
    test-results: pytest-results.json
    token: ${{ secrets.GITHUB_TOKEN }}
```

### JUnit XML (Maven, Gradle, etc.)

```yaml
- name: Report results
  uses: ollieb89/test-results-reporter@v1
  if: always()
  with:
    test-results: "**/target/surefire-reports/*.xml"
    token: ${{ secrets.GITHUB_TOKEN }}
```

### Multiple formats

```yaml
- uses: ollieb89/test-results-reporter@v1
  if: always()
  with:
    test-results: |
      jest-results.json
      pytest-results.json
      **/surefire-reports/*.xml
    token: ${{ secrets.GITHUB_TOKEN }}
```

---

## PR Comment Example

```
## 🧪 Test Results

| Status | Count |
|--------|-------|
| ✅ Passed | 142 |
| ❌ Failed | 3 |
| ⏭️ Skipped | 7 |

<details>
<summary>❌ Failures (3)</summary>

**UserService › should create user**
`src/services/user.test.ts:45`
Expected status 201, received 500

</details>

⚠️ 1 flaky test detected (failed now, passed previously)
```

---

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `test-results` | ✅ | — | Glob pattern(s) for result files |
| `token` | ✅ | `github.token` | GitHub token for PR comments |
| `fail-on-error` | ❌ | `true` | Fail the step if tests failed |

---

## License

MIT

---

## 🧠 Stop CI Debugging Hell

Tired of scanning logs and rerunning jobs? Grab the **[CI Failure Recovery Pack](https://trivexia.gumroad.com/l/ci-failure-recovery-pack)** — includes the **GitHub Actions Triage Checklist** and the **CI Debugging Template** to help you find and fix root causes systematically.
