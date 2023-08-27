import mqtt from 'precompiled-mqtt'

import { SerializedError, createAsyncThunk } from '@reduxjs/toolkit'

import { RootState } from '../store'
import { setStatus, tickHeartbeat } from './mqtt'

interface MQTTClient {
  connected: boolean
  subscribe: (topic: string, cb: (err: Error) => void) => void
  unsubscribe: (topic: string, args: any, cb: () => void) => void
  on: (event: string, cb: (topic: string, buffer: any) => void) => void
}

let client: MQTTClient

export const connect = createAsyncThunk<void, void, { state: RootState }>(
  'mqtt/connect',
  async (args, { getState, dispatch }) => {
    const connect = () => {
      const c: MQTTClient = mqtt.connect('mqtt://192.168.116.232:8083')
      c.on('connect', (conack) => {
        console.log('mqtt client connected: ')
        dispatch(setStatus('connected'))
      })
      c.on('disconnect', () => {
        console.log('mqtt client disconnected')
        dispatch(setStatus('idle'))
      })
      c.on('offline', () => {
        console.log('mqtt client offline')
        dispatch(setStatus('idle'))
      })
      c.on('close', () => {
        console.log('mqtt client closed')
        dispatch(setStatus('idle'))
      })
      c.on('error', (err) => {
        console.log('mqtt client error: ' + err)
        dispatch(setStatus('idle'))
      })
      return c
    }

    const status = getState().mqtt.status

    if (!client || (client && status === 'idle')) {
      dispatch(setStatus('connecting'))
      client = connect()
    }
  },
)

export const subscribe = createAsyncThunk<
  void,
  { topic: string; cb: (payload: any) => void }
>('mqtt/subscribe', async (args, { dispatch }) => {
  const { cb, topic } = args
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
      // dispatch(tickHeartbeat())
    })
  }

  if (client.connected) {
    sub()
  } else {
    client.on('connect', () => {
      sub()
    })
  }
})

export const unsubscribe = createAsyncThunk<void, { topic: string }>(
  'mqtt/unsubscribe',
  async (args) => {
    client.unsubscribe(args.topic, {}, () => {
      console.log('unsubscribed ', args.topic)
    })
  },
)

export const monitor = createAsyncThunk<void, void, { state: RootState }>(
  'mqtt/monitor',
  async (arg, { getState, dispatch }) => {
    setInterval(() => {
      const { status, heartbeat } = getState().mqtt
      const now = new Date().getTime()

      if (now - heartbeat > 5000) {
        if (status === 'connected') {
          dispatch(connect())
        }
      }
    }, 10 * 1000)
  },
)
