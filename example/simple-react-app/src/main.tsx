import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ExperimentProvider } from './contexts/ExperimentContext'

createRoot(document.getElementById('root')!).render(
  <ExperimentProvider>
    <App />
  </ExperimentProvider>
)
