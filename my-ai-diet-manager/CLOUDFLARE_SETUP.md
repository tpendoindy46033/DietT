# Cloudflare Setup

This app deploys as a **Cloudflare Pages** project (not a Worker - a Worker does
not provide the `ASSETS` binding that `_worker.js` needs to serve `index.html`,
the CSS, and the JS). D1 provides the database. Wrangler automates the whole
process, but a manual dashboard path is documented too.

## Prerequisites

- A Cloudflare account. The free tier covers Pages and D1. If you don't have one,
  create it at https://dash.cloudflare.com/sign-up, then come back here.
- `npm install` already run in this project.

## Option A: automated setup with Wrangler (recommended)

### 1. Sign in

```bash
npm run cf:login
```

This opens Cloudflare's OAuth consent page in your browser. Click **Allow**. If a
browser can't be opened automatically (for example, in a headless environment),
the URL to open is printed to the terminal instead.

Check who you're signed in as at any time with:

```bash
npm run cf:whoami
```

### 2. Run the one-time setup

```bash
npm run cf:setup
```

This is idempotent - safe to run again if it's interrupted. In order, it:

1. Verifies you're authenticated (fails with a clear message if not).
2. Creates the `my-ai-diet-manager-db` D1 database, **only if it doesn't already
   exist**.
3. Writes the real database id into `wrangler.toml`, replacing the placeholder.
   This has to happen before any other D1 command, since Wrangler resolves the
   database to use from that file.
4. Applies `database/schema.sql` to the remote database and verifies all six
   tables (`profiles`, `meals`, `meal_items`, `weights`, `sessions`,
   `login_attempts`) exist.
5. Creates the `my-ai-diet-manager` Pages project, only if it doesn't already
   exist (retries a few times, since the Pages project-creation API sometimes
   fails transiently).
6. Builds the project (`npm run build`).
7. Deploys it.
8. Reads `/api/health` on the live deployment and prints exactly which of the
   three secrets are still missing.

### 3. Set the secrets

```bash
npm run cf:secrets
```

You'll be prompted, one at a time, to type in:

- `OPENAI_API_KEY`
- `APP_PASSWORD`
- `SESSION_SECRET` (a long random string - see `.env.example` for how to generate one)

This script hands the terminal to Wrangler's own prompt for each value; it never
reads, stores, prints, or transmits the values itself. **Cloudflare Pages binds
secrets at deploy time**, so `cf:secrets` automatically redeploys once all three
are set - a secret added without redeploying won't reach the running site, even
though the dashboard will list it as present.

### 4. Verify

```bash
npm run cf:status
```

Reports the authenticated account, whether the Pages project and D1 database
exist, and (via `/api/health`) which secrets are still missing on the live site.
This fails loudly if you're not signed in, rather than silently reporting the
health of whatever happens to be running at the predictable `*.pages.dev`
hostname (which could be someone else's project).

### Everyday commands

| Command | What it does |
| --- | --- |
| `npm run cf:deploy` | Build and deploy with the D1 binding attached (use after the first `cf:setup`) |
| `npm run cf:schema` | Re-apply `database/schema.sql` to the remote database (safe to re-run) |
| `npm run cf:status` | Report what the live site actually has configured |

## Option B: manual setup via the Cloudflare dashboard (Direct Upload)

If you'd rather not use the CLI for deployment itself:

1. **Create the D1 database.** Dashboard → Storage & Databases → D1 → Create
   database, name it `my-ai-diet-manager-db`. Open its **Console** tab and paste
   in the contents of `database/schema.sql` to run it (or use `npm run cf:schema`
   from the CLI, which only needs the database to exist).
2. **Create the Pages project.** Dashboard → Workers & Pages → Create → Pages →
   Upload assets (Direct Upload). Name it `my-ai-diet-manager`.
3. **Build locally**: `npm run build`. This produces `deploy-folder/`.
4. **Upload** the entire contents of `deploy-folder/` as the deployment.
5. **Bind the database.** Project → Settings → Bindings → add a D1 database
   binding named exactly `DB`, pointing at `my-ai-diet-manager-db`.
   Note: the dashboard's bindings UI can silently fail to save a binding with no
   visible error. If that happens, use the CLI path instead (Option A), which
   writes the binding into `wrangler.toml` as code and bypasses the dashboard UI
   entirely for this step.
6. **Add the three secrets** under Settings → Environment variables, as
   **encrypted** variables: `OPENAI_API_KEY`, `APP_PASSWORD`, `SESSION_SECRET`.
7. **Redeploy** after adding secrets or the binding - like the CLI path, Cloudflare
   Pages binds configuration at deploy time, so an existing deployment won't pick
   up changes until you trigger a new one (Deployments → Retry deployment, or
   upload `deploy-folder/` again).

## `wrangler.toml`

```toml
name = "my-ai-diet-manager"
pages_build_output_dir = "deploy-folder"
compatibility_date = "2026-09-21"

[[d1_databases]]
binding       = "DB"
database_name = "my-ai-diet-manager-db"
database_id   = "<filled in automatically by npm run cf:setup>"
```

Declaring the D1 binding here (rather than only in the dashboard) means the
binding is defined as code and is picked up automatically by
`wrangler pages deploy` - no manual dashboard step required when using Option A.

## Troubleshooting

- **`/api/health` shows `database: false`** - the D1 binding isn't resolving.
  Confirm `wrangler.toml` has a real `database_id` (not the placeholder), and
  that you've deployed *after* that value was set (`npm run cf:deploy`).
- **A secret shows as missing right after adding it** - Cloudflare Pages binds
  secrets at deploy time. Redeploy (`npm run cf:deploy`, or use `npm run
  cf:secrets` which does this for you automatically).
- **Login always fails** - check that `APP_PASSWORD` and `SESSION_SECRET` are
  both set; `/api/health` reports both independently.
- **AI analysis fails** - check `/api/health` for `openai: false`, meaning
  `OPENAI_API_KEY` isn't set (or isn't valid). The app never falls back to
  another model or service; it shows a friendly retry message instead.
