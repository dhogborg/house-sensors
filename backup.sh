#!/bin/bash
while [ true ]; do
    DATE=`date +%F`
    echo "It's $DATE and I'm backing up"
    docker exec -ti house-sensors_influxdb_1 influxd backup -portable -host localhost:8088 /backup/$DATE
    zip -r $DATE ./backup/$DATE
    mv ./$DATE.zip ./iCloud/
    echo "Sleeping..."
    sleep 86400
done