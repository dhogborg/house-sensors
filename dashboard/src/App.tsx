import { useEffect } from 'react'

import { Col, Row } from 'antd'

import './App.less'
import IndoorTemperature from './panels/IndoorTemperatureLine'
import OutdoorTemperature from './panels/OutdoorTemperatureLine'
import { PowerLive } from './panels/PowerGauges'
import PowerUseBars from './panels/PowerUseBars'
import { StringByDirection, StringGauges, StringsTotal } from './panels/Strings'
import Summary from './panels/Summary'
import PriceBars from './panels/Tibber'

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
