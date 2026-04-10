import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LoadingPage, Empty } from '../components/ui'
import { Search } from 'lucide-react'
import { format, subDays, startOfWeek, startOfMonth, startOfYear } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Periodo = 'dia' | 'semana' | 'mes' | 'ano'

function getPeriodo(p: Periodo) {
  const hoje = new Date()
  const fim = format(hoje, 'yyyy-MM-dd')
  let inicio = fim
  if (p === 'semana') inicio = format(startOfWeek(hoje, { weekStartsOn: 0 }), 'yyyy-MM-dd')
  if (p === 'mes')    inicio = format(startOfMonth(hoje), 'yyyy-MM-dd')
  if (p === 'ano')    inicio = format(startOfYear(hoje), 'yyyy-MM-dd')
  return { inicio, fim }
}

export function InsightsPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [buscaCliente, setBuscaCliente] = useState('')
  const { inicio, fim } = getPeriodo(periodo)

  // Pedidos do período
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['insights-pedidos', inicio, fim],
    queryFn: async () => {
      const { data } = await supabase.from('pedidos')
        .select('*, cliente:clientes(nome, telefone), itens_pedido(*, pizza:pizzas!itens_pedido_pizza_id_fkey(nome), pizza_metade_1:pizzas!itens_pedido_pizza_metade_1_id_fkey(nome), pizza_metade_2:pizzas!itens_pedido_pizza_metade_2_id_fkey(nome), bebida:bebidas(nome), outro:outros_produtos(nome))')
        .gte('data_criacao', `${inicio}T00:00:00`)
        .lte('data_criacao', `${fim}T23:59:59`)
        .not('status', 'eq', 'devolvido')
      return data ?? []
    }
  })

  const pedidosArr = pedidos as any[]

  // KPIs gerais
  const totalPedidos = pedidosArr.length
  const totalReceita = pedidosArr.filter(p => p.status === 'finalizado').reduce((a, p) => a + Number(p.valor_total), 0)
  const ticketMedio = totalPedidos ? totalReceita / pedidosArr.filter(p => p.status === 'finalizado').length || 0 : 0

  // Pedidos por cliente
  const porCliente: Record<string, { nome: string; tel: string; qtd: number; total: number }> = {}
  pedidosArr.forEach(p => {
    const key = p.cliente_telefone || 'sem-tel'
    if (!porCliente[key]) porCliente[key] = { nome: p.cliente?.nome || 'Sem cadastro', tel: p.cliente_telefone || '—', qtd: 0, total: 0 }
    porCliente[key].qtd++
    porCliente[key].total += Number(p.valor_total)
  })
  const clientesOrdenados = Object.values(porCliente)
    .sort((a, b) => b.qtd - a.qtd)
    .filter(c => !buscaCliente || c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) || c.tel.includes(buscaCliente))

  // Produtos mais/menos vendidos
  const produtosContagem: Record<string, { nome: string; qtd: number }> = {}
  pedidosArr.forEach(p => {
    (p.itens_pedido || []).forEach((item: any) => {
      let nome = ''
      if (item.meia_pizza) {
        if (item.pizza_metade_1?.nome) { produtosContagem[`p-${item.pizza_metade_1_id}`] = produtosContagem[`p-${item.pizza_metade_1_id}`] || { nome: item.pizza_metade_1.nome, qtd: 0 }; produtosContagem[`p-${item.pizza_metade_1_id}`].qtd += item.quantidade }
        if (item.pizza_metade_2?.nome) { produtosContagem[`p-${item.pizza_metade_2_id}`] = produtosContagem[`p-${item.pizza_metade_2_id}`] || { nome: item.pizza_metade_2.nome, qtd: 0 }; produtosContagem[`p-${item.pizza_metade_2_id}`].qtd += item.quantidade }
        return
      }
      nome = item.pizza?.nome || item.bebida?.nome || item.outro?.nome || ''
      if (!nome) return
      const key = `${item.tipo_item}-${item.pizza_id || item.bebida_id || item.outro_id}`
      if (!produtosContagem[key]) produtosContagem[key] = { nome, qtd: 0 }
      produtosContagem[key].qtd += item.quantidade
    })
  })
  const produtosOrdenados = Object.values(produtosContagem).sort((a, b) => b.qtd - a.qtd)
  const maisPedidos = produtosOrdenados.slice(0, 10)
  const menosPedidos = [...produtosOrdenados].sort((a, b) => a.qtd - b.qtd).slice(0, 10)

  // Gráfico por dia (barras simples em SVG)
  const porDia: Record<string, { pedidos: number; receita: number }> = {}
  pedidosArr.forEach(p => {
    const dia = p.data_criacao.split('T')[0]
    if (!porDia[dia]) porDia[dia] = { pedidos: 0, receita: 0 }
    porDia[dia].pedidos++
    if (p.status === 'finalizado') porDia[dia].receita += Number(p.valor_total)
  })
  const diasOrdenados = Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b))
  const maxReceita = Math.max(...diasOrdenados.map(([, v]) => v.receita), 1)
  const maxPedidos = Math.max(...diasOrdenados.map(([, v]) => v.pedidos), 1)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-5 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <h1 className="font-semibold text-gray-100 text-sm">Insights</h1>
        <div className="flex gap-1">
          {(['dia','semana','mes','ano'] as Periodo[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all capitalize ${periodo === p ? 'bg-pizza-500/20 text-pizza-400 border-pizza-500/40' : 'text-gray-500 border-gray-700 hover:border-gray-600'}`}>
              {p === 'dia' ? 'Hoje' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mês' : 'Ano'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-6">
        {isLoading ? <LoadingPage /> : <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4"><div className="text-xs text-gray-500 mb-1">Total pedidos</div><div className="text-2xl font-bold text-gray-100">{totalPedidos}</div></div>
            <div className="card p-4"><div className="text-xs text-gray-500 mb-1">Receita</div><div className="text-2xl font-bold text-green-400">R$ {totalReceita.toFixed(2)}</div></div>
            <div className="card p-4"><div className="text-xs text-gray-500 mb-1">Ticket médio</div><div className="text-2xl font-bold text-gray-100">R$ {ticketMedio.toFixed(2)}</div></div>
          </div>

          {/* Gráfico de barras */}
          {diasOrdenados.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-gray-300 mb-4 text-sm">Vendas por dia</h3>
              <div className="flex items-end gap-1 h-32 overflow-x-auto pb-2">
                {diasOrdenados.map(([dia, val]) => (
                  <div key={dia} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: '32px' }}>
                    <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: '96px' }}>
                      <div className="w-full rounded-t bg-pizza-500/70 transition-all"
                        style={{ height: `${(val.receita / maxReceita) * 80}px`, minHeight: val.receita > 0 ? '2px' : '0' }}
                        title={`R$ ${val.receita.toFixed(2)}`} />
                    </div>
                    <span className="text-xs text-gray-600" style={{ fontSize: '9px' }}>
                      {format(new Date(dia + 'T12:00:00'), 'dd/MM')}
                    </span>
                    <span className="text-xs text-gray-500" style={{ fontSize: '9px' }}>{val.pedidos}p</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                <div className="w-3 h-3 rounded bg-pizza-500/70" /> Receita por dia
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pedidos por cliente */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-300 text-sm">👤 Pedidos por cliente</h3>
              </div>
              <div className="relative mb-3">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)}
                  placeholder="Buscar cliente..." className="input text-xs py-1.5 pl-8" />
              </div>
              {!clientesOrdenados.length ? <Empty icon="👤" title="Nenhum dado" /> : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {clientesOrdenados.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                      <div>
                        <p className="text-sm text-gray-300 font-medium">{c.nome}</p>
                        <p className="text-xs text-gray-600">{c.tel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-200">{c.qtd} pedido{c.qtd !== 1 ? 's' : ''}</p>
                        <p className="text-xs text-green-400">R$ {c.total.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mais e menos vendidos */}
            <div className="space-y-4">
              <div className="card p-4">
                <h3 className="font-semibold text-gray-300 text-sm mb-3">🔥 Mais vendidos</h3>
                {!maisPedidos.length ? <Empty icon="📊" title="Sem dados" /> : (
                  <div className="space-y-1">
                    {maisPedidos.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800/50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-4">{i + 1}.</span>
                          <span className="text-sm text-gray-300">{p.nome}</span>
                        </div>
                        <span className="text-sm font-bold text-pizza-400">{p.qtd}x</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card p-4">
                <h3 className="font-semibold text-gray-300 text-sm mb-3">📉 Menos vendidos</h3>
                {!menosPedidos.length ? <Empty icon="📊" title="Sem dados" /> : (
                  <div className="space-y-1">
                    {menosPedidos.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800/50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-4">{i + 1}.</span>
                          <span className="text-sm text-gray-300">{p.nome}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-500">{p.qtd}x</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>}
      </div>
    </div>
  )
}
