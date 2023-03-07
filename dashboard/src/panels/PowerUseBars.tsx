import { useEffect } from 'react'
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

export default function PowerUseBars(props: { height: number }) {
  const dispatch = useAppDispatch()
  const includeTax = useSelector(configSlice.selector).includeTaxes

  const heatpumpValues = useAppSelector(
    influxdb.selectSeriesValues('heatpumpLoad', 0),
  )
  const loadValues = useAppSelector(influxdb.selectSeriesValues('totalLoad', 0))
  const pvValues = useAppSelector(influxdb.selectSeriesValues('totalPv', 0))

  const priceState = useAppSelector(tibber.selector)

  useEffect(() => {
    const tzOffset = '-60m' //`${new Date().getTimezoneOffset()}m`
    const load = () => {
      batch(() => {
        dispatch(
          influxdb.getFluxQuery({
            id: 'heatpumpLoad',
            category: 'Värmepump',
            query: `
          from(bucket: "energy/autogen")
            |> range(start: -23h)
            |> filter(fn: (r) => r._measurement == "heating" and (r._field == "power"))
            |> aggregateWindow(every: 1m, fn: mean)
            |> fill(value: 0.0)
            |> aggregateWindow(every: 1h, fn: mean)
            |> timeShift(duration: ${tzOffset})
            |> yield(name: "heating")
          `,
          }),
        )
        dispatch(
          influxdb.getFluxQuery({
            id: 'totalLoad',
            category: 'Konsumtion',
            query: `
          from(bucket: "energy/autogen")
            |> range(start: -23h)
            |> filter(fn: (r) => r._measurement == "load" and (r._field == "power"))
            |> filter(fn: (r) => r.phase == "combined")
            |> aggregateWindow(every: 1h, fn: mean)
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
            |> aggregateWindow(every: 1h, fn: mean)
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

  const heatpumpData = heatpumpValues?.map((hpValue, i) => {
    let kwh = Math.round(hpValue.value) / 1000
    // last hour isn't complete, so we have to factor in the percentage of the hour that has passed
    if (i === heatpumpValues.length - 1) {
      kwh = (new Date().getMinutes() / 60) * kwh
    }
    return {
      ...hpValue,
      value: kwh,
    }
  })

  const loadData = loadValues?.map((totValue, i) => {
    let kwh = Math.round(totValue.value) / 1000

    // last hour isn't complete, so we have to factor in the percentage of the hour that has passed
    if (i === loadValues.length - 1) {
      const hourPassed = new Date().getMinutes() / 60
      kwh = hourPassed * kwh
    }

    return {
      time: totValue.time,
      category: totValue.category,
      value: kwh,
    }
  })

  const pvData = pvValues?.map((pvValue, i) => {
    let kwh = Math.round(pvValue.value) / 1000

    // last hour isn't complete, so we have to factor in the percentage of the hour that has passed
    if (i === pvValues.length - 1) {
      const hourPassed = new Date().getMinutes() / 60
      kwh = hourPassed * kwh
    }

    return {
      time: pvValue.time,
      category: pvValue.category,
      value: kwh * -1,
    }
  })

  let data: influxdb.Series['values'] = []
  if (loadData) {
    data = data.concat(loadData)
  }
  if (heatpumpData) {
    data = data.concat(heatpumpData)
  }
  if (pvData) {
    data = data.concat(pvData)
  }

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
    color: ['#fee1a7', '#7dbdba'],

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
