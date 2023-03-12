import { useEffect, useState } from 'react'

import mqtt from 'precompiled-mqtt'

import { refresh, time, theme } from 'src/lib/config'
import { formatNumber } from 'src/lib/helpers'
import { useAppDispatch, useAppSelector } from 'src/lib/hooks'

import * as influxdb from 'src/lib/slices/influxdb'

import { Line, LineConfig } from '@ant-design/charts'
import { SerializedError } from '@reduxjs/toolkit'
import { MultiGauge } from './components/MultiGuage'
import { Col, Row } from 'antd'

interface Sso {
  voltage: number
  temperature: number
  power: number
}

const empty = {
  voltage: 0,
  temperature: 0,
  power: 0,
}

export const StringGauges = (props: { height: number }) => {
  const [east, setEast] = useState<Sso>(empty)
  const [west, setWest] = useState<Sso>(empty)
  const [north, setNorth] = useState<Sso>(empty)

  useEffect(() => {
    const client = mqtt.connect('mqtt://192.168.116.232:8083')

    client.on('connect', function () {
      console.log('mqtt connected')

      client.subscribe('sso', function (err: SerializedError) {
        if (err) {
          console.error(err)
        }
        console.log('subscribed topic: sso')
      })
    })

    client.on('message', function (topic: string, message: any) {
      // message is Buffer
      const payload = JSON.parse(message.toString())
      const values = {
        voltage: parseFloat(payload.udc.val),
        temperature: parseFloat(payload.temp.val),
        power: parseFloat(payload.upv.val) * parseFloat(payload.ipv.val),
      }

      switch (payload.id.val) {
        case 'PS00990-A04-S21120152': // West
          setWest((v) => values)
          break
        case 'PS00990-A04-S22010020': // East
          setEast((v) => values)
          break
        case 'PS00990-A04-S22010101': // North
          setNorth((v) => values)
          break
      }
    })
    return () => {
      client.end()
    }
  }, [])

  return (
    <div className="panel">
      <Row>
        <Col span={8}>
          <SsoGauge height={props.height} sso={east} max={5200} title="Öst" />
        </Col>
        <Col span={8}>
          <SsoGauge height={props.height} sso={north} max={6370} title="Norr" />
        </Col>
        <Col span={8}>
          <SsoGauge height={props.height} sso={west} max={4800} title="Väst" />
        </Col>
      </Row>
    </div>
  )
}

function SsoGauge(props: {
  title: string
  height: number
  sso: Sso
  max: number
}) {
  const { power, temperature } = props.sso
  const percentage = (power / props.max) * 100
  return (
    <MultiGauge
      height={props.height}
      arcWidth={10}
      auxStyle={'25px sans-serif'}
      mainStyle={'40px sans-serif'}
      elements={[{ percentage, width: 20, color: '#fee1a7' }]}
      consume={() => {
        return formatPower(power)
      }}
      grid={() => {
        return formatNumber(temperature, '°', { precision: 1 })
      }}
      title={props.title}
    />
  )
}

export const StringByDirection = (props: { height: number }) => {
  const dispatch = useAppDispatch()
  const strings = useAppSelector(influxdb.selectQuery('strings'))

  useEffect(() => {
    const load = () => {
      const from = new Date()
      from.setHours(6, 0, 0, 0)
      const to = new Date()
      to.setHours(21, 0, 0, 0)

      dispatch(
        influxdb.getQuery({
          id: 'strings',
          db: 'energy',
          query: `SELECT mean("power") AS "mean_power"
            FROM "energy"."autogen"."sso"
            WHERE time > '${from.toISOString()}' AND time < '${to.toISOString()}'
            GROUP BY time(1m), "direction" FILL(null)`,
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
  if (strings.series) {
    data = strings.series
      .map<[string, influxdb.Series['values']]>((series) => {
        return [series.tags.direction, series.values]
      })
      .map(([direction, values]) => {
        return values.map((v) => {
          return {
            ...v,
            category: direction,
          }
        })
      })
      .reduce((prev, curr) => {
        return prev.concat(curr)
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
    legend: false,

    color: (datum) => {
      switch (datum.category) {
        case 'west':
          return '#3481c9'
        case 'east':
          return '#be3d5e'
        case 'north':
        default:
          return '#30b673'
      }
    },
    yAxis: {
      min: 0,
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
          value: formatNumber(datum.value / 1000, ' kW', { precision: 1 }),
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

export const StringsTotal = (props: { height: number }) => {
  const dispatch = useAppDispatch()
  const values = useAppSelector(
    influxdb.selectSeriesValues('strings_combined', 0),
  )

  useEffect(() => {
    const load = () => {
      const from = new Date()
      from.setHours(6, 0, 0, 0)
      const to = new Date()
      to.setHours(21, 0, 0, 0)

      dispatch(
        influxdb.getQuery({
          id: 'strings_combined',
          db: 'energy',
          query: `SELECT mean("power") AS "mean_power" 
              FROM "energy"."autogen"."pv" 
              WHERE time > '${from.toISOString()}' AND time < '${to.toISOString()}'
              GROUP BY time(1m) FILL(null)`,
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
  if (values) {
    data = values
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
    legend: false,

    color: ['#fee1a7'],
    yAxis: {
      min: 0,
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
          value: formatNumber(datum.value / 1000, ' kW', { precision: 1 }),
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

function formatPower(power: number): string {
  if (power > 999 || power < -999) {
    return formatNumber(power / 999, ' kW', { precision: 1 })
  }
  return formatNumber(power, ' W', { precision: 0 })
}
