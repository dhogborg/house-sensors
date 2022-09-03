import { useEffect } from 'react'

import { refresh, time, theme } from '@lib/config'
import { deepEqual, formatNumber } from '@lib/helpers'
import { useAppDispatch, useAppSelector } from '@lib/hooks'

import * as influxdb from '@lib/slices/influxdb'

import { Line, LineConfig } from '@ant-design/charts'

export default function IndoorTemperature(props: { height: number }) {
  const dispatch = useAppDispatch()
  const query = useAppSelector(influxdb.selectQuery('indoor'), deepEqual)

  useEffect(() => {
    const load = () => {
      dispatch(
        influxdb.getQuery({
          id: 'indoor',
          db: 'sensors',
          query: `SELECT mean("value") AS "mean_value" FROM "sensors"."autogen"."temperature" WHERE time > ${time} AND ("name"='Värmepump' OR "name"='Rosa_rummet' OR "name"='Vardagsrum' OR "name"='Gästrum') AND ("source" ='Tado' OR "source" = 'Aqara') GROUP BY time(5m), "name" FILL(previous)`,
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
      return prev.concat(curr.values)
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
