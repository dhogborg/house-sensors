import { PayloadAction, SerializedError, createSlice } from '@reduxjs/toolkit'

import { RootState } from '../store'

export * from './mqtt.thunks'

export interface State {
  status: 'idle' | 'connecting' | 'connected'
  error?: SerializedError
}

const initialState: State = {
  status: 'idle',
}

export const slice = createSlice({
  name: 'mqtt',
  initialState,

  reducers: {
    setStatus: (state, action: PayloadAction<State['status']>) => {
      state.status = action.payload
    },
  },
})

export const selector = (state: RootState) => state.mqtt

export default slice.reducer
export const { setStatus } = slice.actions
