import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { pedidosDb } from '../lib/db'
import { StatusBadge, Spinner } from '../components/ui'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Printer, ChevronRight, AlertTriangle } from 'lucide-react'
import type { StatusPedido } from '../lib/supabase'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const COLUNAS: {
  status: StatusPedido
  label: string
  cor: string
  acoes: { label: string; prox: StatusPedido; variant?: string }[]
}[] = [
  {
    status: 'solicitado', label: 'Solicitados', cor: 'border-t-yellow-500',
    acoes: [
      { label: 'Iniciar preparo', prox: 'fazendo' },
      { label: 'Devolver', prox: 'devolvido', variant: 'danger' }
    ]
  },
  {
    status: 'fazendo', label: 'Fazendo', cor: 'border-t-orange-500',
    acoes: [{ label: 'Marcar pronto', prox: 'pronto' }]
  },
  {
    status: 'pronto', label: 'Prontos', cor: 'border-t-green-500',
    acoes: [] // ações dinâmicas por tipo de pedido — ver KanbanCard
  },
  {
    status: 'delivery', label: 'Delivery', cor: 'border-t-blue-500',
    acoes: [
      { label: 'Finalizar', prox: 'finalizado' },
      { label: 'Devolver', prox: 'devolvido', variant: 'danger' }
    ]
  },
  {
    status: 'balcao', label: 'Balcão', cor: 'border-t-purple-500',
    acoes: [
      { label: 'Finalizar', prox: 'finalizado' },
      { label: 'Devolver', prox: 'devolvido', variant: 'danger' }
    ]
  },
]

