# ── Stage 1: Install & Build ─────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy lockfile + workspace manifests for cached install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm fetch
RUN pnpm install --frozen-lockfile --offline

# Copy source code
COPY packages/shared packages/shared
COPY apps/api apps/api

# Build shared → generate Prisma client → build API
RUN pnpm --filter @cerebromat/shared build \
 && pnpm --filter @cerebromat/api db:generate \
 && pnpm --filter @cerebromat/api build

# Use pnpm deploy to create a flat node_modules with all prod deps
RUN pnpm --filter @cerebromat/api deploy --prod /app/deploy

# Copy built output and Prisma files, then regenerate client in deploy dir
RUN cp -r /app/apps/api/dist /app/deploy/dist \
 && cp -r /app/apps/api/prisma /app/deploy/prisma \
 && cd /app/deploy && npx prisma generate

# ── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache dumb-init
WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S nestjs && adduser -S nestjs -u 1001 -G nestjs

# Copy the flat deployed app
COPY --from=builder --chown=nestjs:nestjs /app/deploy ./

USER nestjs

ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4001/swagger || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
