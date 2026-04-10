import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { pedidosDb, motoboysDb } from '../lib/db'
import { supabase } from '../lib/supabase'
import { StatusBadge, Modal, Spinner } from '../components/ui'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Printer, ChevronRight, AlertTriangle, Truck } from 'lucide-react'
import type { StatusPedido, Motoboy } from '../lib/supabase'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const COLUNAS: { status: StatusPedido | 'na_mesa'; label: string; cor: string }[] = [
  { status: 'solicitado', label: 'Solicitados',  cor: 'border-t-yellow-500' },
  { status: 'fazendo',    label: 'Fazendo',      cor: 'border-t-orange-500' },
  { status: 'pronto',     label: 'Prontos',      cor: 'border-t-green-500'  },
  { status: 'delivery',   label: 'Delivery',     cor: 'border-t-blue-500'   },
  { status: 'balcao',     label: 'Balcão',       cor: 'border-t-purple-500' },
  { status: 'na_mesa',    label: 'Na Mesa',      cor: 'border-t-amber-500'  },
]

export function KanbanPage() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [ultimoCount, setUltimoCount] = useState(0)
  const [modalMotoboy, setModalMotoboy] = useState<{ pedidoId: number } | null>(null)

  const { data: motoboys = [] } = useQuery({ queryKey: ['motoboys'], queryFn: motoboysDb.listar })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pedidos-ativos'],
    queryFn: pedidosDb.listarAtivos,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  })

  useEffect(() => {
    if (!data) return
    if (ultimoCount > 0 && (data as any[]).length > ultimoCount) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4)
      } catch {}
      toast.success('🍕 Novo pedido chegou!', { duration: 8000 })
    }
    setUltimoCount((data as any[]).length)
    setPedidos(data as any)
  }, [data])

  const { mutate: mudarStatus } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: StatusPedido }) =>
      pedidosDb.atualizarStatus(id, status),
    onSuccess: (_, { id, status }) => {
      setPedidos(prev => {
        if (['finalizado','devolvido'].includes(status)) return prev.filter(p => p.id !== id)
        return prev.map(p => p.id === id ? { ...p, status } : p)
      })
      toast.success(`Status → ${status}`)
      setTimeout(() => refetch(), 500)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const { mutate: despacharDelivery, isPending: despachando } = useMutation({
    mutationFn: async ({ pedidoId, motoboyId }: { pedidoId: number; motoboyId: number }) => {
      await pedidosDb.atualizarStatus(pedidoId, 'delivery', { motoboy_id: motoboyId })
      await supabase.from('entregas').upsert(
        { pedido_id: pedidoId, motoboy_id: motoboyId, status: 'saiu', data_saida: new Date().toISOString() },
        { onConflict: 'pedido_id' }
      )
      return { pedidoId, motoboyId }
    },
    onSuccess: ({ pedidoId, motoboyId }) => {
      const motoboy = (motoboys as Motoboy[]).find(m => m.id === motoboyId)
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, status: 'delivery', motoboy, motoboy_id: motoboyId } : p))
      setModalMotoboy(null)
      // Imprimir nota de entrega
      const pedido = pedidos.find(p => p.id === pedidoId)
      if (pedido && motoboy) {
        const win = window.open('', '_blank')
        if (win) { win.document.write(gerarHTMLEntrega({ ...pedido, motoboy })); win.document.close(); setTimeout(() => win.print(), 500) }
      }
      toast.success('Motoboy despachado!')
      refetch()
    },
    onError: (e: Error) => toast.error(e.message)
  })

  const porStatus = (status: string) => {
    if (status === 'na_mesa') return pedidos.filter(p => p.status === 'balcao' && p.tipo === 'mesa').sort((a,b) => new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime())
    if (status === 'balcao')  return pedidos.filter(p => p.status === 'balcao' && p.tipo !== 'mesa').sort((a,b) => new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime())
    return pedidos.filter(p => p.status === status).sort((a,b) => new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime())
  }

  if (isLoading && !pedidos.length) return (
    <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
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
          <span className="text-xs text-gray-500">{pedidos.length} ativos</span>
          <button onClick={() => refetch()} className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-2 py-1 rounded">↻</button>
        </div>
      </div>

      <div className="flex gap-3 p-3 overflow-x-auto flex-1">
        {COLUNAS.map(col => (
          <div key={String(col.status)}
            className={clsx('flex-shrink-0 w-72 bg-gray-900 rounded-xl border border-gray-800 border-t-2 flex flex-col', col.cor)}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
              <span className="text-sm font-medium text-gray-300">{col.label}</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{porStatus(String(col.status)).length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {porStatus(String(col.status)).length === 0
                ? <div className="flex items-center justify-center py-12 text-gray-700 text-sm">Vazio</div>
                : porStatus(String(col.status)).map(pedido => (
                    <KanbanCard key={pedido.id} pedido={pedido}
                      onMudar={(status) => mudarStatus({ id: pedido.id, status })}
                      onDespachar={() => setModalMotoboy({ pedidoId: pedido.id })}
                    />
                  ))
              }
            </div>
          </div>
        ))}
      </div>

      {/* Modal motoboy */}
      <ModalMotoboy
        open={!!modalMotoboy}
        motoboys={motoboys as Motoboy[]}
        onClose={() => setModalMotoboy(null)}
        onConfirm={(motoboyId) => despacharDelivery({ pedidoId: modalMotoboy!.pedidoId, motoboyId })}
        isPending={despachando}
      />
    </div>
  )
}

