import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pedidosDb } from '../lib/db'
import { StatusBadge, LoadingPage, Empty } from '../components/ui'
import { Search } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'

const LABEL_TIPO: Record<string, string> = {
  delivery: '🛵 Delivery',
  retirada: '🏪 Retirada',
  mesa: '🪑 Mesa',
  balcao_retirada: '🏪 Retirada',
  balcao_delivery: '🛵 Delivery',
  online_retirada: '🏪 Retirada',
  online_delivery: '🛵 Delivery',
}

export function HistoricoPage() {
  const hoje = format(new Date(), 'yyyy-MM-dd')
  const [filtros, setFiltros] = useState({
    dataInicio: hoje,
    dataFim: hoje,
    status: '',
    clienteTelefone: '',
    busca: '',
  })
  const [pedidoAberto, setPedidoAberto] = useState<any | null>(null)

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['historico', filtros],
    queryFn: () => pedidosDb.listar({
      data: filtros.dataInicio === filtros.dataFim ? filtros.dataInicio : undefined,
      status: filtros.status || undefined,
      clienteTelefone: filtros.clienteTelefone || undefined,
    })
  })

  const pedidosFiltrados = (pedidos as any[]).filter(p => {
    if (filtros.busca) {
      const b = filtros.busca.toLowerCase()
      const matchId = String(p.id).includes(b)
      const matchCliente = p.cliente?.nome?.toLowerCase().includes(b)
      const matchTel = p.cliente_telefone?.includes(b)
      if (!matchId && !matchCliente && !matchTel) return false
    }
    if (filtros.dataInicio && filtros.dataFim && filtros.dataInicio !== filtros.dataFim) {
      const data = new Date(p.data_criacao)
      const inicio = new Date(filtros.dataInicio + 'T00:00:00')
      const fim = new Date(filtros.dataFim + 'T23:59:59')
      if (data < inicio || data > fim) return false
    }
    return true
  })

  const f = (k: string, v: string) => setFiltros(x => ({ ...x, [k]: v }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <h1 className="font-semibold text-gray-100 text-sm">Histórico de Pedidos</h1>
        <span className="text-xs text-gray-500">{pedidosFiltrados.length} pedidos</span>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 py-3 flex flex-wrap gap-3">
        <div>
          <label className="label">Data início</label>
          <input type="date" value={filtros.dataInicio} onChange={e => f('dataInicio', e.target.value)}
            className="input text-xs py-1.5 w-36" />
        </div>
        <div>
          <label className="label">Data fim</label>
          <input type="date" value={filtros.dataFim} onChange={e => f('dataFim', e.target.value)}
            className="input text-xs py-1.5 w-36" />
        </div>
        <div>
          <label className="label">Status</label>
          <select value={filtros.status} onChange={e => f('status', e.target.value)} className="input text-xs py-1.5 w-36">
            <option value="">Todos</option>
            <option value="finalizado">Finalizado</option>
            <option value="devolvido">Devolvido</option>
            <option value="solicitado">Solicitado</option>
            <option value="fazendo">Fazendo</option>
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="label">Buscar</label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input value={filtros.busca} onChange={e => f('busca', e.target.value)}
              placeholder="ID, nome ou telefone..."
              className="input text-xs py-1.5 pl-8 w-full" />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? <LoadingPage /> : !pedidosFiltrados.length ? (
          <Empty icon="📋" title="Nenhum pedido encontrado" desc="Ajuste os filtros para buscar" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['#','Data','Cliente','Tipo','Status','Total',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {pedidosFiltrados.map(p => (
                  <tr key={p.id} className="hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => setPedidoAberto(p)}>
                    <td className="px-4 py-3 font-bold text-gray-200">#{p.id}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {format(new Date(p.data_criacao), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{p.cliente?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{LABEL_TIPO[p.tipo] || p.tipo}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className={clsx('px-4 py-3 font-bold text-sm',
                      p.status === 'devolvido' ? 'text-red-400' : 'text-gray-200'
                    )}>
                      R$ {Number(p.valor_total).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-pizza-400">Ver detalhes →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal detalhe */}
      {pedidoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setPedidoAberto(null)}>
          <div className="absolute inset-0 bg-black/70" onClick={() => setPedidoAberto(null)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-semibold text-gray-100">Pedido #{pedidoAberto.id}</h2>
              <button onClick={() => setPedidoAberto(null)} className="text-gray-500 hover:text-gray-300 text-xl">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Data:</span> <span className="text-gray-300">{format(new Date(pedidoAberto.data_criacao), "dd/MM/yyyy HH:mm")}</span></div>
                <div><span className="text-gray-500">Status:</span> <StatusBadge status={pedidoAberto.status} /></div>
                <div><span className="text-gray-500">Tipo:</span> <span className="text-gray-300">{LABEL_TIPO[pedidoAberto.tipo] || pedidoAberto.tipo}</span></div>
                <div><span className="text-gray-500">Pagamento:</span> <span className="text-gray-300">{pedidoAberto.forma_pagamento || '—'}</span></div>
                {pedidoAberto.cliente && (
                  <div className="col-span-2"><span className="text-gray-500">Cliente:</span> <span className="text-gray-300">{pedidoAberto.cliente.nome} · {pedidoAberto.cliente_telefone}</span></div>
                )}
              </div>
              <div className="border-t border-gray-800 pt-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Itens</p>
                {(pedidoAberto.itens_pedido || []).map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span className="text-gray-400">{item.quantidade}x {item.meia_pizza ? `½ ${item.pizza_metade_1?.nome} + ½ ${item.pizza_metade_2?.nome}` : item.pizza?.nome || item.bebida?.nome || item.outro?.nome}</span>
                    <span className="text-gray-300">R$ {(Number(item.valor_unitario) * item.quantidade).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-800 pt-3 flex justify-between font-bold">
                <span className="text-gray-300">Total</span>
                <span className={pedidoAberto.status === 'devolvido' ? 'text-red-400' : 'text-gray-100'}>
                  R$ {Number(pedidoAberto.valor_total).toFixed(2)}
                </span>
              </div>
              {pedidoAberto.observacao && (
                <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-2 text-xs text-yellow-400">
                  💬 {pedidoAberto.observacao}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