export function KanbanPage() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [ultimoCount, setUltimoCount] = useState(0)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pedidos-ativos'],
    queryFn: pedidosDb.listarAtivos,
    refetchInterval: 10_000, // atualiza a cada 10 segundos
    refetchIntervalInBackground: true,
  })

  useEffect(() => {
    if (!data) return
    // Alerta sonoro se chegou pedido novo
    if (ultimoCount > 0 && data.length > ultimoCount) {
      const novos = data.length - ultimoCount
      for (let i = 0; i < novos; i++) {
        setTimeout(() => {
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.setValueAtTime(880, ctx.currentTime)
            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.4)
          } catch {}
          toast.success(`🍕 Novo pedido chegou!`, { duration: 8000 })
        }, i * 500)
      }
    }
    setUltimoCount(data.length)
    setPedidos(data as any)
  }, [data])

  const { mutate: mudarStatus } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: StatusPedido }) =>
      pedidosDb.atualizarStatus(id, status),
    onSuccess: (_, { id, status }) => {
      setPedidos(prev => {
        if (['finalizado', 'devolvido'].includes(status)) {
          return prev.filter(p => p.id !== id)
        }
        return prev.map(p => p.id === id ? { ...p, status } : p)
      })
      toast.success(`Status atualizado → ${status}`)
      // Força atualização imediata
      setTimeout(() => refetch(), 500)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const porStatus = (status: StatusPedido) =>
    pedidos
      .filter(p => p.status === status)
      .sort((a, b) => new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime())

  if (isLoading && !pedidos.length) return (
    <div className="flex items-center justify-center h-full">
      <Spinner size="lg" />
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <h1 className="font-semibold text-gray-100 text-sm">Kanban de Pedidos</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400">Atualizando a cada 10s</span>
          </div>
          <span className="text-xs text-gray-500">{pedidos.length} pedidos ativos</span>
          <button onClick={() => refetch()} className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-2 py-1 rounded">
            ↻ Atualizar
          </button>
        </div>
      </div>

      <div className="flex gap-3 p-3 overflow-x-auto flex-1">
        {COLUNAS.map(col => (
          <div key={col.status}
            className={clsx('flex-shrink-0 w-72 bg-gray-900 rounded-xl border border-gray-800 border-t-2 flex flex-col', col.cor)}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
              <span className="text-sm font-medium text-gray-300">{col.label}</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                {porStatus(col.status).length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {porStatus(col.status).length === 0
                ? <div className="flex items-center justify-center py-12 text-gray-700 text-sm">Vazio</div>
                : porStatus(col.status).map(pedido => (
                    <KanbanCard
                      key={pedido.id}
                      pedido={pedido}
                      onMudar={(status) => mudarStatus({ id: pedido.id, status })}
                    />
                  ))
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function KanbanCard({ pedido, onMudar }: {
  pedido: any
  onMudar: (status: StatusPedido) => void
}) {
  const minutos = Math.floor((Date.now() - new Date(pedido.data_criacao).getTime()) / 60000)
  const atrasado = ['fazendo', 'solicitado'].includes(pedido.status) && minutos > 30
  const tempo = formatDistanceToNow(new Date(pedido.data_criacao), { locale: ptBR })

  const imprimirProducao = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(gerarHTMLProducao(pedido))
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  return (
    <div className={clsx(
      'bg-gray-800/80 rounded-xl border p-3 space-y-2.5 transition-all',
      atrasado ? 'border-red-800/60 alert-pulse' : 'border-gray-700/50'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-bold text-gray-100 text-lg leading-none">#{pedido.id}</span>
          {pedido.tipo?.includes('delivery') && (
            <span className="ml-2 badge bg-blue-900/40 text-blue-400 border border-blue-800/40">🛵</span>
          )}
          {pedido.tipo === 'mesa' && pedido.mesa && (
            <span className="ml-2 badge bg-amber-900/40 text-amber-400 border border-amber-800/40">
              🪑 {pedido.mesa.nome}
            </span>
          )}
          {pedido.origem === 'whatsapp' && (
            <span className="ml-1 badge bg-green-900/40 text-green-400 border border-green-800/40">📱</span>
          )}
        </div>
        <div className={clsx('text-xs flex items-center gap-1', atrasado ? 'text-red-400 font-medium' : 'text-gray-500')}>
          {atrasado && <AlertTriangle size={11} />}
          {atrasado ? `${minutos}min ⚠️` : tempo}
        </div>
      </div>

      {pedido.cliente && (
        <p className="text-sm text-gray-300 font-medium leading-none">👤 {pedido.cliente.nome}</p>
      )}

      <div className="space-y-1">
        {(pedido.itens_pedido || []).map((item: any, i: number) => (
          <div key={i} className="text-xs text-gray-400 flex gap-1.5">
            <span className="text-gray-600 flex-shrink-0">{item.quantidade}x</span>
            <span>
              {item.meia_pizza
                ? `½ ${item.pizza_metade_1?.nome} + ½ ${item.pizza_metade_2?.nome}`
                : item.pizza?.nome || item.bebida?.nome || item.outro?.nome}
              {item.borda && <span className="text-pizza-400"> +borda {item.borda.nome}</span>}
              {item.adicionais_item?.length > 0 && (
                <span className="text-green-500"> +{item.adicionais_item.map((a: any) => a.ingrediente?.nome).join(', ')}</span>
              )}
              {item.observacao && <span className="text-yellow-500 italic"> ({item.observacao})</span>}
            </span>
          </div>
        ))}
      </div>

      {pedido.observacao && (
        <p className="text-xs text-yellow-400 bg-yellow-900/20 rounded px-2 py-1 border border-yellow-900/30">
          💬 {pedido.observacao}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{pedido.forma_pagamento || '—'}</span>
        <span className="font-bold text-gray-200">R$ {Number(pedido.valor_total).toFixed(2)}</span>
      </div>

      <div className="flex gap-1.5 flex-wrap pt-0.5">
        <button onClick={imprimirProducao}
          className="btn-ghost p-1.5 text-gray-600 hover:text-gray-300" title="Imprimir comanda">
          <Printer size={14} />
        </button>

        {/* Ações dinâmicas baseadas no status e tipo */}
        {pedido.status === 'solicitado' && <>
          <button onClick={() => onMudar('fazendo')}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-pizza-500/20 text-pizza-400 hover:bg-pizza-500/30 border border-pizza-500/20 flex items-center justify-center gap-1">
            Iniciar preparo <ChevronRight size={11} />
          </button>
          <button onClick={() => onMudar('devolvido')}
            className="text-xs py-1.5 px-2 rounded-lg font-medium bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900/30">
            Devolver
          </button>
        </>}

        {pedido.status === 'fazendo' && (
          <button onClick={() => onMudar('pronto')}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-pizza-500/20 text-pizza-400 hover:bg-pizza-500/30 border border-pizza-500/20 flex items-center justify-center gap-1">
            Marcar pronto <ChevronRight size={11} />
          </button>
        )}

        {pedido.status === 'pronto' && pedido.tipo === 'mesa' && (
          <button onClick={() => onMudar('balcao')}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/20 flex items-center justify-center gap-1">
            🪑 Entregar na {pedido.mesa?.nome || 'mesa'}
          </button>
        )}

        {pedido.status === 'pronto' && pedido.tipo !== 'mesa' && <>
          {pedido.tipo?.includes('delivery') && (
            <button onClick={() => onMudar('delivery')}
              className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-pizza-500/20 text-pizza-400 hover:bg-pizza-500/30 border border-pizza-500/20 flex items-center justify-center gap-1">
              Saiu p/ entrega <ChevronRight size={11} />
            </button>
          )}
          {!pedido.tipo?.includes('delivery') && (
            <button onClick={() => onMudar('balcao')}
              className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-pizza-500/20 text-pizza-400 hover:bg-pizza-500/30 border border-pizza-500/20 flex items-center justify-center gap-1">
              Retirou no balcão <ChevronRight size={11} />
            </button>
          )}
        </>}

        {(pedido.status === 'delivery' || pedido.status === 'balcao') && <>
          <button onClick={() => onMudar('finalizado')}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-pizza-500/20 text-pizza-400 hover:bg-pizza-500/30 border border-pizza-500/20 flex items-center justify-center gap-1">
            Finalizar <ChevronRight size={11} />
          </button>
          <button onClick={() => onMudar('devolvido')}
            className="text-xs py-1.5 px-2 rounded-lg font-medium bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900/30">
            Devolver
          </button>
        </>}
      </div>
    </div>
  )
}

function gerarHTMLProducao(pedido: any): string {
  const itens = (pedido.itens_pedido || []).map((item: any) => {
    let desc = ''
    if (item.meia_pizza) {
      desc = `½ ${item.pizza_metade_1?.nome || ''} + ½ ${item.pizza_metade_2?.nome || ''}`
    } else {
      desc = item.pizza?.nome || item.bebida?.nome || item.outro?.nome || ''
    }
    if (item.borda) desc += ` | Borda: ${item.borda.nome}`
    if (item.adicionais_item?.length) {
      desc += ` | +${item.adicionais_item.map((a: any) => `${a.ingrediente?.nome}${a.aplicado_em !== 'inteira' ? ` (${a.aplicado_em})` : ''}`).join(', ')}`
    }
    if (item.observacao) desc += ` | Obs: ${item.observacao}`
    return `<div class="item"><span>${item.quantidade}x ${desc}</span></div>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; }
    h1 { font-size: 15px; text-align: center; margin: 0 0 4px; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .item { margin: 3px 0; }
    .label { font-size: 10px; text-transform: uppercase; color: #555; }
  </style></head>
  <body>
    <h1>🍕 PRODUÇÃO</h1>
    <div class="label">Pedido</div>
    <div><strong>#${pedido.id}</strong> · ${new Date(pedido.data_criacao).toLocaleString('pt-BR')}</div>
    <div class="divider"></div>
    <div class="label">Cliente</div>
    <div>${pedido.cliente?.nome || 'Balcão'}</div>
    ${pedido.tipo?.includes('delivery') ? `<div>${pedido.cliente?.condominio?.nome || ''} · Q${pedido.cliente?.quadra} L${pedido.cliente?.lote}</div>` : ''}
    <div class="divider"></div>
    <div class="label">Itens</div>
    ${itens}
    ${pedido.observacao ? `<div class="divider"></div><div><strong>Obs:</strong> ${pedido.observacao}</div>` : ''}
    <div class="divider"></div>
    <div style="text-align:center;font-size:10px">--- SEM VALOR ---</div>
  </body></html>`
}