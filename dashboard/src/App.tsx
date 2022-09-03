import React, { useEffect } from "react";
import { Row, Col } from "antd";

import "./App.less";
import {
  IndoorTemperature,
  OutdoorTemperature,
  PowerCombined,
} from "./panels/InfluxQL";

function App() {
  const gutter = 16;
  return (
    <div className="App">
      <div id="Grid">
        <Row gutter={gutter}>
          <Col span={12}>
            <OutdoorTemperature />
          </Col>
          <Col span={12}>
            <IndoorTemperature />
          </Col>
        </Row>
        <Row gutter={gutter}>
          <Col span={4}>
            <PowerCombined />
          </Col>
          <Col span={4}>column-12</Col>
          <Col span={4}>column-12</Col>
          <Col span={12}>column-12</Col>
        </Row>
        <Row gutter={gutter}>
          <Col span={8}>column-8</Col>
          <Col span={8}>column-8</Col>
          <Col span={8}>column-8</Col>
        </Row>
        <Row gutter={gutter}>
          <Col span={6}>column-6</Col>
          <Col span={6}>column-6</Col>
          <Col span={6}>column-6</Col>
          <Col span={6}>column-6</Col>
        </Row>
      </div>
    </div>
  );
}

export default App;
