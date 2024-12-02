import { log } from 'console'

import { useEffect, useMemo } from 'react'
import { batch } from 'react-redux'

import { Column, ColumnConfig } from '@ant-design/charts'

import {
  BUY_ADDED_TAX_CENTS,
  BUY_TRANSMISSION_FEE_CENTS,
  SELL_GRID_BENEFIT_CENTS,
  SELL_REDUCED_TAX_CENTS,
  refresh,
  theme,
} from 'src/lib/config'
import { formatNumber } from 'src/lib/helpers'
import { useDispatch, useSelector } from 'src/lib/store'

import * as configSlice from 'src/lib/slices/config'
import * as influxdb from 'src/lib/slices/influxdb'
import * as tibber from 'src/lib/slices/tibber'

export const ColorSolar = '#fee1a7'
export const ColorSell = '#30BF78'
export const ColorBuy = '#f85e46'
export const ColorProduction = ColorSell + '33'
export const ColorDischarge = '#3699b5'
export const ColorCharge = '#7EAD76'
export const ColorBatteryCharge = '#3699b5'
export const ColorBatteryDischarge = '#fee1a7'

const Grain = '1h'

type MasterNode = {
  time: Date

  load: number
  import: number
  export: number
  selfUsage: number
  solar: number
  charge: number
  discharge: number
}

