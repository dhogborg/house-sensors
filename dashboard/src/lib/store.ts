import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit'

import { combineReducers } from 'redux'

import config from './slices/config'
import tibber from './slices/tibber'
import yr from './slices/yr'
import influxdb from './slices/influxdb'

export const store = configureStore({
  reducer: combineReducers({
    config,
    tibber,
    yr,
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
