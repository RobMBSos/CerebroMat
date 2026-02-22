# ── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy only lockfile + workspace configs for cached install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm fetch
RUN pnpm install --frozen-lockfile --offline

# ── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/mobile/node_modules ./apps/mobile/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/mobile apps/mobile

# Build shared package first, then export Expo as static web
RUN pnpm --filter @cerebromat/shared build \
 && cd apps/mobile && npx expo export --platform web

# ── Stage 3: Serve static files with Caddy ───────────────────────────────────
FROM caddy:2-alpine AS runner

# Copy exported static site
COPY --from=builder /app/apps/mobile/dist /srv

# Caddy config for SPA routing (all routes → index.html)
RUN cat > /etc/caddy/Caddyfile <<'CADDYFILE'
:8080 {
	root * /srv
	encode gzip
	try_files {path} /index.html
	file_server
}
CADDYFILE

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1
