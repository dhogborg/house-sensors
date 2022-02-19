import { errorString } from '@lib/helpers'
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { ResultProps } from 'antd'
import { handledFetch } from '../http'
import { RootState } from '../store'

export interface State {
  series: {
    [key: string]: Series
  }

  status: 'idle' | 'loading' | 'failed'
  error?: string

  lastFetch: number
}

export interface Series {
  id: string

  tags: { [key: string]: string }
  columns: string[]

  values: {
    value: number
    time: string
  }[]
}

const initialState: State = {
  series: {},

  status: 'idle',

  lastFetch: 0,
}

export const getQuery = createAsyncThunk<
  Series[],
  { id: string; db: string; query: string }
>('tibber/get', async (args) => {
  const r = await query(args)

  const series: Series[] = r.results
    .reduce<Response['results'][number]['series']>((prev, curr) => {
      return prev.concat(curr.series)
    }, [])
    .map((serie) => {
      console.log(serie)
    })
  return series
})

export const slice = createSlice({
  name: 'influx',
  initialState,

  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(getQuery.pending, (state) => {
        state.status = 'loading'
        state.error = undefined
      })
      .addCase(getQuery.fulfilled, (state, action) => {
        state.status = 'idle'
        action.payload.forEach((s) => {
          state.series[s.id] = s
        })
      })
      .addCase(getQuery.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
  },
})

const INFLUX_ENDPOINT = 'http://thirteen.lan:8086'

interface Response {
  results: {
    statement_id: number
    series: {
      name: string
      columns: string[]
      tags: { [key: string]: string }
      values: any[]
    }[]
  }[]
}

async function query(args: { query: string; db: string }): Promise<Response> {
  const request = [
    `db=${encodeURIComponent(args.db)}`,
    `q=${encodeURIComponent(args.query)}`,
  ].join('&')

  const response = await handledFetch(
    `${INFLUX_ENDPOINT}/query?pretty=true&${request}`,
  )
  return await response.json()
}

export const selector = (state: RootState) => state.energy

export default slice.reducer
