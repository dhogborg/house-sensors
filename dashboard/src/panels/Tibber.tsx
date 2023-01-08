import { useEffect } from 'react'

import { Column, ColumnConfig } from '@ant-design/charts'

import * as tibber from 'src/lib/slices/tibber'
import * as appConfig from 'src/lib/slices/config'
import {
  BUY_TRANSMISSION_FEE_CENTS,
  BUY_ADDED_TAX_CENTS,
  SELL_REDUCED_TAX_CENTS,
  SELL_GRID_BENEFIT_CENTS,
} from 'src/lib/config'
import { formatNumber } from 'src/lib/helpers'
import { useAppDispatch, useAppSelector } from 'src/lib/hooks'

interface priceNode {
  startsAt?: string
  category: string
  price: number
}

export default function PriceBars(props: { height: number }) {
  const dispatch = useAppDispatch()
  const store = useAppSelector(tibber.selector)
  const includeFeesAndTax = useAppSelector(appConfig.selector).includeTaxes

  useEffect(() => {
    dispatch(tibber.get())
    const r = setInterval(() => {
      dispatch(tibber.get())
    }, 5 * 60 * 1000)
    return () => {
      clearInterval(r)
    }
  }, [dispatch])

  const buyFeesAndTaxes = includeFeesAndTax
    ? BUY_TRANSMISSION_FEE_CENTS + BUY_ADDED_TAX_CENTS
    : 0
  const sellFeesAndTaxes = includeFeesAndTax
    ? SELL_REDUCED_TAX_CENTS + SELL_GRID_BENEFIT_CENTS
    : 0

  const currentSek = store.current?.total || 0
  const currentTax = store.current?.tax || 0
  const currentBuy = Math.round(100 * currentSek + buyFeesAndTaxes)
  const currentSell = Math.round(
    100 * (currentSek - currentTax) + sellFeesAndTaxes,
  )

  const toggleFeesAndTaxes = (chart: unknown, event: { type: string }) => {
    switch (event.type) {
      case 'annotation:click':
        dispatch(appConfig.toggleIncludeTax())
        return
    }
  }

  let priceData: priceNode[] = []

  priceData = priceData.concat(
    store.today.map((node) => {
      return {
        ...node,
        category: 'buy_price',
        price: Math.round(node.total * 100 + buyFeesAndTaxes),
      }
    }),
  )

  priceData = priceData.concat(
    store.tomorrow.map((node) => {
      return {
        ...node,
        category: 'buy_price',
        price: Math.round(node.total * 100 + buyFeesAndTaxes),
      }
    }),
  )

  priceData = priceData.concat(
    store.today.map((node) => {
      return {
        ...node,
        category: 'sell_price',
        price: Math.round((node.total - node.tax) * 100 + sellFeesAndTaxes),
      }
    }),
  )

  priceData = priceData.concat(
    store.tomorrow.map((node) => {
      return {
        ...node,
        category: 'sell_price',
        price: Math.round((node.total - node.tax) * 100 + sellFeesAndTaxes),
      }
    }),
  )

  const segmentCount = store.today.length + store.tomorrow.length

  let lowNode: priceNode | undefined
  let lowIndex = -1
  let highNode: priceNode | undefined
  let highIndex = -1
  let mean = 0
  priceData
    .filter((node) => {
      return node.category === 'buy_price'
    })
    .forEach((node, i) => {
      if (!lowNode || node.price < lowNode.price) {
        lowNode = node
        lowIndex = i
      }

      if (!highNode || node.price > highNode.price) {
        highNode = node
        highIndex = i
      }

      if (i === 0) {
        mean = node.price
      } else {
        mean = (mean + node.price) / 2
      }
    })

  priceData.push({
    category: 'current_buy',
    startsAt: store.current?.startsAt,
    price: currentBuy,
  })

  let annotations: ColumnConfig['annotations'] = []

  annotations.push({
    type: 'line',
    start: ['min', mean],
    end: ['max', mean],
    style: {
      lineWidth: 1,
      stroke: '#F4664A',
      lineDash: [2, 2],
    },
  })

  if (lowNode) {
    annotations.push({
      type: 'text',
      content: `${Math.round(lowNode.price)}`,
      position: (xScale, yScale: any) => {
        const top = `${topIndent(lowNode!.price, yScale.price?.max)}%`
        const left = `${leftIndent(lowIndex, segmentCount)}%`
        return [left, top]
      },
      style: {
        textAlign: 'center',
        fill: 'white',
        fontSize: 12,
      },
      background: {
        padding: 1,
        style: {
          radius: 2,
          fill: 'rgba(125, 227, 144, 0.8)',
        },
      },
    })
  }

  if (highNode) {
    annotations.push({
      type: 'text',
      content: `${Math.round(highNode.price)}`,
      position: (xScale, yScale: any) => {
        const top = `${topIndent(highNode!.price, yScale.price?.max)}%`
        const left = `${leftIndent(highIndex, segmentCount)}%`

        return [left, top]
      },
      style: {
        textAlign: 'center',
        fill: 'white',
        fontSize: 12,
      },
      background: {
        padding: 1,
        style: {
          radius: 2,
          fill: '#ff607b',
        },
      },
    })
  }

  annotations.push({
    type: 'text',
    content: `${Math.round(currentBuy)} öre`,

    position: (xScale, yScale) => {
      return [`50%`, `30%`]
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
  })

  annotations.push({
    type: 'text',
    content: `Sälj: ${Math.round(currentSell)} öre`,

    position: (xScale, yScale) => {
      return [`50%`, `53%`]
    },

    style: {
      textAlign: 'center',
      fill: 'white',
      fontSize: 15,
    },

    offsetY: -10,

    background: {
      padding: 5,
      style: {
        radius: 4,
        fill: 'rgba(37, 184, 204, 0.6)',
      },
    },
  })

  const config: ColumnConfig = {
    data: priceData,
    isStack: false,

    xField: 'startsAt',
    yField: 'price',
    padding: 'auto',

    yAxis: {
      // apply margin to y axis to fit the high-price annotation
      max: (highNode?.price || 0) * 1.05,
    },

    seriesField: 'category',
    color: (datum, defaultColor) => {
      switch (datum.category) {
        case 'current_buy':
          return 'rgba(255, 0 , 0 , 0.6)'
        case 'buy_price':
          return 'rgba(37, 184, 204, 0.6)'
        case 'sell_price':
          return 'rgba(254, 225, 167, 1.00)'
        default:
          return 'blue'
      }
    },

    theme: 'dark',
    height: props.height,

    label: undefined,

    legend: false,

    tooltip: {
      title: (title, datum) => {
        const d = new Date(datum.startsAt)
        return d.toLocaleDateString('sv-se') + ' ' + d.toLocaleTimeString()
      },
      formatter: (datum) => {
        return {
          name: datum.category,
          value: formatNumber(datum.price, ' öre', {
            precision: 0,
          }),
        }
      },
    },

    animation: false,

    annotations,

    xAxis: {
      tickCount: 24,
      label: {
        formatter: (t, item, index) => {
          let d = new Date(t)
          return d.getHours()
        },
      },
    },
  }

  return (
    <div className="panel">
      <Column onEvent={toggleFeesAndTaxes} {...config} />
    </div>
  )
}

function leftIndent(pos: number, count: number): number {
  const segmWidth = 100 / count
  return 2 + pos * segmWidth
}

function topIndent(value: number, high: number): number {
  const percent = (value / high) * 100
  return 94 - Math.round(percent)
}
