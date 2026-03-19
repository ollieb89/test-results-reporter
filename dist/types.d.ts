export type TestStatus = 'passed' | 'failed' | 'skipped';
export interface TestResult {
    name: string;
    classname?: string;
    file?: string;
    line?: number;
    duration?: number;
    status: TestStatus;
    errorMessage?: string;
    errorDetails?: string;
}
export interface TestSuite {
    name: string;
    file?: string;
    tests: TestResult[];
    duration?: number;
}
export interface ParsedResults {
    suites: TestSuite[];
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
}
export interface FlakyTest {
    name: string;
    file?: string;
    suite?: string;
}
export interface PreviousRunTest {
    name: string;
    file?: string;
    suite?: string;
    status: TestStatus;
}
export interface PreviousRunResults {
    tests: PreviousRunTest[];
    timestamp: string;
}
