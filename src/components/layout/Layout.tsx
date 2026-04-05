import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, KanbanSquare, ChefHat,
  Truck, Settings, LogOut, Package, Users, BarChart3,
  Pizza, UtensilsCrossed
} from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

const navFuncionario = [
  { to: '/pdv',      icon: ShoppingCart,  label: 'PDV' },
  { to: '/kanban',   icon: KanbanSquare,  label: 'Kanban' },
  { to: '/cozinha',  icon: ChefHat,       label: 'Cozinha' },
  { to: '/entregas', icon: Truck,         label: 'Entregas' },
]

const navAdmin = [
  { to: '/dashboard',       icon: BarChart3,       label: 'Dashboard' },
  { to: '/admin/clientes',  icon: Users,           label: 'Clientes' },
  { to: '/admin/pizzas',    icon: Pizza,           label: 'Pizzas' },
  { to: '/admin/cardapio',  icon: UtensilsCrossed, label: 'Cardápio' },
  { to: '/admin/estoque',   icon: Package,         label: 'Estoque' },
  { to: '/admin/equipe',    icon: Settings,        label: 'Equipe' },
]

export function Layout() {
  const { usuario, logout } = useAuthStore()
  const navigate = useNavigate()
  const isProprietario = usuario?.role === 'proprietario'

  const handleLogout = async () => {
    await logout()
    toast.success('Até logo!')
    navigate('/login')
  }

  const navItems = isProprietario ? [...navFuncionario, ...navAdmin] : navFuncionario

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className="w-16 lg:w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-gray-800">
          <span className="text-2xl">🍕</span>
          <span className="hidden lg:block font-bold text-gray-100 text-sm">PDV Pizzaria</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-pizza-500/20 text-pizza-400 border border-pizza-500/30'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-pizza-500/20 border border-pizza-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-pizza-400">
                {usuario?.nome?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-300 truncate">{usuario?.nome}</p>
              <p className="text-xs text-gray-600 capitalize">{usuario?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-all"
          >
            <LogOut size={14} />
            <span className="hidden lg:block">Sair</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}
