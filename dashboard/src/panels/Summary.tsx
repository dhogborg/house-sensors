import { useEffect, useState } from 'react'

import { deepEqual, formatNumber } from '@lib/helpers'
import { useAppDispatch, useAppSelector } from '@lib/hooks'
import * as tibber from '@lib/slices/tibber'

import mqtt from 'precompiled-mqtt'

import * as influxdb from '@lib/slices/influxdb'
import { Col, Row } from 'antd'
import { SerializedError } from '@reduxjs/toolkit'

export default function Summary(props: { height: number }) {
  const dispatch = useAppDispatch()
  const power = useAppSelector(influxdb.selectQuery('summary'), deepEqual)
  const monthHours = useAppSelector(
    influxdb.selectQuery('month_summary'),
    deepEqual,
  )
  const todayPrice = useAppSelector(tibber.selector).today
  const [altView, setAltView] = useState(false)

  useEffect(() => {
    const now = new Date()
    const sinceMidnight = now.getHours() * 60 + now.getMinutes()
    const firstOtMonth = now.getDate() * 24 * 60 + now.getMinutes()

    const load = () => {
      dispatch(
        influxdb.getQuery({
          id: 'summary',
          db: 'energy',
          query: `SELECT mean("power") FROM "energy"."autogen"."electricity" WHERE time > now() - ${sinceMidnight}m AND "phase"='combined' GROUP BY time(1h)`,
        }),
      )

      dispatch(
        influxdb.getQuery({
          id: 'month_summary',
          db: 'energy',
          query: `SELECT mean("power") FROM "energy"."autogen"."electricity" WHERE time > now() - ${firstOtMonth}m AND "phase"='combined' GROUP BY time(1h)`,
        }),
      )
    }

    load()

    const r = setInterval(() => {
      load()
    }, 2 * 60 * 1000)
    return () => {
      clearInterval(r)
    }
  }, [dispatch])

  const [heatPower, setHeatPower] = useState<number | undefined>(undefined)
  useEffect(() => {
    const client = mqtt.connect('mqtt://192.168.116.232:8083')

    client.on('connect', function () {
      console.log('connected zigbee')

      client.subscribe(
        'zigbee2mqtt/0x0004740000847cf5',
        function (err: SerializedError) {
          if (err) {
            console.error(err)
          }
        },
      )
    })

    client.on('message', function (topic: string, message: any) {
      // message is Buffer
      const payload = JSON.parse(message.toString())

      let power = payload.apparentPower - 37
      if (power < 0) {
        power = 0
      } else {
        power = power * 0.93
      }

      setHeatPower(power)
    })
    return () => {
      client.end()
    }
  }, [setHeatPower])

  const hours = power?.series?.[0]?.values

  const consumed = hours?.reduce((prev, curr) => {
    return prev + curr.value
  }, 0)

  let maxConsum = 0
  hours?.forEach((h) => {
    if (h.value > maxConsum) {
      maxConsum = h.value
    }
  })

  const totalCost = hours?.reduce((prev, curr, i) => {
    let priceNode = todayPrice.find((n) => {
      const d1 = new Date(n.startsAt)
      const d2 = new Date(curr.time)
      if (d1.getDate() !== d2.getDate()) return false
      if (d1.getHours() !== d2.getHours()) return false
      return true
    })
    if (!priceNode) {
      return prev
    }

    // this hour of the day?
    let factor = 1
    if (hours.length === i + 1) {
      factor = new Date().getMinutes() / 60
    }

    return prev + (curr.value / 1000) * priceNode.total * factor
  }, 0)

  const highHour = monthHours?.series?.[0]?.values.reduce((prev, curr) => {
    if (curr.value > prev) return curr.value
    return prev
  }, 0)

  return (
    <div
      className="panel"
      style={{ height: props.height + 'px' }}
      onClick={() => {
        setAltView((state) => {
          return !state
        })
      }}
    >
      <Row>
        <Col span={12}>
          <dl>
            <dt>Förbrukat: </dt>
            <dd>{formatNumber(consumed / 1000, ' kWh', { precision: 1 })}</dd>
          </dl>
          <dl>
            <dt>Köpt:</dt>
            <dd>{formatNumber(consumed / 1000, ' kWh', { precision: 1 })}</dd>
          </dl>
          <dl>
            <dt>Kostnad:</dt>
            <dd>
              {!altView
                ? formatNumber(totalCost, ' SEK')
                : formatNumber(totalCost / (consumed / 100000), ' öre/kWh', {
                    precision: 0,
                  })}
            </dd>
          </dl>
        </Col>
        <Col span={12}>
          <dl>
            <dt>Värmepump: </dt>
            <dd>
              {heatPower === undefined
                ? '- W'
                : formatNumber(heatPower, ' W', {
                    precision: 0,
                  })}
            </dd>
          </dl>
          <dl>
            <dt>Prod. / peak:</dt>
            <dd>0 kWh / 0 kW</dd>
          </dl>
          <dl>
            <dt>Max kons.:</dt>
            <dd>
              {!altView ? (
                <>
                  {formatNumber(highHour / 1000, ' kW', { precision: 1 })}
                  {' / '}
                  {formatNumber(maxConsum / 1000, ' kW', { precision: 1 })}
                </>
              ) : (
                <>
                  {formatNumber((highHour / 1000) * 35, ' SEK', {
                    precision: 0,
                  })}
                </>
              )}
            </dd>
          </dl>
        </Col>
      </Row>
    </div>
  )
}
