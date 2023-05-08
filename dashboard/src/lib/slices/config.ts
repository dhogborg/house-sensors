import { createSlice } from '@reduxjs/toolkit'

import { RootState } from '../store'

export interface State {
  includeTaxes: boolean
}

const initialState: State = {
  includeTaxes: false,
}

export const slice = createSlice({
  name: 'config',
  initialState,

  reducers: {
    toggleIncludeTax: (state) => {
      state.includeTaxes = !state.includeTaxes
    },
  },
})

export const selector = (state: RootState) => state.config

export default slice.reducer
export const { toggleIncludeTax } = slice.actions
