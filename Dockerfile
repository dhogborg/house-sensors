FROM --platform=$BUILDPLATFORM golang as build

COPY . /workdir
WORKDIR /workdir

ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o server/bin/server ./server/*.go

FROM debian:stable-slim as release

COPY --from=build   /workdir/server/bin/server  /server
COPY                ./dashboard/build/          /www/html

ENV STATIC_ASSETS /www/html

ENTRYPOINT /server