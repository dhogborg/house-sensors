import { RootState } from '../../lib/store'

interface Node {
  time: string
  value: number
}

function TotalConsumedWh(loadHours: Node[]): number {
  const consumed = loadHours.reduce((prev, curr, i) => {
    // this hour of the day?
    let factor = 1
    if (loadHours.length === i + 1) {
      factor = new Date().getMinutes() / 60
    }
    return prev + curr.value * factor
  }, 0)

  return consumed
}

function PeakPowerWatts(monthGridHours: Node[]): number {
  const highHour = monthGridHours.reduce((prev, curr) => {
    if (curr.value > prev) return curr.value
    return prev
  }, 0)

  return highHour
}

function PvProducedWh(pvHours: Node[]): number {
  const pvProduced = pvHours.reduce((prev, curr, i) => {
    // this hour of the day?
    let factor = 1
    if (pvHours.length === i + 1) {
      factor = new Date().getMinutes() / 60
    }

    return prev + curr.value * factor
  }, 0)

  return pvProduced
}

function PvPeakWatts(pvPeakValues: Node[]): number {
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

function NetConsumedWh(gridHours: Node[]): number {
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

function NetCostSEK(
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

function SelfUsage(type: 'cost' | 'energy'): number {
  const pvMinutes = useSelector(
    influxdb.selectSeriesValues('pvPowerMinutes', 0),
  )
  const pvHours = useSelector(influxdb.selectSeriesValues('pvPower', 0))
  const todayPrice = useAppSelector(tibber.today)
  const loadMinutes = useSelector(
    influxdb.selectSeriesValues('loadPowerMinutes', 0),
  )

  const selfConsumedValue = pvMinutes?.reduce(
    (total, pvHour, i) => {
      let priceNode = todayPrice.find((n) => {
        const d1 = new Date(n.startsAt)
        const d2 = new Date(pvHour.time)
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

      // this hour of the day?
      let factor = 1
      if (pvHours.length === i + 1) {
        factor = new Date().getMinutes() / 60
      }

      if (pvHour.value > 0) {
        const remainPv = pvHour.value - load.value
        const selfConsumedWm = remainPv > 0 ? load.value : pvHour.value
        const cost = (selfConsumedWm / 1000 / 60) * priceNode.total
        return {
          kWh: total.kWh + selfConsumedWm / 1000 / 60,
          cost: total.cost + cost * factor,
        }
      }

      return total
    },
    { kWh: 0, cost: 0 },
  )

  switch (type) {
    case 'cost':
      return formatNumber(selfConsumedValue.cost, ' SEK', {
        precision: 1,
      })
    case 'energy':
      return formatNumber(selfConsumedValue.kWh, ' kWh', { precision: 1 })
  }
}

function HeatPumpConsumed(): number {
  const heatpumpTotal = useSelector(
    influxdb.selectSeriesValues('heatpump_total', 0),
  )

  const heatpumpTotalConsumedWm = heatpumpTotal.reduce((prev, curr) => {
    return prev + curr.value
  }, 0)

  return formatNumber(heatpumpTotalConsumedWm / 1000 / 60, ' kWh', {
    precision: 1,
  })
}
