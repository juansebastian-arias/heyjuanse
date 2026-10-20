# heyjuanse.com

The personal site of Juan Sebastián Arias. Its centerpiece is the **Decision Lab**: a working
lead-routing system for a fictional company that you can change and inspect in the browser.

- **[Decision Lab](https://heyjuanse.com/lab)**: a week of messy inbound leads and too few sales
  calls. Change the rules, watch every lead move, and open any lead to see why it went where it
  did. Every metric is a SQL query that runs in your browser.
- **[Under the hood](https://heyjuanse.com/architecture)**: requirements, the rule catalogue, the
  SQL, the AI contract, the tests and the design decisions, rendered from this code.
- **[Selected work](https://heyjuanse.com/work)**: short, factual descriptions of professional
  work, kept separate from the demo.

Everything in the lab is synthetic. Larkspur is a fictional company, and every person, company
and message was produced by a seeded generator. The lab is an independent demonstration: it has
not been used in production and it is not a copy of any employer's or client's system.

## Quick start

Requires Node 22.12 or later and pnpm 10 (`corepack enable` installs the pinned version).

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm check        # typecheck, lint, unit and property tests
pnpm build        # runs the tests, then a static production build
pnpm test:e2e     # browser and accessibility tests against the production build
```

No environment variables are needed to run or build the site. The API key is only used by the
offline extraction workflow described below.

## How the code is organized

| Path | What it holds |
| --- | --- |
| `core/` | The engine, in plain TypeScript with no React and no I/O, so it is tested on its own. |
| `core/dataset/` | The seeded generator and the assumptions behind the synthetic data. |
| `core/cleaning/` | Normalization, duplicate rules, survivorship and company matching. |
| `core/scoring/`, `core/routing/` | Score tables, eligibility and message rules, the call queue and decision traces. |
| `core/ai/` | The extraction contract: prompt, schema, quote checks and the trust policy. |
| `core/backtest/` | Metrics against the answer key, the AI scorecard and the "what changed" explanations. |
| `core/sql/` | SQLite schema and metric queries, kept equal to the TypeScript metrics by a test. |
| `server/ai/` | The only code that calls the Anthropic API. Scripts use it; the site never does. |
| `scripts/` | Data generation, offline AI extraction and evaluation. |
| `app/`, `components/`, `lib/` | Next.js pages, the lab interface, and browser and build-time helpers. |
| `content/` | Hand-written copy: work entries, requirements, decisions and limitations. |
| `public/data/` | The published weeks: `leads.json` (what the rules see), `labels.json` (the answer key) and, once generated, `ai.json` (stored model outputs). |
| `tests/e2e/` | Playwright browser and accessibility tests. |

The cleaning, scoring, routing and AI modules cannot import the generator or the answer key; a
test in `core/architecture.test.ts` enforces this. More in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Data

`pnpm data:generate` rewrites `public/data` from the generator. The output is deterministic, and a
test fails if the committed files differ from what the generator produces, so a change to the
generator must ship with regenerated data. Bump `GENERATOR_VERSION` in `core/dataset/generate.ts`
when the generator's logic changes.

## AI outputs

A small model reads each free-text message once, offline, and returns structured signals with
quotes from the message. The answers are stored in `public/data/<week>/ai.json` with the model,
effort, prompt version, date and cost. The site never calls a model.

To generate them, add an `ANTHROPIC_API_KEY` repository secret and run the **Generate AI outputs**
workflow from the Actions tab. It estimates the cost, stops at a spending cap (3 US dollars by
default), runs the checks and the build, scores the outputs against the answer key and opens a
pull request with the scorecard. Details in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

```bash
pnpm ai:extract --dry-run   # count messages and estimate the cost, no API calls
pnpm ai:eval                # score stored outputs against the answer key
```

## Tests

- **Unit and property tests** (Vitest and fast-check) cover cleaning, duplicates, scoring,
  routing, the AI checks, the metrics and the explanations. Property tests check rules that must
  always hold, such as "more buying signals never lower a score" and "more capacity never removes
  a call".
- **Parity**: the SQL metrics and the TypeScript metrics are compared over random settings.
- **Browser tests** (Playwright and axe) run against the production build on a desktop and a phone
  viewport. They check that every page passes WCAG 2.2 A and AA rules in light and dark mode, that
  the metrics on screen match the engine, and that the lab works from a keyboard.
- **The build is gated**: `pnpm build` runs the unit tests first and writes the report that the
  Under the hood page publishes.

More in [docs/TESTING.md](docs/TESTING.md).

## Deployment

Every page is pre-rendered, so the site deploys as static files with security headers set in
`next.config.ts`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Vercel, the domain and the AI
workflow.

## How this was built

Juan Sebastián Arias wrote the brief, set the scope and the standards, and approved the design and
product decisions. Most of the code was written with Claude Code, an AI coding assistant, under his
direction. It is held to the same tests and published rules as any other code.

## Known limitations

The answer key comes from the same generator that wrote the data, so the lab shows how the rules
behave under stated assumptions, not how they would perform on a real market. The full list, and
what comes next, is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#limitations-and-next-steps) and
on the [Under the hood](https://heyjuanse.com/architecture#limitations) page.
