import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'

import { store } from 'src/lib/store'

import App from './App'
import './main.css'

const container = document.getElementById('root')
const root = createRoot(container)
root.render(
  <Provider store={store}>
    <App />
  </Provider>,
)
