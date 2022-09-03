FROM --platform=$BUILDPLATFORM golang as build

COPY . /workdir
WORKDIR /workdir

ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o bin/proxy *.go

FROM debian:stable-slim as release

COPY --from=build /workdir/bin/proxy /proxy

ENTRYPOINT /proxy