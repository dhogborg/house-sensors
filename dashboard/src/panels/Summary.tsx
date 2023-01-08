import { useEffect, useState } from 'react'

import { formatNumber } from 'src/lib/helpers'
import { useAppDispatch, useAppSelector } from 'src/lib/hooks'
import * as tibber from 'src/lib/slices/tibber'

import mqtt from 'precompiled-mqtt'

import * as influxdb from 'src/lib/slices/influxdb'
import { Col, Row } from 'antd'
import { SerializedError } from '@reduxjs/toolkit'
import { useSelector } from 'react-redux'

export default function Summary(props: { height: number }) {
  const dispatch = useAppDispatch()
  const loadHours = useSelector(influxdb.selectSeriesValues('loadPower', 0))
  const gridHours = useSelector(influxdb.selectSeriesValues('gridPower', 0))
  const pvHours = useSelector(influxdb.selectSeriesValues('pvPower', 0))
  const pvPeakValues = useSelector(influxdb.selectSeriesValues('pvPeak', 0))

  const loadMinutes = useSelector(
    influxdb.selectSeriesValues('loadPowerMinutes', 0),
  )
  const pvMinutes = useSelector(
    influxdb.selectSeriesValues('pvPowerMinutes', 0),
  )
  const monthGridHours = useSelector(
    influxdb.selectSeriesValues('month_summary', 0),
  )
  const heatpumpTotal = useSelector(
    influxdb.selectSeriesValues('heatpump_total', 0),
  )

  const todayPrice = useAppSelector(tibber.selector).today
  const [altView, setAltView] = useState(false)

  useEffect(() => {
    const now = new Date()
    const sinceMidnight = now.getHours() * 60 + now.getMinutes()
    const firstOtMonth = now.getDate() * 24 * 60 + now.getMinutes()

    const load = () => {
      dispatch(
        influxdb.getQuery({
          id: 'gridPower',
          db: 'energy',
          query: `SELECT mean("power") FROM "energy"."autogen"."grid" WHERE time > now() - ${sinceMidnight}m AND "phase"='combined' GROUP BY time(1h)`,
        }),
      )

      dispatch(
        influxdb.getQuery({
          id: 'loadPower',
          db: 'energy',
          query: `SELECT mean("power") FROM "energy"."autogen"."load" WHERE time > now() - ${sinceMidnight}m AND "phase"='combined' GROUP BY time(1h)`,
        }),
      )

      dispatch(
        influxdb.getQuery({
          id: 'pvPower',
          db: 'energy',
          query: `SELECT mean("power") FROM "energy"."autogen"."pv" WHERE time > now() - ${sinceMidnight}m GROUP BY time(1h)`,
        }),
      )

      dispatch(
        influxdb.getQuery({
          id: 'loadPowerMinutes',
          db: 'energy',
          query: `SELECT mean("power") FROM "energy"."autogen"."load" WHERE time > now() - ${sinceMidnight}m AND "phase"='combined' GROUP BY time(1m)`,
        }),
      )

      dispatch(
        influxdb.getQuery({
          id: 'pvPowerMinutes',
          db: 'energy',
          query: `SELECT mean("power") FROM "energy"."autogen"."pv" WHERE time > now() - ${sinceMidnight}m GROUP BY time(1m)`,
        }),
      )

      dispatch(
        influxdb.getQuery({
          id: 'pvPeak',
          db: 'energy',
          query: `SELECT max("power") FROM "energy"."autogen"."pv" WHERE time > now() - ${sinceMidnight}m GROUP BY time(24h) ORDER BY time DESC LIMIT 1`,
        }),
      )

      dispatch(
        influxdb.getQuery({
          id: 'month_summary',
          db: 'energy',
          query: `SELECT mean("power") FROM "energy"."autogen"."grid" WHERE time > now() - ${firstOtMonth}m AND "phase"='combined' GROUP BY time(1h)`,
        }),
      )

      dispatch(
        influxdb.getQuery({
          id: 'heatpump_total',
          db: 'energy',
          query: `SELECT mean("power") AS "mean_power" FROM "energy"."autogen"."heating" WHERE time > now() - ${sinceMidnight}m  AND "type"='heatpump' GROUP BY time(1m) FILL(previous)`,
        }),
      )
    }

    load()

    const r = setInterval(() => {
      load()
    }, 2 * 60 * 1000)
    return () => {
      clearInterval(r)
    }
  }, [dispatch])

  const [heatPower, setHeatPower] = useState<number | undefined>(undefined)
  useEffect(() => {
    const client = mqtt.connect('mqtt://192.168.116.232:8083')

    client.on('connect', function () {
      console.log('mqtt connected')

      client.subscribe(
        'zigbee2mqtt/0x0004740000847cf5',
        function (err: SerializedError) {
          if (err) {
            console.error(err)
          }
          console.log('subscribed topic: zigbee2mqtt/0x0004740000847cf5')
        },
      )
    })

    client.on('message', function (topic: string, message: any) {
      // message is Buffer
      const payload = JSON.parse(message.toString())

      let power = payload.apparentPower - 37
      if (power < 0) {
        power = 0
      } else {
        power = power * 0.93
      }

      setHeatPower(power)
    })
    return () => {
      client.end()
    }
  }, [setHeatPower])

  const loadConsumed = loadHours.reduce((prev, curr, i) => {
    // this hour of the day?
    let factor = 1
    if (loadHours.length === i + 1) {
      factor = new Date().getMinutes() / 60
    }
    return prev + curr.value * factor
  }, 0)

  const gridConsumed = gridHours.reduce((prev, curr, i) => {
    // this hour of the day?
    let factor = 1
    if (gridHours.length === i + 1) {
      factor = new Date().getMinutes() / 60
    }

    return prev + curr.value * factor
  }, 0)

  const heatpumpTotalConsumedWm = heatpumpTotal.reduce((prev, curr) => {
    return prev + curr.value
  }, 0)

  const pvProduced = pvHours.reduce((prev, curr, i) => {
    // this hour of the day?
    let factor = 1
    if (pvHours.length === i + 1) {
      factor = new Date().getMinutes() / 60
    }

    return prev + curr.value * factor
  }, 0)

  let gridPeak = 0
  gridHours.forEach((h) => {
    if (h.value > gridPeak) {
      gridPeak = h.value
    }
  })

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

  const highHour = monthGridHours.reduce((prev, curr) => {
    if (curr.value > prev) return curr.value
    return prev
  }, 0)

  let rows: Grid = [
    // Row 1
    [
      {
        title: 'Förbrukat:',
        value: formatNumber(loadConsumed / 1000, ' kWh', { precision: 1 }),
        alt: {
          title: 'Max Effekt:',
          value: formatNumber(highHour / 1000, ' kW', { precision: 1 }),
        },
      },
      {
        title: 'Producerat:',
        value: formatNumber(pvProduced / 1000, ' kWh', { precision: 1 }),
        alt: {
          title: 'Högsta:',
          value: formatNumber(pvPeak / 1000, ' kW', { precision: 2 }),
        },
      },
    ],
    // Row 2
    [
      {
        title: 'Import / Export:',
        value: formatNumber(gridConsumed / 1000, ' kWh', {
          precision: 1,
        }),
        alt: {
          title: 'Kostnad:',
          value: formatNumber(gridCost, ' SEK', { precision: 1 }),
        },
      },
      {
        title: 'Egenanvändning:',
        value: formatNumber(selfConsumedValue.kWh, ' kWh', { precision: 1 }),
        alt: {
          title: 'Besparing:',
          value: formatNumber(selfConsumedValue.cost, ' SEK', {
            precision: 1,
          }),
        },
      },
    ],
    // Row 3
    [
      {
        title: 'Värmepump:',
        value:
          heatPower === undefined
            ? '- W'
            : formatNumber(heatPower, ' W', { precision: 0 }),
        alt: {
          title: 'Värmepump (idag):',
          value: formatNumber(heatpumpTotalConsumedWm / 1000 / 60, ' kWh', {
            precision: 1,
          }),
        },
      },
      {
        title: 'Snittpris:',
        value: formatNumber(gridCost / (gridConsumed / 100000), ' öre/kWh', {
          precision: 0,
        }),
      },
    ],
  ]

  return (
    <div
      className="panel"
      style={{ height: props.height + 'px' }}
      onClick={() => {
        setAltView((state) => {
          return !state
        })
      }}
    >
      <Row>
        <Col span={12}>
          {rows.map((row, i) => {
            const cell = row[0]
            const use = altView && cell.alt ? cell.alt : cell
            return (
              <dl key={i}>
                <dt>{use.title}</dt>
                <dd>{use.value}</dd>
              </dl>
            )
          })}
        </Col>
        <Col span={12}>
          {rows.map((row, i) => {
            const cell = row[1]
            const use = altView && cell.alt ? cell.alt : cell
            return (
              <dl key={i}>
                <dt>{use.title}</dt>
                <dd>{use.value}</dd>
              </dl>
            )
          })}
        </Col>
      </Row>
    </div>
  )
}

type Grid = Cell[][]
interface Cell {
  title: string
  value: string

  alt?: Cell
}
