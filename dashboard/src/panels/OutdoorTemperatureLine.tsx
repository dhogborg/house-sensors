import { useEffect } from 'react'

import { Area, AreaConfig } from '@ant-design/charts'

import { theme } from 'src/lib/config'
import { deepEqual, formatNumber } from 'src/lib/helpers'
import { useDispatch, useSelector } from 'src/lib/store'

import * as influxdb from 'src/lib/slices/influxdb'
import * as yr from 'src/lib/slices/yr'

const SECONDS = 1000

export default function OutdoorTemperature(props: { height: number }) {
  const dispatch = useDispatch()
  const query: influxdb.State['query'][string] = useSelector(
    influxdb.selectQuery('outdoor'),
    deepEqual,
  )
  const weatherState = useSelector(yr.selector)

  useEffect(() => {
    const load = () => {
      dispatch(
        influxdb.getQuery({
          id: 'outdoor',
          db: 'sensors',
          query: `SELECT mean("value") AS "temperature" 
                  FROM "sensors"."autogen"."temperature" 
                  WHERE time > now() - 24h AND "name"='Outdoor' AND "source" != 'pi-probe'
                  GROUP BY time(10m), "source" FILL(previous)`,
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

  let current: {
    [key: string]: number
  } = {}
  let values: influxdb.Series['values'] = []

  if (query.series) {
    values = query.series.reduce<influxdb.Series['values']>((prev, series) => {
      if (series.tags.source === 'PiProbe') {
        current.piprobe = series.values[series.values.length - 1]?.value
      }
      if (series.tags.source === 'Aqara') {
        current.aqara = series.values[series.values.length - 1]?.value
      }

      return prev.concat(
        series.values.map((v) => {
          return {
            ...v,
            category: series.tags.source,
          }
        }),
      )
    }, [])

    const timeIndex: { [key: string]: influxdb.Series['values'] } = {}
    values.forEach((node) => {
      const t = node.time
      if (!timeIndex[t]) {
        timeIndex[t] = []
      }
      if (typeof node.value === 'number') {
        timeIndex[t].push(node)
      }
    })

    const means: influxdb.Series['values'] = []
    Object.entries(timeIndex).forEach(([t, nodes]) => {
      const mean =
        nodes.length > 0
          ? nodes.reduce<number>((prev, curr, i) => {
              if (i === 0) {
                return curr.value
              }
              return (prev + curr.value) / 2
            }, 0)
          : null

      if (mean !== null) {
        means.push({
          category: 'Mean',
          time: t,
          value: mean,
        })
      }
    })

    // do a round of smoothing on the means
    means.forEach((node, i) => {
      // average with the adjacent values
      if (i < means.length - 1) {
        const next = means[i + 1].value
        const v = means[i].value
        means[i].value = (v + next) / 2
      }
    })
    values = means.concat(values)
  }

  let annotation = '-'

  const meanCount = Object.keys(current).length
  const currentMean = Object.keys(current)
    .map((k) => current[k])
    .reduce((prev, curr) => {
      return prev + curr
    }, 0)

  if (meanCount > 0) {
    annotation = formatNumber(currentMean / meanCount, '°', { precision: 1 })
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

    color: (datum) => {
      switch (datum.category) {
        case 'Mean':
          return 'rgba(9, 121, 10,1)'
        default:
          return 'rgba(9, 121, 119, 0.2)'
      }
    },
    isStack: false,

    state: {},
    line: {
      style: {
        lineWidth: 6,
      },
    },

    animation: false,

    areaStyle: (value) => {
      switch (value.category) {
        case 'Mean':
          return {
            fill: 'l(270) 0:#000000 1:#09790a',
          }
        default:
          return {
            fill: 'rgba(0,0,0,0)',
          }
      }
    },

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

        position: [`50%`, `50%`],

        top: true,
      },
      {
        type: 'text',
        content: weather,

        position: (xScale, yScale) => {
          return [`53%`, `45%`]
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
          return [`53%`, `25%`]
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
              current === undefined || currentMean > 0
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
      <Area {...config} />
    </div>
  )
}
