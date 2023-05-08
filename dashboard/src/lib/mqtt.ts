import mqtt from 'precompiled-mqtt'

import { SerializedError } from '@reduxjs/toolkit'

let client: any
let connecting: boolean

export function getClient() {
  const connect = () => {
    connecting = true
    const c = mqtt.connect('mqtt://192.168.116.232:8083')
    c.on('connect', () => {
      console.log('mqtt client connected')
      connecting = false
    })
    return c
  }

  if (!client || (client && !connecting && !client.connected)) {
    client = connect()
  }

  return client
}

export function subscribe(
  topic: string,
  cb: (payload: any) => void,
): () => void {
  const client = getClient()

  const sub = () => {
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
  }

  if (client.connected) {
    sub()
  } else {
    client.on('connect', () => {
      sub()
    })
  }

  return () => {
    client.unsubscribe(topic, {}, () => {
      console.log('unsubscribed ', topic)
    })
  }
}
