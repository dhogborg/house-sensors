import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { handledFetch } from '../http'
import { RootState } from '../store'

export interface State {
  timeseries: DataNode[]

  current?: DataNode
  highTemp?: DataNode
  lowTemp?: DataNode

  status: 'idle' | 'loading' | 'failed'
  error?: string

  lastFetch: number
}

export interface DataNode {
  time: string

  symbol_1h: string
  symbol_6h: string
  symbol_12h: string

  rain: number

  air_pressure_at_sea_level: number
  air_temperature: number
  cloud_area_fraction: number
  relative_humidity: number
  wind_from_direction: number
  wind_speed: number
}

const initialState: State = {
  timeseries: [],

  status: 'idle',

  lastFetch: 0,
}

export const get = createAsyncThunk<DataNode[], void, { state: RootState }>(
  'yr/get',
  async () => {
    const request = [`lat=57.720832`, `lon=11.9341056`].join('&')
    const r = await handledFetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact.json?${request}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    )
    const response = await r.json()
    if (!response?.properties?.timeseries?.length) {
      throw new Error('invalid response')
    }

    const nodes: DataNode[] = response.properties.timeseries.map(
      (node: any) => {
        return {
          time: node.time,

          symbol_1h: node.data?.next_1_hours?.summary?.symbol_code,
          symbol_6h: node.data?.next_6_hours?.summary?.symbol_code,
          symbol_12h: node.data?.next_12_hours?.summary?.symbol_code,

          rain: node.data?.next_6_hours?.details.precipitation_amount || 0,

          ...node.data.instant.details,
        }
      },
    )
    return nodes.slice(0, 12)
  },
  {
    condition: (arg, { getState }): boolean => {
      const { lastFetch, status } = getState().yr
      const dataAge = new Date().getTime() - lastFetch
      if (status === 'loading' || dataAge < 1000 * 60) {
        return false
      }
      return true
    },
  },
)

export const slice = createSlice({
  name: 'yr',
  initialState,

  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(get.pending, (state) => {
        state.status = 'loading'
        state.error = undefined
      })
      .addCase(get.fulfilled, (state, action) => {
        state.status = 'idle'
        state.timeseries = action.payload

        state.current = action.payload[0]

        let high: DataNode | undefined
        let low: DataNode | undefined
        action.payload.forEach((node) => {
          if (!high || node.air_temperature > high.air_temperature) {
            high = node
          }
          if (!low || node.air_temperature < low.air_temperature) {
            low = node
          }
        })
        state.highTemp = high
        state.lowTemp = low
      })
      .addCase(get.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
  },
})

export const selector = (state: RootState) => state.yr

export default slice.reducer
