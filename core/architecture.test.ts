/**
 * The decision engine must never see how the data was made or what the right answers are.
 * These checks keep that true as the code changes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const CORE = join(process.cwd(), "core");
const ENGINE_DIRS = ["cleaning", "scoring", "routing", "ai"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
  });
}

function imports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] ?? "");
}

describe("engine boundaries", () => {
  const files = ENGINE_DIRS.flatMap((dir) => {
    try {
      return sourceFiles(join(CORE, dir));
    } catch {
      return [];
    }
  });

  it.each(files.map((file) => [relative(CORE, file)]))(
    "%s does not import the generator",
    (file) => {
      for (const source of imports(join(CORE, file))) {
        expect(source).not.toMatch(/(^|\/)dataset\//);
        expect(source).not.toMatch(/(^|\/)backtest\//);
      }
    },
  );

  it("routing does not take labels as input", () => {
    const text = readFileSync(join(CORE, "routing", "route.ts"), "utf8");
    expect(text).not.toMatch(/LabelsFile|PersonTruth|hasNeed/);
  });
});
