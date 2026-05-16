import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, KanbanSquare, Settings, LogOut,
  Package, Users, BarChart3, UtensilsCrossed,
  ClipboardList, History, TrendingUp, MessageCircle
} from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '../../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

const navFuncionario = [
  { to: '/pdv',    icon: ShoppingCart,  label: 'PDV' },
  { to: '/kanban', icon: KanbanSquare,  label: 'Kanban' },
  { to: '/mesas',     icon: ClipboardList,  label: 'Mesas' },
  { to: '/whatsapp',  icon: MessageCircle,  label: 'WhatsApp' },
]

const navAdmin = [
  { to: '/dashboard', icon: BarChart3,       label: 'Dashboard' },
  { to: '/insights',  icon: TrendingUp,      label: 'Insights' },
  { to: '/historico', icon: History,         label: 'Histórico' },
  { to: '/admin/clientes',  icon: Users,          label: 'Clientes' },
  { to: '/admin/cardapio',  icon: UtensilsCrossed, label: 'Cardápio' },
  { to: '/admin/estoque',   icon: Package,        label: 'Estoque' },
  { to: '/admin/equipe',    icon: Settings,       label: 'Equipe' },
]

// Hook para contar alertas não lidos do WhatsApp
function useAlertasCount() {
  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas-pdv-count'],
    queryFn: async () => {
      const { data } = await supabase.from('alertas_pdv')
        .select('id').eq('lido', false)
      return data ?? []
    },
    refetchInterval: 10_000,
  })
  return (alertas as any[]).length
}

// Som de notificação
function tocarSomAlerta() {
  try {
    const ctx = new AudioContext()
    const tempos = [0, 0.15, 0.3]
    tempos.forEach(t => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime + t)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + t + 0.07)
      gain.gain.setValueAtTime(0.3, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.2)
    })
  } catch {}
}

export function Layout() {
  const { usuario, logout } = useAuthStore()
  const navigate = useNavigate()
  const isProprietario = usuario?.role === 'proprietario'
  const alertasCount = useAlertasCount()
  const alertasAnterior = useRef(alertasCount)

  // Tocar som quando chegar alerta novo
  useEffect(() => {
    if (alertasCount > alertasAnterior.current) {
      tocarSomAlerta()
      toast('🚨 Nova solicitação de atendimento no WhatsApp!', {
        duration: 8000,
        style: { background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b' }
      })
    }
    alertasAnterior.current = alertasCount
  }, [alertasCount])

  const handleLogout = async () => {
    await logout()
    toast.success('Até logo!')
    navigate('/login')
  }

  const navItems = isProprietario ? [...navFuncionario, ...navAdmin] : navFuncionario

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <aside className="w-16 lg:w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="h-14 flex items-center gap-3 px-4 border-b border-gray-800">
          <span className="text-2xl">🍕</span>
          <span className="hidden lg:block font-bold text-gray-100 text-sm">PDV Pizzaria</span>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isWhatsApp = to === '/whatsapp'
            return (
              <NavLink key={to} to={to}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-pizza-500/20 text-pizza-400 border border-pizza-500/30'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
                )}>
                <div className="relative flex-shrink-0">
                  <Icon size={18} />
                  {isWhatsApp && alertasCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse">
                      {alertasCount > 9 ? '9+' : alertasCount}
                    </span>
                  )}
                </div>
                <span className="hidden lg:block">{label}</span>
                {isWhatsApp && alertasCount > 0 && (
                  <span className="hidden lg:flex ml-auto min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full items-center justify-center px-1">
                    {alertasCount > 9 ? '9+' : alertasCount}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-pizza-500/20 border border-pizza-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-pizza-400">{usuario?.nome?.[0]?.toUpperCase() || '?'}</span>
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-300 truncate">{usuario?.nome}</p>
              <p className="text-xs text-gray-600 capitalize">{usuario?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-all">
            <LogOut size={14} />
            <span className="hidden lg:block">Sair</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden flex flex-col"><Outlet /></main>
    </div>
  )
}
