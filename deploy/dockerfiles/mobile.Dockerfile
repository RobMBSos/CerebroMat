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
FROM golang:1.27.3-alpine@sha256:fa3d596898d9f126af7c01d14ee7597bab3f39cccf392ef36b69fe77cd681f18 AS caddy-builder
RUN apk add --no-cache git
WORKDIR /src
RUN git init . \
 && git remote add origin https://github.com/caddyserver/caddy.git \
 && git fetch --depth 1 origin tag v2.11.9 \
 && git checkout --detach 0d98caea58f794f88e709b1bef2880996a471bca
COPY deploy/patches/certificates-jose-v4.patch /tmp/certificates-jose-v4.patch
# Backport the upstream JOSE v4 API migration until certificates has a tagged release.
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go get golang.org/x/net@v0.62.0 go.step.sm/crypto@v0.92.0 github.com/klauspost/compress@v1.20.2 \
 && go mod download github.com/smallstep/certificates@v0.30.2 \
 && mkdir -p third_party \
 && cp -a /go/pkg/mod/github.com/smallstep/certificates@v0.30.2 third_party/certificates \
 && chmod -R u+w third_party/certificates \
 && git apply --directory=third_party/certificates /tmp/certificates-jose-v4.patch \
 && go mod edit -replace=github.com/smallstep/certificates=./third_party/certificates \
 && go mod tidy
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOMAXPROCS=2 go test -mod=mod -p 2 github.com/smallstep/certificates/authority/provisioner -run 'Test(AWS|Azure|OIDC)' \
 && CGO_ENABLED=0 GOMAXPROCS=2 go build -p 2 -trimpath -ldflags="-s -w" -o /out/caddy ./cmd/caddy


# ── Stage 2: Serve static files with Caddy ───────────────────────────────────
FROM caddy:2.11.9-alpine@sha256:0bbb055bda6793c999bde78b1b5ce3e89f829fb031af2cf50056ea1246559fee AS runner

RUN apk upgrade --no-cache
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
