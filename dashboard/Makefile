default: run

include .env

.PHONY: setup
setup: 
	yarn install

.PHONY: run
run: 
	yarn run start

.PHONY: build
build: 
	yarn run build
	docker build --platform=linux/amd64 -t dhogborg/house-dashboard:latest .

.PHONY:
builder:
	docker buildx create --use

.PHONY: release
release: 
	yarn run build
	docker buildx build --push --platform=linux/amd64,linux/arm64 -t dhogborg/house-dashboard:latest .