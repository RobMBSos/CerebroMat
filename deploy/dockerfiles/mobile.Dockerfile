# ── Stage 1: Install & Build ─────────────────────────────────────────────────
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy the entire monorepo for full install (Expo needs all hoisted deps)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY patches ./patches
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

# Build upstream Caddy with the patched Go standard library and HTTP/2 dependency.
FROM golang:1.27.3-alpine@sha256:f2c872bcee949b7be9c490efd02b48a8a2fbf947cdf533f1c58525ec9d8170fd AS caddy-builder
RUN apk add --no-cache git
WORKDIR /src
RUN git init . \
 && git remote add origin https://github.com/caddyserver/caddy.git \
 && git fetch --depth 1 origin tag v2.11.7 \
 && git checkout --detach 72dd0fb067f6d7826c7f79907670ba4a713bfe37 \
 && go get golang.org/x/net@v0.60.0 \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/caddy ./cmd/caddy

# ── Stage 2: Serve static files with Caddy ───────────────────────────────────
FROM caddy:2-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f AS runner

COPY --from=caddy-builder /out/caddy /usr/bin/caddy

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
