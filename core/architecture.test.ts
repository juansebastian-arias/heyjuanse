/**
 * The shape of the code, held in place by tests: the model knows nothing about the page, it
 * never reads the clock or draws unseeded chance, and the API client stays on the server.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CORE = join(ROOT, "core");
const FLOW = join(CORE, "flow");

function sourceFiles(dir: string, extensions = [".ts"], tests = false): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path, extensions, tests);
    const isTest = /\.test\.tsx?$/.test(name);
    return extensions.some((extension) => name.endsWith(extension)) && (tests || !isTest)
      ? [path]
      : [];
  });
}

function imports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] ?? "");
}

const name = (file: string) => relative(ROOT, file).split("\\").join("/");

describe("the model", () => {
  const files = sourceFiles(FLOW);

  it("is found where this test looks for it", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((file) => [name(file)]))(
    "%s imports only the model itself and the seeded generator",
    (file) => {
      for (const source of imports(join(ROOT, file))) {
        expect(source, file).toMatch(/^(\.\/[\w-]+|\.\.\/random)$/);
      }
    },
  );

  it.each(files.map((file) => [name(file)]))(
    "%s never reads the clock or draws chance that a seed does not fix",
    (file) => {
      const code = readFileSync(join(ROOT, file), "utf8")
        // Comments may talk about clocks and luck; code may not use them.
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/Math\.random|Date\.now|new Date\(|performance\.now/);
    },
  );
});

describe("the rest of core", () => {
  it("never imports the interface, the framework or the server", () => {
    for (const file of sourceFiles(CORE, [".ts"], true)) {
      for (const source of imports(file)) {
        expect(source, name(file)).not.toMatch(
          /^(react|react-dom|next)(\/|$)|^@\/(app|components|lib|server)\/|(^|\/)(app|components|lib|server)\//,
        );
      }
    }
  });
});

describe("the site", () => {
  it("never imports the API client, except the one live agent route", () => {
    // The live agent is the only place a visitor's request reaches the Claude API. It is a
    // server route; pages and components only call it over fetch.
    const allowed = new Set(["app/api/agent/route.ts"]);
    const siteFiles = ["app", "components", "lib"]
      .flatMap((dir) => sourceFiles(join(ROOT, dir), [".ts", ".tsx"], true))
      .filter((file) => !allowed.has(name(file)));
    expect(siteFiles.length).toBeGreaterThan(20);
    for (const file of siteFiles) {
      for (const source of imports(file)) {
        expect(source, name(file)).not.toMatch(/@anthropic-ai|^(@\/|(\.\.\/)+)server\//);
      }
    }
  });

  it("keeps the simulation's worker free of the page: it loads the model and nothing from React", () => {
    const seen = new Set<string>();
    const queue = [join(ROOT, "lib", "flow", "worker.ts")];
    while (queue.length > 0) {
      const file = queue.pop();
      if (!file || seen.has(file)) continue;
      seen.add(file);
      for (const source of imports(file)) {
        expect(source, name(file)).not.toMatch(/^(react|react-dom|next)(\/|$)|\.css$/);
        const base = source.startsWith("@/")
          ? join(ROOT, source.slice(2))
          : source.startsWith(".")
            ? join(file, "..", source)
            : null;
        if (base) queue.push(`${base}.ts`);
      }
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});
