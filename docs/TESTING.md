# Testing and evaluation

The tests are organized around the claims the site makes. If the lab says a rule holds, a number
comes from SQL, or a page is accessible, something below checks it.

| Command | What runs |
| --- | --- |
| `pnpm test` | Unit, property, parity, data and architecture tests (Vitest) |
| `pnpm check` | Typecheck, lint and formatting (Biome), then `pnpm test` |
| `pnpm build` | `pnpm test:report`, then the production build |
| `pnpm test:e2e` | Browser and accessibility tests against the production build (Playwright and axe) |
| `pnpm ai:eval` | The stored AI outputs scored against the answer key |

CI runs all of these except the AI evaluation on every push to `main` and every pull request; see
`.github/workflows/ci.yml`.

## Unit and property tests

They live next to the code (`*.test.ts` in `core/`, `server/` and `scripts/`).

- **Cleaning**: normalization of names, emails, companies, websites, countries and titles, with
  the reason recorded for each change.
- **Duplicates**: each merge rule, the title conflict that blocks a merge, look-alike names that are
  flagged but never merged, and survivorship.
- **Scoring**: the published tables and group limits, and properties that must always hold: more
  activity, more recent activity, a source with more intent, an approved budget or a shorter
  timeline never lower a score, and every score stays within 0 to 100.
- **Routing**: every eligibility rule and its order, every AI policy (including that AI cannot
  override a data rule), and properties of the queue: exactly `min(capacity, queue)` calls, more
  capacity never removes a call, raising the threshold never adds a lead to the sales lane, and
  every lead gets exactly one decision.
- **AI checks**: quote verification (case, spacing and curly quotes), the downgrade to low
  confidence, and the trust policy.
- **Metrics**: every need is counted exactly once, more capacity never reaches fewer needs, and
  the decisions do not change when the answer key changes.
- **Explanations**: what the "what changed" panel says for each kind of change, and that a case
  file's reason for a score without AI points matches how the router decided.
- **Extraction client**, with the Anthropic client mocked: refusals, cut-off answers and output
  that does not match the schema are stored as failures, rate limits fail one message, and an
  authentication error stops the run.

Property tests use fast-check, which tries many random leads and settings and shrinks any failure
to a minimal example.

## Tests that keep the site honest

- **SQL parity** (`core/sql/parity.test.ts`): the metric queries and the TypeScript reference
  metrics agree over random settings. The lab shows SQL results, and the reference implementation
  is what the unit tests check, so this test connects the two.
- **Published data** (`core/dataset/generate.test.ts`): the generator is deterministic,
  regenerating the data must reproduce the committed files exactly, every email and website uses
  a reserved `.example` domain, and each week has a plausible mix of needs and duplicates.
- **Architecture** (`core/architecture.test.ts`): the engine cannot import the generator or the
  answer key, and the site cannot import the API client.
- **The build gate**: `pnpm build` runs the unit tests first and stops if one fails. The report it
  writes (`.reports/vitest.json`) is what the Under the hood page lists, so the published test
  names and results come from the run that preceded the build.

## Browser and accessibility tests

`tests/e2e/` runs on two projects, a 1440-pixel desktop and a Pixel 7 phone, against
`pnpm start`, so it exercises the static build, the security headers and the compiled SQLite
engine.

- Every page loads with one main heading, no console errors and no axe violations of WCAG 2.2 A
  and AA rules. Every page, the lab's table view and its under-the-hood view are also checked in
  dark mode.
- Every internal link and in-page anchor resolves, and unknown addresses return a 404 page.
- The metrics on screen match what the engine computes for the same settings, including after a
  dial moves, with the stored AI outputs on, and in the answer-key experiment. The stored outputs
  are labeled with the model and the date of the run, and the answer key as an upper bound.
- The one-line results on the home page and at the top of the lab match what the engine computes
  for the default week, with and without the stored AI outputs, and the work result on the home
  page carries its program-level label. The lab's list of the skills it shows is plain text, with
  no buttons or links in it.
- A shared link restores the settings it was made with.
- Keyboard paths: the skip link, moving a dial with arrow keys, opening a case file with Enter and
  closing it with Escape, with focus returned to the lead.
- The SQL console refuses writes and answers read-only queries.
- On a phone, the rules fold into one line and the try-one-change buttons work with a tap.
- Failures (`tests/e2e/resilience.spec.ts`): if the data cannot load, the lab says so and offers a
  reload; if SQLite cannot start, the reference implementation computes the metrics and the page
  says so, with no uncaught errors; if the stored AI outputs cannot load, AI stays off, the summary
  at the top stops pointing to "Use AI signals", and the lab offers the answer-key experiment
  instead. Addresses with nonsense settings fall back to the
  defaults or the nearest allowed value, and a link to a case that does not exist leaves the lab as
  it was.
- Privacy: no page requests anything from another site, sets a cookie or stores anything in the
  browser, which is what the colophon promises.
- Reflow: no page scrolls sideways at 320 pixels wide (WCAG 1.4.10), including the lab's three
  views and an open case file.

Not covered yet: manual screen reader testing, visual regression tests and performance budgets.
Performance was checked by hand with Lighthouse on its mobile profile; it is not part of CI.

## Evaluating the AI outputs

`pnpm ai:eval` (and the lab's under-the-hood view) scores each stored run against the answer key:

- accuracy for each scored field: intent, timeline, budget, requested next step and language;
- the share of messages where all four fields that affect routing are right;
- prompt injection attempts caught, and false alarms;
- accuracy among high-confidence answers, to check that confidence means something;
- answers downgraded by the quote check;
- refusals and failures, and the estimated cost.

Every miss is listed with the expected and returned values. The answer key comes from the same
generator as the messages, so these numbers measure extraction on this synthetic data, not on real
inbound mail.

### Stored runs

Two runs have been made, each with `claude-haiku-5-5` at low effort over the 578 messages in the
three weeks. The lab uses the second. Totals for all three weeks:

| Measure | Prompt 2026-10-20.1 | Prompt 2026-10-22.1 (in use) |
| --- | --- | --- |
| Answers lowered to low confidence by the quote check | 146 | 2 |
| Answers the rules saw as high confidence | 193 | 316 |
| All four routing fields right | 79.9% | 84.9% |
| Intent right | 96.4% | 96.2% |
| Next step right | 85.8% | 91.7% |
| Prompt injections caught | 12 of 12, no false alarms | 12 of 12, no false alarms |
| Needs reached at the default settings with AI on, high confidence only (AI off: 78 of 213; answer key: 97) | 79 | 90 |
| Cases sent to human review at those settings | 45 | 27 |
| Estimated cost | $0.21 | $0.23 |

The first run read most fields correctly, but a quarter of its answers were lowered to low
confidence. In 113 of the 146, intent had no quote of its own, often because the sentence that
showed it was quoted once, under another field. The second prompt asks for one evidence item per
field, repeating a quote when one sentence supports several, and only quotes from inside the
message. The answer key was not used to write the change.

Each prompt ran once, so part of the change in field accuracy may be run-to-run variation; the drop
in downgrades is what the change targeted. The 578 messages come from 105 of the 111 hand-written
templates (140 distinct texts once the placeholders are filled), so a template the model misreads
counts several times, and the shares are not 578 independent measurements. The first run's outputs
are kept on the `ai-outputs/20261022-000353` branch.
