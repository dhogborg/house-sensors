import { useEffect } from 'react'

import { refresh, time, theme } from '@lib/config'
import { deepEqual, formatNumber } from '@lib/helpers'
import { useAppDispatch, useAppSelector } from '@lib/hooks'

import * as influxdb from '@lib/slices/influxdb'

import { Area, AreaConfig } from '@ant-design/charts'

export default function OutdoorTemperature(props: { height: number }) {
  const dispatch = useAppDispatch()
  const query = useAppSelector(influxdb.selectQuery('outdoor'), deepEqual)

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
        id: 'outdoor',
        db: 'sensors',
        query: `SELECT mean("value") AS "temperature" FROM "sensors"."autogen"."temperature" WHERE time > ${time} AND "name"='Outdoor' GROUP BY time(10m), "name" FILL(previous)`,
      }),
    )
  }

  let values = query.series?.[0]?.values || []
  let current = 0
  let annotation = '-'
  if (values.length > 0) {
    current = values[values.length - 1].value
    annotation = formatNumber(current, '°')
  }

  const config: AreaConfig = {
    data: values,
    xField: 'time',
    yField: 'value',
    padding: 'auto',
    color: ['#09790a'],

    line: {
      style: {
        lineWidth: 6,
      },
    },

    animation: false,

    areaStyle: () => {
      return {
        fill: 'l(270) 0:#000000 1:#09790a',
      }
    },

    tooltip: {
      formatter: (datum) => {
        return { name: datum.category, value: formatNumber(datum.value, '°') }
      },
    },

    annotations: [
      {
        type: 'text',
        content: annotation,

        position: (xScale, yScale) => {
          return [`50%`, `50%`]
        },

        style: {
          textAlign: 'center',
          fill: 'white',
          fontSize: 45,
        },

        offsetY: -10,

        background: {
          padding: 10,
          style: {
            radius: 4,
            fill:
              current > 0
                ? 'rgba(125, 227, 144, 0.6)'
                : 'rgba(92, 201, 245, 1.00)',
          },
        },
      },
    ],

    seriesField: 'category',
    theme,
    height: props.height,
    smooth: true,

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
      <Area {...config} />
    </div>
  )
}
