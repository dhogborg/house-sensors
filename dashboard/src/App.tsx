import { useEffect } from 'react'
import { createDispatchHook } from 'react-redux'

import { Col, Row, message } from 'antd'

import * as mqtt from './lib/slices/mqtt'

import './App.less'
import { useDispatch, useSelector } from './lib/store'
import PriceBars from './panels/EnergyPrice'
import IndoorTemperature from './panels/IndoorTemperatureLine'
import OutdoorTemperature from './panels/OutdoorTemperatureLine'
import { PowerLive } from './panels/PowerGauges'
import PowerUseBars from './panels/PowerUseBars'
import Summary from './panels/Summary'

function App() {
  const gutter = 0
  useEffect(() => {
    setTimeout(() => {
      window.location.reload()
    }, 1000 * 60 * 120)
  }, [])

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
