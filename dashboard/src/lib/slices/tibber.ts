import { errorString } from '@lib/helpers'
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { handledFetch } from '../http'
import { RootState } from '../store'

export interface State {
  current?: PriceNode

  today: PriceNode[]
  tomorrow: PriceNode[]

  status: 'idle' | 'loading' | 'failed'
  error?: string

  lastFetch: number
}

export interface PriceNode {
  total: number
  energy: number
  tax: number
  startsAt: string
}

const initialState: State = {
  current: undefined,
  today: [],
  tomorrow: [],

  status: 'idle',

  lastFetch: 0,
}

interface PriceResult {
  viewer: {
    homes: {
      currentSubscription: {
        priceInfo: {
          current: PriceNode
          today: PriceNode[]
          tomorrow: PriceNode[]
        }
      }
    }[]
  }
}

export const get = createAsyncThunk<
  {
    current: PriceNode
    today: PriceNode[]
    tomorrow: PriceNode[]
  },
  void,
  { state: RootState }
>(
  'tibber/get',
  async () => {
    let query = `
  {
    viewer {
      homes {
        currentSubscription{
          priceInfo{
            current{
              total
              energy
              tax
              startsAt
            }
            today {
              total
              energy
              tax
              startsAt
            }
            tomorrow {
              total
              energy
              tax
              startsAt
            }
          }
        }
      }
    }
  }`
    const result = await doRequest<PriceResult>(query)
    return result.viewer.homes[0].currentSubscription.priceInfo
  },
  {
    condition: (arg, { getState }): boolean => {
      const { lastFetch, status } = getState().tibber
      const dataAge = new Date().getTime() - lastFetch
      if (status === 'loading' || dataAge < 1000 * 60) {
        return false
      }
      return true
    },
  },
)

export const slice = createSlice({
  name: 'tibber',
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
        state = {
          ...state,
          ...action.payload,
        }
      })
      .addCase(get.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
  },
})

async function doRequest<T>(query: string) {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.REACT_APP_TIBBER_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: query,
    }),
  }
  let response = await handledFetch('https://api.tibber.com/v1-beta/gql', init)
  let result: GQLResponse<T> = await response.json()
  return result.data
}

export enum Interval {
  Hourly = 'HOURLY',
  Daily = 'DAILY',
  Monthly = 'MONTLY',
}

interface GQLResponse<T = any> {
  data: T
}

export const selector = (state: RootState) => state.tibber

export default slice.reducer
