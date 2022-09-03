FROM golang as builder

COPY . /workdir

WORKDIR /workdir
RUN GOOS=linux GOARCH=amd64 go build -o proxy *.go 

FROM alpine as release

COPY --from=builder /workdir/proxy /proxy

ENTRYPOINT /proxy