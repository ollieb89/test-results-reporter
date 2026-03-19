import { ParsedResults, FlakyTest } from './types';
export declare const COMMENT_MARKER = "<!-- test-results-reporter -->";
export declare function formatPRComment(results: ParsedResults, flakyTests: FlakyTest[]): string;
