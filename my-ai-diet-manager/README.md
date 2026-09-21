# AI Diet Manager

A personal, single-user AI-assisted diet and nutrition tracker. Describe a meal in
words or snap a photo of it, and [gpt-5-nano](https://platform.openai.com) estimates
the foods, portions, and nutrition for you to review, edit, and save. Built as a
Cloudflare Pages site with a bundled `_worker.js`, a Cloudflare D1 database, and a
React + TypeScript + Vite frontend.

## What this is (and isn't)

- Nutrition values are **AI estimates**, always editable, never auto-saved.
- Uses exactly one model, `gpt-5-nano`, for every AI operation. No fallback model,
  no external nutrition/food database, no client-side calls to OpenAI.
- Single user, password-protected, with session cookies and rate-limited login.
- This app does not give medical advice. See the disclaimer on the Settings page.

## Project layout

```
my-ai-diet-manager/
  database/schema.sql       D1 schema (profiles, meals, meal_items, weights, sessions, login_attempts)
  src/shared/                Types + validation + nutrition math shared by frontend and worker
  src/frontend/               React app (pages, components, dependency-free SVG charts)
  src/worker/                  Cloudflare Worker: routing, auth, D1 access, OpenAI Responses API calls
  scripts/                    Cross-platform Node build & Cloudflare automation scripts
  tests/                      Vitest test suite
  public/                     Static PWA files copied into deploy-folder at build time
  deploy-folder/               Build output - the complete, deployable production site
```

## Requirements

- Node.js **20.19 or newer** (this environment has Node v22.22.2, npm 10.9.7)
- A Cloudflare account (free tier covers Pages + D1)
- An OpenAI API key with access to `gpt-5-nano`

## Getting started

```bash
npm install
npm test
npm run build
```

- `npm install` installs dependencies. `npm audit` should report zero vulnerabilities.
- `npm test` runs the full Vitest suite (validation, nutrition math, auth/crypto,
  the Cloudflare SPA-fallback fix, and - when `node:sqlite` is available - the real
  API handlers against the real `database/schema.sql`).
- `npm run build` type-checks, builds the frontend with Vite, bundles the worker
  with esbuild, generates PWA icons, and assembles everything into `deploy-folder/`.
- `npm run dev` starts a local Vite dev server for frontend-only iteration (the
  `/api/*` routes need a real Cloudflare Pages + D1 environment - see
  [CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md)).

All commands work identically on Windows and macOS: every build step is a plain
Node.js script under `scripts/`, with no shell-specific commands and no hardcoded
paths.

## Deploying

See [CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md) for the full walkthrough,
including both the automated `npm run cf:*` scripts and the manual Cloudflare
dashboard path.

Quick version, once you're signed in to Cloudflare (`npm run cf:login`):

```bash
npm run cf:setup     # creates the D1 database + Pages project, applies the schema, builds, deploys
npm run cf:secrets   # prompts you to enter OPENAI_API_KEY, APP_PASSWORD, SESSION_SECRET, then redeploys
```

## Required Cloudflare resources

| Name | Type | Purpose |
| --- | --- | --- |
| `DB` | D1 binding | All application data |
| `OPENAI_API_KEY` | Encrypted secret | Server-side calls to the OpenAI Responses API |
| `APP_PASSWORD` | Encrypted secret | The single-user login password |
| `SESSION_SECRET` | Encrypted secret | HMAC key for session tokens, IP hashes, and password comparison |

`GET /api/health` reports (without authentication) which of these four resources
are currently configured on the live deployment - it's the fastest way to check
what's missing.

## Security notes

- Passwords are compared in constant time, keyed by `SESSION_SECRET` (never
  derived from `APP_PASSWORD`).
- Session tokens are random, stored server-side only as an HMAC hash, and set as
  `HttpOnly; Secure; SameSite=Strict` cookies.
- Client IPs are never stored - only an HMAC hash, keyed by `SESSION_SECRET`.
- Meal photos are used only for the analysis request and are never persisted.
- The OpenAI API key never reaches the browser; all OpenAI calls happen inside
  the Cloudflare Worker.

## Testing notes

- `tests/api.test.ts` runs the real worker handlers against the real
  `database/schema.sql`, using a small D1-compatible shim built on Node's
  built-in `node:sqlite`. If `node:sqlite` isn't available in the Node version
  running the tests, that suite is skipped gracefully rather than failing.
- `tests/assets.test.ts` reproduces Cloudflare Pages' own SPA-fallback behavior
  (a missing asset or unknown path returns `index.html` with a `200`, not a real
  `404`) with a mock asset server, and verifies the worker corrects for it.
- `tests/project-guards.test.ts` scans the whole codebase to assert: only
  `gpt-5-nano` is ever mentioned, the model is never read from an environment
  variable, no external nutrition/food-database integration exists anywhere, no
  secrets are committed, the frontend never references the OpenAI key or
  endpoint, the schema has all required tables/indexes/cascades, and the build
  scripts contain no OS-specific commands or hardcoded paths.
