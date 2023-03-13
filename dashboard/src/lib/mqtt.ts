import { SerializedError } from '@reduxjs/toolkit'
import mqtt from 'precompiled-mqtt'

let client: any

export function getClient() {
  if (!client) {
    client = mqtt.connect('mqtt://192.168.116.232:8083')
    client.on('connect', () => {
      console.log('mqtt client connected')
    })
  }

  return client
}

export function subscribe(topic: string, cb: (payload: any) => void) {
  const client = getClient()

  client.on('connect', () => {
    client.subscribe(topic, function (err: SerializedError) {
      if (err) {
        console.error(err)
      }
      console.log('subscribed topic: ', topic)
    })

    client.on('message', (messageTopic: string, message: Buffer) => {
      if (messageTopic === topic) {
        const payload = JSON.parse(message.toString())
        cb(payload)
      }
    })
  })
}
