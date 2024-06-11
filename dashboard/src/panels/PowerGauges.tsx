import { useEffect, useMemo, useState } from 'react'

import { Gauge, GaugeConfig } from '@ant-design/charts'
import { Col, Modal, Row } from 'antd'

import { deepEqual, formatNumber } from 'src/lib/helpers'
import { useDispatch, useSelector } from 'src/lib/store'

import * as influxdb from 'src/lib/slices/influxdb'
import * as mqtt from 'src/lib/slices/mqtt'

import EnergyClock from './EnergyClock'
import { StringByDirection, StringGauges, StringsTotal } from './Strings'
import BatteryBar from './components/BatteryBar'
import { MultiGauge, MultiGaugeProps } from './components/MultiGauge'

export const ColorSolar = '#fee1a7'
export const ColorSell = '#30BF78'
export const ColorBuy = '#f85e46'

export const ColorDischarge = '#3699b5'
export const ColorCharge = '#3699b5'

export function PowerLive(props: { height: number }) {
  const dispatch = useDispatch()
  const [solarPower, setSolarPower] = useState(0)
  const [gridPower, setGridPower] = useState(0)
  const [inverterPower, setInverterPower] = useState(0)
  const [loadPower, setLoadPower] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [soc, setSoc] = useState(0)
  const [freq, setFreq] = useState(50.0)

  const [batteryData, setBatteryData] = useState({
    charge: 0,
    discharge: 0,
  })

  const mqttStatus = useSelector(mqtt.selector).topics['ehub']
  useEffect(() => {
    if (
      mqttStatus?.status === 'connected' ||
      mqttStatus?.status === 'connecting'
    ) {
      return
    }

    const subscribeSungrowPower = mqtt.subscribe({
      topic: 'sungrow/power',
      cb: (payload: any) => {
        setBatteryData(payload)
      },
    })
    dispatch(subscribeSungrowPower)

    const subscribeSungrowStats = mqtt.subscribe({
      topic: 'sungrow/stats',
      cb: (payload: any) => {
        setSoc(payload.soc ?? 0)
      },
    })
    dispatch(subscribeSungrowStats)

    const topic = 'ehub'
    const subscribeEhub = mqtt.subscribe({
      topic,
      cb: (payload: any) => {
        setSolarPower(parseFloat(payload.ppv.val))
        setInverterPower(() => {
          const p =
            parseFloat(payload.pinv['L1']) +
            parseFloat(payload.pinv['L2']) +
            parseFloat(payload.pinv['L3'])
          return p * -1
        })

        setLoadPower(() => {
          return (
            parseFloat(payload.pload['L1']) +
            parseFloat(payload.pload['L2']) +
            parseFloat(payload.pload['L3'])
          )
        })
        setGridPower(
          parseFloat(payload.pext['L1']) +
            parseFloat(payload.pext['L2']) +
            parseFloat(payload.pext['L3']),
        )
        setFreq(() => {
          const f = payload?.gridfreq?.val
          if (!isNaN(f)) {
            return parseFloat(payload.gridfreq.val)
          } else {
            return 50
          }
        })
      },
    })
    dispatch(subscribeEhub)
  }, [dispatch, mqttStatus])

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

  const batteryPower = batteryData.charge - batteryData.discharge
  const generation = inverterPower + batteryPower * 0.95

  let estimLoad = gridPower + generation
  const loadQ = estimLoad / loadPower

  // 10% difference
  if (Math.abs(loadQ - 1) < 0.5 || Math.abs(batteryPower) > 1) {
    estimLoad = loadPower
  }

  return (
    <div className="panel">
      <div className="power-gauge-component">
        <div
          className="sine"
          style={{
            position: 'absolute',
            left: '10px',
            top: '5px',
          }}
        >
          {freq > 50.1 || freq < 49.9 ? (
            <span>⚠️</span>
          ) : (
            <span style={{ fontSize: 22 }}>∿</span>
          )}{' '}
          {freq.toFixed(2)}
        </div>
        <EnergyClock
          height={props.height}
          onClick={() => setModalOpen(true)}
          pv={solarPower}
          usage={Math.max(0, estimLoad)}
          grid={gridPower}
          battery={batteryPower}
        />
        <BatteryBar
          height={props.height * 0.8}
          color="#4a8fc3"
          percentage={soc}
        />
      </div>
      {modal}
    </div>
  )
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

  const power = query.series?.[0]?.values?.[0]?.value ?? 0
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
