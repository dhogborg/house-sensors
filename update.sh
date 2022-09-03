#/bin/bash
docker pull dhogborg/influx-cors-proxy:latest
docker pull dhogborg/house-dashboard:latest
docker rm -f house-sensors_dashboard_1 house-sensors_proxy_1 && docker-compose up -d dashboard proxy
