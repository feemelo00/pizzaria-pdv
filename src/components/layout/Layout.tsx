
// ── Navegação mobile com menu "Mais" ──────────────────────────
function MobileNav({ navMobile, navAdmin, alertasCount, onLogout }: {
  navMobile: typeof navFuncionario
  navAdmin: typeof navAdmin
  alertasCount: number
  onLogout: () => void
}) {
  const [maisAberto, setMaisAberto] = useState(false)
  const temAdmin = navAdmin.length > 0

  return (
    <>
      {/* Overlay do menu Mais */}
      {maisAberto && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMaisAberto(false)} />
      )}

      {/* Drawer menu Mais */}
      {maisAberto && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 rounded-t-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-200">Menu</span>
            <button onClick={() => setMaisAberto(false)} className="text-gray-500 p-1"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {navAdmin.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} onClick={() => setMaisAberto(false)}
                className={({ isActive }) => clsx(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all',
                  isActive
                    ? 'border-pizza-500/40 bg-pizza-500/10 text-pizza-400'
                    : 'border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
                )}>
                <Icon size={20} />
                <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
              </NavLink>
            ))}
          </div>
          <button onClick={() => { setMaisAberto(false); onLogout() }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-900/40 text-red-400 text-sm">
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}

      {/* Barra inferior */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 flex items-center justify-around px-1 py-1">
        {navMobile.map(({ to, icon: Icon, label }) => {
          const isWhatsApp = to === '/whatsapp'
          return (
            <NavLink key={to} to={to}
              className={({ isActive }) => clsx(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all flex-1',
                isActive ? 'text-pizza-400' : 'text-gray-500'
              )}>
              <div className="relative">
                <Icon size={22} />
                {isWhatsApp && alertasCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse">
                    {alertasCount > 9 ? '9+' : alertasCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          )
        })}

        {/* Botão Mais — só aparece se tiver itens admin */}
        {temAdmin ? (
          <button onClick={() => setMaisAberto(v => !v)}
            className={clsx(
              'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all flex-1',
              maisAberto ? 'text-pizza-400' : 'text-gray-500'
            )}>
            <MoreHorizontal size={22} />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        ) : (
          <button onClick={onLogout}
            className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-gray-500 flex-1">
            <LogOut size={22} />
            <span className="text-[10px] font-medium">Sair</span>
          </button>
        )}
      </nav>
    </>
  )
}

import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, KanbanSquare, Settings, LogOut,
  Package, Users, BarChart3, UtensilsCrossed,
  ClipboardList, History, TrendingUp, MessageCircle, MoreHorizontal, X
} from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '../../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useEffect, useRef, useState } from 'react'
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

  const navMobile = navFuncionario

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-16 lg:w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex-col">
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

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-hidden flex flex-col pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Barra de navegação inferior — mobile only */}
      <MobileNav
        navMobile={navMobile}
        navAdmin={isProprietario ? navAdmin : []}
        alertasCount={alertasCount}
        onLogout={handleLogout}
      />
    </div>
  )
}
