/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TIBBER_TOKEN: string
  readonly VITE_INFLUXDB_TOKEN: string
  readonly VITE_INFLUXDB_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
