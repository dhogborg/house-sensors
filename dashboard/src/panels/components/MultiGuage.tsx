import { useEffect, useRef, useState } from 'react'

export interface MultiGaugeProps {
  height: number

  background?: string
  fillColor?: string

  elements: {
    percentage: number
    color?: string
    zIndex?: number
    width?: number
  }[]

  title?: string
  titleStyle?: string

  // display values
  consume?: () => string
  solar?: () => string
  grid?: () => string
}

const defaultColors = ['#BDD9BF', '#FFC857', '#2E4052', '#CCC5B9', '#FFFCF2']
const defaultWidth = 30

export const MultiGauge = function (props: MultiGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [width, setWidth] = useState(200)

  const container = containerRef.current
  useEffect(() => {
    if (container) {
      setWidth(() => {
        return container.clientWidth
      })
    }
  }, [container])

  const canvas = canvasRef.current
  useEffect(() => {
    if (!canvas) {
      return
    }

    canvas.height = props.height * 2
    canvas.style.height = props.height + 'px'
    canvas.width = width * 2
    canvas.style.width = width + 'px'

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    //Our first draw
    context.fillStyle = props.background || '#141414'
    context.fillRect(0, 0, context.canvas.width, context.canvas.height)

    let z = 0
    const drawArc = (color: string, width: number, percent: number) => {
      if (color === undefined) {
        console.error('element with undefined color will not render')
      }

      if (percent > 100) {
        percent = 100
      }

      const arcStart = 0.8 * Math.PI
      const arcEnd = 1.4 * Math.PI * (percent / 100)

      context.beginPath()
      context.arc(
        canvas.width * 0.5,
        canvas.height * 0.55,
        canvas.width * 0.4,
        arcStart,
        arcStart + arcEnd,
      )

      context.strokeStyle = color
      context.lineWidth = width + z
      z += 0.25

      context.stroke()
    }

    drawArc(props.fillColor || '#e5e5e5', defaultWidth, 100)

    props.elements.forEach((element, i) => {
      const defaultColor = defaultColors[i % defaultColors.length]
      drawArc(
        element.color || defaultColor,
        element.width || defaultWidth,
        element.percentage || 0,
      )
    })

    if (props.title) {
      context.font = props.titleStyle || '30px sans-serif'
      context.fillStyle = '#ffffff'
      context.textAlign = 'center'
      context.fillText(props.title, canvas.width * 0.5, canvas.height * 0.825)
    }

    const offsetTop = -0.06

    if (props.solar) {
      context.font = '30px sans-serif'
      context.fillStyle = '#ffffff'
      context.textAlign = 'center'
      context.fillText(
        props.solar(),
        canvas.width * 0.5,
        canvas.height * (0.425 + offsetTop),
      )
    }

    if (props.consume) {
      context.font = '60px sans-serif'
      context.fillStyle = '#ffffff'
      context.textAlign = 'center'
      context.fillText(
        props.consume(),
        canvas.width * 0.5,
        canvas.height * (0.57 + offsetTop),
      )
    }

    if (props.grid) {
      context.font = '30px sans-serif'
      context.fillStyle = '#ffffff'
      context.textAlign = 'center'
      context.fillText(
        props.grid(),
        canvas.width * 0.5,
        canvas.height * (0.675 + offsetTop),
      )
    }
  }, [canvas, props, width])

  return (
    <div
      ref={containerRef}
      className="multi-gauge-container"
      style={{ height: props.height, width: '100%' }}
    >
      <canvas ref={canvasRef}></canvas>
    </div>
  )
}
