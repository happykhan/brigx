import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './globals.css'
import { installTauriDesktopBridge } from '../desktop/tauri'

async function bootstrap() {
  await installTauriDesktopBridge()
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )
}

void bootstrap().catch(error => {
  console.error('[BRIGX] Application startup failed:', error)
  const root = document.getElementById('root')
  if (root) root.textContent = 'BRIGX could not start. Please restart the application.'
})
