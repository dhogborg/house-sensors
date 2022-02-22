import { useEffect } from 'react'

import { refresh, time, theme } from '@lib/config'
import { deepEqual, formatNumber } from '@lib/helpers'
import { useAppDispatch, useAppSelector } from '@lib/hooks'

import * as influxdb from '@lib/slices/influxdb'
import * as tibber from '@lib/slices/tibber'

import { Column, ColumnConfig } from '@ant-design/charts'

export default function PowerUseBars(props: { height: number }) {
  const dispatch = useAppDispatch()

  const heatpumpQuery = useAppSelector(
    influxdb.selectQuery('heatpumpConsumed'),
    deepEqual,
  )
  const totalQuery = useAppSelector(
    influxdb.selectQuery('totalConsumed'),
    deepEqual,
  )
  const priceState = useAppSelector(tibber.selector)

  useEffect(() => {
    load()

    const r = setInterval(() => {
      load()
    }, refresh)
    return () => {
      clearInterval(r)
    }
  }, [])

  const load = () => {
    dispatch(
      influxdb.getQuery({
        id: 'heatpumpConsumed',
        db: 'energy',
        categories: ['Värmepump'],
        query: `SELECT mean("power") as "Heating" FROM "energy"."autogen"."heating" WHERE time > ${time} AND "type"='heatpump' GROUP BY time(1h) FILL(0)`,
      }),
    )
    dispatch(
      influxdb.getQuery({
        id: 'totalConsumed',
        db: 'energy',
        categories: ['Övrigt'],
        query: `SELECT mean("power") as "Consumption" FROM "energy"."autogen"."electricity" WHERE time > ${time} AND "phase"='combined' GROUP BY time(1h) FILL(0)`,
      }),
    )
  }

  const heatpumpSeries = heatpumpQuery.series?.[0]
  const heatpumpData = heatpumpSeries?.values.map((hpValue, i) => {
    let kwh = Math.round(hpValue.value) / 1000
    if (i == heatpumpSeries.values.length - 1) {
      kwh = (new Date().getMinutes() / 60) * kwh
    }
    return {
      ...hpValue,
      value: kwh,
    }
  })

  const totalSeries = totalQuery.series?.[0]
  const total = totalSeries?.values || []

  // renaming total to to other since we subtract some sources from total
  const other = totalSeries?.values.map((totValue, i) => {
    let kwh = Math.round(totValue.value) / 1000

    const hpValue = heatpumpSeries?.values?.[i]?.value || 0
    const hpKwh = Math.round(hpValue) / 1000

    // subtract the known consumers
    if (kwh - hpKwh > 0) {
      kwh = kwh - hpKwh
    }

    if (i == totalSeries.values.length - 1) {
      kwh = (new Date().getMinutes() / 60) * kwh
    }

    return {
      ...totValue,
      value: kwh,
    }
  })

  let data: influxdb.Series['values'] = []
  if (other && heatpumpData) {
    data = data.concat(other).concat(heatpumpData)
  }

  const config: ColumnConfig = {
    data,
    isStack: true,
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
      formatter: (datum) => {
        return {
          name: datum.category,
          value: formatNumber(datum.value, ' kWh'),
        }
      },
    },

    annotations: total.map((hour, i) => {
      let kwh = hour.value / 1000
      const time = hour.time

      if (i == total.length - 1) {
        kwh = (new Date().getMinutes() / 60) * kwh
      }

      let priceNode = priceState.today.filter((n) => {
        const d1 = new Date(n.startsAt)
        const d2 = new Date(time)
        if (d1.getDate() !== d2.getDate()) return false
        if (d1.getHours() !== d2.getHours()) return false
        return true
      })[0]

      let price = '-'
      if (priceNode) {
        price = Number(kwh * priceNode.total).toFixed(2)
      }

      return {
        type: 'text',
        content: price,

        position: (xScale, yScale: any) => {
          return [
            `${i * 4}%`,
            `${100 - Math.round((kwh / yScale.value.max) * 100)}%`,
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
            fill: '#f890a1',
          },
        },
      }
    }),

    xAxis: {
      type: 'time',
      tickCount: 24,
      label: {
        formatter: (t, item, index) => {
          let d = new Date(Number(item.id))
          return d.getHours()
        },
      },
    },
  }

  return (
    <div className="panel">
      <Column {...config} />
    </div>
  )
}
