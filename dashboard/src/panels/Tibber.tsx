import { useEffect, useState } from 'react'

import { Column, ColumnConfig } from '@ant-design/charts'

import * as tibber from '@lib/slices/tibber'
import { formatNumber } from '@lib/helpers'
import { useAppDispatch, useAppSelector } from '@lib/hooks'

export default function PriceBars(props: { height: number }) {
  const dispatch = useAppDispatch()
  const store = useAppSelector(tibber.selector)

  useEffect(() => {
    load()
    const r = setInterval(() => {
      load()
    }, 5 * 60 * 1000)
    return () => {
      clearInterval(r)
    }
  }, [])

  const load = () => {
    dispatch(tibber.get())
  }

  const current = Math.round(100 * (store.current?.total || 0))
  console.log({ current })

  let priceData: any[] = []

  priceData = priceData.concat(
    store.today.map((node) => {
      return {
        ...node,
        category: 'price',
        price: Math.round(node.total * 100),
      }
    }),
  )

  priceData = priceData.concat(
    store.tomorrow.map((node) => {
      return {
        ...node,
        category: 'price',
        price: Math.round(node.total * 100),
      }
    }),
  )

  priceData.push({
    category: 'current',
    startsAt: store.current?.startsAt,
    price: current,
  })

  const config: ColumnConfig = {
    data: priceData,
    isStack: false,

    xField: 'startsAt',
    yField: 'price',
    padding: 'auto',
    seriesField: 'category',
    color: (datum, defaultColor) => {
      if (datum.category === 'current') {
        return 'red'
      }
      return 'rgba(37, 184, 204, 1.00)'
    },

    theme: 'dark',
    height: props.height,

    label: undefined,

    legend: false,

    tooltip: {
      formatter: (datum) => {
        return {
          name: datum.category,
          value: formatNumber(datum.price, ' öre', { precision: 0 }),
        }
      },
    },

    animation: false,

    annotations: [
      {
        type: 'text',
        content: `${Math.round(current)} öre`,

        position: (xScale, yScale) => {
          return [`50%`, `50%`]
        },

        style: {
          textAlign: 'center',
          fill: 'white',
          fontSize: 35,
        },

        offsetY: -10,

        background: {
          padding: 10,
          style: {
            radius: 4,
            fill: 'rgba(37, 184, 204, 0.6)',
          },
        },
      },
    ],

    xAxis: {
      type: 'time',
      tickCount: 24,
      label: {
        formatter: (t, item, index) => {
          let d = new Date(Number(item.id))
          return d.getHours()
        },
      },
    },
  }

  return (
    <div className="panel">
      <Column {...config} />
    </div>
  )
}
