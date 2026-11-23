# Architecture

How the site is put together, and why. The product reasoning is in [PRODUCT.md](PRODUCT.md); the
model itself is explained for readers on the site's own page, [`/engine`](https://heyjuanse.com/engine).

## The shape of it

```
core/flow      the model: pure TypeScript, no React, no I/O
core/agent     the AI step's contract: shapes, limits
server/agent   the only code that calls the model
lib/flow       the page's state and wording, built on core/flow
components     the interface
app            two pages, a 404 and one API route
```

Dependencies point one way: `app` and `components` use `lib`, which uses `core`. `core` cannot
import React, Next.js or the model's SDK. A lint rule and `core/architecture.test.ts` enforce it,
so the model can always be run and tested without a browser or a network.

## The model (`core/flow`)

| Module | What it does |
| --- | --- |
| `company.ts` | Larkspur: the five teams, every assumption with its base value, the six improvements, what a setup costs. |
| `calendar.ts` | Working hours, nights and weekends. |
| `requests.ts`, `chance.ts`, `dist.ts` | The stream of customers. Each customer carries their own seeded chance, so their size, patience and decisions are the same under every setup. |
| `engine.ts`, `heap.ts` | The discrete-event simulation: arrivals, assignment, lines, work, redo, giving up, invoices and payments. |
| `experiment.ts`, `metrics.ts` | Many quarters of one setup, summarised; the paired difference between two setups and whether it is clear. |
| `planner.ts` | Every move from a setup, measured and judged; the plan that takes the best one and looks again. |
| `diagnose.ts` | Why work waits at a team: the wait split into its causes. |
| `sensitivity.ts` | How much a gain depends on each assumption, moved one at a time. |
| `theory.ts`, `validate.ts` | Erlang C, Erlang-A and Pollaczek–Khinchine, and the comparison of the engine with them. |
| `trace.ts` | The path of single customers, for "Follow one customer". |
| `scenario.ts` | A setup plus changed assumptions, and its form in a link. |

Three decisions make the numbers worth reading:

1. **The same customers on both sides.** A change is measured as the difference on identical
   customers, which removes most of the noise a comparison of two random runs would have.
2. **A difference has to be clear.** Sixty quarters give a mean difference and its standard error.
   The page states a difference only when the mean is more than twice that error, and says "no
   clear change" otherwise.
3. **The engine is checked against answers known in advance.** With its extras switched off, the
   simulation must reproduce the formulas of queueing theory within sampling error. The check runs
   in the unit tests, at build time for `/engine`, and in the visitor's browser on request.

## The page (`lib/flow`, `components/flow`)

**The first screen is computed where the page is built.** `startView()` simulates today's company,
every first move and the whole plan, and `app/page.tsx` renders it. The page arrives with its
numbers and can be read with scripts switched off.

**After that, everything runs in the browser.** `FlowStore` (`lib/flow/store.ts`) holds the
scenario and the view. A change never blocks: the store publishes an empty view at once, asks the
worker pool for the quarters it needs, and publishes each part as it is ready (the setup, then
every option from it, then the plan step by step). Work for a scenario the visitor has already
left is dropped. Quarters are kept by scenario, so going back is instant. When the visitor follows
the plan, the rest of it is carried over instead of computed again. While the page is idle the
store simulates what the recommended move leads to, so that taking it shows its result at once.

**The pool** (`lib/flow/pool.ts`) runs up to four web workers. Where workers are not available the
same code runs on the page.

**The scenario is in the address.** `?on=routing&hire=quote:1&if=demand:16` reopens the same
company. `decodeScenario` keeps what it recognises and drops the rest, so a mangled or hostile link
cannot put the page in a state the model does not have.

**The floor** (`components/flow/Floor.tsx`) runs one stream of the same engine in real time.
`Live` advances it, `Stage` draws it on a canvas, and the names, counts and buttons are HTML laid
over the drawing, so they stay real text. The stream is the same for everyone (`LIVE_SEED`), chosen
because its first weeks land close to the long-run averages; a test holds it to that.

**The sentences** the page writes from numbers live in `lib/flow/words.ts` and
`lib/flow/format.ts`, apart from the components, so each can be tested against the measurement it
describes. Rounding never invents precision, and a difference that is not clear is never printed
as one.

**While numbers are recomputed** the previous ones stay on screen under a thin running line
(`[data-busy]` in `app/globals.css`) and `aria-busy`. They are not dimmed: dimmed text fails the
contrast rule, which the browser tests caught.

## The AI step

`app/api/agent/route.ts` accepts one request, checks it in order (same origin, a key is
configured, the input is valid, the visitor and the day are under their limits) and calls
`server/agent/triage.ts`. The model must answer through one tool whose input is validated with the
schema in `core/agent/contract.ts`; anything else is reported as a failure and not shown. Nothing
is sent anywhere: the page shows a draft, and a person edits, approves or rejects it.

The four sample requests replay runs recorded by `scripts/record-agent.ts` into
`content/agent/recordings.json`. The page says which is which.

## Security and privacy

- The API key exists only in the server's environment. A browser test reads every script the site
  ships and fails if the key's name, a key or the API's address appears in one.
- `next.config.ts` sends a content security policy, `X-Frame-Options: DENY`, `nosniff`, a referrer
  policy, a permissions policy and HSTS with every response.
- The site sets no cookie, stores nothing in the browser and requests nothing from another origin.
  A browser test walks a whole visit and fails if any of that changes.
- The policy allows inline scripts, because the framework inlines small scripts in static pages.
  Nonces would make every page render on demand.

## Addresses of earlier versions

`/work`, `/about`, `/simulator` and `/lab` redirect to `/`; `/architecture` and `/colophon`
redirect to `/engine`.
