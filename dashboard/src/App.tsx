import { Row, Col } from 'antd'

import './App.less'

import IndoorTemperature from './panels/IndoorTemperatureLine'
import OutdoorTemperature from './panels/OutdoorTemperatureLine'
import PowerUseBars from './panels/PowerUseBars'
import { PowerCombined, PowerHeatPump } from './panels/PowerGauges'

import PriceBars from './panels/Tibber'

function App() {
  const gutter = 0
  return (
    <div className="App">
      <div id="Grid">
        <Row gutter={gutter}>
          <Col md={12}>
            <OutdoorTemperature height={250} />
          </Col>
          <Col md={12}>
            <IndoorTemperature height={250} />
          </Col>
        </Row>
        <Row gutter={gutter}>
          <Col md={6}>
            <PowerCombined height={225} />
          </Col>
          <Col md={6}>
            <PowerHeatPump height={225} />
          </Col>
          <Col md={12}>
            <PriceBars height={225} />
          </Col>
        </Row>

        <Row gutter={gutter}>
          <Col md={24}>
            <PowerUseBars height={250} />
          </Col>
        </Row>
      </div>
    </div>
  )
}

export default App
