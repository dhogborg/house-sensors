#!/bin/bash

source backup.env

while [ true ]; do
    DATE=`date +%F`
    echo "It's $DATE and I'm backing up"
    docker exec -ti house-sensors_influxdb_1 influx backup -t $INFLUX_TOKEN  /backup/$DATE
    zip -r $DATE ./backup/$DATE
    s3cmd put ./$DATE.zip s3://$BUCKET/

    echo "Sleeping..."
    sleep 86400
    rm $DATE.zip
    rm -r ./backup/$DATE
done
