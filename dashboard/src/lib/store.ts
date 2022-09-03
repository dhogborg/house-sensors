import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit'

import { combineReducers } from 'redux'

import tibber from './slices/tibber'
import influxdb from './slices/influxdb'

export const store = configureStore({
  reducer: combineReducers({
    tibber,
    influxdb,
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
