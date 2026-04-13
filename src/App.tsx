import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
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

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
})

function ProtectedRoute({ children, onlyAdmin = false }: {
  children: React.ReactNode; onlyAdmin?: boolean
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
          success: { iconTheme: { primary: '#f97316', secondary: '#fff' } }
        }} />
        <AlertasWhatsApp />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/pdv" replace />} />
            <Route path="pdv"    element={<PDVPage />} />
            <Route path="kanban" element={<KanbanPage />} />
            <Route path="mesas"  element={<ComandaMesaPage />} />
            <Route path="dashboard" element={<ProtectedRoute onlyAdmin><DashboardPage /></ProtectedRoute>} />
            <Route path="insights"  element={<ProtectedRoute onlyAdmin><InsightsPage /></ProtectedRoute>} />
            <Route path="historico" element={<ProtectedRoute onlyAdmin><HistoricoPage /></ProtectedRoute>} />
            <Route path="admin/clientes" element={<ProtectedRoute onlyAdmin><ClientesPage /></ProtectedRoute>} />
            <Route path="admin/cardapio" element={<ProtectedRoute onlyAdmin><CardapioPage /></ProtectedRoute>} />
            <Route path="admin/estoque"  element={<ProtectedRoute onlyAdmin><EstoquePage /></ProtectedRoute>} />
            <Route path="admin/equipe"   element={<ProtectedRoute onlyAdmin><EquipePage /></ProtectedRoute>} />
            <Route path="whatsapp" element={<WhatsAppPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/pdv" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
