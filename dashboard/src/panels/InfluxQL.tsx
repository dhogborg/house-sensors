import { useEffect, useState } from "react";

import * as influxdb from "@lib/influx";

import {
  Area,
  AreaConfig,
  Gauge,
  Line,
  LineConfig,
  GaugeConfig,
} from "@ant-design/charts";

const time = "now() - 7d";
const theme = "dark";

type DataPoint = { category: string; time: string; value: string };

export function OutdoorTemperature(props: {}) {
  const [state, setState] = useState<{ data: any[] }>({ data: [] });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const t = await influxdb.query({
      db: "sensors",
      query: `SELECT mean("value") AS "temperature" FROM "sensors"."autogen"."temperature" WHERE time > ${time} AND "name"='Outdoor' GROUP BY time(10m), "name" FILL(linear)`,
    });
    const data = t.results[0].series
      .reduce<DataPoint[]>((data, series) => {
        const values = series.values.map((value) => {
          return {
            category: series.tags.name,
            time: value[0],
            value: value[1],
          };
        });

        return data.concat(values);
      }, [])
      .filter((value) => !!value.value);

    setState({ data });
  };

  const config: AreaConfig = {
    data: state.data,
    xField: "time",
    yField: "value",
    padding: "auto",
    seriesField: "category",
    theme,
    height: 250,

    xAxis: {
      type: "time",
    },
  };

  return (
    <div className="panel">
      <Area {...config} />
    </div>
  );
}

export function IndoorTemperature(props: {}) {
  const [state, setState] = useState<{ data: any[] }>({ data: [] });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const t = await influxdb.query({
      db: "sensors",
      query: `SELECT mean("value") AS "mean_value" FROM "sensors"."autogen"."temperature" WHERE time > ${time} AND ("name"='Värmepump' OR "name"='Övervåning' OR "name"='Vardagsrum') AND ("source" ='Tado' OR "source" = 'Aqara') GROUP BY time(5m), "name" FILL(linear)`,
    });
    const data = t.results[0].series
      .reduce<DataPoint[]>((prev, curr) => {
        const values = curr.values.map((value) => {
          return {
            category: curr.tags.name,
            time: value[0],
            value: value[1],
          };
        });

        return prev.concat(values);
      }, [])
      .filter((value) => !!value.value);

    setState({ data });
  };

  const config: LineConfig = {
    data: state.data,
    xField: "time",
    yField: "value",
    padding: "auto",
    seriesField: "category",
    theme,
    height: 250,

    yAxis: {
      min: 15,
    },

    xAxis: {
      type: "time",
    },
  };

  return (
    <div className="panel">
      <Line {...config} />
    </div>
  );
}

export function PowerCombined(props: {}) {
  const [state, setState] = useState<{ power: number }>({ power: 0 });
  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const t = await influxdb.query({
      db: "energy",
      query: `SELECT power FROM "energy"."autogen"."electricity" WHERE time > now() - 1m AND "phase"='combined' LIMIT 1`,
    });

    const power: number = t.results[0]?.series[0]?.values[0][1] || 0;

    setState({ power });
  };

  const percent = state.power / 9000;

  const config: GaugeConfig = {
    height: 120,
    percent: percent,

    range: {
      ticks: [0, 1 / 3, 2 / 3, 1],
      color: ["#F4664A", "#FAAD14", "#30BF78"],
    },
    indicator: {
      pointer: {
        style: {
          lineWidth: 4,
          stroke: "#ddd",
        },
      },
      pin: {
        style: {
          lineWidth: 0,
          fill: "#ddd",
        },
      },
    },
    statistic: {
      content: {
        style: {
          fontSize: "12px",
          lineHeight: "12px",
        },
      },
    },
  };

  return (
    <div className="panel">
      <Gauge {...config} />
    </div>
  );
}
