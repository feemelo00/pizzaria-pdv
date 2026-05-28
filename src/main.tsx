import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useAuthStore } from './store/authStore'

async function iniciar() {
  try {
    await useAuthStore.getState().inicializar()
  } catch (err) {
    console.error('[main] Falha ao inicializar auth:', err)
    // Mesmo com erro, renderiza o app (ele vai redirecionar para login)
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><App /></React.StrictMode>
  )
}

iniciar()
