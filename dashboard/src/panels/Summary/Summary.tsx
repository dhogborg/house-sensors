import { useEffect, useState } from 'react'

import { Col, Row } from 'antd'

import { formatNumber } from 'src/lib/helpers'
import { useDispatch, useSelector } from 'src/lib/store'

import * as config from 'src/lib/slices/config'
import * as influxdb from 'src/lib/slices/influxdb'
import * as mqtt from 'src/lib/slices/mqtt'
import * as tibber from 'src/lib/slices/tibber'

import * as lib from './Summary.lib'

export default function Summary(props: { height: number }) {
  const dispatch = useDispatch()
  const includeTax = useSelector(config.selector).includeTaxes
  const gridMinutes = useSelector(influxdb.selectSeriesValues('gridMinutes', 0))
  const pvPeakValues = useSelector(influxdb.selectSeriesValues('pvPeak', 0))

  const loadMinutes = useSelector(
    influxdb.selectSeriesValues('loadPowerMinutes', 0),
  )
  const pvMinutes = useSelector(
    influxdb.selectSeriesValues('pvPowerMinutes', 0),
  )
  const monthGridHours = useSelector(
    influxdb.selectSeriesValues('topGridHours', 0),
  )
  const heatpumpTotal = useSelector(
    influxdb.selectSeriesValues('heatpumpTotal', 0),
  )

  const todayPrice = useSelector(tibber.selector).today
  const [altView, setAltView] = useState(false)

  useEffect(() => {
    const now = new Date()
    const firstOtMonth = now.getDate() * 24 * 60 + now.getMinutes()

    dispatch(
      influxdb.getFluxQuery({
        id: 'topGridHours',
        category: 'energy',
        query: `from(bucket: "energy/autogen")
      |> range(start: -${firstOtMonth}m)
      |> filter(fn: (r) => r["_measurement"] == "grid")
      |> filter(fn: (r) => r.phase == "combined")  
      |> filter(fn: (r) => r["_field"] == "power")
      |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
      |> aggregateWindow(every: 24h, fn: max, createEmpty: false)
      |> yield(name: "mean")`,
      }),
    )
  }, [dispatch])

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
          id: 'heatpumpTotal',
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

  const mqttStatus = useSelector(mqtt.selector).topics['tapo/p115/heatpump']
  const [heatPower, setHeatPower] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (
      mqttStatus?.status === 'connected' ||
      mqttStatus?.status === 'connecting'
    ) {
      return
    }

    const topic = 'tapo/p115/heatpump'
    dispatch(
      mqtt.subscribe({
        topic,
        cb: (payload) => {
          const { power } = payload
          setHeatPower(power)
        },
      }),
    )
  }, [dispatch, mqttStatus])

  const totalConsumedWh = lib.TotalConsumedWh(loadMinutes)
  const peakPowerWatts = lib.PeakPowerWatts(monthGridHours)
  const pvProducedWh = lib.PvProducedWh(pvMinutes)
  const pvPeakWatts = lib.PvPeakWatts(pvPeakValues)
  const imported = lib.GridImport(gridMinutes)
  const exported = lib.GridExport(gridMinutes)

  const totalPaidSEK = lib.TotalCostSEK(gridMinutes, todayPrice, includeTax)
  const totalGainSEK =
    lib.TotalGainSEK(gridMinutes, todayPrice, includeTax) * -1
  const netCostSEK = totalPaidSEK - totalGainSEK

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
        title: 'Besparing:',
        value: formatNumber(selfUsage.potentialCost, ' kr', {
          precision: 1,
        }),
        alt: {
          title: 'Egenanvändning:',
          value: formatNumber(selfUsage.kWh, ' kWh', { precision: 1 }),
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
        value: `${totalPaidSEK.toFixed(0)} - ${totalGainSEK.toFixed(
          0,
        )} = ${netCostSEK.toFixed(0)} kr`,
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
