const path = require('path')
const CracoLessPlugin = require('craco-less')

module.exports = {
  webpack: {
    alias: { '@lib': path.resolve(__dirname, './src/lib') },
    configure: (configuration) => {
      return {
        ...configuration,
        ignoreWarnings: [/Failed to parse source map/],
      }
    },
  },
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            javascriptEnabled: true,
          },
        },
      },
    },
  ],
}
