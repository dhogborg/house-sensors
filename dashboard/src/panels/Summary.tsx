import { useEffect } from 'react'

import { deepEqual, formatNumber } from '@lib/helpers'
import { useAppDispatch, useAppSelector } from '@lib/hooks'
import * as tibber from '@lib/slices/tibber'

import * as influxdb from '@lib/slices/influxdb'
import { Col, Row } from 'antd'

export default function Summary(props: { height: number }) {
  const dispatch = useAppDispatch()
  const power = useAppSelector(influxdb.selectQuery('summary'), deepEqual)
  const todayPrice = useAppSelector(tibber.selector).today

  useEffect(() => {
    const now = new Date()
    const minutes = now.getHours() * 60 + now.getMinutes()

    const load = () => {
      const q = `SELECT mean("power") FROM "energy"."autogen"."electricity" WHERE time > now() - ${minutes}m AND "phase"='combined' GROUP BY time(1h)`
      dispatch(
        influxdb.getQuery({
          id: 'summary',
          db: 'energy',
          query: q,
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

  const hpQuery = useAppSelector(influxdb.selectQuery('heatpump'), deepEqual)

  useEffect(() => {
    const load = () => {
      const q = `SELECT "power" FROM "energy"."autogen"."heating" WHERE time > now() - 5m AND "type"='heatpump' ORDER BY time DESC LIMIT 1`
      dispatch(
        influxdb.getQuery({
          id: 'heatpump',
          db: 'energy',
          query: q,
        }),
      )
    }

    load()

    const r = setInterval(() => {
      load()
    }, 10 * 1000)
    return () => {
      clearInterval(r)
    }
  }, [dispatch])

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
    // const price = todayPrice?.[i]
    let priceNode = todayPrice.filter((n) => {
      const d1 = new Date(n.startsAt)
      const d2 = new Date(curr.time)
      if (d1.getDate() !== d2.getDate()) return false
      if (d1.getHours() !== d2.getHours()) return false
      return true
    })[0]
    return prev + (curr.value / 1000) * priceNode?.total || 0
  }, 0)

  return (
    <div className="panel" style={{ height: props.height + 'px' }}>
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
            <dd>{formatNumber(totalCost, ' SEK')}</dd>
          </dl>
        </Col>
        <Col span={12}>
          <dl>
            <dt>Värmepump: </dt>
            <dd>
              {hpQuery?.series?.[0]?.values[0].value
                ? formatNumber(hpQuery.series[0].values[0].value, ' W', {
                    precision: 0,
                  })
                : '- W'}
            </dd>
          </dl>
          <dl>
            <dt>Max kons.:</dt>
            <dd>{formatNumber(maxConsum / 1000, ' kW', { precision: 1 })}</dd>
          </dl>
          <dl>
            <dt>Producerat / max:</dt>
            <dd>0 kWh / 0 kW</dd>
          </dl>
        </Col>
      </Row>
    </div>
  )
}
