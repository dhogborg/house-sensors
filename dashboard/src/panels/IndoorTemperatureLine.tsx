import { useEffect } from 'react'

import { refresh, time, theme } from 'src/lib/config'
import { deepEqual, formatNumber } from 'src/lib/helpers'
import { useAppDispatch, useAppSelector } from 'src/lib/hooks'

import * as influxdb from 'src/lib/slices/influxdb'

import { Line, LineConfig } from '@ant-design/charts'

export default function IndoorTemperature(props: { height: number }) {
  const dispatch = useAppDispatch()
  const query: influxdb.State['query'][string] = useAppSelector(
    influxdb.selectQuery('indoor'),
    deepEqual,
  )

  useEffect(() => {
    const load = () => {
      dispatch(
        influxdb.getQuery({
          id: 'indoor',
          db: 'sensors',
          query: `SELECT mean("value") AS "mean_value" 
            FROM "sensors"."autogen"."temperature" 
            WHERE time > ${time} AND ("name"='Vardagsrum' OR "name"='Rosa_rummet' OR "name"='Gästrum' OR "name"='Värmepump') AND ("source" ='Tado' OR "source" = 'Aqara') 
            GROUP BY time(5m), "name"
            FILL(previous)`,
        }),
      )
    }

    load()

    const r = setInterval(() => {
      load()
    }, refresh)
    return () => {
      clearInterval(r)
    }
  }, [dispatch])

  let data: influxdb.Series['values'] = []
  if (query.series?.length > 0) {
    data = query.series.reduce<influxdb.Series['values']>((prev, curr) => {
      const values = curr.values.map((value, i) => {
        const nodes = [curr.values[i - 1], value, curr.values[i + 1]].filter(
          (node) => node !== undefined && node.value !== null,
        )

        const sum = nodes.reduce<number>((prev, curr, i) => {
          if (i === 0) return curr.value
          return prev + curr.value
        }, 0)

        return {
          ...value,
          value: sum / nodes.length,
        }
      })
      return prev.concat(values)
    }, [])
  }

  const config: LineConfig = {
    data: data,
    xField: 'time',
    yField: 'value',
    padding: 'auto',
    seriesField: 'category',
    theme,
    height: props.height,
    smooth: true,

    color: ['#3481c9', '#30b673', '#be3d5e', '#4e5cbc'],
    yAxis: {
      min: 15,
    },

    animation: false,

    tooltip: {
      title: (title, datum) => {
        const d = new Date(datum.time)
        return d.toLocaleDateString('sv-se') + ' ' + d.toLocaleTimeString()
      },
      formatter: (datum) => {
        return {
          name: datum.category,
          value: formatNumber(datum.value, '°', { precision: 1 }),
        }
      },
    },

    xAxis: {
      tickCount: 12,
      label: {
        formatter: (t, item, index) => {
          let d = new Date(t)
          return (
            d.getHours() +
            '.' +
            d.getMinutes() +
            (d.getMinutes() < 10 ? '0' : '')
          )
        },
      },
    },
  }

  return (
    <div className="panel">
      <Line {...config} />
    </div>
  )
}
