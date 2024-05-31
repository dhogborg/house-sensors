import { useEffect, useRef, useState } from 'react'

import { useWindowSize } from '../../lib/hooks'

const defaultColor = '#BDD9BF'
const defaultWidth = 30

interface Props {
  percentage: number
  height: number
  width?: number
  background?: string
  fillColor?: string
  color?: string
}

export default function BatteryBar(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const windowSize = useWindowSize()
  const [containerSize, setContainerSize] = useState({
    width: 40,
    height: 200,
  })

  const container = containerRef.current
  useEffect(() => {
    if (container) {
      setContainerSize(() => {
        return {
          width: container.clientWidth,
          height: container.clientHeight,
        }
      })
    }
  }, [container, windowSize.width, windowSize.height, props.height])

  const canvas = canvasRef.current
  useEffect(() => {
    if (!canvas) {
      return
    }

    canvas.height = containerSize.height * 2
    canvas.style.height = containerSize.height + 'px'
    canvas.width = containerSize.width * 2
    canvas.style.width = containerSize.width + 'px'

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    //Our first draw
    context.fillStyle = props.background || '#141414'
    context.fillRect(0, 0, context.canvas.width, context.canvas.height)

    let z = 0
    const drawBar = (
      color: string,
      width: number,
      percent: number,
      printPercentage?: boolean,
    ) => {
      if (color === undefined) {
        console.error('element with undefined color will not render')
      }

      if (percent > 100) {
        percent = 100
      }

      const paddingTop = 0
      const paddingBottom = 70
      context.fillStyle = color

      const fullHeight = context.canvas.height - paddingTop - paddingBottom
      const barHeight = fullHeight * (percent / 100)
      context.fillRect(0, fullHeight - barHeight, width, barHeight)

      if (printPercentage) {
        context.font = '15px sans-serif'
        context.fillStyle = '#ffffff'
        context.textAlign = 'center'
        context.fillText(`${percent.toFixed(0)}%`, 19, fullHeight + 25)
      }
    }

    drawBar(props.fillColor || '#e5e5e5', props.width ?? defaultWidth, 100)

    drawBar(
      props.color ?? defaultColor,
      props.width ?? defaultWidth,
      props.percentage ?? 0,
      true,
    )
  }, [canvas, props, containerSize])

  return (
    <div
      ref={containerRef}
      className="battery-bar-container"
      style={{ height: props.height, width: '20px' }}
    >
      <canvas ref={canvasRef}></canvas>
    </div>
  )
}
