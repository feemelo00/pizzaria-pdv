import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { financeiroDb, ingredientesDb } from '../lib/db'
import { LoadingPage } from '../components/ui'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, ShoppingBag, Truck, AlertTriangle, Users } from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase'

export function DashboardPage() {
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data: kpis, isLoading } = useQuery({
    queryKey: ['kpis', data],
    queryFn: () => financeiroDb.kpisDia(data),
    refetchInterval: 60_000
  })
  const { data: estoqueBaixo = [] } = useQuery({
    queryKey: ['estoque-baixo'],
    queryFn: ingredientesDb.listarEstoqueBaixo,
    refetchInterval: 120_000
  })
  const { data: totalClientes } = useQuery({
    queryKey: ['total-clientes'],
    queryFn: async () => {
      const { count } = await supabase.from('clientes').select('*', { count: 'exact', head: true })
      return count ?? 0
    }
  })

  if (isLoading) return <LoadingPage />

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-5 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <h1 className="font-semibold text-gray-100 text-sm">Dashboard</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-pizza-500" />
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Cards KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Faturamento" valor={`R$ ${(kpis?.faturamento || 0).toFixed(2)}`}
            icon={<TrendingUp size={18} />} cor="green" />
          <KPICard label="Prejuízo" valor={`R$ ${(kpis?.prejuizo || 0).toFixed(2)}`}
            icon={<TrendingDown size={18} />} cor="red"
            alerta={(kpis?.prejuizo || 0) > 0} />
          <KPICard label="Pedidos" valor={kpis?.totalPedidos || 0}
            icon={<ShoppingBag size={18} />} cor="orange" />
          <KPICard label="Deliveries" valor={kpis?.totalDelivery || 0}
            icon={<Truck size={18} />} cor="blue" />
        </div>

        {/* Cards secundários */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Balcão" valor={kpis?.totalBalcao || 0} icon={<ShoppingBag size={16} />} cor="gray" small />
          <KPICard label="Devolvidos" valor={kpis?.devolvidos || 0} icon={<TrendingDown size={16} />} cor="gray" small />
          <KPICard label="Ticket médio" valor={`R$ ${(kpis?.ticketMedio || 0).toFixed(2)}`} icon={<TrendingUp size={16} />} cor="gray" small />
          <KPICard label="Clientes" valor={totalClientes || 0} icon={<Users size={16} />} cor="gray" small />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Entregas por motoboy */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-300 mb-3 text-sm flex items-center gap-2">
              <Truck size={15} className="text-pizza-400" /> Entregas por Motoboy
            </h3>
            {!kpis?.porMotoboy?.length
              ? <p className="text-xs text-gray-600 py-4 text-center">Nenhuma entrega registrada hoje</p>
              : kpis.porMotoboy.map((m: any) => (
                  <div key={m.nome} className="py-2.5 border-b border-gray-800 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-300">🛵 {m.nome}</span>
                      <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full">
                        {m.qtd} entrega{m.qtd !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 flex flex-wrap gap-2">
                      {Object.entries(m.condominios).map(([cond, qtd]: any) => (
                        <span key={cond}>{cond}: {qtd}x</span>
                      ))}
                    </div>
                  </div>
                ))
            }
          </div>

          {/* Estoque baixo */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-300 mb-3 text-sm flex items-center gap-2">
              <AlertTriangle size={15} className="text-yellow-500" /> Estoque Baixo
            </h3>
            {!(estoqueBaixo as any[]).length
              ? (
                <div className="flex items-center gap-2 py-4 text-green-500">
                  <span className="text-xl">✅</span>
                  <span className="text-sm">Todos os ingredientes em nível adequado</span>
                </div>
              )
              : (estoqueBaixo as any[]).map(ing => (
                  <div key={ing.id} className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
                    <span className="text-sm text-gray-300">{ing.nome}</span>
                    <div className="text-right">
                      <div className="text-xs font-bold text-red-400">
                        {Number(ing.quantidade_estoque).toFixed(3)} {ing.unidade}
                      </div>
                      <div className="text-xs text-gray-600">
                        mín: {Number(ing.estoque_minimo).toFixed(3)} {ing.unidade}
                      </div>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Data selecionada */}
        <p className="text-xs text-gray-700 text-center">
          Dados de {format(new Date(data + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>
    </div>
  )
}

function KPICard({ label, valor, icon, cor, alerta = false, small = false }: {
  label: string; valor: string | number; icon: React.ReactNode
  cor: string; alerta?: boolean; small?: boolean
}) {
  const cores: Record<string, string> = {
    green: 'bg-green-900/20 border-green-800/40 text-green-400',
    red:   'bg-red-900/20   border-red-800/40   text-red-400',
    orange:'bg-orange-900/20 border-orange-800/40 text-orange-400',
    blue:  'bg-blue-900/20  border-blue-800/40  text-blue-400',
    gray:  'bg-gray-800/50  border-gray-700/50  text-gray-400',
  }
  return (
    <div className={clsx('card p-4 border', cores[cor], alerta && 'ring-1 ring-red-500/40')}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
        <span className="opacity-60">{icon}</span>
      </div>
      <div className={clsx('font-bold', small ? 'text-xl' : 'text-2xl')}>{valor}</div>
    </div>
  )
}
