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

.PHONY: push
push: 
	docker push dhogborg/house-dashboard:latest