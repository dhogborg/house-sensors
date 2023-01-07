import react from '@vitejs/plugin-react'
import { defineConfig, UserConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export const commonConfig: UserConfig = {
  plugins: [react(), tsconfigPaths()],
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
}

export default defineConfig(({ mode }) => {
  if (mode !== 'development') {
    return commonConfig
  }

  return {
    ...commonConfig,
    ...{
      server: {
        port: 3000,
      },
    },
  }
})
