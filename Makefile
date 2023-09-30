default: build

include .env


.PHONY: build
build: 
	make -C dashboard build
	docker build --platform=linux/arm64 -t dhogborg/house-dashboard:latest .

.PHONY: run
run: 
	go run ./server/*.go

.PHONY: release
release: build
	docker push dhogborg/house-dashboard:latest
