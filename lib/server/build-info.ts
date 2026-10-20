/**
 * Facts about the build, read when a page is rendered: the commit it was built from and the
 * versions of the main dependencies, taken from package.json so the colophon cannot drift.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface BuildInfo {
  /** Full commit SHA, when known. */
  commit: string | null;
  builtAt: string;
  versions: Record<string, string>;
}

function currentCommit(): string | null {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromCi) return fromCi;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export function buildInfo(): BuildInfo {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  return {
    commit: currentCommit(),
    builtAt: new Date().toISOString(),
    versions: { ...pkg.dependencies, ...pkg.devDependencies },
  };
}
