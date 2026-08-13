# Startime

Next.js replacement for `codetime-web_old`. The repository is intentionally a
workspace: editor integrations depend on `@startime/sdk`, while the web app
depends on the same API contract, authentication, and database packages.

## Layout

- `apps/web` — Next.js App Router website and `/v3` compatibility handlers.
- `packages/api-contract` — versioned request/response contracts shared by web,
  APIs, and editor packages.
- `packages/auth` — Better Auth instance plus API-key authorization helpers.
- `packages/db` — Drizzle PostgreSQL schema, migrations, and database client.
- `packages/sdk` — framework-neutral client package for future editors.

## Migration rule

`/v3/*` is the public compatibility boundary. It must retain legacy endpoint
paths, payloads, status codes, and error bodies while its implementation moves
to route handlers. Do not expose database rows directly from those handlers.

## Local setup

1. Copy `.env.example` to `.env` and supply a PostgreSQL connection and secret.
2. Run `bun install`.
3. Generate Better Auth's Drizzle schema additions with `bun run auth:generate`,
   review them, then generate/review a Drizzle migration.
4. Run `bun run dev`.

The Drizzle 1.0 beta is deliberate. Keep it pinned, review its release notes
before upgrades, and never use schema push against a database containing the
legacy production tables.
