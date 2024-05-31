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

    const subscribeSungrow = mqtt.subscribe({
      topic: 'sungrow/stats',
      cb: (payload: any) => {
        setBatteryData({
          charge: payload?.batteryCharge ?? 0 * 1000,
          discharge: payload?.batteryDischarge ?? 0 * 1000,
        })
        setSoc(payload?.batteryLevel ?? 0)
      },
    })
    dispatch(subscribeSungrow)

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
      },
    })
    dispatch(subscribeEhub)
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

  // const elements: MultiGaugeProps['elements'] = []

  const batteryPower = batteryData.discharge - batteryData.charge
  const generation = inverterPower + batteryPower * 0.95

  let estimLoad = gridPower + generation
  const loadQ = estimLoad / loadPower

  // console.log({
  //   loadQ: Math.abs(loadQ - 1).toFixed(3),
  //   estimLoad: Math.floor(estimLoad),
  //   loadPower: Math.floor(loadPower),
  //   gridPower: Math.floor(gridPower),
  //   batteryPower: Math.floor(batteryPower),
  // })

  // 10% difference
  if (Math.abs(loadQ - 1) < 0.5 || Math.abs(batteryPower) < 1) {
    estimLoad = loadPower
  }

  // if (gridPower < 0) {
  //   elements.push({
  //     percentage: ((estimLoad + Math.abs(gridPower)) / max) * 100,
  //     color: ColorSell,
  //     z: 2,
  //   })
  //   elements.push({
  //     percentage: (estimLoad / max) * 100,
  //     color: ColorSolar,
  //     z: 10,
  //   })
  // } else {
  //   elements.push({
  //     percentage: (estimLoad / max) * 100,
  //     color: ColorBuy,
  //     z: 2,
  //   })
  //   elements.push({
  //     percentage: (solarPower / max) * 100,
  //     color: ColorSolar,
  //     z: 10,
  //   })
  // }

  // if (batteryData.discharge > 0) {
  //   elements.push({
  //     percentage: (batteryData.discharge / max) * 100,
  //     color: ColorDischarge,
  //     z: 100,
  //     width: 10,
  //   })
  // }

  // if (batteryData.charge > 0) {
  //   elements.push({
  //     percentage: (Math.abs(batteryData.charge) / max) * 100,
  //     color: ColorCharge,
  //     z: 100,
  //     width: 10,
  //   })
  // }

  return (
    <div className="panel">
      <div className="power-gauge-component">
        {/* <MultiGauge
          height={props.height}
          elements={elements}
          onClick={() => setModalOpen(true)}
          consume={() => {
            return formatPower(estimLoad)
          }}
          solar={() => {
            return '☀️ ' + formatPower(solarPower)
          }}
          grid={() => {
            return '⚡️ ' + formatPower(gridPower)
          }}
          battery={() => {
            return '🔋 ' + formatPower(batteryPower)
          }}
          title="Nuvarande förbrk."
        /> */}
        <EnergyClock
          height={props.height}
          onClick={() => setModalOpen(true)}
          pv={solarPower}
          usage={estimLoad}
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

function formatPower(power: number): string {
  if (power > 999 || power < -999) {
    return formatNumber(power / 1000, ' kW', { precision: 2 })
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
