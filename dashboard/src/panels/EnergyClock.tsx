import { log } from 'console'

import { formatNumber } from '../lib/helpers'
import { MultiGauge, MultiGaugeProps } from './components/MultiGauge'

interface Props {
  pv: number
  usage: number
  grid: number
  battery: number
  timestamp?: number
  title?: string

  height?: number

  onClick?: () => void
}

const max = 11_000

export const ColorSolar = '#fee1a7'
export const ColorSell = '#30BF78'
export const ColorBuy = '#f85e46'

export const ColorBattery = '#3699b5'

export default function EnergyClock(props: Props) {
  let elements: MultiGaugeProps['elements'] = []

  const charge = Math.max(0, props.battery)
  const discharge = Math.abs(Math.min(0, props.battery))
  const solarLoad = Math.min(props.pv, props.usage)

  const percent = (n: number): number => (n / max) * 100

  if (discharge > 0) {
    elements.push({
      percentage: percent(Math.abs(discharge)),
      color: ColorBattery,
      z: 1,
    })
  }

  if (charge > 0) {
    const remainSolar = props.pv - solarLoad
    const solarBatt = Math.min(remainSolar, charge)
    if (solarBatt > 0) {
      elements.push({
        percentage: percent(solarBatt),
        color: ColorBattery,
        z: 1,
      })
    }
  }

  elements.push({
    percentage: percent(Math.min(props.pv, props.usage)),
    color: ColorSolar,
    z: 2,
  })

  elements.push({
    percentage: percent(Math.abs(props.grid)),
    color: props.grid < 0 ? ColorSell : ColorBuy,
    z: 0,
  })

  elements = elements.sort((a, b) => b.z - a.z)

  // Stack the elements
  let base = 0
  for (const elem of elements) {
    base += elem.percentage
    elem.percentage = base
  }

  // const sanity = props.usage + charge - (props.grid + props.pv + discharge)
  // if (sanity !== 0) {
  //   elements = []
  // }
  return (
    <MultiGauge
      height={props.height}
      elements={elements}
      onClick={props.onClick}
      consume={() => {
        return formatPower(props.usage)
      }}
      solar={() => {
        return '☀️ ' + formatPower(props.pv)
      }}
      grid={() => {
        return '⚡️ ' + formatPower(props.grid)
      }}
      battery={() => {
        if (props.battery === 0) {
          return '🔋 0 W'
        }
        return `${props.battery > 0 ? '⚡️' : ''}🔋 ${formatPower(
          Math.abs(props.battery),
        )}`
      }}
      title={props.title ?? 'Nuvarande förbrk.'}
    />
  )
}

function formatPower(power: number): string {
  if (power > 999 || power < -999) {
    return formatNumber(power / 1000, ' kW', { precision: 2 })
  }
  return formatNumber(power, ' W', { precision: 0 })
}
