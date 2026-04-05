import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { pedidosDb } from '../lib/db'
import { useRealtimePedidos } from '../hooks/useRealtime'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export function CozinhaPage() {
  const [pedidos, setPedidos] = useState<any[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos-cozinha'],
    queryFn: pedidosDb.listarAtivos,
    refetchInterval: 20_000,
  })

  useEffect(() => { if (data) setPedidos(data) }, [data])

  useRealtimePedidos(useCallback((p, evento) => {
    if (evento === 'INSERT') {
      setPedidos(prev => prev.find(x => x.id === p.id) ? prev : [p, ...prev])
    } else {
      setPedidos(prev => {
        if (['finalizado','devolvido','pronto','delivery','balcao'].includes(p.status)) {
          return prev.filter(x => x.id !== p.id)
        }
        return prev.map(x => x.id === p.id ? { ...x, ...p } : x)
      })
    }
  }, []))

  const { mutate: marcarStatus } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      pedidosDb.atualizarStatus(id, status as any),
    onSuccess: (_, { id, status }) => {
      if (status === 'pronto') {
        setPedidos(prev => prev.filter(p => p.id !== id))
        toast.success('Pedido marcado como pronto! ✅')
      } else {
        setPedidos(prev => prev.map(p => p.id === id ? { ...p, status } : p))
      }
    }
  })

  const cozinha = pedidos.filter(p => ['solicitado', 'fazendo'].includes(p.status))
    .sort((a, b) => new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime())

  return (
    <div className="min-h-full bg-gray-950 flex flex-col overflow-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍳</span>
          <h1 className="text-lg font-bold text-gray-100">Cozinha</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400">Ao vivo</span>
          </div>
          <span className="text-sm text-gray-500">{cozinha.length} na fila</span>
        </div>
      </div>

      {/* Grid de pedidos */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-700 border-t-pizza-500" />
          </div>
        ) : cozinha.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-700">
            <CheckCircle size={48} className="mb-4" />
            <p className="text-xl font-medium">Fila vazia</p>
            <p className="text-sm mt-1">Nenhum pedido aguardando preparo</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {cozinha.map(pedido => (
              <CardCozinha key={pedido.id} pedido={pedido}
                onIniciar={() => marcarStatus({ id: pedido.id, status: 'fazendo' })}
                onPronto={() => marcarStatus({ id: pedido.id, status: 'pronto' })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CardCozinha({ pedido, onIniciar, onPronto }: {
  pedido: any; onIniciar: () => void; onPronto: () => void
}) {
  const minutos = Math.floor((Date.now() - new Date(pedido.data_criacao).getTime()) / 60000)
  const urgente  = minutos >= 20
  const critico  = minutos >= 35
  const fazendo  = pedido.status === 'fazendo'

  const tempo = formatDistanceToNow(new Date(pedido.data_criacao), { locale: ptBR, addSuffix: false })

  return (
    <div className={clsx(
      'rounded-2xl border-2 p-4 flex flex-col gap-3 transition-all',
      critico  ? 'border-red-600 bg-red-950/30' :
      urgente  ? 'border-yellow-600 bg-yellow-950/20' :
      fazendo  ? 'border-orange-600/60 bg-orange-950/20' :
                 'border-gray-700 bg-gray-900'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black text-white">#{pedido.id}</span>
            {pedido.tipo?.includes('delivery') && (
              <span className="text-xs bg-blue-900/50 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded-full">🛵</span>
            )}
          </div>
          <div className={clsx('text-xs font-semibold mt-0.5 flex items-center gap-1',
            fazendo ? 'text-orange-400' : 'text-yellow-500'
          )}>
            {fazendo
              ? <><Clock size={11} /> Em preparo</>
              : <><Clock size={11} /> Aguardando</>
            }
          </div>
        </div>
        <div className={clsx('text-right text-sm font-bold flex items-center gap-1',
          critico ? 'text-red-400' : urgente ? 'text-yellow-400' : 'text-gray-500'
        )}>
          {critico && <AlertTriangle size={14} />}
          {minutos}min
        </div>
      </div>

      {/* Cliente */}
      {pedido.cliente && (
        <p className="text-sm text-gray-300 font-medium">👤 {pedido.cliente.nome}</p>
      )}

      {/* Itens — sem preço */}
      <div className="space-y-2 flex-1">
        {(pedido.itens_pedido || []).map((item: any, i: number) => (
          <div key={i} className="bg-black/30 rounded-xl p-3">
            <div className="flex gap-2">
              <span className="text-white font-black text-xl leading-none flex-shrink-0">{item.quantidade}x</span>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm leading-tight">
                  {item.meia_pizza
                    ? <>½ {item.pizza_metade_1?.nome} <span className="text-gray-500">+</span> ½ {item.pizza_metade_2?.nome}</>
                    : item.pizza?.nome || item.bebida?.nome || item.outro?.nome
                  }
                </div>
                {item.borda && (
                  <div className="text-pizza-400 text-xs mt-0.5">🔴 Borda: {item.borda.nome}</div>
                )}
                {item.adicionais_item?.length > 0 && (
                  <div className="text-green-400 text-xs mt-0.5">
                    + {item.adicionais_item.map((a: any) => {
                      const em = a.aplicado_em !== 'inteira' ? ` (${a.aplicado_em === 'metade_1' ? '½1' : '½2'})` : ''
                      return `${a.ingrediente?.nome}${em}`
                    }).join(', ')}
                  </div>
                )}
                {item.observacao && (
                  <div className="text-yellow-400 text-xs italic mt-0.5">💬 {item.observacao}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Obs geral */}
      {pedido.observacao && (
        <div className="bg-yellow-900/30 border border-yellow-800/40 rounded-lg p-2 text-yellow-300 text-xs">
          💬 {pedido.observacao}
        </div>
      )}

      {/* Botão ação */}
      <button
        onClick={fazendo ? onPronto : onIniciar}
        className={clsx(
          'w-full py-3 rounded-xl font-bold text-base transition-all active:scale-95',
          fazendo
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-orange-600 hover:bg-orange-500 text-white'
        )}
      >
        {fazendo ? '✅ Marcar Pronto' : '🔥 Iniciar Preparo'}
      </button>
    </div>
  )
}
