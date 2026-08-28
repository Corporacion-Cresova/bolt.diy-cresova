# Backend strategy for Cresova Builder

> **Status:** Decision documented. Implementation deferred until a paying client requests a backend feature.

## The problem

Bolt Cresova today generates **frontends only**. Every site runs inside a WebContainer in the browser; there is no server, no database, no auth, nothing that persists between visits beyond the local project files. That is the right choice for landing pages, portfolios and marketing sites — they do not need any of that — and it lets Cresova Builder stay free of infrastructure cost on the build side.

It stops being the right choice the first time a paying client asks for any of these:

- A contact form that **actually delivers emails** (instead of opening the user's mail client).
- **Login / signup** so returning visitors can see their history or saved quotes.
- A **dashboard** with the visitor's own data.
- A **CMS** so the client can edit copy and images without coming back to Cresova.
- **E-commerce**: catalogue, cart, checkout, payment, order tracking.
- Anything that needs to **persist data** between two visits from the same person.

When that happens, Cresova needs a backend. This document decides which one, before the need becomes urgent.

## The three options

### Option A — BaaS (Backend-as-a-Service)

Use a hosted service for auth, database, storage and server-side functions. The two realistic choices in 2026 are:

| Service | What it covers | Cresova-specific fit |
|---------|----------------|----------------------|
| **Supabase** | Postgres + Auth + Storage + Edge Functions + Realtime | **Already supported by Bolt Cresova** (`boltAction type="supabase"` exists, the parser understands it, the workbench renders it). Highest fit by far. |
| **Firebase** | Firestore (NoSQL) + Auth + Functions + Hosting | Lighter integration in Bolt Cresova. Stronger on realtime, weaker on relational queries. |

**Pros.** Zero server to maintain. Free tiers cover the first ten paying Cresova clients. Scales without intervention. Auth, dashboard, realtime all included.

**Cons.** Vendor lock-in (partial). Costs grow with usage. Edge cases outside the service's API surface require workarounds.

**Cresova-specific advantage.** Bolt Cresova's `supabase` action handler is already written and tested. Activating it costs one environment variable (`SUPABASE_URL` + `SUPABASE_ANON_KEY`) and zero new code.

### Option B — Custom backend on the existing VPS

Build a backend in Node/Express (or Hono, or Fastify) backed by Postgres on the Contabo VPS that already hosts Bolt Cresova, EasyPanel, n8n, Chatwoot, Evolution API and OpenClaw.

**Pros.** Total control. No vendor lock-in. Fixed cost. Code lives next to Bolt Cresova.

**Cons.** The Contabo VPS is already serving six services. Adding a seventh means more surface area for failures, more monitoring, more 3am pages. Diego's skill set is "basic to intermediate" (per the running Cresova profile), not "designs and operates backend infrastructure" — so a custom backend pushes Diego into operations work he has not signed up for.

**Cresova-specific risk.** Bolt Cresova is meant to be deployable in many customer environments, not just one Contabo VPS. A custom backend that lives only in the Cresova VPS does not help future clients self-host.

### Option C — Serverless functions

Cloudflare Workers, Vercel Functions, AWS Lambda, Deno Deploy.

**Pros.** Zero server to maintain (managed by the platform). Auto-scales. True pay-per-execution.

**Cons.** Cold starts (50-300ms on first invocation). Execution time limits (typically 30s). Vendor lock-in is the strongest of the three options. Debugging across the edge is harder than on a VPS.

**Cresova-specific fit.** Strong, *if* the backend is hosted on Cloudflare Workers and Bolt Cresova is already deployed on Cloudflare Pages (it is). The runtime model aligns. The debugging tools are good.

## Decision

**Start with Option A — Supabase.** Move to Option C (Cloudflare Workers) only if Supabase's API surface becomes a binding constraint. Never move to Option B unless the volume justifies a dedicated engineer.

### Why Supabase first

1. **It is already integrated.** Bolt Cresova ships a `supabase` action handler. Activating it is a config change, not a code change.
2. **Postgres is enough.** Every Cresova feature above (auth, dashboards, CMS, e-commerce) fits the relational model cleanly.
3. **Realtime is included.** Forms that show "your message was sent", dashboards that update without reload, e-commerce inventory that does not lag — all free with Supabase Realtime.
4. **Edge Functions cover the gaps.** When Supabase's REST API is not enough (custom logic, third-party integrations), Edge Functions are Deno-based, deploy with `supabase functions deploy`, and cost almost nothing.
5. **Cost is predictable.** Free tier: 500 MB database, 1 GB storage, 2 GB egress. Pro plan: $25/month, generous limits. A Cresova client with 10k monthly visitors fits in free.

### Why not Option B (custom on the VPS)

The Contabo VPS already runs six services. Diego's operational hours are best spent on the front end of Cresova (where the differentiation lives) and on client acquisition, not on hardening a seventh service. A custom backend would also fork Bolt Cresova into a Cresova-Cloud and a Cresova-Self-Hosted variant, doubling the maintenance surface for zero upside at current scale.

### Why not Option C (serverless) first

Cloudflare Workers are excellent, but the debugging loop is unfamiliar to most of the team and the deployment model requires Deno, which adds another toolchain. Supabase's Postgres + REST + Edge Functions covers the same surface with a more conventional stack, and we already have the integration in Bolt Cresova. If the workload later becomes "thousands of requests per second" and Postgres cannot keep up, that is the day to move to Cloudflare Workers + D1 + Durable Objects.

## What this means for Cresova Builder's roadmap

### Today (no backend)

- Frontend-only sites. Forms use mailto: links or third-party form services (Formspree, Tally, Netlify Forms).
- This is fine for Web Esencial and Web Pro tiers.

### When the first client asks for a backend

1. **Open a Supabase project for that client** (free tier).
2. **Add env vars** to the EasyPanel container:
   - `SUPABASE_URL=https://xxxx.supabase.co`
   - `SUPABASE_ANON_KEY=...`
   - `SUPABASE_SERVICE_KEY=...` (only if server-side operations are needed)
3. **Use the existing `supabase` action** in the generated site (`<boltAction type="supabase" operation="query" ...>`).
4. **Document the schema** for that client in their Supabase project (tables, RLS policies, indexes).

### What to charge

| Tier | Includes |
|------|----------|
| **Web Esencial** (sin backend) | Frontend only. Formularios con servicios externos. |
| **Web Pro** (con backend) | + Setup de Supabase (1 schema inicial), autenticación, dashboard básico. **+$200-500 setup + $30-50/mes mantenimiento.** |
| **Web Custom** (backend propio) | Solo si el cliente tiene volumen que justifica. Cotizar caso a caso. |

The Supabase Pro plan ($25/mes) plus a small maintenance retainer covers the operational cost for the Web Pro tier with margin.

### When to reconsider the decision

Reopen this decision if **any** of the following becomes true:

1. **More than 20 Cresova clients need a backend.** At that point the operational cost of managing 20 separate Supabase projects starts to justify a shared multi-tenant backend. Move to Option C with a shared Cloudflare Workers + D1 setup.

2. **A client needs features Supabase cannot do.** Realtime collaboration, complex workflow engines, ML inference at the edge. At that point the question is whether to build a custom backend for that one client (revenue-positive) or to migrate the platform (revenue-neutral, expensive).

3. **Diego grows a backend engineering team.** Unlikely in 2026 but possible by 2028. At that point Option B becomes attractive because the operational cost becomes a feature, not a tax.

## For Diego: what to do tomorrow

Nothing. Bolt Cresova's frontend story is not finished. Finish the M1-M7 plan from the bolt-plan document, ship the bug fix for the runtime dedupe, and only come back to this document when a paying client says "I need a login" or "I need the form to save to a database."

This is a *documented decision*, not a *work item*. The work items it implies are: open Supabase project when first needed; activate Bolt Cresova's existing `supabase` action; document the per-client schema. None of these need to happen today.

## Open questions

1. **Auth provider.** Supabase Auth supports email, magic links, OAuth (Google, GitHub, etc), and SAML. Which Cresova clients actually need SSO? Probably none for Web Esencial, magic links for Web Pro. Decide per client.
2. **Realtime needs.** Forms that update a live dashboard? E-commerce inventory? Probably overkill for the first 5 Cresova clients. Revisit when a real feature request comes in.
3. **Backup policy.** Supabase Pro includes daily backups with 7-day retention. Is that enough? For most Cresova clients, yes. For e-commerce, no — they need their own backup plan.

These are the questions that become urgent only when a specific client feature request lands. Until then, they stay open.
