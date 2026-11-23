# Deployment

The two pages are pre-rendered when the site is built. The only code that runs on a server is the
AI route, `app/api/agent`. There is no database. These notes use Vercel; any host that runs
`pnpm build` and serves Next.js output works.

## Vercel

1. Import the GitHub repository as a project. Keep the detected settings: framework **Next.js**,
   install command `pnpm install`, build command `pnpm build`, Node.js 22.
2. Deploy. `pnpm build` runs the unit tests first, so a failing test stops the deployment.

Every push to `main` deploys to production. Every pull request gets a preview deployment.

## The live AI step

It is optional. Without a key the site works, and the four sample requests replay recorded runs.

1. In the Claude Console, create an API key inside a workspace made for this site, and give that
   workspace a monthly spend limit. That limit is the hard ceiling on cost; the limits in the code
   are the first lines of defense, not the last.
2. In Vercel, add it under **Settings → Environment Variables** as `ANTHROPIC_API_KEY`, for
   Production (and Preview if previews should run it). Do not prefix it with `NEXT_PUBLIC_`: that
   would ship it to the browser.
3. Redeploy.

| Variable | Effect |
| --- | --- |
| `ANTHROPIC_API_KEY` | Switches the live agent on. Server only. |
| `AGENT_ENABLED=false` | Switches it off without removing the key. |
| `AGENT_DAILY_LIMIT` | Runs allowed per day and server instance. 100 by default. |

The limits are kept in memory, so each server instance counts on its own and a restart resets
them.

## The domain

1. In the Vercel project, open **Settings → Domains** and add `heyjuanse.com` and
   `www.heyjuanse.com`, with one redirecting to the other.
2. At the registrar, add the DNS records Vercel shows. Vercel issues the certificate once they
   resolve.

## Checking a deployment

```bash
curl -sI https://heyjuanse.com | grep -iE "content-security-policy|strict-transport|x-frame"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://heyjuanse.com/lab
```

Then, in a browser:

- Press **Make this change**. The sentence above the button should report the result, and the
  address should end in `?on=routing`.
- Open **Check the math** and run the checks. Every row should say Yes. That proves the workers
  loaded under the content security policy.
- Open **Try the AI step** and write a request of your own. With the key set, a draft comes back;
  without it, the page says the live agent is switched off.

## Recording the sample runs

The **Record agent runs** workflow calls the model on the four sample requests and commits
`content/agent/recordings.json` to the branch, for review in its pull request. It runs when the
requests, the contract, the prompt or the recorder change on a working branch, or by hand from the
Actions tab, and needs the `ANTHROPIC_API_KEY` repository secret. A run costs about 10 US cents.
