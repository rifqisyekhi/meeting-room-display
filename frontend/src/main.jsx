import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ensureDevSessionSync } from './utils/devSession'

// Pastikan data sesi dev terisolasi hanya untuk siklus npm run dev saat ini
ensureDevSessionSync()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

