import { useEffect, useState } from "react";

import { Column, ColumnConfig } from "@ant-design/charts";

import * as tibber from "@lib/tibber";

export function PriceGraph(props: { height: number }) {
  const [state, setState] = useState<{ current?: number; priceData: any[] }>({
    priceData: [],
  });

  useEffect(() => {
    load();
    const r = setInterval(() => {
      load();
    }, 5 * 60 * 1000);
    return () => {
      clearInterval(r);
    };
  }, []);

  const load = async () => {
    try {
      const price = await tibber.getPrice();
      const priceToday = price.today.map((node) => {
        return {
          category: "price",
          time: node.startsAt,
          price: Math.round(node.total * 100),
        };
      });
      const priceTomorrow = price.tomorrow.map((node) => {
        return {
          category: "price",
          time: node.startsAt,
          price: Math.round(node.total * 100),
        };
      });

      setState({
        priceData: priceToday.concat(priceTomorrow, {
          category: "current",
          time: price.current.startsAt,
          price: Math.round(price.current.total * 100),
        }),
        current: price.current.total * 100,
      });
    } catch (err) {
      console.log(err);
    }
  };

  const config: ColumnConfig = {
    data: state.priceData,
    isStack: false,

    xField: "time",
    yField: "price",
    padding: "auto",
    seriesField: "category",
    color: (datum, defaultColor) => {
      if (datum.category === "current") {
        return "red";
      }
      return "rgba(37, 184, 204, 1.00)";
    },

    theme: "dark",
    height: props.height,

    label: undefined,

    legend: false,

    annotations: [
      {
        type: "text",
        content: `${Math.round(state.current!)} öre/kWh`,

        position: (xScale, yScale) => {
          return [`50%`, `50%`];
        },

        style: {
          textAlign: "center",
          fill: "white",
          fontSize: 35,
        },

        offsetY: -10,

        background: {
          padding: 10,
          style: {
            radius: 4,
            fill: "rgba(37, 184, 204, 0.6)",
          },
        },
      },
    ],

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
