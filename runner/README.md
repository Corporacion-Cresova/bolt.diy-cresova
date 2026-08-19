# Cresova Runner

Runs generated projects on the server instead of inside the user's browser tab.

Today WebContainer executes `npm install` and the dev server inside the tab, which means builds
are as fast as the user's laptop, they slow to a crawl when the tab is in the background, and the
project dies when the tab closes. This service moves that work to the VPS.

It is a separate service because the main app runs under Wrangler (`workerd`), which cannot spawn
processes or touch the filesystem.

## What it does

- Holds one directory and one port per project under `PROJECT_ROOT`.
- Accepts file operations and commands over a WebSocket at `/connect`, authenticated with a
  short lived ticket rather than the shared secret.
- Detects the dev server by connecting to the port it assigned, not by parsing command output,
  which differs per framework and changes between versions.
- Serves each project at `https://<projectId>.<PREVIEW_DOMAIN>`, websocket upgrades included so
  hot reload works.
- Stops and deletes idle projects after `IDLE_TIMEOUT_MS`.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `RUNNER_TOKEN` | none, **required** | Signing secret for connection tickets, at least 32 characters. Without it the service refuses to start: anyone reaching it could run code on the host. The **same value** must be set on the main app. |
| `PREVIEW_DOMAIN` | `preview.cresova.com` | Needs a wildcard DNS record and a wildcard certificate. |
| `PROJECT_ROOT` | `/data/projects` | Mount a volume so projects survive a restart. |
| `PORT` | `3001` | |
| `IDLE_TIMEOUT_MS` | 30 min | After this with no client attached, processes are killed and files removed. |

## Turning it on in the app

The app keeps using WebContainer until both variables are set on the **main** service:

| Variable | Notes |
|---|---|
| `RUNNER_TOKEN` | Exactly the same value as the runner's. |
| `RUNNER_URL` | Public address of this service, e.g. `https://runner.cresova.com`. |

With both set, the browser asks `/api/runner-ticket` for a ticket and connects. If the runner does
not answer within 15 seconds the app falls back to WebContainer on its own, so a runner that is
down degrades the product instead of breaking it. The header badge says which one is in use.

## Tickets

The browser can hold no secret: whatever it holds is readable by anyone who opens the app, and
`RUNNER_TOKEN` grants the right to run commands on the host. So the secret stays on the two
servers, and the app hands the browser a ticket instead — scoped to one project, valid for five
minutes, signed `HMAC-SHA256(secret, "<projectId>.<expiresAt>")`.

The app signs with WebCrypto under `workerd` and the runner verifies with `node:crypto`;
`tickets-crossruntime.spec.mjs` exists to keep those two byte identical.

## Known gaps

- Files created by a command are not reflected back into the file tree: the browser holds the
  source of truth and pushes every change, but nothing watches the other direction yet.
- Workbench text search is a WebContainer feature with no server side equivalent yet, so it
  returns nothing while the runner is in use.
- Preview runtime errors are not forwarded: the preview is a proxied page, not an iframe the app
  controls.

## Security

This service executes code written by a language model, including npm install scripts.

- Every path is resolved and confined to its project directory; an absolute path from the model is
  treated as project-relative, never host-absolute.
- Project processes get an allowlisted environment. They never see `OPEN_ROUTER_API_KEY`,
  `PEXELS_API_KEY` or `RUNNER_TOKEN`.
- The container runs as the `node` user, never root.
- The token is compared in constant time.

Do not expose this service directly to the internet: only `<id>.<PREVIEW_DOMAIN>` and the app
should be able to reach it.

## Deploying on EasyPanel

1. New service from the same repository, build path `/`, Dockerfile `runner/Dockerfile`.
2. Environment: `RUNNER_TOKEN` (a long random string), `PREVIEW_DOMAIN`.
3. Volume mounted at `/data`.
4. Domain: `*.preview.cresova.com` pointing at this service, port 3001.
5. DNS: a wildcard `*.preview` A record to the VPS, plus a wildcard certificate. A wildcard
   certificate requires DNS validation, so the DNS provider needs an API token; delegating the
   domain's DNS to Cloudflare is the simplest route if the registrar is not supported.
6. On the **main** app service, set `RUNNER_TOKEN` to the same value and `RUNNER_URL` to this
   service's address. Until then the app keeps running projects in the browser.

If a wildcard certificate is not an option, a fixed pool of ordinary hostnames works too
(`p1.preview…` through `p20.preview…`, each with a normal HTTP-01 certificate); that only changes
how preview hostnames are handed out, not the protocol.
