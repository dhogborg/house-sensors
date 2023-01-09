import { RootState } from '../../lib/store'

interface Node {
  time: string
  value: number
}

export function TotalConsumedWh(loadMinutes: Node[]): number {
  const consumed = loadMinutes.reduce((prev, curr) => {
    return prev + curr.value
  }, 0)

  return consumed / 60
}

export function PeakPowerWatts(monthGridHours: Node[]): number {
  const highHour = monthGridHours.reduce((prev, curr) => {
    if (curr.value > prev) return curr.value
    return prev
  }, 0)

  return highHour
}

export function PvProducedWh(pvMinutes: Node[]): number {
  const pvProduced = pvMinutes.reduce((prev, curr) => {
    return prev + curr.value
  }, 0)

  return pvProduced / 60
}

export function PvPeakWatts(pvPeakValues: Node[]): number {
  let pvPeak = 0
  if (pvPeakValues) {
    pvPeak = pvPeakValues
      .filter((val) => {
        return val.value != null
      })
      .map((val) => {
        return val.value
      })[0]
  }

  return pvPeak
}

export function NetConsumedWh(gridHours: Node[]): number {
  const gridConsumed = gridHours.reduce((prev, curr, i) => {
    // this hour of the day?
    let factor = 1
    if (gridHours.length === i + 1) {
      factor = new Date().getMinutes() / 60
    }

    return prev + curr.value * factor
  }, 0)

  return gridConsumed
}

export function NetCostSEK(
  gridHours: Node[],
  todayPrice: RootState['tibber']['today'],
): number {
  const gridCost = gridHours?.reduce((prev, curr, i) => {
    let priceNode = todayPrice.find((n) => {
      const d1 = new Date(n.startsAt)
      const d2 = new Date(curr.time)
      if (d1.getDate() !== d2.getDate()) return false
      if (d1.getHours() !== d2.getHours()) return false
      return true
    })
    if (!priceNode) {
      return prev
    }

    // this hour of the day?
    let factor = 1
    if (gridHours.length === i + 1) {
      factor = new Date().getMinutes() / 60
    }

    const price =
      curr.value > 0 ? priceNode.total : priceNode.total - priceNode.tax

    return prev + (curr.value / 1000) * price * factor
  }, 0)

  return gridCost
}

interface SelfUsageSpec {
  kWh: number
  cost: number
}

export function SelfUsage(
  pvMinutes: Node[],
  loadMinutes: Node[],
  price: RootState['tibber']['today'],
): SelfUsageSpec {
  const selfConsumedValue = pvMinutes?.reduce<SelfUsageSpec>(
    (total, pvMinute, i) => {
      let priceNode = price.find((n) => {
        const d1 = new Date(n.startsAt)
        const d2 = new Date(pvMinute.time)
        if (d1.getDate() !== d2.getDate()) return false
        if (d1.getHours() !== d2.getHours()) return false
        return true
      })
      if (!priceNode) {
        return total
      }

      const load = loadMinutes[i]
      if (!load) {
        return total
      }

      if (pvMinute.value > 0) {
        const remainPv = pvMinute.value - load.value
        const selfConsumedWm = remainPv > 0 ? load.value : pvMinute.value
        const cost = (selfConsumedWm / 1000 / 60) * priceNode.total
        return {
          kWh: total.kWh + selfConsumedWm / 1000 / 60,
          cost: total.cost + cost,
        }
      }

      return total
    },
    { kWh: 0, cost: 0 },
  )

  return selfConsumedValue
}

export function HeatPumpConsumedWh(heatpumpMinutes: Node[]): number {
  const heatpumpTotalConsumedWm = heatpumpMinutes.reduce((prev, curr) => {
    return prev + curr.value
  }, 0)

  return heatpumpTotalConsumedWm / 60
}

export function AveragePaidPrice(netCost: number, netConsumed: number): number {
  console.log({ netCost, netConsumed })
  const sekPerWh = netCost / netConsumed
  return sekPerWh * 100000
}
