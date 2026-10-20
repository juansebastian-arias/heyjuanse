/**
 * Reads the Vitest report written by `pnpm test:report`, which runs before every production build,
 * so the "Under the hood" page lists the tests that gated the deployed code, with their results.
 * Without a report (for example in `next dev` before the first run) the page says so instead of
 * showing results it does not have.
 */
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

export type TestStatus = "passed" | "failed" | "skipped" | "pending" | "todo";

export interface TestCase {
  name: string;
  status: TestStatus;
}

export interface TestFile {
  path: string;
  tests: TestCase[];
}

export interface TestReport {
  /** When the run started, as an ISO date. */
  ranAt: string;
  total: number;
  passed: number;
  failed: number;
  files: TestFile[];
}

interface VitestJson {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  startTime: number;
  testResults: Array<{
    name: string;
    assertionResults: Array<{ ancestorTitles: string[]; title: string; status: TestStatus }>;
  }>;
}

export const TEST_REPORT_PATH = ".reports/vitest.json";

export function readTestReport(): TestReport | null {
  const root = process.cwd();
  let raw: VitestJson;
  try {
    raw = JSON.parse(readFileSync(join(root, TEST_REPORT_PATH), "utf8")) as VitestJson;
  } catch {
    return null;
  }
  const files = raw.testResults
    .map((file) => ({
      // Report paths are absolute on the machine that ran them; publish them relative to the repo.
      path: relative(root, file.name).split("\\").join("/"),
      tests: file.assertionResults.map((test) => ({
        name: [...test.ancestorTitles, test.title].join(" › "),
        status: test.status,
      })),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    ranAt: new Date(raw.startTime).toISOString(),
    total: raw.numTotalTests,
    passed: raw.numPassedTests,
    failed: raw.numFailedTests,
    files,
  };
}
