# heyjuanse.com

The site of Juan Sebastián Arias. It is one working product instead of a set of pages about its
author: **Larkspur**, a made-up company that sells route-planning software to delivery fleets,
simulated in the browser from a customer's first message to the paid invoice.

- **[The company](https://heyjuanse.com)**: watch requests move through five teams, see where
  buyers give up waiting, make the change the model ranks first and read what it came to. Under
  it: a panel for each team, the plan step by step, and five layers that answer what a careful
  reader would ask (why the line forms, what happens to one customer, what if an assumption is
  wrong, is the engine right, what does the AI step do).
- **[How it is built](https://heyjuanse.com/engine)**: what runs for real and what is made up,
  the life of a request, the decisions behind the numbers, every assumption with its value, the
  checks against known formulas, and the test report of the build.

## What is real and what is made up

| Runs for real | Made up, and labeled so |
| --- | --- |
| The simulation: every dot, wait and dollar is computed in the visitor's browser, again after each change. | Larkspur and its customers. No real company's data is used anywhere. |
| The comparison: each change is measured against today's company on the same simulated customers, over 60 quarters. | The assumptions: plausible for a small software company, not measured. All are listed on `/engine`; seven can be changed on the home page. |
| The checks: the engine is tested against queueing formulas with known answers, and a visitor can rerun that test. | The dollar figures: they follow from the assumptions. They show how the method reasons and are not results achieved anywhere. |
| The AI step: a visitor's own request is a live model call. The four samples replay real runs, recorded once. | |

## Quick start

Requires Node 22.12 or later and pnpm 10 (`corepack enable` installs the pinned version).

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm check        # typecheck, lint, unit and property tests
pnpm build        # runs the tests, then a production build
pnpm test:e2e     # browser and accessibility tests against the production build
```

Nothing needs to be configured to run or build the site. One optional variable, on the server
only, switches on the live AI step: see [The AI step](#the-ai-step).

## How the code is organized

| Path | What it holds |
| --- | --- |
| `core/flow/` | The model, in plain TypeScript with no React and no I/O: the company and its assumptions, the event engine, seeded chance, the experiment over many quarters, the planner, sensitivity, and the comparison with queueing theory. |
| `core/agent/` | The contract of the AI step: input and output shapes, limits and the rate limiter. |
| `server/agent/` | The only code that calls the model. Used by the API route and by the recording script. |
| `lib/flow/` | What the page needs around the model: the store, the worker pool, the view built from simulated quarters, the live stream drawn on the floor, and every sentence the page writes from a number. |
| `lib/server/` | Build-time helpers: the test report and the build details that `/engine` publishes. |
| `components/flow/` | The interface: the floor (a canvas with real HTML labels over it), the console with the next move, the scoreboard, the team and plan panels, and the layers under `inside/`. |
| `app/` | The two pages, the 404, the API route `app/api/agent` and the global styles. |
| `content/agent/` | The four sample requests and the recorded real runs that replay them. |
| `scripts/` | `record-agent.ts`, which records those runs. |
| `tests/e2e/` | Playwright browser and accessibility tests. |

`core/` cannot import React, Next.js or the model's SDK; the linter and a test in
`core/architecture.test.ts` enforce it. More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and
the reasoning behind the product in [docs/PRODUCT.md](docs/PRODUCT.md).

## The model in one paragraph

Requests arrive through the working week and pass five teams: reply, quote, contract, set up,
invoice. Each team has people, hours and a line; a request that waits too long gives up, and some
of those would have bought. The engine is a discrete-event simulation. Each customer carries their
own seeded chance, so two setups are compared on exactly the same customers. A setup is run for 60
quarters after a warm-up, and a difference counts only when its mean is more than twice its
standard error. The planner measures every change still open, takes the one with the best gain
after cost that is clearly worth it, and looks again from there.

## The AI step

"Try the AI step" hands a customer request to an agent that classifies it, picks an owner and
drafts a reply and a CRM note. Nothing is sent: the visitor edits, approves or rejects the draft.

- The four sample requests replay real runs stored in `content/agent/recordings.json`, so they
  work with no key and cost nothing.
- A visitor's own request goes to `POST /api/agent`, which calls the model on the server. It needs
  `ANTHROPIC_API_KEY` in the host's environment. Without it the route answers that the live agent
  is switched off and the samples keep working.
- The key never reaches the browser; a browser test reads every script the site ships to confirm
  it. The route accepts same-origin requests only, limits each visitor and each day, and makes one
  model call with a small output budget. The hard ceiling on cost is the spend limit of the API
  workspace, set in the Claude Console.

`AGENT_ENABLED=false` switches the live agent off; `AGENT_DAILY_LIMIT` changes the daily limit
(100 by default). The **Record agent runs** workflow re-records the samples when the requests, the
contract or the prompt change (about 10 US cents per run).

## Tests

- **Unit and property tests** (Vitest and fast-check): 308 tests over the engine, the experiment,
  the planner, the wording and the store. The engine is held to Erlang C, Erlang-A and
  Pollaczek–Khinchine within their sampling error.
- **Browser tests** (Playwright and axe) drive the production build on a desktop and a phone. They
  compare the figures on screen with figures the engine computes separately in the test process,
  for the first screen, every kind of change, a setup opened from a link and each layer. They also
  cover the keyboard, reduced motion, a browser without workers, WCAG 2.2 A and AA in light and
  dark, a 320 pixel screen, the security headers, and that a visit sets no cookie and contacts no
  other site.
- **The build is gated**: `pnpm build` runs the unit tests first and writes the report that
  `/engine` publishes.

More in [docs/TESTING.md](docs/TESTING.md).

## Deployment

The two pages are pre-rendered; the first screen arrives with its numbers already computed. The
only server code is the AI route. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## How this was built

Juan Sebastián Arias wrote the brief, set the scope and the standards, and approved the design and
product decisions. Most of the code was written with Claude Code, an AI coding assistant, under his
direction. It is held to the same tests and published rules as any other code.

## Known limitations

- Larkspur's assumptions are chosen, not measured. The page shows how the method reasons under
  stated assumptions, not what a real company would gain.
- The model compares settled quarters. It does not simulate the weeks a change takes to bed in.
- Results repeat exactly on one JavaScript engine; another may round the last digit of a logarithm
  differently and move a figure very slightly.
- The rate limits of the AI route are kept in memory, per server instance.
- The content security policy allows inline scripts, because the framework's static pages need
  them. Nothing is loaded from another origin.

The full list is on [How it is built](https://heyjuanse.com/engine#limits).
