import { useEffect } from 'react'
import { batch } from 'react-redux'

import { refresh, theme } from 'src/lib/config'
import { formatNumber } from 'src/lib/helpers'
import { useAppDispatch, useAppSelector } from 'src/lib/hooks'

import * as influxdb from 'src/lib/slices/influxdb'
import * as tibber from 'src/lib/slices/tibber'

import { Column, ColumnConfig } from '@ant-design/charts'

export default function PowerUseBars(props: { height: number }) {
  const dispatch = useAppDispatch()

  const heatpumpValues = useAppSelector(
    influxdb.selectSeriesValues('heatpumpConsumed', 0),
  )
  const totalValues = useAppSelector(
    influxdb.selectSeriesValues('totalConsumed', 0),
  )

  const priceState = useAppSelector(tibber.selector)

  useEffect(() => {
    const tzOffset = '-60m' //`${new Date().getTimezoneOffset()}m`
    const load = () => {
      batch(() => {
        dispatch(
          influxdb.getFluxQuery({
            id: 'heatpumpConsumed',
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
            id: 'totalConsumed',
            category: 'Total',
            query: `
          from(bucket: "energy/autogen")
            |> range(start: -23h)
            |> filter(fn: (r) => r._measurement == "grid" and (r._field == "power"))
            |> filter(fn: (r) => r.phase == "combined")
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
    if (i === heatpumpValues.values.length - 1) {
      kwh = (new Date().getMinutes() / 60) * kwh
    }
    return {
      ...hpValue,
      value: kwh,
    }
  })

  // minimum graph value
  const minValue = totalValues?.reduce((prev, curr) => {
    const currKwh = curr.value / 1000
    if (currKwh < prev) {
      return currKwh
    }
    return prev
  }, -1.1)

  const totalData = totalValues?.map((totValue, i) => {
    let kwh = Math.round(totValue.value) / 1000

    // last hour isn't complete, so we have to factor in the percentage of the hour that has passed
    if (i === totalValues.values.length - 1) {
      const hourPassed = new Date().getMinutes() / 60
      kwh = hourPassed * kwh
    }

    return {
      time: totValue.time,
      category: totValue.category,
      value: kwh,
    }
  })

  let data: influxdb.Series['values'] = []
  if (totalData) {
    data = data.concat(totalData)
  }
  if (heatpumpData) {
    data = data.concat(heatpumpData)
  }

  let annotations: ColumnConfig['annotations'] = [
    {
      type: 'line',
      start: ['min', 0],
      end: ['max', 0],
      style: {
        lineWidth: 1,
        stroke: '#454545',
      },
    },
  ]

  annotations = annotations.concat(
    totalValues.map((hour, i) => {
      let kwh = hour.value / 1000
      const time = hour.time

      let priceNode = priceState.nodes.filter((n) => {
        const d1 = new Date(n.startsAt)
        const d2 = new Date(time)
        if (d1.getDate() !== d2.getDate()) return false
        if (d1.getHours() !== d2.getHours()) return false
        return true
      })[0]

      if (i === totalValues.length - 1) {
        // last hour isn't complete, so factor in the percentage of the hour that has passed
        kwh = (new Date().getMinutes() / 60) * kwh
        priceNode = tibber.now(priceState.today)
      }

      let price = 0
      if (priceNode) {
        price = kwh > 0 ? priceNode.total : priceNode.total - priceNode.tax
      }

      let priceStr = ''
      if (priceNode) {
        priceStr = Number(kwh * price).toFixed(2)
      }

      let fill = 'rgba(0,0,0,0)'
      if (priceNode?.total !== undefined) fill = priceFill(kwh * price)

      return {
        type: 'text',
        content: priceStr,

        position: (xScale, yScale: any) => {
          const left = 2 + i * 4.1666

          const range = yScale.value.max - yScale.value.min
          const zeroLine = yScale.value.max / range

          let top = 0
          if (kwh > 0) {
            top = zeroLine * 100 + 18
          } else {
            top = zeroLine * 100
          }

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

    annotations,

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
      minLimit: minValue,
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
      <Column {...config} />
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
  const hue = Number(minHue + step * percent).toFixed(0)

  return `hsl(${hue}, 70%, 70%)`
}
