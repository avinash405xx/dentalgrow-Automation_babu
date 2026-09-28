# DentaGrow Suite - Deployment & Operations Runbook

Target: `dentagrow-api` (Wasmer Edge app `da_2l9IzteUYZy5`, owner `avinash405xx`).

## 1. Why production returned HTTP 500

The live workload `dav_nQgIotpu9ZaG` fails at start-up with Node's
`ERR_UNKNOWN_FILE_EXTENSION ".ts"`, i.e. the running process executed
`node src/server.ts` instead of the compiled `node dist/server.js`.

The repository at `HEAD` (`0132b3b`) already fixes this: `commands.start` is
pinned to `node dist/server.js` in the root `Anybuild`. That commit was pushed
but **never built** by Wasmer, so Edge kept serving the previous artifact.
Treat the current outage as a *stale deployment*, not a config defect.

### How the runtime layout is derived (verified against Anybuild v0.29.0)

| Anybuild construct | Effect |
| --- | --- |
| `app_subdir = "api"` | Build context enters `api/` (`node_stage_steps` -> `workdir(source.path/app_subdir)`), so `npm install` and `npm run build:api` run inside `api/`. |
| `_export_steps` | Runs `cp -RL . /app` with the working directory already inside `api/`, so **`/app` contains the contents of `api/`**, not the repo root. |
| `node_serve` | `cwd = app.serve_path`, and `docker.rs` sets `serve_path = "/app"`. |

Therefore `node dist/server.js` resolves to `/app/dist/server.js`, which is
`api/dist/server.js`. This is confirmed by the historical error path itself:
`/app/src/server.ts` is `api/src/server.ts`, proving `app_subdir` was already
in effect - only the start command was wrong.

`runtime_port` is emitted as `None` for the Wasmer platform
(`run/wasmer.rs`), and the Node provider never injects `PORT`, so the
`PORT: "80"` value in `app.yaml` is what the Express app binds to. Leave it.

## 2. Required Wasmer dashboard configuration

Set these in the app's **Environment Variables** (they are not committed):

| Key | Value |
| --- | --- |
| `SUPABASE_URL` | `https://mjtbinsmgblgwfvcdsjp.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | current `service_role` key for that project |
| `DENTAGROW_INTERNAL_SECRET` | freshly generated 64-char hex (see below) |
| `ALLOWED_ORIGINS` | exact dashboard origins, comma-separated, no wildcard |
| `PORT` | `80` (already supplied by `app.yaml`; do not duplicate) |

### 2.1 CRITICAL - the project ref is easy to mistype

`api/.env` on the development machine contained
`https://mtbinsmgblgwfvdcsjp.supabase.co`, which is **not** the real project.
The correct ref is `mjtbinsmgblgwfvcdsjp` (confirmed by `api/.env.example`,
`supabase/.temp/project-ref` and the pooler URL). The bad host does not
resolve:

```
getaddrinfo ENOTFOUND mtbinsmgblgwfvdcsjp.supabase.co
```

Every Supabase-backed endpoint then returns `503 Notification idempotency
storage unavailable`. If the dashboard values were copied from that file, the
same typo is in production and must be corrected there, or a successful redeploy
will still 503 on `/v1/*` database routes.

Check the host before trusting it:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://mjtbinsmgblgwfvcdsjp.supabase.co/rest/v1/
# 401 = project exists and wants credentials. 000 = wrong host / DNS.
```

### 2.2 Rotate BOTH server secrets (mandatory - they are public)

`api/.env.example` was committed with **real** values in `d74ec53` ("Prepare
DentaGrow production deployment") and `a3f8a1b` ("configure Wasmer API
runtime"). Both commits are ancestors of `origin/main`, and
`github.com/avinash405xx/dentalgrow-Automation_babu` answers unauthenticated
requests (`api.github.com/...` returns `200`), so the repository is public and
the values are world-readable:

| Exposed value | Where | Current status |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` (42-char `sb_secret_...`) | `api/.env.example` in `d74ec53`, `a3f8a1b` | **Identical to the key still present in the developer `api/.env`.** It now returns HTTP `401 Invalid API key` from Supabase, i.e. it has already been revoked/rotated. |
| `DENTAGROW_INTERNAL_SECRET` (64-char hex) | same blob | Differs from the value now in `api/.env`; treat it as burned regardless. |

`052edf1` ("fix API env example") replaced both with inert placeholders, and
`HEAD` is clean - verified by scanning every reachable blob. **History rewrites
do not un-leak the values**; rotation is the only real fix.

Actions, in order:

1. Supabase dashboard -> *Settings* -> *API Keys*: roll the `service_role` key.
   The key currently in `api/.env` is the leaked one and is already rejected
   (`401`), which is exactly why Supabase-backed endpoints answer
   `503 Notification idempotency storage unavailable` locally. Put the new key
   in the dashboard env var **and** in the local `api/.env`.
2. Generate and set a new internal secret everywhere it is used:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. If the repo ever stays public, consider making it private or having GitHub
   purge the cached objects, then confirm no `.env` (only `.env.example` with
   placeholders) is ever committed again - `.gitignore` already blocks `.env`.

Probe a service-role key without exposing it:

