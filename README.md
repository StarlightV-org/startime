# Startime

Startime is a developer-activity dashboard. It imports coding activity data, stores it in PostgreSQL, and presents time, streak, and usage breakdowns in a web dashboard.

[Icon Pack](https://github.com/material-extensions/vscode-material-icon-theme)

## Features

- GitHub sign-in with Better Auth and passkey support.
- Personal activity dashboard with total time, today's time, current streak, and longest streak.
- Activity breakdowns by editor, workspace, language, and platform, with date-range filtering.
- Organization creation, membership roles, and invitations.
- CodeTime CSV imports up to 64 MB, with background processing and progress reporting.
- Privacy-preserving file identifiers: imported file paths are HMAC-hashed before they are stored.
- User data exports as downloadable ZIP archives.

## Dev Setup

### Prerequisites

- [Bun](https://bun.sh/) `1.3.14` or later.
- [Docker Compose](https://docs.docker.com/compose/) for local PostgreSQL and Redis.
- A GitHub OAuth application configured with this callback URL:
  `https://localhost:3000/api/auth/callback/github`.
- An [UploadThing](https://uploadthing.com/) application and token for file imports and exports.

The web application runs over HTTPS in development. Visit `https://localhost:3000` and accept or trust the local development certificate if your browser prompts you.

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

Create a root `.env` file. Replace the placeholder credentials and secrets with your own values; secrets used for `INTERNAL_SERVICE_SECRET` and `FILE_HASH_KEY` should be random and at least 32 characters long.

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

### Initialize the database

Apply the current Drizzle schema to the local database:

```sh
bun run dk push
```

### Run the applications

In separate terminals, start the web application and the importer:

```sh
bun run dev
bun run dev:im
```

- Web application: `https://localhost:3000`
- Importer health check: `http://localhost:3001/health`

### Useful commands

| Command               | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `bun run dev`         | Start the Next.js web application.                    |
| `bun run dev:im`      | Start the Fastify importer with file watching.        |
| `bun run build`       | Build all Turborepo workspaces.                       |
| `bun run check`       | Run Biome checks across workspaces.                   |
| `bun run check:write` | Apply safe Biome fixes across workspaces.             |
| `bun run dk push`     | Synchronize the local PostgreSQL schema with Drizzle. |

Stop local services while preserving their data with `docker compose down`. Add `-v` to also remove the PostgreSQL and Redis volumes.

## Architecture

Startime is a Bun workspace managed by Turborepo. The applications share typed database access, validated environment configuration, internal-request signing, and logging utilities.

```mermaid
flowchart TD
    User[User browser] --> Web[apps/web\nNext.js dashboard]
    Web --> Auth[Better Auth\nGitHub and passkeys]
    Web --> API[tRPC API]
    API --> DB[(PostgreSQL)]
    Web --> Upload[UploadThing]
    Web -->|HMAC-signed request| Importer[apps/importer\nFastify service]
    Importer --> Upload
    Importer --> DB
    Web -. required configuration .-> Redis[(Redis)]
```

### Workspace layout

| Path                    | Responsibility                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `apps/web`              | Next.js 16 dashboard, Better Auth integration, tRPC API, UploadThing endpoints, and UI. |
| `apps/importer`         | Fastify worker for asynchronous CSV imports and user-data exports.                      |
| `packages/db`           | Drizzle ORM client, shared PostgreSQL schema, and Drizzle configuration.                |
| `packages/env`          | Runtime validation of server and client environment variables.                          |
| `packages/service-auth` | HMAC-SHA256 signing and verification for web-to-importer requests.                      |
| `packages/print`        | Shared `Print` logging utility.                                                         |

### Activity import flow

1. An authenticated user uploads a CodeTime CSV through the web application.
2. UploadThing stores the private file; the web app creates an `eventImports` record in PostgreSQL.
3. The web app submits a signed `POST /v1/imports` request to the importer.
4. The importer verifies the signature, downloads the file using a temporary UploadThing URL, validates and parses the CSV, then inserts activity events in batches of 500.
5. Import progress is written to PostgreSQL and polled by the web UI. When processing ends, the importer deletes the uploaded source file.

### Data model

The shared schema stores users, auth accounts and sessions, passkeys, organizations and memberships, activity events, uploaded files, import jobs, and export jobs. All Startime tables use the `startime_` prefix to avoid collisions with existing database tables.

## Planned Extensions

|     Name      | Description                    | Status |
| :-----------: | ------------------------------ | :----: |
|    vscode     | The most popular editor        |   ❌   |
| visual-studio |                                |   ❌   |
|    cursor     |                                |   ❌   |
|      vim      |                                |   ❌   |
|    neovim     |                                |   ❌   |
|   obsidian    | For tracking your time writing |   ❌   |
| intellij-idea |                                |   ❌   |
