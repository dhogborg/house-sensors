import { useEffect } from 'react'

import { deepEqual, formatNumber } from '@lib/helpers'
import { useAppDispatch, useAppSelector } from '@lib/hooks'

import * as influxdb from '@lib/slices/influxdb'

import {
  Area,
  AreaConfig,
  Column,
  ColumnConfig,
  Gauge,
  GaugeConfig,
  Line,
  LineConfig,
} from '@ant-design/charts'

const time = 'now() - 24h'
const theme = 'dark'
const refresh = 600 * 1000

export function OutdoorTemperature(props: { height: number }) {
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

export function IndoorTemperature(props: { height: number }) {
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

export function PowerCombined(props: { height: number }) {
  const dispatch = useAppDispatch()
  const query = useAppSelector(influxdb.selectQuery('power'), deepEqual)

  useEffect(() => {
    load()

    const r = setInterval(() => {
      load()
    }, 10 * 1000)
    return () => {
      clearInterval(r)
    }
  }, [])

  const load = () => {
    dispatch(
      influxdb.getQuery({
        id: 'power',
        db: 'energy',
        query: `SELECT "power" FROM "energy"."autogen"."electricity" WHERE time > now() - 1m AND "phase"='combined' ORDER BY time DESC LIMIT 1`,
      }),
    )
  }

  const power = query.series?.[0]?.values?.[0]?.value || 0
  const max = 9000
  const percent = power / max

  const config: GaugeConfig = {
    height: props.height,
    percent: percent,

    radius: 0.75,
    range: {
      color: percent === 0 ? '#e5e5e5' : '#30BF78',
      width: 12,
    },
    indicator: undefined,

    statistic: {
      content: {
        offsetY: -50,
        style: {
          fontSize: '24px',
          color: 'white',
        },
        formatter: (datum, data) => {
          const watts = Number(datum!.percent * max)
          if (watts > 1000) {
            return formatNumber(watts / 1000, ' kW', { precision: 2 })
          }
          return formatNumber(watts, ' W', { precision: 0 })
        },
      },
      title: {
        offsetY: 1,
        style: {
          fontSize: '14px',
          color: '#ddd',
        },
        formatter: (datum, data) => {
          return 'Nuvarande förbrk.'
        },
      },
    },
    gaugeStyle: {
      lineCap: 'round',
    },
  }

  return (
    <div className="panel">
      <Gauge {...config} />
    </div>
  )
}

export function PowerHeatPump(props: { height: number }) {
  const dispatch = useAppDispatch()
  const query = useAppSelector(influxdb.selectQuery('heatpump'), deepEqual)

  useEffect(() => {
    load()

    const r = setInterval(() => {
      load()
    }, 10 * 1000)
    return () => {
      clearInterval(r)
    }
  }, [])

  const load = () => {
    dispatch(
      influxdb.getQuery({
        id: 'heatpump',
        db: 'energy',
        query: `SELECT "power" FROM "energy"."autogen"."heating" WHERE time > now() - 1m AND "type"='heatpump' ORDER BY time DESC LIMIT 1`,
      }),
    )
  }

  const max = 2200
  const power = query.series?.[0]?.values?.[0]?.value || 0
  const percent = power / max

  const config: GaugeConfig = {
    height: props.height,
    percent: percent,

    radius: 0.75,
    range: {
      color: percent === 0 ? '#e5e5e5' : '#30BF78',
      width: 12,
    },
    indicator: undefined,

    statistic: {
      content: {
        offsetY: -50,
        style: {
          fontSize: '24px',
          color: 'white',
        },
        formatter: (datum, data) => {
          return `${Number(datum!.percent * max).toFixed(0)} W`
        },
      },
      title: {
        offsetY: 1,
        style: {
          fontSize: '14px',
          color: '#ddd',
        },
        formatter: (datum, data) => {
          return 'Värmepump'
        },
      },
    },
    gaugeStyle: {
      lineCap: 'round',
    },
  }

  return (
    <div className="panel">
      <Gauge {...config} />
    </div>
  )
}

export function PowerUse(props: { height: number }) {
  const dispatch = useAppDispatch()

  const heatpumpQuery = useAppSelector(
    influxdb.selectQuery('heatpumpConsumed'),
    deepEqual,
  )
  const totalQuery = useAppSelector(
    influxdb.selectQuery('totalConsumed'),
    deepEqual,
  )

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
