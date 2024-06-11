import { Action, ThunkAction, configureStore } from '@reduxjs/toolkit'
import * as reactRedux from 'react-redux'
import { combineReducers } from 'redux'

import config from './slices/config'
import elpriset from './slices/elpriset'
import influxdb from './slices/influxdb'
import mqtt from './slices/mqtt'
import tibber from './slices/tibber'
import yr from './slices/yr'

export const store = configureStore({
  reducer: combineReducers({
    config,
    tibber,
    elpriset,
    mqtt,
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

// Use throughout your app instead of `useDispatch` and `useSelector` from 'react-redux'
export const useDispatch = () => reactRedux.useDispatch<AppDispatch>()
export const useSelector: reactRedux.TypedUseSelectorHook<RootState> =
  reactRedux.useSelector
