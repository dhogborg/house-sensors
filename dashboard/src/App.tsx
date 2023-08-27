import { useEffect } from 'react'
import { createDispatchHook } from 'react-redux'

import { Col, Row, message } from 'antd'

import * as mqtt from './lib/slices/mqtt'

import './App.less'
import { useDispatch, useSelector } from './lib/store'
import IndoorTemperature from './panels/IndoorTemperatureLine'
import OutdoorTemperature from './panels/OutdoorTemperatureLine'
import { PowerLive } from './panels/PowerGauges'
import PowerUseBars from './panels/PowerUseBars'
import Summary from './panels/Summary'
import PriceBars from './panels/Tibber'

function App() {
  const dispatch = useDispatch()
  const mqttState = useSelector(mqtt.selector)

  const gutter = 0
  useEffect(() => {
    setTimeout(() => {
      window.location.reload()
    }, 1000 * 60 * 120)
  }, [])

  useEffect(() => {
    if (mqttState.status === 'idle') {
      dispatch(mqtt.connect())
    }
  }, [dispatch, mqttState.status])

  useEffect(() => {
    switch (mqttState.status) {
      case 'connected':
        message.success('Connected!', 2)
        break
    }
  }, [mqttState.status])

  return (
    <div className="App">
      <div id="Grid">
        <Row gutter={gutter}>
          <Col xs={24} md={12}>
            <OutdoorTemperature height={250} />
          </Col>
          <Col xs={24} md={12}>
            <IndoorTemperature height={250} />
          </Col>
        </Row>
        <Row gutter={gutter}>
          <Col xs={24} md={6}>
            <PowerLive height={235} />
          </Col>
          <Col xs={24} md={6}>
            <Summary height={235} />
          </Col>
          <Col xs={24} md={12}>
            <PriceBars height={225} />
          </Col>
        </Row>

        <Row gutter={gutter}>
          <Col xs={24} md={24}>
            <PowerUseBars height={250} />
          </Col>
        </Row>
      </div>
    </div>
  )
}

export default App
