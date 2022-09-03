import { useEffect } from 'react'

import { theme } from '@lib/config'
import { deepEqual, formatNumber } from '@lib/helpers'
import { useAppDispatch, useAppSelector } from '@lib/hooks'

import * as influxdb from '@lib/slices/influxdb'
import * as yr from '@lib/slices/yr'

import { Area, AreaConfig } from '@ant-design/charts'

const SECONDS = 1000

export default function OutdoorTemperature(props: { height: number }) {
  const dispatch = useAppDispatch()
  const query = useAppSelector(influxdb.selectQuery('outdoor'), deepEqual)
  const weatherState = useAppSelector(yr.selector)

  useEffect(() => {
    const load = () => {
      dispatch(
        influxdb.getQuery({
          id: 'outdoor',
          db: 'sensors',
          query: `SELECT mean("value") AS "temperature" FROM "sensors"."autogen"."temperature" WHERE time > now() - 24h AND "name"='Outdoor' GROUP BY time(10m), "name" FILL(previous)`,
        }),
      )
    }

    load()

    const r = setInterval(() => {
      load()
    }, 10 * 60 * SECONDS)
    return () => {
      clearInterval(r)
    }
  }, [dispatch])

  useEffect(() => {
    const load = () => {
      dispatch(yr.get())
    }
    load()

    const r = setInterval(() => {
      load()
    }, 30 * 60 * SECONDS)
    return () => {
      clearInterval(r)
    }
  }, [dispatch])

  let values = query.series?.[0]?.values || []
  let current = 0
  let annotation = '-'
  if (values.length > 0) {
    current = values[values.length - 1].value
    annotation = formatNumber(current, '°')
  }

  let weather = ''
  if (weatherState.lowTemp?.air_temperature) {
    weather += `${Math.floor(weatherState.lowTemp.air_temperature)}°`
  }

  if (weatherState.highTemp?.air_temperature) {
    weather += ` - ${Math.ceil(weatherState.highTemp.air_temperature)}°`
  }
  const symbolSrc = `/weathericon/svg/${weatherState.current?.symbol_12h}.svg`

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
        type: 'line',
        start: ['min', 0],
        end: ['max', 0],
        style: {
          lineWidth: 2,
          stroke: 'rgba(92, 201, 245, 0.50)',
          lineDash: [0, 0],
        },
      },
      {
        type: 'html',
        html: `<img class="yr-weather-symbol" src=${symbolSrc} alt="${weatherState.current?.symbol_12h}" />`,

        position: [`50%`, `60%`],

        top: true,
      },
      {
        type: 'text',
        content: weather,

        position: (xScale, yScale) => {
          return [`53%`, `55%`]
        },

        style: {
          textAlign: 'center',
          fill: 'white',
          fontSize: 15,
        },
        background: {
          padding: 5,
        },
      },

      {
        type: 'text',
        content: annotation,

        position: (xScale, yScale) => {
          return [`53%`, `35%`]
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
