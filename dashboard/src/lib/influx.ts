import { handledFetch } from '../http'

const INFLUX_ENDPOINT =
  process.env.INFLUX_ENDPOINT || 'http://192.168.116.232:8086'

export interface Response {
  results: {
    statement_id: number
    series: Series[]
  }[]
}

export interface Series {
  name: string
  columns: string[]
  tags: { [key: string]: string }
  values: any[]
}

export async function query(props: {
  query: string
  db: string
}): Promise<Response> {
  const request = [
    `db=${encodeURIComponent(props.db)}`,
    `q=${encodeURIComponent(props.query)}`,
  ].join('&')

  const response = await handledFetch(
    `${INFLUX_ENDPOINT}/query?pretty=true&${request}`,
  )
  return await response.json()
}
