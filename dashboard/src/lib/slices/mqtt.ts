import { PayloadAction, SerializedError, createSlice } from '@reduxjs/toolkit'

import { RootState } from '../store'
import { subscribe, unsubscribe } from './mqtt.thunks'

export * from './mqtt.thunks'

interface MQTTConn {
  status: 'connecting' | 'connected' | 'error'
  error?: SerializedError
}

export interface State {
  topics: { [key: string]: MQTTConn }
}

const initialState: State = {
  topics: {},
}

export const slice = createSlice({
  name: 'mqtt',
  initialState,

  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(subscribe.pending, (state, action) => {
        state.topics[action.meta.arg.topic] = {
          status: 'connecting',
        }
      })
      .addCase(subscribe.fulfilled, (state, action) => {
        state.topics[action.meta.arg.topic] = {
          status: 'connected',
        }
      })
      .addCase(subscribe.rejected, (state, action) => {
        state.topics[action.meta.arg.topic] = {
          status: 'error',
          error: action.error,
        }
      })
      .addCase(unsubscribe.fulfilled, (state, action) => {
        delete state.topics[action.meta.arg.topic]
      })
  },
})

export const selector = (state: RootState) => state.mqtt

export default slice.reducer
