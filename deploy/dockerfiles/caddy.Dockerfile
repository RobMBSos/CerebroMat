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
    go get golang.org/x/net@v0.62.0 go.step.sm/crypto@v0.92.0 \
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

FROM caddy:2.11.9-alpine@sha256:0bbb055bda6793c999bde78b1b5ce3e89f829fb031af2cf50056ea1246559fee
RUN apk upgrade --no-cache
COPY --from=caddy-builder /out/caddy /usr/bin/caddy
