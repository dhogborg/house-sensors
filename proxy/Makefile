default: build

.PHONY: build
build: 
	docker build --platform=linux/arm64 -t dhogborg/influx-cors-proxy:latest .

.PHONY: run
run: 
	TARGET=http://192.168.116.232:8086 go run *.go

.PHONY: release
release: 
	docker buildx build --push --platform=linux/amd64,linux/arm64 -t dhogborg/influx-cors-proxy:latest .