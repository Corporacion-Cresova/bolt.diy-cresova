# Cresova Runner

Runs generated projects on the server instead of inside the user's browser tab.

Today WebContainer executes `npm install` and the dev server inside the tab, which means builds
are as fast as the user's laptop, they slow to a crawl when the tab is in the background, and the
project dies when the tab closes. This service moves that work to the VPS.

It is a separate service because the main app runs under Wrangler (`workerd`), which cannot spawn
processes or touch the filesystem.

## What it does

- Holds one directory and one port per project under `PROJECT_ROOT`.
- Accepts file operations and commands over a WebSocket at `/connect`.
- Detects the dev server by connecting to the port it assigned, not by parsing command output,
  which differs per framework and changes between versions.
- Serves each project at `https://<projectId>.<PREVIEW_DOMAIN>`, websocket upgrades included so
  hot reload works.
- Stops and deletes idle projects after `IDLE_TIMEOUT_MS`.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `RUNNER_TOKEN` | none, **required** | Shared secret for `/connect`. Without it the service refuses to start: anyone reaching it could run code on the host. |
| `PREVIEW_DOMAIN` | `preview.cresova.com` | Needs a wildcard DNS record and a wildcard certificate. |
| `PROJECT_ROOT` | `/data/projects` | Mount a volume so projects survive a restart. |
| `PORT` | `3001` | |
| `IDLE_TIMEOUT_MS` | 30 min | After this with no client attached, processes are killed and files removed. |

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
