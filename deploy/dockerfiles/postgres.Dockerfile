# Keep PostgreSQL 16 and rebuild only its privilege-dropping helper.
FROM golang:1.27.3-alpine@sha256:f2c872bcee949b7be9c490efd02b48a8a2fbf947cdf533f1c58525ec9d8170fd AS gosu-builder
RUN apk add --no-cache git
WORKDIR /src
RUN git init . \
 && git remote add origin https://github.com/tianon/gosu.git \
 && git fetch --depth 1 origin 6456aaa0f3c854d199d0f037f068eb97515b7513 \
 && git checkout --detach FETCH_HEAD \
 && go get github.com/moby/sys/user@v0.4.1 golang.org/x/sys@v0.44.0 \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/gosu .

FROM postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea
COPY --from=gosu-builder /out/gosu /usr/local/bin/gosu
RUN apk upgrade --no-cache zlib && gosu nobody true
