import { Row, Col } from "antd";

import "./App.less";

import {
  IndoorTemperature,
  OutdoorTemperature,
  PowerCombined,
  PowerUse,
  PowerHeatPump,
} from "./panels/InfluxQL";

import { PriceGraph } from "./panels/Tibber";

function App() {
  const gutter = 0;
  return (
    <div className="App">
      <div id="Grid">
        <Row gutter={gutter}>
          <Col span={12}>
            <OutdoorTemperature height={250} />
          </Col>
          <Col span={12}>
            <IndoorTemperature height={250} />
          </Col>
        </Row>
        <Row gutter={gutter}>
          <Col span={6}>
            <PowerCombined height={225} />
          </Col>
          <Col span={6}>
            <PowerHeatPump height={225} />
          </Col>
          <Col span={12}>
            <PriceGraph height={225} />
          </Col>
        </Row>

        <Row gutter={gutter}>
          <Col span={24}>
            <PowerUse height={250} />
          </Col>
        </Row>
      </div>
    </div>
  );
}

export default App;
