import { createAsyncThunk } from '@reduxjs/toolkit'

import { RootState } from '../store'

const PROXY_TOKEN = import.meta.env.VITE_PROXY_TOKEN

const sockets: { [key: string]: WebSocket } = {}

export const subscribe = createAsyncThunk<
  void,
  { topic: string; cb: (payload: any) => void }
>('mqtt/subscribe', async (args, { dispatch }) => {
  const { cb, topic } = args

  const prot = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${prot}//${location.host}/api/mqtt?token=${PROXY_TOKEN}`

  const ws = new WebSocket(url)
  sockets[topic] = ws

  ws.addEventListener('open', () => {
    console.log('mqtt client ws open')
    ws.send(topic)
  })
  ws.addEventListener('close', () => {
    console.log('mqtt client ws closed')
    dispatch(unsubscribe({ topic }))
  })
  ws.addEventListener('message', (msg) => {
    cb(JSON.parse(msg.data))
  })
})

export const unsubscribe = createAsyncThunk<
  void,
  { topic: string },
  { state: RootState }
>('mqtt/unsubscribe', async (args, { getState }) => {
  const ws = sockets[args.topic]
  if (ws && !ws.CLOSED) {
    ws.close()
    delete sockets[args.topic]
  }
})
