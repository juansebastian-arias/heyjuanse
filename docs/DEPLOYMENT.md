# Deployment

The site is a static Next.js build: no server runtime, no database and no environment variables.
Any host that runs `pnpm build` and serves Next.js output works; these notes use Vercel.

## First deployment on Vercel

1. In Vercel, choose **Add New → Project** and import this GitHub repository.
2. Keep the detected settings: framework **Next.js**, install command `pnpm install`, build command
   `pnpm build`. Set the Node.js version to 22 under **Settings → Build and Deployment** if it is
   not already.
3. Deploy. `pnpm build` runs the unit tests before building, so a failing test stops the
   deployment.

Every push to `main` deploys to production, and every pull request gets a preview deployment.

## The domain

1. In the Vercel project, open **Settings → Domains** and add `heyjuanse.com` and
   `www.heyjuanse.com`, with one redirecting to the other.
2. At the domain registrar, add the DNS records Vercel shows for each name (typically an `A`
   record for the apex domain and a `CNAME` for `www`). Vercel issues the TLS certificate once the
   records resolve.

## Checking a deployment

```bash
curl -sI https://heyjuanse.com | grep -iE "content-security-policy|strict-transport|x-frame"
```

The security headers come from `next.config.ts`. The content security policy is only sent by
production builds, because the development server needs to evaluate code.

Then open `/lab` and confirm that the metrics panel says "Computed by SQLite in your browser". That
proves the WebAssembly engine loaded under the content security policy.

## Generating the AI outputs

The extraction runs in GitHub Actions, so the API key never reaches the site or a laptop.

1. Create an API key in the Claude Console, inside a workspace. A workspace just for this site can
   carry a monthly spend limit, which is a sensible second cap. A key that is not scoped to a
   workspace fails on the first request with an error asking for a workspace ID.
2. In the GitHub repository, add it under **Settings → Secrets and variables → Actions → New
   repository secret** with the name `ANTHROPIC_API_KEY`.
3. In the **Actions** tab, run **Generate AI outputs**. The defaults are the model
   `claude-haiku-5-5` at low effort, all weeks, and a 3 US dollar cap on estimated spend. The dry
   run before it estimates about 13 cents per week; the stored runs cost about 8.
4. The run checks, tests and builds the site with the new outputs, scores them against the answer
   key and pushes them to a new branch. Its summary shows the scorecard and links to a pre-filled
   pull request. Open it, and CI runs on it like on any other pull request. Merging it deploys the
   outputs.

The workflow does not open the pull request itself, because a pull request opened with a
workflow's own token does not start CI.

Each stored run records the hash of the leads file it read. If the data is regenerated, the lab
marks older outputs as stale and stops using them until the workflow runs again.

## Regenerating the data

```bash
pnpm data:generate
pnpm test
```

Commit the regenerated `public/data` files together with the generator change; a test fails if
they differ. Bump `GENERATOR_VERSION` when the generator's logic changes, and run the AI workflow
again afterwards.
