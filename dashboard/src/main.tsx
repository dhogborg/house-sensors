import ReactDOM from 'react-dom/client'

import { Provider } from 'react-redux'

import './main.css'
import { store } from 'src/lib/store'
import App from './App'

const container = document.getElementById('root')
const root = ReactDOM.createRoot(container)
root.render(
  <Provider store={store}>
    <App />
  </Provider>,
)
