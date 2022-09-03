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

export const getFluxQuery = createAsyncThunk<
  Series[],
  { id: string; query: string; category?: string },
  { state: RootState }
>('influxdb/flux', async (args) => {
  const r = await fluxQuery({ query: args.query })
  // Split into rows and filter comments
  const rows = r.split('\n').filter((row) => {
    if (row.indexOf('#') === 0) return false
    if (!row || row.trim() === '') return false
    return true
  })
  // extract header row, the first non-comment.
  const header = rows.splice(0, 1)[0]

  // closure that translates columns to cell indexes
  const rowParser = (header: string) => {
    const headCells = header.split(',').map((cell) => cell.trim())
    return (row: string) => {
      const rowObj: { [key: string]: number | string } = {}
      row.split(',').forEach((cell, i) => {
        rowObj[headCells[i]] = cell.trim()
      })

      return rowObj
    }
  }

  const toObj = rowParser(header)
  const values: Series['values'] = rows
    .map((row) => toObj(row))
    .map((row) => {
      const t = row['_time'] as string

      return {
        time: t,
        value: Number(row['_value']),
        category: args.category || (row['_measurement'] as string),
      }
    })

  // clamp the last row to the current hour
  if (values.length > 1) {
    const d = new Date(values[values.length - 2].time)
    d.setHours(d.getHours() + 1)
    values[values.length - 1].time = d.toJSON()
  }

  const series: Series = {
    id: args.id,
    name: args.id,

    tags: {},
    columns: [],

    values: values.slice(0, values.length),
  }

  return [series]
})

export const getQuery = createAsyncThunk<
  Series[],
  { id: string; db: string; query: string; categories?: string[] },
  { state: RootState }
>(
  'influxdb/get',
  async (args) => {
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
  },
  {
    condition: (arg, { getState }): boolean => {
      const state = getState().influxdb
      const query = state.query[arg.id]
      if (query?.fetching) {
        return false
      }

      return true
    },
  },
)

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

      .addCase(getFluxQuery.pending, (state, action) => {
        state.fetching = true

        state.query[action.meta.arg.id] = {
          ...state.query[action.meta.arg.id],
          fetching: true,
          error: undefined,
        }
      })
      .addCase(getFluxQuery.fulfilled, (state, action) => {
        state.fetching = false

        state.query[action.meta.arg.id] = {
          fetching: false,
          series: action.payload,
        }
      })
      .addCase(getFluxQuery.rejected, (state, action) => {
        state.fetching = false

        state.query[action.meta.arg.id] = {
          fetching: false,
          error: action.error.message,
          series: [],
        }
      })
  },
})

const INFLUX_ENDPOINT = 'http://thirteen.lan'

type FluxResponse = string

async function fluxQuery(args: { query: string }): Promise<FluxResponse> {
  const response = await handledFetch(`${INFLUX_ENDPOINT}:9086/api/v2/query`, {
    method: 'POST',
    headers: {
      Accept: 'application/csv',
      'Content-type': 'application/vnd.flux',
    },
    body: args.query,
  })

  return response.text()
}

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
    `${INFLUX_ENDPOINT}:8086/query?pretty=true&${request}`,
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
