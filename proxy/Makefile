default: build

.PHONY: build
build: 
	docker build --platform=linux/amd64 -t dhogborg/influx-cors-proxy:latest .

.PHONY: release
release: 
	docker push dhogborg/influx-cors-proxy:latest