```bash
curl -s -o /dev/null -w "%{http_code}\n" ^
  "https://mjtbinsmgblgwfvcdsjp.supabase.co/rest/v1/dentagrow_app_releases?select=id&limit=1" ^
  -H "apikey: %NEW_KEY%" -H "Authorization: Bearer %NEW_KEY%"
# 200 = accepted. 401 = revoked/wrong key (do not deploy with it).
```

## 3. Triggering the redeployment

No `wasmer` CLI or API token is available in this environment, so the push did
not produce a build. Pick one:

**A. Reconnect the repository (recommended).** In the Wasmer dashboard open
`dentagrow-api` -> *Settings* -> *Deployment* and confirm a GitHub source is
attached. If it shows "not connected", install the Wasmer GitHub App on
`avinash405xx/dentalgrow-Automation_babu` and select this repo + `main`. The
attach action runs an initial build immediately.

**B. Push a no-op commit** after the source is attached, to confirm the webhook
fires:

```bash
git commit --allow-empty -m "ci: trigger Wasmer build" && git push origin main
```

**C. Deploy from the CLI** once a token exists:

```bash
npm i -g wasmer
wasmer login
wasmer deploy --no-monitor --schema-version 2
```

`wasmer deploy` reads `app.yaml` plus the root `Anybuild`; do not add a
`wasmer.toml`, and keep `Anybuild` at the repository root next to `app.yaml`.

## 4. If the rebuild still fails

Work down this list, re-running `wasmer deploy --no-monitor` between attempts:

1. Read the build log. A failure inside `npm run build:api` means `tsc` could
   not resolve `../tsconfig.json`; `app_subdir` copies the whole repo into the
   build directory, so this should not happen.
2. The app is annotated `edgejs_enable: true` / `edgejs_precompile: true`, so
   the artifact is precompiled for Wasmer's EdgeJS runtime rather than plain
   Node. If the log or start-up output blames an unsupported Node builtin
   (`fs`, `crypto`, dynamic `require`) - `dotenv/config` reads the filesystem at
   import time - set both annotations to `false` in `app.yaml` and redeploy to
   run real Node.
3. `app.yaml` annotations override the `Anybuild` config. `node_server` there is
   `express` while `Anybuild` says `node`; that mismatch is harmless today
   (it only selects optional dependency-optimization paths) but keep the two
   files aligned to avoid surprises.
4. Confirm the dashboard has no start command or `PORT` override that shadows
   `app.yaml` / `Anybuild`.

## 5. Post-deploy verification

```bash
set API=https://<your-edge-hostname>

curl -s %API%/health
# expect {"ok":true,"version":"1.0.0","service":"dentagrow-api"}

curl -s -o NUL -w "%{http_code}\n" %API%/v1/releases/current
# expect 200

curl -s -o NUL -w "%{http_code}\n" -X POST %API%/v1/admin/users ^
  -H "Content-Type: application/json" -d "{}"
# expect 400 (body validation) - never 500

curl -s -o NUL -w "%{http_code}\n" -X POST ^
  %API%/v1/notifications/idempotency/check-and-reserve ^
  -H "Content-Type: application/json" -d "{}"
# expect 401 (internal secret enforced before validation)

curl -s -D - -o NUL -X OPTIONS %API%/v1/admin/users ^
  -H "Origin: https://<dashboard-origin>" ^
  -H "Access-Control-Request-Method: POST"
# expect Access-Control-Allow-Origin to echo the exact origin, never *
```

A `500`/`workload_failure` with `x-edge-request-outcome: workload_failure` means
the process is still crashing on boot: re-read the runtime log, do not assume
the code changed.

## 6. Validation performed locally (all green)

`node dist/server.js` from `api/` with real environment values:

| Check | Result |
| --- | --- |
| Process command line | `node.exe dist/server.js` - no `.ts`, no `ERR_UNKNOWN_FILE_EXTENSION` |
| `GET /health` | 200 `{"ok":true,"version":"1.0.0","service":"dentagrow-api"}` |
| `GET /v1/releases/current` | 200 with release payload |
| No / wrong internal secret | 401 both cases |
| Correct secret + bad body | 400 |
| `POST /v1/admin/users` valid body | 501 (fails closed by design) |
| `POST /v1/admin/users` bad body | 400 |
| CORS allowed origin | ACAO echoes origin exactly, never `*` |
| CORS disallowed origin | no `Access-Control-Allow-Origin` header |
| Unknown route | 404 |
| Supabase idempotency call | 503 - project host invalid / key rejected, see 2.1 & 2.2 |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` (both panels) | exit 0 |
| `npm run build:api` | exit 0, emits `api/dist/server.js` |
| Vite dev `:4100` `/`, `/src/main.tsx`, shared `api.ts` | all HTTP 200 |
| Browser bundles | contain `/health`, `/v1/releases/current`, `/v1/admin/users`; contain **no** `sb_secret` and no internal-secret header |

## 7. Notes

- `POST /v1/admin/users` deliberately returns `501` until caller-authorization
  middleware exists. The panels call it and surface the real server answer
  instead of pretending success. Do not add a Supabase service-role key or the
  internal secret to any Vite `VITE_*` variable to make it "work".
- Supabase-backed endpoints require migration
  `supabase/migrations/005_notification_idempotency.sql` to be applied to the
  target project.
- `supabase/.temp/` (CLI link scratch state, including the pooler URL) was
  untracked and gitignored.