function KanbanCard({ pedido, onMudar, onDespachar }: {
  pedido: any
  onMudar: (status: StatusPedido) => void
  onDespachar: () => void
}) {
  const minutos = Math.floor((Date.now() - new Date(pedido.data_criacao).getTime()) / 60000)
  const atrasado = ['fazendo','solicitado'].includes(pedido.status) && minutos > 30
  const tempo = formatDistanceToNow(new Date(pedido.data_criacao), { locale: ptBR })

  const imprimirProducao = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(gerarHTMLProducao(pedido))
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  return (
    <div className={clsx('bg-gray-800/80 rounded-xl border p-3 space-y-2.5 card-novo transition-all',
      atrasado ? 'border-red-800/60 alert-pulse' : 'border-gray-700/50')}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center flex-wrap gap-1">
          <span className="font-bold text-gray-100 text-lg leading-none">#{pedido.id}</span>
          {pedido.tipo === 'delivery' && <span className="badge bg-blue-900/40 text-blue-400 border border-blue-800/40">🛵 Delivery</span>}
          {pedido.tipo === 'mesa' && pedido.mesa && <span className="badge bg-amber-900/40 text-amber-400 border border-amber-800/40">🪑 {pedido.mesa.nome}</span>}
          {pedido.tipo === 'retirada' && <span className="badge bg-purple-900/40 text-purple-400 border border-purple-800/40">🏪 Retirada</span>}
          {pedido.origem === 'whatsapp' && <span className="badge bg-green-900/40 text-green-400 border border-green-800/40">📱</span>}
        </div>
        <div className={clsx('text-xs flex items-center gap-1 flex-shrink-0', atrasado ? 'text-red-400 font-medium' : 'text-gray-500')}>
          {atrasado && <AlertTriangle size={11} />}
          {atrasado ? `${minutos}min ⚠️` : tempo}
        </div>
      </div>

      {/* Cliente */}
      {pedido.cliente && <p className="text-sm text-gray-300 font-medium leading-none">👤 {pedido.cliente.nome}</p>}
      {pedido.motoboy && <p className="text-xs text-blue-400">🛵 {pedido.motoboy.nome}</p>}

      {/* Itens */}
      <div className="space-y-1">
        {(pedido.itens_pedido || []).map((item: any, i: number) => (
          <div key={i} className="text-xs text-gray-400 flex gap-1.5">
            <span className="text-gray-600 flex-shrink-0">{item.quantidade}x</span>
            <span>
              {item.meia_pizza
                ? `½ ${item.pizza_metade_1?.nome} + ½ ${item.pizza_metade_2?.nome}`
                : item.pizza?.nome || item.bebida?.nome || item.outro?.nome}
              {item.borda && <span className="text-pizza-400"> +{item.borda.nome}</span>}
              {item.adicionais_item?.length > 0 && <span className="text-green-500"> +{item.adicionais_item.map((a: any) => a.ingrediente?.nome).join(', ')}</span>}
              {item.observacao && <span className="text-yellow-500 italic"> ({item.observacao})</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Obs */}
      {pedido.observacao && (
        <p className="text-xs text-yellow-400 bg-yellow-900/20 rounded px-2 py-1 border border-yellow-900/30">💬 {pedido.observacao}</p>
      )}

      {/* Total */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{pedido.forma_pagamento || '—'}</span>
        <span className="font-bold text-gray-200">R$ {Number(pedido.valor_total).toFixed(2)}</span>
      </div>

      {/* Ações */}
      <div className="flex gap-1.5 flex-wrap pt-0.5">
        <button onClick={imprimirProducao} className="btn-ghost p-1.5 text-gray-600 hover:text-gray-300" title="Imprimir produção">
          <Printer size={14} />
        </button>

        {pedido.status === 'solicitado' && <>
          <button onClick={() => onMudar('fazendo')}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-pizza-500/20 text-pizza-400 hover:bg-pizza-500/30 border border-pizza-500/20 flex items-center justify-center gap-1">
            Iniciar <ChevronRight size={11} />
          </button>
          <button onClick={() => onMudar('devolvido')}
            className="text-xs py-1.5 px-2 rounded-lg font-medium bg-red-900/30 text-red-400 border border-red-900/30">
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
            🪑 Levar para {pedido.mesa?.nome || 'mesa'}
          </button>
        )}

        {pedido.status === 'pronto' && pedido.tipo === 'delivery' && (
          <button onClick={onDespachar}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/20 flex items-center justify-center gap-1">
            <Truck size={11} /> Despachar
          </button>
        )}

        {pedido.status === 'pronto' && pedido.tipo === 'retirada' && (
          <button onClick={() => onMudar('balcao')}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-pizza-500/20 text-pizza-400 hover:bg-pizza-500/30 border border-pizza-500/20 flex items-center justify-center gap-1">
            Retirou no balcão <ChevronRight size={11} />
          </button>
        )}

        {pedido.status === 'delivery' && <>
          <button onClick={() => onMudar('finalizado')}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-pizza-500/20 text-pizza-400 hover:bg-pizza-500/30 border border-pizza-500/20 flex items-center justify-center gap-1">
            Finalizar <ChevronRight size={11} />
          </button>
          <button onClick={() => onMudar('devolvido')}
            className="text-xs py-1.5 px-2 rounded-lg font-medium bg-red-900/30 text-red-400 border border-red-900/30">
            Devolver
          </button>
        </>}

        {pedido.status === 'balcao' && pedido.tipo !== 'mesa' && <>
          <button onClick={() => onMudar('finalizado')}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-pizza-500/20 text-pizza-400 hover:bg-pizza-500/30 border border-pizza-500/20 flex items-center justify-center gap-1">
            Finalizar <ChevronRight size={11} />
          </button>
          <button onClick={() => onMudar('devolvido')}
            className="text-xs py-1.5 px-2 rounded-lg font-medium bg-red-900/30 text-red-400 border border-red-900/30">
            Devolver
          </button>
        </>}

        {pedido.status === 'balcao' && pedido.tipo === 'mesa' && (
          <div className="flex-1 flex items-center justify-center bg-amber-900/20 border border-amber-800/30 rounded-lg px-2 py-1.5">
            <span className="text-xs text-amber-400">🪑 Fechar pela tela Mesas</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ModalMotoboy({ open, motoboys, onClose, onConfirm, isPending }: {
  open: boolean; motoboys: Motoboy[]; onClose: () => void
  onConfirm: (id: number) => void; isPending: boolean
}) {
  const [selecionado, setSelecionado] = useState<number | null>(null)

  return (
    <Modal open={open} onClose={onClose} title="Selecionar Motoboy para Entrega" size="sm">
      <div className="space-y-3">
        {!motoboys.length
          ? <p className="text-sm text-gray-500 text-center py-4">Nenhum motoboy ativo cadastrado</p>
          : motoboys.map(m => (
              <button key={m.id} onClick={() => setSelecionado(m.id)}
                className={clsx('w-full text-left p-3 rounded-xl border transition-all',
                  selecionado === m.id ? 'border-pizza-500/60 bg-pizza-500/10 text-pizza-300' : 'border-gray-700 text-gray-400 hover:border-gray-600')}>
                🛵 {m.nome}
                {m.telefone && <span className="text-gray-600 text-xs ml-2">{m.telefone}</span>}
              </button>
            ))
        }
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => selecionado && onConfirm(selecionado)} disabled={!selecionado || isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {isPending ? <Spinner size="sm" /> : <><Truck size={14} /> Despachar e Imprimir</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function gerarHTMLProducao(pedido: any): string {
  const itens = (pedido.itens_pedido || []).map((item: any) => {
    let desc = item.meia_pizza
      ? `½ ${item.pizza_metade_1?.nome || ''} + ½ ${item.pizza_metade_2?.nome || ''}`
      : item.pizza?.nome || item.bebida?.nome || item.outro?.nome || ''
    if (item.borda) desc += ` | Borda: ${item.borda.nome}`
    if (item.adicionais_item?.length) desc += ` | +${item.adicionais_item.map((a: any) => `${a.ingrediente?.nome}${a.aplicado_em !== 'inteira' ? ` (${a.aplicado_em})` : ''}`).join(', ')}`
    if (item.observacao) desc += ` | Obs: ${item.observacao}`
    return `<div class="item"><span>${item.quantidade}x ${desc}</span></div>`
  }).join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:8px}h1{font-size:15px;text-align:center;margin:0 0 4px}.divider{border-top:1px dashed #000;margin:6px 0}.item{margin:3px 0}.label{font-size:10px;text-transform:uppercase;color:#555}</style></head><body>
    <h1>🍕 PRODUÇÃO</h1><div class="label">Pedido</div><div><strong>#${pedido.id}</strong> · ${new Date(pedido.data_criacao).toLocaleString('pt-BR')}</div>
    <div class="divider"></div><div class="label">Cliente</div><div>${pedido.cliente?.nome || 'Balcão'}</div>
    ${pedido.tipo === 'delivery' ? `<div>${pedido.cliente?.condominio?.nome || ''} · Q${pedido.cliente?.quadra} L${pedido.cliente?.lote}</div>` : ''}
    <div class="divider"></div><div class="label">Itens</div>${itens}
    ${pedido.observacao ? `<div class="divider"></div><div><strong>Obs:</strong> ${pedido.observacao}</div>` : ''}
    <div class="divider"></div><div style="text-align:center;font-size:10px">--- SEM VALOR ---</div></body></html>`
}

function gerarHTMLEntrega(pedido: any): string {
  const itens = (pedido.itens_pedido || []).map((item: any) => {
    let desc = item.meia_pizza
      ? `½ ${item.pizza_metade_1?.nome || ''} + ½ ${item.pizza_metade_2?.nome || ''}`
      : item.pizza?.nome || item.bebida?.nome || item.outro?.nome || ''
    if (item.borda) desc += ` | Borda: ${item.borda.nome}`
    return `<div class="item"><span>${item.quantidade}x ${desc}</span><span>R$ ${(Number(item.valor_unitario)*item.quantidade).toFixed(2)}</span></div>`
  }).join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:8px}h1{font-size:15px;text-align:center;margin:0 0 4px}.divider{border-top:1px dashed #000;margin:6px 0}.item{display:flex;justify-content:space-between;margin:3px 0}.label{font-size:10px;text-transform:uppercase;color:#555}.total{font-weight:bold;font-size:13px}</style></head><body>
    <h1>🍕 NOTA DE ENTREGA</h1><div class="label">Pedido</div><div><strong>#${pedido.id}</strong> · ${new Date(pedido.data_criacao).toLocaleString('pt-BR')}</div>
    <div class="divider"></div><div class="label">Cliente</div><div>${pedido.cliente?.nome || '—'}</div>
    <div>${pedido.cliente?.condominio?.nome || ''} · Q${pedido.cliente?.quadra} L${pedido.cliente?.lote} · ${pedido.cliente?.rua || ''}</div>
    <div>Tel: ${pedido.cliente?.telefone || ''}</div>
    <div class="divider"></div><div class="label">Motoboy</div><div>${pedido.motoboy?.nome || '—'}</div>
    <div class="divider"></div><div class="label">Itens</div>${itens}
    <div class="divider"></div>
    ${pedido.valor_frete > 0 ? `<div class="item"><span>Frete</span><span>R$ ${Number(pedido.valor_frete).toFixed(2)}</span></div>` : ''}
    <div class="item total"><span>TOTAL</span><span>R$ ${Number(pedido.valor_total).toFixed(2)}</span></div>
    <div class="divider"></div><div style="text-align:center;font-size:10px">Pagamento: ${pedido.forma_pagamento || '—'}</div></body></html>`
}
