# Contributing to StarTime

Thanks for your interest in contributing to StarTime.

StarTime is a Bun workspace containing a Next.js dashboard, a Fastify importer
service, editor extensions, and shared packages for database access,
environment validation, internal service authentication, and logging.

## Before You Start

- Search existing issues and pull requests before starting work.
- Open an issue or discussion before investing significant time in a new
  feature, architectural change, or extension.
- Keep pull requests focused on one problem. Separate refactors from
  functional changes where possible.
- Do not include secrets, production credentials, or user data in issues,
  commits, or pull requests.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) `1.3.14` or later
- [Docker Compose](https://docs.docker.com/compose/)
- A GitHub OAuth application configured for:
  `https://localhost:3000/api/auth/callback/github`
- An UploadThing application for import and export workflows

### Install dependencies

```sh
bun install
```

### Start local services

```sh
docker compose up -d
```

This starts PostgreSQL on `localhost:6543` and Redis on `localhost:6379`.

### Configure environment variables

Create a root `.env` file. Replace the placeholder credentials and secrets with
your own values.

```env
DATABASE_URL=postgresql://startime:startime@localhost:6543/startime
REDIS_URL=redis://localhost:6379

BETTER_AUTH_SECRET=<random-secret>
BETTER_AUTH_URL=https://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=https://localhost:3000
BETTER_AUTH_GITHUB_CLIENT_ID=<github-oauth-client-id>
BETTER_AUTH_GITHUB_CLIENT_SECRET=<github-oauth-client-secret>

UPLOADTHING_TOKEN=<uploadthing-token>
UPLOADTHING_APPID=<uploadthing-app-id>

IMPORTER_URL=http://localhost:3001
IMPORTER_PORT=3001
INTERNAL_SERVICE_SECRET=<random-secret-at-least-32-characters>
FILE_HASH_KEY=<random-secret-at-least-32-characters>

NEXT_PUBLIC_DISABLE_SUBSCRIPTIONS_IN_DEV=true
```

Never commit `.env` files or real credentials. Use randomly generated,
at-least-32-character values for `INTERNAL_SERVICE_SECRET` and
`FILE_HASH_KEY`.

### Initialize the database

```sh
bun run dk push
```

### Run the applications

Run these commands in separate terminals:

```sh
bun run dev
bun run dev:im
```

- Dashboard: `https://localhost:3000`
- Importer health check: `http://localhost:3001/health`

The dashboard uses HTTPS locally. Trust or accept the development certificate
in your browser if prompted.

## Repository Layout

| Path                    | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `apps/web`              | Next.js dashboard, Better Auth, tRPC API, UploadThing, and UI |
| `apps/importer`         | Fastify service for CSV imports and data exports              |
| `extentions`            | Editor extensions and their development documentation         |
| `packages/db`           | Drizzle client, schema, and configuration                     |
| `packages/env`          | Runtime environment-variable validation                       |
| `packages/service-auth` | HMAC signing for web-to-importer requests                     |
| `packages/print`        | Shared `Print` logging utility                                |

See the [README](./README.md) for a broader architecture overview.

## Extension Development

Contributions that add or modify an editor extension must follow the extension
contract in [`extentions/EXTENTIONS.md`](./extentions/EXTENTIONS.md).

That document is the source of truth for:

- event payloads and API endpoints;
- API-key authentication;
- required extension configuration;
- event triggering and rate-limiting expectations; and
- displaying a user's current project coding time.

Use the relevant editor's extension or plugin API. Keep extension-specific
options to a minimum, and use secure secret storage for the user token whenever
the editor supports it.

## Development Standards

- Use TypeScript and follow the existing patterns in the package or app you
  are changing.
- Format and lint code with Biome. Do not manually reformat unrelated files.
- Do not use `console` for logging. Use the shared `Print` utility from
  `@starTime/print`.
- Keep changes privacy conscious. Imported file paths must remain HMAC-hashed
  before storage.
- Add or update runtime environment validation when introducing a required
  environment variable.
- Keep internal requests between the web app and importer authenticated with
  `@starTime/service-auth`.

## Database Changes

The shared Drizzle schema lives in `packages/db`.

When changing it:

1. Update the schema.
2. Apply it locally:

   ```sh
   bun run dk push
   ```

3. Verify the affected flow against a local PostgreSQL instance.
4. Explain any migration, compatibility, or data-backfill considerations in
   your pull request.

## Validate Your Changes

Run the checks relevant to your change before opening a pull request:

```sh
bun run check
bun run build
```

For UI changes, also verify the affected workflow in the local dashboard. For
importer changes, verify its health endpoint and the relevant import or export
behavior. For extension changes, test the extension in its target editor and
verify its requests follow `extentions/EXTENTIONS.md`.

Useful commands:

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `bun run dev`         | Start the Next.js dashboard          |
| `bun run dev:im`      | Start the Fastify importer           |
| `bun run check`       | Run Biome checks across workspaces   |
| `bun run check:write` | Apply safe Biome fixes               |
| `bun run build`       | Build all workspaces                 |
| `bun run dk push`     | Synchronize the local Drizzle schema |

## Pull Requests

Before requesting review:

- Describe the problem and solution clearly.
- List the validation you performed.
- Include screenshots or a short recording for visible UI changes.
- Mention schema, environment-variable, deployment, or extension-protocol
  implications.
- Keep the pull request free of unrelated formatting changes and generated
  artifacts.

## License

By contributing, you agree that your contributions are licensed under the
project's [license](./LICENSE.md).
