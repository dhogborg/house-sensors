export const errorString = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'string') {
    return err
  }
  return 'Unknown error'
}

export const formatNumber = (
  n: number,
  suffix: string,
  options?: {
    precision?: number
    trim?: boolean
  },
) => {
  const defaults = {
    precision: 2,
    trim: true,
  }
  let opts = {
    ...defaults,
    ...options,
  }
  let num = Number(n).toFixed(opts.precision)
  // need to have decimals (ie. precision >= 1) to be able to trim 0-decimals
  if (opts.precision > 0 && opts.trim) {
    // trim trailing zeros and the optional decimal point if all zeroes
    num = num.replace(/\.?0+$/, '')
  }
  if (suffix) {
    return `${num}${suffix}`
  }
  return '' + num
}

export const deepEqual = (a: any, b: any): boolean => {
  const ajs = JSON.stringify(a)
  const bjs = JSON.stringify(b)

  return ajs === bjs
}
