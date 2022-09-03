default: build

.PHONY: build
build: 
	docker build --platform=linux/arm64 -t dhogborg/influx-cors-proxy:latest .

.PHONY: release
release: 
	docker buildx build --push --platform=linux/amd64,linux/arm64 -t dhogborg/influx-cors-proxy:latest .