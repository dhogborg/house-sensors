import { useEffect, useMemo } from 'react'
import { batch, useSelector } from 'react-redux'

import {
  refresh,
  theme,
  BUY_TRANSMISSION_FEE_CENTS,
  BUY_ADDED_TAX_CENTS,
  SELL_REDUCED_TAX_CENTS,
  SELL_GRID_BENEFIT_CENTS,
} from 'src/lib/config'
import { formatNumber } from 'src/lib/helpers'
import { useAppDispatch, useAppSelector } from 'src/lib/hooks'

import * as influxdb from 'src/lib/slices/influxdb'
import * as tibber from 'src/lib/slices/tibber'
import * as configSlice from 'src/lib/slices/config'

import { Column, ColumnConfig } from '@ant-design/charts'
import { SelfUsage } from './Summary/Summary.lib'

export const ColorSolar = '#fee1a7'
export const ColorSell = '#30BF78'
export const ColorBuy = '#f85e46'
export const ColorProduction = ColorSell + '33'

const Grain = '1m'

type MasterNode = {
  time: Date

  load: number
  import: number
  export: number
  selfUsage: number
  solar: number
}

export default function PowerUseBars(props: { height: number }) {
  const dispatch = useAppDispatch()
  const includeTax = useSelector(configSlice.selector).includeTaxes

  const loadValues = useAppSelector(influxdb.selectSeriesValues('totalLoad', 0))
  const pvValues = useAppSelector(influxdb.selectSeriesValues('totalPv', 0))
  const gridValues = useAppSelector(influxdb.selectSeriesValues('totalGrid', 0))

  const priceState = useAppSelector(tibber.selector)

  useEffect(() => {
    const tzOffset = '-60m' //`${new Date().getTimezoneOffset()}m`
    const load = () => {
      batch(() => {
        dispatch(
          influxdb.getFluxQuery({
            id: 'totalGrid',
            category: 'Grid',
            query: `
          from(bucket: "energy/autogen")
            |> range(start: -23h)
            |> filter(fn: (r) => r._measurement == "grid" and (r._field == "power"))
            |> filter(fn: (r) => r.phase == "combined")
            |> aggregateWindow(every: ${Grain}, fn: mean)
            |> timeShift(duration: ${tzOffset})
            |> fill(value: 0.0)
            |> yield(name: "electricity")
          `,
          }),
        )

        dispatch(
          influxdb.getFluxQuery({
            id: 'totalLoad',
            category: 'Load',
            query: `
          from(bucket: "energy/autogen")
            |> range(start: -23h)
            |> filter(fn: (r) => r._measurement == "load" and (r._field == "power"))
            |> filter(fn: (r) => r.phase == "combined")
            |> aggregateWindow(every: ${Grain}, fn: mean)
            |> timeShift(duration: ${tzOffset})
            |> fill(value: 0.0)
            |> yield(name: "electricity")
          `,
          }),
        )

        dispatch(
          influxdb.getFluxQuery({
            id: 'totalPv',
            category: 'Produktion',
            query: `
          from(bucket: "energy/autogen")
            |> range(start: -23h)
            |> filter(fn: (r) => r._measurement == "pv" and (r._field == "power"))
            |> aggregateWindow(every: ${Grain}, fn: mean)
            |> timeShift(duration: ${tzOffset})
            |> fill(value: 0.0)
            |> yield(name: "electricity")
          `,
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

  if (!loadValues || !pvValues || !gridValues) {
    return null
  }

  const masterInput = useMemo(() => {
    const minutes = loadValues.map((loadNode, i) => {
      const pvNode = pvValues[i]
      const gridNode = gridValues[i]

      return {
        time: new Date(loadNode.time),

        grid: (gridNode?.value ?? 0) / 1000 / 60,
        load: (loadNode?.value ?? 0) / 1000 / 60,
        solar: (pvNode?.value ?? 0) / 1000 / 60,
      }
    })

    // reduce to hours
    const hours: MasterNode[] = []
    minutes.forEach((node) => {
      const t = node.time
      let curr: MasterNode = hours[hours.length - 1]
      if (!curr || curr.time.getHours() !== t.getHours()) {
        curr = {
          time: t,

          load: 0,
          import: 0,
          export: 0,
          selfUsage: 0,
          solar: 0,
        }
        hours.push(curr)
      }

      const selfUse = node.grid > 0 ? node.solar : node.load
      const gridExport = node.grid < 0 ? node.grid : 0
      const gridImport = node.grid > 0 ? node.grid : 0

      curr.load += node.load
      curr.export += gridExport
      curr.import += gridImport
      curr.selfUsage += selfUse
      curr.solar += node.solar
    })

    return hours
  }, [loadValues, gridValues, pvValues])

  const data: influxdb.Series['values'] = masterInput.reduce((prev, node) => {
    const nodes = [
      {
        time: node.time.toISOString(),
        category: 'Import',
        value: node.import,
      },
      {
        time: node.time.toISOString(),
        category: 'Egenanvändning',
        value: node.selfUsage,
      },
      {
        time: node.time.toISOString(),
        category: 'Export',
        value: node.export,
      },
      {
        time: node.time.toISOString(),
        category: 'Producerat',
        value: node.solar * -1,
      },
    ]
    return prev.concat(nodes)
  }, [])

  let annotations: ColumnConfig['annotations'] = [
    {
      type: 'line',
      start: [-1, 0],
      end: [24, 0],
      style: {
        lineWidth: 2,
        stroke: 'black',
      },
    },
  ]

  annotations = annotations.concat(
    loadValues.map((hour, i) => {
      let loadKwh = hour.value / 1000
      const { time } = hour

      let priceNode = priceState.nodes.find((n) => {
        const d1 = new Date(n.startsAt)
        const d2 = new Date(time)
        if (d1.getDate() !== d2.getDate()) return false
        if (d1.getHours() !== d2.getHours()) return false
        return true
      })

      const pvValue = pvValues[i]
      let pvKwh = pvValue?.value / 1000 ?? 0

      if (i === loadValues.length - 1) {
        // last hour isn't complete, so factor in the percentage of the hour that has passed
        loadKwh = (new Date().getMinutes() / 60) * loadKwh
        pvKwh = (new Date().getMinutes() / 60) * pvKwh
        priceNode = tibber.now(priceState.today)
      }

      const fees = includeTax
        ? (BUY_ADDED_TAX_CENTS + BUY_TRANSMISSION_FEE_CENTS) / 100
        : 0

      const benefits = includeTax
        ? (SELL_REDUCED_TAX_CENTS + SELL_GRID_BENEFIT_CENTS) / 100
        : 0

      let netCost = 0
      let priceStr = ''
      if (priceNode) {
        const cost = loadKwh > 0 ? loadKwh * (priceNode.total + fees) : 0
        const gain = pvKwh * (priceNode.energy + benefits) * -1
        netCost = cost + gain
        priceStr = Number(netCost).toFixed(2)
      }

      let fill = 'rgba(0,0,0,0)'
      fill = priceFill(netCost)

      return {
        type: 'text',
        content: priceStr,

        position: (xScale, yScale: any) => {
          const left = 2 + i * 4.1666
          let top = 12
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
    isStack: false,
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
