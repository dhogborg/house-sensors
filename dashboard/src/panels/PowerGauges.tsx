import { useEffect, useMemo, useState } from 'react'

import { Gauge, GaugeConfig } from '@ant-design/charts'
import { Col, Modal, Row } from 'antd'

import { deepEqual, formatNumber } from 'src/lib/helpers'
import { useDispatch, useSelector } from 'src/lib/store'

import * as influxdb from 'src/lib/slices/influxdb'
import * as mqtt from 'src/lib/slices/mqtt'

import { StringByDirection, StringGauges, StringsTotal } from './Strings'
import { MultiGauge } from './components/MultiGuage'

export const ColorSolar = '#fee1a7'
export const ColorSell = '#30BF78'
export const ColorBuy = '#f85e46'

export function PowerLive(props: { height: number }) {
  const dispatch = useDispatch()
  const [solarPower, setSolarPower] = useState(0)
  const [consumePower, setConsumePower] = useState(0)
  const [gridPower, setGridPower] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)

  const mqttStatus = useSelector(mqtt.selector).topics['ehub']
  useEffect(() => {
    if (
      mqttStatus?.status === 'connected' ||
      mqttStatus?.status === 'connecting'
    ) {
      return
    }

    const topic = 'ehub'
    const subscribe = mqtt.subscribe({
      topic,
      cb: (payload: any) => {
        setSolarPower(() => {
          return parseFloat(payload.ppv.val)
        })
        setConsumePower(() => {
          return (
            parseFloat(payload.pload['L1']) +
            parseFloat(payload.pload['L2']) +
            parseFloat(payload.pload['L3'])
          )
        })
        setGridPower(() => {
          return (
            parseFloat(payload.pext['L1']) +
            parseFloat(payload.pext['L2']) +
            parseFloat(payload.pext['L3'])
          )
        })
      },
    })
    dispatch(subscribe)
  }, [dispatch, mqttStatus])

  const max = 11_000

  const modal = useMemo(() => {
    return (
      <Modal
        title="Solar Strings"
        centered
        visible={modalOpen}
        onOk={() => setModalOpen(false)}
        okText="Close"
        onCancel={() => setModalOpen(false)}
        width={850}
      >
        <Row>
          <Col xs={24}>
            <StringGauges height={175} />
          </Col>
          <Col xs={24} md={12}>
            <StringsTotal height={250} />
          </Col>
          <Col xs={24} md={12}>
            <StringByDirection height={250} />
          </Col>
        </Row>
      </Modal>
    )
  }, [modalOpen])

  const elements = []
  if (solarPower > consumePower) {
    // push a selling colored bar and a solar generating bar
    elements.push({
      percentage: (solarPower / max) * 100,
      color: ColorSell,
      z: 2,
    })
    elements.push({
      percentage: (consumePower / max) * 100,
      color: ColorSolar,
      z: 1,
    })
  } else {
    // push a buy-bar, a consume bar and a solar bar
    elements.push({
      percentage: (consumePower / max) * 100,
      color: ColorBuy,
      z: 2,
    })
    elements.push({
      percentage: (solarPower / max) * 100,
      color: ColorSolar,
      z: 1,
    })
  }

  return (
    <div className="panel">
      <MultiGauge
        height={props.height}
        elements={elements}
        onClick={() => setModalOpen(true)}
        consume={() => {
          return formatPower(consumePower)
        }}
        solar={() => {
          return '☀️ ' + formatPower(solarPower)
        }}
        grid={() => {
          if (solarPower === 0) {
            return ''
          }
          return '⚡️ ' + formatPower(gridPower)
        }}
        title="Nuvarande förbrk."
      />
      {modal}
    </div>
  )
}

function formatPower(power: number): string {
  if (power > 999 || power < -999) {
    return formatNumber(power / 999, ' kW', { precision: 2 })
  }
  return formatNumber(power, ' W', { precision: 0 })
}

export function PowerCombined(props: { height: number }) {
  const dispatch = useDispatch()
  const query: influxdb.State['query'][string] = useSelector(
    influxdb.selectQuery('power'),
    deepEqual,
  )

  useEffect(() => {
    const load = () => {
      dispatch(
        influxdb.getQuery({
          id: 'power',
          db: 'energy',
          query: `SELECT "power" FROM "energy"."autogen"."electricity" WHERE time > now() - 1m AND "phase"='combined' ORDER BY time DESC LIMIT 1`,
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
  const dispatch = useDispatch()
  const query = useSelector(influxdb.selectQuery('heatpump'), deepEqual)

  useEffect(() => {
    const load = () => {
      dispatch(
        influxdb.getQuery({
          id: 'heatpump',
          db: 'energy',
          query: `SELECT "power" FROM "energy"."autogen"."heating" WHERE time > now() - 5m AND "type"='heatpump' ORDER BY time DESC LIMIT 1`,
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