export default function PowerUseBars(props: { height: number }) {
  const dispatch = useDispatch()
  const includeTax = useSelector(configSlice.selector).includeTaxes

  // const loadValues = useSelector(influxdb.selectSeriesValues('totalLoad', 0))
  const pvValues = useSelector(influxdb.selectSeriesValues('totalPv', 0))
  const gridImport = useSelector(influxdb.selectSeriesValues('gridImport', 0))
  const gridExport = useSelector(influxdb.selectSeriesValues('gridExport', 0))
  const chargeValues = useSelector(influxdb.selectSeriesValues('charge', 0))
  const dischargeValues = useSelector(
    influxdb.selectSeriesValues('discharge', 0),
  )

  const priceState = useSelector(tibber.selector)

  useEffect(() => {
    const tzOffset = '-60m' //`${new Date().getTimezoneOffset()}m`
    const load = () => {
      batch(() => {
        dispatch(
          influxdb.getFluxQuery({
            id: 'gridImport',
            category: 'import',
            query: `from(bucket: "energy/autogen")
                      |> range(start: -23h)
                      |> filter(fn: (r) => r._measurement == "grid")
                      |> filter(fn: (r) => r.phase == "combined")
                      |> filter(fn: (r) => r._measurement == "grid" and r._field == "power")
                      |> filter(fn: (r) => r._value > 0)
                      |> aggregateWindow(every: 10s, createEmpty: true, fn: mean)
                      |> fill(value: 0.0)
                      |> aggregateWindow(every: 1h, createEmpty: true, fn: mean)`,
          }),
        )
        dispatch(
          influxdb.getFluxQuery({
            id: 'gridExport',
            category: 'import',
            query: `from(bucket: "energy/autogen")
                      |> range(start: -23h)
                      |> filter(fn: (r) => r._measurement == "grid")
                      |> filter(fn: (r) => r.phase == "combined")
                      |> filter(fn: (r) => r._measurement == "grid" and r._field == "power")
                      |> filter(fn: (r) => r._value < 0)
                      |> aggregateWindow(every: 10s, createEmpty: true, fn: mean)
                      |> fill(value: 0.0)
                      |> aggregateWindow(every: 1h, createEmpty: true, fn: mean)`,
          }),
        )
        dispatch(
          influxdb.getQuery({
            id: 'charge',
            db: 'energy',
            query: `SELECT mean("charge") AS "mean_charge"
                FROM "energy"."autogen"."storage" 
                WHERE time > now() - 23h
                GROUP BY time(${Grain}) FILL(null)`,
          }),
        ),
          dispatch(
            influxdb.getQuery({
              id: 'discharge',
              db: 'energy',
              query: `SELECT mean("discharge") AS "mean_discharge" 
                FROM "energy"."autogen"."storage" 
                WHERE time > now() - 23h
                GROUP BY time(${Grain}) FILL(null)`,
            }),
          ),
          dispatch(
            influxdb.getQuery({
              id: 'totalPv',
              db: 'energy',
              query: `SELECT mean("power") AS "mean_power" 
            FROM "energy"."autogen"."pv" 
            WHERE time > now() - 23h 
            GROUP BY time(${Grain}) FILL(null)`,
            }),
          )
      })
    }

    load()

    const r = setInterval(() => {
      load()
    }, refresh)
    return () => {
      clearInterval(r)
    }
  }, [dispatch])

  if (!pvValues || !gridImport || !gridExport) {
    return null
  }

  const hours = useMemo(() => {
    const hours = gridImport.map((loadNode, i) => {
      const pvNode = pvValues[i]
      const importNode = gridImport[i]
      const exportNode = gridExport[i]
      const chargeNode = chargeValues[i]
      const dischargeNode = dischargeValues[i]

      return {
        time: new Date(loadNode.time),

        import: (importNode?.value ?? 0) / 1000,
        export: (exportNode?.value ?? 0) / 1000,
        load: (loadNode?.value ?? 0) / 1000,
        solar: (pvNode?.value ?? 0) / 1000,
        charge: (chargeNode?.value ?? 0) / 1000,
        discharge: (dischargeNode?.value ?? 0) / 1000,
      }
    })

    // reduce to hours
    //   const hours: MasterNode[] = []
    //   minutes.forEach((node) => {
    //     const t = node.time
    //     let curr: MasterNode = hours[hours.length - 1]
    //     if (!curr || curr.time.getHours() !== t.getHours()) {
    //       curr = {
    //         time: t,

    //         load: 0,
    //         import: 0,
    //         export: 0,
    //         selfUsage: 0,
    //         solar: 0,
    //         charge: 0,
    //         discharge: 0,
    //       }
    //       hours.push(curr)
    //     }

    //     let selfUseSolar = 0
    //     if (node.solar > 0) {
    //       // selfUseSolar = node.grid > 0 ? node.solar : node.load
    //       selfUseSolar = node.solar - node.export - node.charge
    //     }

    //     // let netImport = gridImport - node.charge
    //     // if (netImport < 0) netImport = 0

    //     // let netCharge = node.charge - selfUseSolar
    //     // if (netCharge < 0) netCharge = 0

    //     // let netDischarge = node.discharge
    //     // if (gridExport > 0) {
    //     //   netDischarge = netDischarge - gridExport
    //     // }

    //     curr.load += node.load
    //     curr.export += node.export
    //     curr.import += node.import * -1
    //     curr.selfUsage += selfUseSolar
    //     // curr.solar += node.solar
    //     curr.charge += node.charge
    //     curr.discharge += node.discharge
    //   })

    return hours
  }, [gridExport, gridImport, pvValues, chargeValues, dischargeValues])

  const data: influxdb.Series['values'] = hours.reduce((prev, node, i) => {
    const nodes = [
      {
        time: node.time.toString(),
        category: 'Export',
        value: node.export * -1,
      },
      {
        time: node.time.toString(),
        category: 'Till Batteri',
        value: node.charge,
      },
      {
        time: node.time.toString(),
        category: 'Egenanvändning',
        value: node.solar - node.charge - Math.abs(node.export),
      },

      {
        time: node.time.toString(),
        category: 'Import',
        value: node.import * -1,
      },
      {
        time: node.time.toString(),
        category: 'Från Batteri',
        value: node.discharge * -1,
      },
      // {
      //   time: node.time.toString(),
      //   category: 'Producerat',
      //   value: (node.solar + node.export) * -1,
      // },
    ]
    return prev.concat(nodes)
  }, [])

  let annotations: ColumnConfig['annotations'] = [
    {
      type: 'line',
      start: [-1, 0],
      end: [24, 0],
      style: {
        lineWidth: 1,
        stroke: 'black',
      },
    },
  ]

  const priceNodes = [...priceState.nodes, ...priceState.today]

  annotations = annotations.concat(
    hours.map((hour, i) => {
      const { solar, load, time } = hour

      const priceNode = priceNodes.find((n) => {
        const d1 = new Date(n.startsAt)
        const d2 = new Date(time)
        if (d1.getDate() !== d2.getDate()) return false
        if (d1.getHours() !== d2.getHours()) return false
        return true
      })

      const fees = includeTax
        ? (BUY_ADDED_TAX_CENTS + BUY_TRANSMISSION_FEE_CENTS) / 100
        : 0

      const benefits = includeTax
        ? (SELL_REDUCED_TAX_CENTS + SELL_GRID_BENEFIT_CENTS) / 100
        : 0

      let netCost = 0
      let priceStr = ''
      if (priceNode) {
        const cost = load > 0 ? load * (priceNode.total + fees) : 0
        const gain = solar * (priceNode.energy + benefits) * -1
        netCost = cost + gain
        priceStr = formatNumber(netCost, '', { precision: 1 })
      }

      let fill = 'rgba(0,0,0,0)'
      // fill = priceFill(netCost)

      return {
        type: 'text',
        content: priceStr,

        position: (xScale, yScale: any) => {
          const left = 2 + i * 4.1666
          const top = 12
          return [
            `${left}%`, // left
            `${top}%`, // top
          ]
        },

        style: {
          textAlign: 'center',
          fill: 'white',
          fontSize: 12,
        },

        offsetY: -20,

        background: {
          padding: 5,
          style: {
            radius: 4,
            fill,
          },
        },
      }
    }),
  )

  const config: ColumnConfig = {
    data,
    isStack: true,
    xField: 'time',
    yField: 'value',
    padding: 'auto',
    seriesField: 'category',

    color: (cat) => {
      switch (cat.category) {
        case 'Egenanvändning':
          return ColorSolar
        case 'Import':
          return ColorBuy
        case 'Export':
          return ColorSell
        case 'Producerat':
          return ColorProduction
        case 'Till Batteri':
          return ColorBatteryCharge
        case 'Från Batteri':
          return ColorBatteryDischarge
      }
    },
    theme,
    height: props.height,

    label: undefined,
    animation: false,

    legend: {
      layout: 'horizontal',
      position: 'top',
    },

    tooltip: {
      title: (title, datum) => {
        const d = new Date(datum.time)
        return d.toLocaleDateString('sv-se') + ' ' + d.toLocaleTimeString()
      },
      formatter: (datum) => {
        if (datum.category === 'Producerat') {
          const node = hours.find((node) => node.time.toString() === datum.time)
          if (node) {
            datum.value = node.solar
          }
        }

        if (datum.value < 0) {
          datum.value = datum.value * -1
        }

        return {
          name: datum.category,
          value: formatNumber(datum.value, ' kWh'),
        }
      },
    },

    xAxis: {
      tickCount: 24,
      label: {
        formatter: (t, item, index) => {
          let d = new Date(t)
          return d.getHours()
        },
      },
    },
    yAxis: {
      label: {
        formatter: (text, item, index) => {
          const num = parseFloat(text)
          const str = num.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')
          return str
        },
      },
    },
    columnWidthRatio: 0.6,
  }

  return (
    <div className="panel">
      <Column {...config} annotations={annotations} />
    </div>
  )
}

function priceFill(cost: number): string {
  const minHue = 100
  const step = 2.6
  let percent = (cost / 6) * 100
  if (percent > 100) {
    percent = 100
  }
  if (percent < 0) percent = 0
  const hue = Number(minHue + step * percent).toFixed(0)

  return `hsl(${hue}, 70%, 70%)`
}
