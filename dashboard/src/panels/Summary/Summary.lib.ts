import { RootState } from '../../lib/store'
import * as taxes from 'src/lib/config'

const buyTaxesPerkWh =
  (taxes.BUY_ADDED_TAX_CENTS + taxes.BUY_TRANSMISSION_FEE_CENTS) / 100

const sellBenefitsPerkWh =
  (taxes.SELL_GRID_BENEFIT_CENTS + taxes.SELL_REDUCED_TAX_CENTS) / 100
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

export function GridImport(gridMinutes: Node[]): number {
  const wm = gridMinutes.reduce((prev, curr) => {
    if (curr.value > 0) {
      return prev + curr.value
    }
    return prev
  }, 0)
  return wm / 60
}

export function GridExport(gridMinutes: Node[]): number {
  const wm = gridMinutes.reduce((prev, curr) => {
    if (curr.value < 0) {
      return prev + curr.value * -1
    }
    return prev
  }, 0)
  return wm / 60
}

export function TotalCostSEK(
  gridMinutes: Node[],
  todayPrice: RootState['tibber']['today'],
  includeTax: boolean,
): number {
  const importMins = gridMinutes.filter((v) => v.value > 0)
  return summedCost(importMins, todayPrice, includeTax)
}

export function TotalGainSEK(
  gridMinutes: Node[],
  todayPrice: RootState['tibber']['today'],
  includeTax: boolean,
): number {
  const exportMins = gridMinutes.filter((v) => v.value < 0)
  return summedCost(exportMins, todayPrice, includeTax)
}

export function summedCost(
  gridMinutes: Node[],
  todayPrice: RootState['tibber']['today'],
  includeTax: boolean,
): number {
  const gridCost = gridMinutes?.reduce((prev, curr, i) => {
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

    const fees = includeTax ? buyTaxesPerkWh / 60 : 0
    const benefits = includeTax ? sellBenefitsPerkWh / 60 : 0

    const price =
      curr.value > 0 ? priceNode.total + fees : priceNode.energy + benefits

    return prev + (curr.value / 1000) * price
  }, 0)

  return gridCost / 60
}

interface SelfUsageSpec {
  kWh: number
  potentialCost: number // What the energy would have cost if we were to buy it
  cost: number // what the energy cost us to use in lost revenue
}

export function SelfUsage(
  pvMinutes: Node[],
  loadMinutes: Node[],
  price: RootState['tibber']['today'],
  includeTax: boolean,
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
        const kWh = selfConsumedWm / 1000 / 60
        let potentialCost = kWh * priceNode.total
        let cost = kWh * priceNode.energy

        if (includeTax) {
          potentialCost += kWh * buyTaxesPerkWh
          cost += kWh * sellBenefitsPerkWh
        }

        return {
          kWh: total.kWh + kWh,
          potentialCost: total.potentialCost + potentialCost,
          cost: total.cost + cost,
        }
      }

      return total
    },
    { kWh: 0, potentialCost: 0, cost: 0 },
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
  const sekPerWh = netCost / netConsumed
  return sekPerWh * 100000
}
