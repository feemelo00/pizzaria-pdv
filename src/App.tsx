import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { Component, type ReactNode } from 'react'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/layout/Layout'
import { LoginPage } from './pages/LoginPage'
import { PDVPage } from './pages/PDVPage'
import { KanbanPage } from './pages/KanbanPage'
import { ComandaMesaPage } from './pages/ComandaMesaPage'
import { DashboardPage } from './pages/DashboardPage'
import { HistoricoPage } from './pages/HistoricoPage'
import { InsightsPage } from './pages/InsightsPage'
import { ClientesPage } from './pages/admin/ClientesPage'
import { CardapioPage } from './pages/admin/CardapioPage'
import { EstoquePage } from './pages/admin/EstoquePage'
import { EquipePage } from './pages/admin/EquipePage'
import { Spinner } from './components/ui'
import { WhatsAppPage, AlertasWhatsApp } from './pages/WhatsAppPage'

// ── Error Boundary: impede que um crash numa página derrube o app inteiro ──
class ErrorBoundary extends Component<{ children: ReactNode }, { erro: Error | null }> {
  constructor(props: any) {
    super(props)
    this.state = { erro: null }
  }
  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }
  componentDidCatch(erro: Error, info: any) {
    console.error('[ErrorBoundary]', erro, info)
  }
  render() {
    if (this.state.erro) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-100">Ocorreu um erro nesta tela</h2>
          <p className="text-sm text-gray-500 max-w-sm">{this.state.erro.message}</p>
          <button
            className="btn-primary px-6"
            onClick={() => this.setState({ erro: null })}
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Wrapper de rota com ErrorBoundary por página ──
function PageWrapper({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

// ── QueryClient robusto: retry inteligente, não repete 404/401 ──
const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Não retenta erros de autenticação ou not found
        if (error?.status === 401 || error?.status === 403 || error?.status === 404) return false
        return failureCount < 2
      },
      staleTime: 30_000,
      // Não refetcha automaticamente se a janela está em foco mas sem mudanças
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0, // Mutações nunca repetem automaticamente
    }
  }
})

function ProtectedRoute({ children, onlyAdmin = false }: {
  children: ReactNode; onlyAdmin?: boolean
}) {
  const { usuario, loading } = useAuthStore()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
  if (!usuario) return <Navigate to="/login" replace />
  if (onlyAdmin && usuario.role !== 'proprietario') return <Navigate to="/pdv" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151', borderRadius: '10px' },
          success: { iconTheme: { primary: '#f97316', secondary: '#fff' } },
          error: { duration: 6000 },
        }} />
        <AlertasWhatsApp />
        <Routes>
          <Route path="/login" element={<PageWrapper><LoginPage /></PageWrapper>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/pdv" replace />} />
            <Route path="pdv"     element={<PageWrapper><PDVPage /></PageWrapper>} />
            <Route path="kanban"  element={<PageWrapper><KanbanPage /></PageWrapper>} />
            <Route path="mesas"   element={<PageWrapper><ComandaMesaPage /></PageWrapper>} />
            <Route path="dashboard" element={<ProtectedRoute onlyAdmin><PageWrapper><DashboardPage /></PageWrapper></ProtectedRoute>} />
            <Route path="insights"  element={<ProtectedRoute onlyAdmin><PageWrapper><InsightsPage /></PageWrapper></ProtectedRoute>} />
            <Route path="historico" element={<ProtectedRoute onlyAdmin><PageWrapper><HistoricoPage /></PageWrapper></ProtectedRoute>} />
            <Route path="admin/clientes" element={<ProtectedRoute onlyAdmin><PageWrapper><ClientesPage /></PageWrapper></ProtectedRoute>} />
            <Route path="admin/cardapio" element={<ProtectedRoute onlyAdmin><PageWrapper><CardapioPage /></PageWrapper></ProtectedRoute>} />
            <Route path="admin/estoque"  element={<ProtectedRoute onlyAdmin><PageWrapper><EstoquePage /></PageWrapper></ProtectedRoute>} />
            <Route path="admin/equipe"   element={<ProtectedRoute onlyAdmin><PageWrapper><EquipePage /></PageWrapper></ProtectedRoute>} />
            <Route path="whatsapp" element={<PageWrapper><WhatsAppPage /></PageWrapper>} />
          </Route>
          <Route path="*" element={<Navigate to="/pdv" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
