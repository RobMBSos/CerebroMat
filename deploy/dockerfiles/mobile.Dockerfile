# ── Stage 1: Install & Build ─────────────────────────────────────────────────
FROM node:22.22.3-alpine3.23 AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy the entire monorepo for full install (Expo needs all hoisted deps)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared packages/shared
COPY apps/mobile apps/mobile

# Build shared → export Expo as static web SPA
# EXPO_PUBLIC_ vars are inlined at build time
ENV EXPO_PUBLIC_API_URL=/api
RUN pnpm --filter @cerebromat/shared build \
 && cd apps/mobile && npx expo export --platform web

# ── Stage 2: Serve static files with Caddy ───────────────────────────────────
FROM caddy:2.11.3-alpine AS runner

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
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/ || exit 1
