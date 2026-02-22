# ── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy only lockfile + workspace configs for cached install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm fetch
RUN pnpm install --frozen-lockfile --offline

# ── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

# Build shared package first, then generate Prisma client, then build API
RUN pnpm --filter @cerebromat/shared build \
 && pnpm --filter @cerebromat/api db:generate \
 && pnpm --filter @cerebromat/api build

# ── Stage 3: Production runner ───────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S nestjs && adduser -S nestjs -u 1001 -G nestjs

# Copy built application
COPY --from=builder --chown=nestjs:nestjs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nestjs /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/apps/api/package.json ./package.json

# Copy Prisma schema + migrations (needed for prisma migrate deploy)
COPY --from=builder --chown=nestjs:nestjs /app/apps/api/prisma ./prisma

# Copy shared dist (referenced by API at runtime)
COPY --from=builder --chown=nestjs:nestjs /app/packages/shared/dist ./node_modules/@cerebromat/shared/dist
COPY --from=builder --chown=nestjs:nestjs /app/packages/shared/package.json ./node_modules/@cerebromat/shared/package.json

# Copy generated Prisma client
COPY --from=builder --chown=nestjs:nestjs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nestjs:nestjs /app/node_modules/@prisma ./node_modules/@prisma

USER nestjs

ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4001/api || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
