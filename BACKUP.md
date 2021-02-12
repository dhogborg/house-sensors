# Backup

docker exec -ti house-sensors_influxdb_1 bash
influxd backup -portable -host localhost:8088 /backup/2021-01-20T21:34
