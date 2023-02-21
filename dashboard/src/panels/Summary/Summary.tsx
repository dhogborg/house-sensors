import { Col, Row } from 'antd'
import mqtt from 'precompiled-mqtt'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { formatNumber } from 'src/lib/helpers'
import { useAppDispatch, useAppSelector } from 'src/lib/hooks'
import * as influxdb from 'src/lib/slices/influxdb'
import * as tibber from 'src/lib/slices/tibber'
import * as config from 'src/lib/slices/config'

import { SerializedError } from '@reduxjs/toolkit'

import * as lib from './Summary.lib'

export default function Summary(props: { height: number }) {
  const dispatch = useAppDispatch()
  const includeTax = useSelector(config.selector).includeTaxes
  // const gridHours = useSelector(influxdb.selectSeriesValues('gridPower', 0))
  const gridMinutes = useSelector(influxdb.selectSeriesValues('gridMinutes', 0))
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
    const load = () => {
      const now = new Date()
      const sinceMidnight = now.getHours() * 60 + now.getMinutes()
      const firstOtMonth = now.getDate() * 24 * 60 + now.getMinutes()

      dispatch(
        influxdb.getQuery({
          id: 'gridMinutes',
          db: 'energy',
          query: `SELECT mean("power") FROM "energy"."autogen"."grid" WHERE time > now() - ${sinceMidnight}m AND "phase"='combined' GROUP BY time(1m)`,
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

  const totalConsumedWh = lib.TotalConsumedWh(loadMinutes)
  const peakPowerWatts = lib.PeakPowerWatts(monthGridHours)
  const pvProducedWh = lib.PvProducedWh(pvMinutes)
  const pvPeakWatts = lib.PvPeakWatts(pvPeakValues)
  const imported = lib.GridImport(gridMinutes)
  const exported = lib.GridExport(gridMinutes)

  const totalPaidSEK = lib.TotalCostSEK(gridMinutes, todayPrice, includeTax)
  const netCostSEK =
    totalPaidSEK + lib.TotalGainSEK(gridMinutes, todayPrice, includeTax)

  const selfUsage = lib.SelfUsage(
    pvMinutes,
    loadMinutes,
    todayPrice,
    includeTax,
  )
  const heatPumpConsumedWh = lib.HeatPumpConsumedWh(heatpumpTotal)
  const averagePaidPrice = lib.AveragePaidPrice(
    totalPaidSEK + selfUsage.cost,
    totalConsumedWh,
  )

  let rows: Grid = [
    // Row 1
    [
      {
        title: 'Förbrukat:',
        value: formatNumber(totalConsumedWh / 1000, ' kWh', { precision: 1 }),
        alt: {
          title: 'Max Effekt:',
          value: formatNumber(peakPowerWatts / 1000, ' kW', { precision: 1 }),
        },
      },
      {
        title: 'Producerat:',
        value: formatNumber(pvProducedWh / 1000, ' kWh', { precision: 1 }),
        alt: {
          title: 'Högsta:',
          value: formatNumber(pvPeakWatts / 1000, ' kW', { precision: 2 }),
        },
      },
    ],
    // Row 2
    [
      {
        title: 'Import:',
        value: formatNumber(imported / 1000, ' kWh', {
          precision: 1,
        }),
        alt: {
          title: 'Export:',
          value: formatNumber(exported / 1000, ' kWh', { precision: 1 }),
        },
      },
      {
        title: 'Egenanvändning:',
        value: formatNumber(selfUsage.kWh, ' kWh', { precision: 1 }),
        alt: {
          title: 'Besparing:',
          value: formatNumber(selfUsage.potentialCost, ' SEK', {
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
          value: formatNumber(heatPumpConsumedWh / 1000, ' kWh', {
            precision: 1,
          }),
        },
      },
      {
        title: 'Total kostnad:',
        value: formatNumber(netCostSEK, ' SEK', { precision: 0 }),
        alt: {
          title: 'Snittpris:',
          value: formatNumber(averagePaidPrice, ' öre/kWh', {
            precision: 0,
          }),
        },
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
