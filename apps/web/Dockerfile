# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

FROM base AS dependencies
COPY package.json bun.lock bunfig.toml ./
COPY apps/importer/package.json ./apps/importer/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/env/package.json ./packages/env/package.json
COPY packages/print/package.json ./packages/print/package.json
COPY packages/service-auth/package.json ./packages/service-auth/package.json
COPY packages/zed-startime-lsp/package.json ./packages/zed-startime-lsp/package.json
COPY packages/zod/package.json ./packages/zod/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS builder
COPY . .
ENV SKIP_VALIDATION=true
RUN bun run --filter @startime/web build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 bunjs \
  && adduser --system --uid 1001 --ingroup bunjs bunjs

COPY --from=builder --chown=bunjs:bunjs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=bunjs:bunjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=bunjs:bunjs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=bunjs:bunjs /app/apps/web/package.json ./apps/web/package.json

USER bunjs
EXPOSE 3000
CMD ["bun", "apps/web/server.js"]
