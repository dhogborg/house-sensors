import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'

import { handledFetch } from '../http'
import { RootState } from '../store'

export interface State {
  today: PriceNode[]
  tomorrow: PriceNode[]

  status: 'idle' | 'loading' | 'failed'
  error?: string

  lastFetch: number
}

export interface PriceNode {
  price: number
  timeStart: string
}

const initialState: State = {
  tomorrow: [],
  today: [],

  status: 'idle',

  lastFetch: 0,
}

// export const getTomorrow = createAsyncThunk<
//   PriceNode[],
//   void,
//   { state: RootState }
// >(
//   'elpriset/getTomorrow',
//   async () => {
//     const today = new Date()
//     const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

//     const { year, month, day } = dateParts(tomorrow)
//     const result = await fetch(
//       `https://www.elprisetjustnu.se/api/v1/prices/${year}/${month}-${day}_SE3.json`,
//     )

//     const nodes = await result.json()

//     return nodes.map((node) => {
//       return {
//         timeStart: node.time_start,
//         price: node.SEK_per_kWh,
//       }
//     })
//   },
//   {
//     condition: (arg, { getState }): boolean => {
//       // const { lastFetch, status } = getState().elpriset
//       // const dataAge = new Date().getTime() - lastFetch
//       // if (status === 'loading' || dataAge < 1000 * 60) {
//       //   return false
//       // }
//       // return true
//       return tomorrow.length === 0
//     },
//   },
// )

export const get = createAsyncThunk<
  { today: PriceNode[]; tomorrow: PriceNode[] },
  void,
  { state: RootState }
>(
  'elpriset/get',
  async () => {
    const now = new Date()

    let today: PriceNode[] = []
    let tomorrow: PriceNode[] = []

    try {
      const result = await getDate(now)
      const prices = await result.json()
      const nodes: PriceNode[] = prices.map((node) => {
        return {
          timeStart: node.time_start,
          price: node.SEK_per_kWh,
        }
      })

      today = nodes
    } catch (err) {}

    try {
      const result = await getDate(
        new Date(now.getTime() + 24 * 60 * 60 * 1000),
      )
      const prices = await result.json()
      const nodes: PriceNode[] = prices.map((node) => {
        return {
          timeStart: node.time_start,
          price: node.SEK_per_kWh,
        }
      })

      tomorrow = nodes
    } catch (err) {}

    return { today, tomorrow }
  },
  {
    condition: (arg, { getState }): boolean => {
      const { lastFetch, status } = getState().elpriset
      const dataAge = new Date().getTime() - lastFetch
      if (status === 'loading' || dataAge < 1000 * 60) {
        return false
      }
      return true
    },
  },
)

async function getDate(d: Date) {
  const { year, month, day } = dateParts(d)
  return await fetch(
    `https://www.elprisetjustnu.se/api/v1/prices/${year}/${month}-${day}_SE3.json`,
  )
}

export const slice = createSlice({
  name: 'elpriset',
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
        state.today = action.payload.today
        state.tomorrow = action.payload.tomorrow
      })
      .addCase(get.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
    // .addCase(getTomorrow.pending, (state) => {
    //   state.status = 'loading'
    //   state.error = undefined
    // })
    // .addCase(getTomorrow.fulfilled, (state, action) => {
    //   state.status = 'idle'
    //   state.tomorrow = action.payload
    // })
    // .addCase(getTomorrow.rejected, (state, action) => {
    //   state.status = 'failed'
    //   state.error = action.error.message
    //   state.tomorrow = []
    // })
  },
})

export const selector = (state: RootState) => state.elpriset
export const today = (state: RootState) => state.elpriset.today
export const tomorrow = (state: RootState) => state.elpriset.tomorrow

export const now = (nodes: PriceNode[]): PriceNode => {
  const now = new Date()
  return nodes.find((node) => {
    const d = new Date(node.timeStart)
    return now.getHours() === d.getHours() && now.getDay() == d.getDay()
  })
}

export default slice.reducer

function dateParts(d: Date): { year: string; month: string; day: string } {
  const dateStr = d.toISOString().substring(0, 10)
  const month = dateStr.substring(5, 7)
  const day = dateStr.substring(8, 10)

  return { year: d.getFullYear().toFixed(0), day, month }
}
