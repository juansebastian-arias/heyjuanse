/**
 * The decision engine must never see how the data was made or what the right answers are.
 * These checks keep that true as the code changes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const CORE = join(process.cwd(), "core");
const ENGINE_DIRS = ["cleaning", "scoring", "routing", "ai"];

function sourceFiles(dir: string, extensions = [".ts"]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path, extensions);
    const isTest = /\.test\.tsx?$/.test(name);
    return extensions.some((extension) => name.endsWith(extension)) && !isTest ? [path] : [];
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

  it("the site never imports the API client", () => {
    const siteFiles = ["app", "components", "lib"].flatMap((dir) => {
      try {
        return sourceFiles(join(process.cwd(), dir), [".ts", ".tsx"]);
      } catch {
        return [];
      }
    });
    expect(siteFiles.length).toBeGreaterThan(10);
    for (const file of siteFiles) {
      for (const source of imports(file)) {
        expect(source, relative(process.cwd(), file)).not.toMatch(
          /@anthropic-ai|^(@\/|(\.\.\/)+)server\//,
        );
      }
    }
  });

  it("routing does not take labels as input", () => {
    const text = readFileSync(join(CORE, "routing", "route.ts"), "utf8");
    expect(text).not.toMatch(/LabelsFile|PersonTruth|hasNeed/);
  });
});
