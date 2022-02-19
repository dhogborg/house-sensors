import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit'

import { combineReducers } from 'redux'

import tibber from './slices/tibber'
import energy from './slices/energy'

export const store = configureStore({
  reducer: combineReducers({
    tibber,
    energy,
  }),
  preloadedState: {},
})

export type AppDispatch = typeof store.dispatch
export type RootState = ReturnType<typeof store.getState>
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>
