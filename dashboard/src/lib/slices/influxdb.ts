import { errorString } from '@lib/helpers'
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

import { handledFetch } from '../http'
import { RootState } from '../store'

export interface State {
  query: {
    // the id provided as argument
    [key: string]: {
      fetching: boolean
      error?: string
      series: Series[]
    }
  }

  fetching: boolean
}

export interface Series {
  id: string
  name: string

  tags: { [key: string]: string }
  columns: string[]

  values: {
    time: string
    category: string
    value: number
  }[]
}

const initialState: State = {
  query: {},
  fetching: false,
}

export const getQuery = createAsyncThunk<
  Series[],
  { id: string; db: string; query: string; categories?: string[] }
>('influxdb/get', async (args) => {
  const r = await query(args)

  const series: Series[] = r.results
    .reduce<Response['results'][number]['series']>((prev, curr) => {
      return prev.concat(curr.series)
    }, [])
    .map((series, i) => {
      let category = args.id
      if (series.name) {
        category = series.name
      }
      if (series.tags?.name) {
        category = series.tags.name
      }
      if (args.categories && args.categories[i]) {
        category = args.categories[i]
      }

      return {
        id: args.id,
        name: series.name,

        tags: series.tags,
        columns: series.columns,

        values: series.values.map((d) => {
          return {
            time: d[0] as string,
            category,
            value: d[1] as number,
          }
        }),
      }
    })
  return series
})

export const slice = createSlice({
  name: 'influxdb',
  initialState,

  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(getQuery.pending, (state, action) => {
        state.fetching = true

        state.query[action.meta.arg.id] = {
          ...state.query[action.meta.arg.id],
          fetching: true,
          error: undefined,
        }
      })
      .addCase(getQuery.fulfilled, (state, action) => {
        state.fetching = false

        state.query[action.meta.arg.id] = {
          fetching: false,
          series: action.payload,
        }
      })
      .addCase(getQuery.rejected, (state, action) => {
        state.fetching = false

        state.query[action.meta.arg.id] = {
          fetching: false,
          error: action.error.message,
          series: [],
        }
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

export const selector = (state: RootState) => state.influxdb

export const selectQuery = (id: string) => {
  return (state: RootState) => {
    if (state.influxdb.query[id]) {
      return state.influxdb.query[id]
    }
    return {
      fetching: false,
      series: [],
      error: undefined,
    }
  }
}
export default slice.reducer
