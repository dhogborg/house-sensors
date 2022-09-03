default: build

.PHONY: build
build: 
	GOARCH=amd64 GOOS=linux go build -o bin/proxy *.go
	docker build --platform=linux/amd64 -t dhogborg/influx-cors-proxy:latest .

.PHONY: release
release: 
	docker push dhogborg/influx-cors-proxy:latest