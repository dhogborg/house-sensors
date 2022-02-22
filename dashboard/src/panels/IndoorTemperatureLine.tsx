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
        id: 'indoor',
        db: 'sensors',
        query: `SELECT mean("value") AS "mean_value" FROM "sensors"."autogen"."temperature" WHERE time > ${time} AND ("name"='Värmepump' OR "name"='Övervåning' OR "name"='Vardagsrum') AND ("source" ='Tado' OR "source" = 'Aqara') GROUP BY time(5m), "name" FILL(previous)`,
      }),
    )
  }

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

    color: ['#30b673', '#be3d5e', '#4e5cbc'],
    yAxis: {
      min: 15,
    },

    animation: false,

    tooltip: {
      formatter: (datum) => {
        return {
          name: datum.category,
          value: formatNumber(datum.value, '°', { precision: 1 }),
        }
      },
    },

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
      <Line {...config} />
    </div>
  )
}
