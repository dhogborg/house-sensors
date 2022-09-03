import { useEffect, useState } from "react";

import * as influxdb from "@lib/influx";

import {
  Area,
  AreaConfig,
  Column,
  ColumnConfig,
  Gauge,
  GaugeConfig,
  Line,
  LineConfig,
} from "@ant-design/charts";

const time = "now() - 24h";
const theme = "dark";

type DataPoint = {
  [key: string]: string | number;
  category: string;
  time: string;
};

export function OutdoorTemperature(props: { height: number }) {
  const [state, setState] = useState<{ data: any[] }>({ data: [] });

  useEffect(() => {
    load();

    const r = setInterval(() => {
      load();
    }, 60 * 1000);
    return () => {
      clearInterval(r);
    };
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
            category: "Utomhus",
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
    color: ["#09790a"],

    line: {
      style: {
        lineWidth: 6,
      },
    },

    areaStyle: () => {
      return {
        fill: "l(270) 0:#000000 1:#09790a",
      };
    },

    annotations: [
      {
        type: "text",
        content: `${
          state.data.length > 0 ? state.data[state.data.length - 1].value : "-"
        }°`,

        position: (xScale, yScale) => {
          return [`50%`, `50%`];
        },

        style: {
          textAlign: "center",
          fill: "white",
          fontSize: 45,
        },

        offsetY: -10,

        background: {
          padding: 10,
          style: {
            radius: 4,
            fill: "rgba(125, 227, 144, 0.6)",
          },
        },
      },
    ],

    seriesField: "category",
    theme,
    height: props.height,
    smooth: true,

    xAxis: {
      type: "time",
      tickCount: 24,
      label: {
        formatter: (t, item, index) => {
          let d = new Date(Number(item.id));
          return d.getHours();
        },
      },
    },
  };

  return (
    <div className="panel">
      <Area {...config} />
    </div>
  );
}

export function IndoorTemperature(props: { height: number }) {
  const [state, setState] = useState<{ data: any[] }>({ data: [] });

  useEffect(() => {
    load();

    const r = setInterval(() => {
      load();
    }, 60 * 1000);
    return () => {
      clearInterval(r);
    };
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
    height: props.height,

    color: ["#be3d5e", "#30b673", "#4e5cbc"],
    yAxis: {
      min: 15,
    },

    xAxis: {
      type: "time",
      tickCount: 24,
      label: {
        formatter: (t, item, index) => {
          let d = new Date(Number(item.id));
          return d.getHours();
        },
      },
    },
  };

  return (
    <div className="panel">
      <Line {...config} />
    </div>
  );
}

export function PowerCombined(props: { height: number }) {
  const [state, setState] = useState<{ power: number }>({ power: 0 });
  useEffect(() => {
    load();

    const r = setInterval(() => {
      load();
    }, 10 * 1000);
    return () => {
      clearInterval(r);
    };
  }, []);

  const max = 9000;

  const load = async () => {
    const t = await influxdb.query({
      db: "energy",
      query: `SELECT "power" FROM "energy"."autogen"."electricity" WHERE time > now() - 1m AND "phase"='combined' ORDER BY time DESC LIMIT 1`,
    });

    const power: number = t.results[0]?.series[0]?.values[0][1] || 0;

    setState({ power });
  };

  const percent = state.power / max;

  const config: GaugeConfig = {
    height: props.height,
    percent: percent,

    radius: 0.75,
    range: {
      color: "#30BF78",
      width: 12,
    },
    indicator: undefined,

    statistic: {
      content: {
        offsetY: -50,
        style: {
          fontSize: "24px",
          color: "white",
        },
        formatter: (datum, data) => {
          const watts = Number(datum!.percent * max);
          if (watts > 1000) {
            return `${(watts / 1000).toFixed(2)} kW`;
          }

          return `${watts.toFixed(0)} W`;
        },
      },
      title: {
        offsetY: 1,
        style: {
          fontSize: "14px",
          color: "#ddd",
        },
        formatter: (datum, data) => {
          return "Nuvarande förbrk.";
        },
      },
    },
    gaugeStyle: {
      lineCap: "round",
    },
  };

  return (
    <div className="panel">
      <Gauge {...config} />
    </div>
  );
}

export function PowerHeatPump(props: { height: number }) {
  const [state, setState] = useState<{ power: number }>({ power: 0 });
  useEffect(() => {
    load();

    const r = setInterval(() => {
      load();
    }, 10 * 1000);
    return () => {
      clearInterval(r);
    };
  }, []);

  const max = 2200;

  const load = async () => {
    const t = await influxdb.query({
      db: "energy",
      query: `SELECT "power" FROM "energy"."autogen"."heating" WHERE time > now() - 1m AND "type"='heatpump' ORDER BY time DESC LIMIT 1`,
    });

    const power: number = t.results[0]?.series[0]?.values[0][1] || 0;

    setState({ power });
  };

  const percent = state.power / max;

  const config: GaugeConfig = {
    height: props.height,
    percent: percent,

    radius: 0.75,
    range: {
      color: "#30BF78",
      width: 12,
    },
    indicator: undefined,

    statistic: {
      content: {
        offsetY: -50,
        style: {
          fontSize: "24px",
          color: "white",
        },
        formatter: (datum, data) => {
          return `${Number(datum!.percent * max).toFixed(0)} W`;
        },
      },
      title: {
        offsetY: 1,
        style: {
          fontSize: "14px",
          color: "#ddd",
        },
        formatter: (datum, data) => {
          return "Värmepump";
        },
      },
    },
    gaugeStyle: {
      lineCap: "round",
    },
  };

  return (
    <div className="panel">
      <Gauge {...config} />
    </div>
  );
}

export function PowerUse(props: { height: number }) {
  const [state, setState] = useState<{ usageData: any[] }>({
    usageData: [],
  });

  useEffect(() => {
    load();

    const r = setInterval(() => {
      load();
    }, 60 * 1000);
    return () => {
      clearInterval(r);
    };
  }, []);

  const load = async () => {
    const e = await influxdb.query({
      db: "energy",
      query: `SELECT mean("power") as "Consumption" FROM "energy"."autogen"."electricity" WHERE time > ${time} AND "phase"='combined' GROUP BY time(1h) FILL(null)`,
    });
    const d1 = e.results[0].series.reduce<DataPoint[]>((data, series) => {
      const values = series.values.map((value) => {
        return {
          category: series.name,
          time: value[0],
          value: Math.round(value[1]) / 1000,
        };
      });

      return data.concat(values);
    }, []);

    const hp = await influxdb.query({
      db: "energy",
      query: `SELECT mean("power") as "Heating" FROM "energy"."autogen"."heating" WHERE time > ${time} AND "type"='heatpump' GROUP BY time(1h) FILL(null)`,
    });

    const d2 = hp.results[0].series.reduce<DataPoint[]>((data, series) => {
      const values = series.values.map((value) => {
        return {
          category: series.name,
          time: value[0],
          value: Math.round(value[1]) / 1000,
        };
      });

      return data.concat(values);
    }, []);

    setState({ ...state, usageData: d1.concat(d2) });
  };

  const config: ColumnConfig = {
    data: state.usageData,
    isStack: true,
    xField: "time",
    yField: "value",
    padding: "auto",
    seriesField: "category",
    color: ["#fee1a7", "#7dbdba"],

    theme,
    height: props.height,

    label: undefined,

    legend: {
      layout: "horizontal",
      position: "top",
    },

    xAxis: {
      type: "time",
      tickCount: 24,
      label: {
        formatter: (t, item, index) => {
          let d = new Date(Number(item.id));
          return d.getHours();
        },
      },
    },
  };

  return (
    <div className="panel">
      <Column {...config} />
    </div>
  );
}
