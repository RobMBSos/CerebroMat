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

FROM caddy:2-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f
COPY --from=caddy-builder /out/caddy /usr/bin/caddy
