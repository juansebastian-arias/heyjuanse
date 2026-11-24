# Testing

```bash
pnpm check        # typecheck, lint, unit and property tests
pnpm build        # runs the unit tests, writes the report, builds
pnpm test:e2e     # browser tests against the production build
```

CI (`.github/workflows/ci.yml`) runs all of it on every pull request and on `main`.

## Unit and property tests

Vitest and fast-check, next to the code they test in `core/`, `lib/` and `server/`: 308 tests in 22
files. `pnpm build` runs them first and writes `.reports/vitest.json`, which `/engine` publishes
by file and by name, so the page cannot show a report that did not happen.

What they hold:

- **The engine against theory.** With its extras switched off, the simulation must match the
  formulas of queueing theory: Erlang C for one and for three people, Pollaczek–Khinchine for
  uneven work, Erlang-A for customers who give up. Each within the sampling error of the run.
- **The engine's rules, one at a time.** Order of service, part-time teams, patience that runs
  through nights and weekends, hand-outs, rework, the wait for payment.
- **Conservation.** Every request that arrives is accounted for, under today's company and under
  changed ones. No request is lost or invented, no team is overbooked, time never runs backwards,
  and every hour of a wait is counted once, under what the request was waiting for.
- **Reproducibility.** The same seed gives the same customers and the same history, whether time
  advances in one step or in many, and however many workers compute it.
- **The comparison.** Two setups get exactly the same requests and the same would-be buyers; a
  setup against itself differs by exactly zero.
- **The planner.** It only takes steps that are clearly worth their cost, stops when none is, and
  ends within a few percent of the best of all 64 combinations of improvements.
- **The wording.** Each sentence the page writes is tested against the number it describes,
  including that a difference which is not clear, or which disappears when rounded, is not stated.
- **The store.** Publishing in stages, never showing anything from an abandoned change, simulating
  nothing twice, carrying the plan over, and recovering from a failed run.

## Browser tests

Playwright and axe, in `tests/e2e/`, on a desktop (1440 by 900) and a phone (Pixel 7), against the
production build.

The tests do not trust the page for its own numbers. `helpers.ts` runs the same quarters in the
test process, without the page, and the tests then hold the page to those figures.

| File | What it covers |
| --- | --- |
| `company.spec.ts` | The first screen (one thing to do, whole and in view, also on a short laptop screen; numbers present with scripts off); the floor running, pausing and skipping; reduced motion; the best move (address, figures, the sentence that reports it, the flag moving on, undo); any other change; the whole plan; the keyboard; a setup opened from a link; a mangled link; a browser without workers. |
| `inside.spec.ts` | The tabs from the keyboard; the table of waits against the engine; one customer's story; changing an assumption and putting it back; the sensitivity test; rerunning the checks; the published test report; the AI step with sample runs, edits, approval and rejection, and its failure messages. |
| `engine.spec.ts` | `/engine`: the contents, the diagram, every assumption with the model's value, the checks, the test files. |
| `site.spec.ts` | WCAG 2.2 A and AA in light and dark, on a changed company with every layer open, and on the 404; the skip link; no sideways scroll at 320 pixels; a visit that sets no cookie, stores nothing and contacts no other site; contact links; the security headers; the card a shared link shows; redirects; the 404; no key in any shipped script; the API route's refusals. |

**No browser test reaches the model.** Tests of the API route send requests that stop at its first
checks. Tests of the interface answer `/api/agent` themselves.

To run them with a Chromium that is already installed, point a local config at it:

```ts
// playwright.local.config.ts (not committed)
import base from "./playwright.config";
export default {
  ...base,
  use: { ...base.use, launchOptions: { executablePath: "/path/to/chromium" } },
};
```

```bash
npx playwright test -c playwright.local.config.ts --trace off
```

## What the tests do not cover

- The live model call. It needs a key and costs money, so it is exercised by the recording
  workflow and by hand, not by CI.
- Browsers other than Chromium.
- The production deployment itself. `docs/DEPLOYMENT.md` lists what to check after one.
