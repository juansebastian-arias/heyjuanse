// Copies the SQLite WebAssembly binary next to the site so the browser can load it.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const source = require.resolve("sql.js/dist/sql-wasm-browser.wasm");
const target = join(process.cwd(), "public", "vendor", "sql-wasm-browser.wasm");
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.info("copied sql-wasm-browser.wasm to public/vendor");
