import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pedidosDb, motoboysDb, tempoEstimadoDb, pizzasDb, bebidasDb, bordasDb, ingredientesDb } from '../lib/db'
import { supabase } from '../lib/supabase'
import { StatusBadge, Modal, Spinner } from '../components/ui'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Printer, ChevronRight, AlertTriangle, Truck, Pencil, X, Plus, Trash2, WifiOff } from 'lucide-react'
import type { StatusPedido, Motoboy } from '../lib/supabase'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useRealtimePedidos } from '../hooks/useRealtime'

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
  const [modalCancelar, setModalCancelar] = useState<{ pedido: any } | null>(null)
  const [modalEditar, setModalEditar] = useState<{ pedido: any } | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const queryClient = useQueryClient()

  // Monitorar conexão com a internet
  useEffect(() => {
    const handleOnline = () => { setOnline(true); refetch() }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const { data: motoboys = [] } = useQuery({ queryKey: ['motoboys'], queryFn: motoboysDb.listar })

  const { data: tempoEstimado } = useQuery({
    queryKey: ['tempo-estimado'],
    queryFn: () => tempoEstimadoDb.calcular(),
    refetchInterval: 30_000
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pedidos-ativos'],
    queryFn: pedidosDb.listarAtivos,
    refetchInterval: online ? 10_000 : false, // Para de refetchar se offline
    refetchIntervalInBackground: true,
    retry: 2,
  })

  // Realtime via WebSocket (substitui polling quando online)
  useRealtimePedidos(useCallback((_pedido, evento) => {
    if (evento === 'INSERT' || evento === 'UPDATE') {
      setTimeout(() => refetch(), 300)
    }
  }, []))

  useEffect(() => {
    if (!data) return
    if (ultimoCount > 0 && (data as any[]).length > ultimoCount) {
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
      // Invalida pedidos e mesas para PDV/ComandaMesa também verem a mudança
      queryClient.invalidateQueries({ queryKey: ['pedidos-ativos'] })
      queryClient.invalidateQueries({ queryKey: ['mesas'] })
      toast.success(`Status → ${status}`)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  // ── Cancelar com motivo ──────────────────────────
  const { mutate: cancelarPedido, isPending: cancelando } = useMutation({
    mutationFn: async ({ pedidoId, motivo }: { pedidoId: number; motivo: string }) => {
      await pedidosDb.cancelar(pedidoId, motivo)
    },
    onSuccess: (_, { pedidoId }) => {
      setPedidos(prev => prev.filter(p => p.id !== pedidoId))
      setModalCancelar(null)
      queryClient.invalidateQueries({ queryKey: ['pedidos-ativos'] })
      queryClient.invalidateQueries({ queryKey: ['mesas'] })
      toast.success('Pedido cancelado')
    },
    onError: (e: Error) => toast.error(e.message)
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
      queryClient.invalidateQueries({ queryKey: ['pedidos-ativos'] })
      queryClient.invalidateQueries({ queryKey: ['mesas'] })
      const pedido = pedidos.find(p => p.id === pedidoId)
      if (pedido && motoboy) {
        const win = window.open('', '_blank')
        if (win) { win.document.write(gerarHTMLEntrega({ ...pedido, motoboy })); win.document.close(); setTimeout(() => win.print(), 500) }
      }
      toast.success('Motoboy despachado!')
    },
    onError: (e: Error) => toast.error(e.message)
  })

  const porStatus = (status: string) => {
    const byTime = (a: any, b: any) => new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime()
    if (status === 'na_mesa') return pedidos.filter(p => p.status === 'balcao' && p.tipo === 'mesa').sort(byTime)
    if (status === 'balcao')  return pedidos.filter(p => p.status === 'balcao' && p.tipo !== 'mesa').sort(byTime)
    return pedidos.filter(p => p.status === status).sort((a,b) => new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime())
  }

  const onPedidoEditado = (pedidoAtualizado: any) => {
    setPedidos(prev => prev.map(p => p.id === pedidoAtualizado.id ? pedidoAtualizado : p))
    setModalEditar(null)
    // Invalida tudo que pode ter mudado: pedidos, estoque de bebidas/ingredientes
    queryClient.invalidateQueries({ queryKey: ['pedidos-ativos'] })
    queryClient.invalidateQueries({ queryKey: ['mesas'] })
    queryClient.invalidateQueries({ queryKey: ['bebidas-disp'] })
    queryClient.invalidateQueries({ queryKey: ['ingredientes-admin'] })
    queryClient.invalidateQueries({ queryKey: ['tempo-estimado'] })
  }

  if (isLoading && !pedidos.length) return (
    <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <h1 className="font-semibold text-gray-100 text-sm">Kanban de Pedidos</h1>
        <div className="flex items-center gap-3">
          {!online && (
            <div className="flex items-center gap-1.5 bg-red-900/30 border border-red-800/50 rounded-lg px-2 py-1">
              <WifiOff size={12} className="text-red-400" />
              <span className="text-xs text-red-400">Sem conexão</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className={clsx('w-2 h-2 rounded-full', online ? 'bg-green-400 animate-pulse' : 'bg-red-500')} />
            <span className={clsx('text-xs', online ? 'text-green-400' : 'text-red-400')}>
              {online ? 'Ao vivo' : 'Offline'}
            </span>
          </div>
          <span className="text-xs text-gray-500">{pedidos.length} ativos</span>
          {tempoEstimado && (
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1">
              <span className="text-xs text-gray-500">🍕 {tempoEstimado.pizzasNaFila} na fila</span>
              <span className="text-xs text-gray-600">|</span>
              <span className="text-xs text-pizza-400">⏱ ~{tempoEstimado.preparo}min preparo</span>
            </div>
          )}
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
                      onCancelar={() => setModalCancelar({ pedido })}
                      onEditar={() => setModalEditar({ pedido })}
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

      {/* [MELHORIA 3] Modal cancelamento com motivo */}
      {modalCancelar && (
        <ModalCancelar
          pedido={modalCancelar.pedido}
          onClose={() => setModalCancelar(null)}
          onConfirm={(motivo) => cancelarPedido({ pedidoId: modalCancelar.pedido.id, motivo })}
          isPending={cancelando}
        />
      )}

      {/* [MELHORIA 2] Modal edição de pedido */}
      {modalEditar && (
        <ModalEditarPedido
          pedido={modalEditar.pedido}
          onClose={() => setModalEditar(null)}
          onSalvo={onPedidoEditado}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// KanbanCard
// ─────────────────────────────────────────────────────────────
function KanbanCard({ pedido, onMudar, onDespachar, onCancelar, onEditar }: {
  pedido: any
  onMudar: (status: StatusPedido) => void
  onDespachar: () => void
  onCancelar: () => void
  onEditar: () => void
}) {
  // Corrigir fuso horário — Supabase retorna UTC sem 'Z', JS interpreta como local
  const dataCriacao = pedido.data_criacao.endsWith('Z')
    ? new Date(pedido.data_criacao)
    : new Date(pedido.data_criacao + 'Z')
  const minutos = Math.floor((Date.now() - dataCriacao.getTime()) / 60000)
  const atrasado = ['fazendo','solicitado'].includes(pedido.status) && minutos > 30
  const tempo = formatDistanceToNow(dataCriacao, { addSuffix: false, locale: ptBR })

  // Calcular estimativa de entrega (preparo + frete)
  const horaFormatada = dataCriacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

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
          {(pedido.tipo === 'delivery' || pedido.tipo === 'balcao_delivery' || pedido.tipo === 'online_delivery') && <span className="badge bg-blue-900/40 text-blue-400 border border-blue-800/40">🛵 Delivery</span>}
          {pedido.tipo === 'mesa' && pedido.mesa && <span className="badge bg-amber-900/40 text-amber-400 border border-amber-800/40">🪑 {pedido.mesa.nome}</span>}
          {pedido.tipo === 'retirada' && <span className="badge bg-purple-900/40 text-purple-400 border border-purple-800/40">🏪 Retirada</span>}
          {pedido.origem === 'whatsapp' && <span className="badge bg-green-900/40 text-green-400 border border-green-800/40">📱</span>}
        </div>
        <div className={clsx('text-xs flex items-center gap-1 flex-shrink-0 flex-col items-end', atrasado ? 'text-red-400 font-medium' : 'text-gray-500')}>
          <span className="text-gray-600">{horaFormatada}</span>
          <span className={clsx('flex items-center gap-1', atrasado ? 'text-red-400' : 'text-gray-500')}>
            {atrasado && <AlertTriangle size={11} />}
            {atrasado ? `${minutos}min atraso` : tempo}
          </span>
        </div>
      </div>

      {/* Cliente */}
      {pedido.cliente && (
        <div>
          <p className="text-sm text-gray-300 font-medium leading-none">👤 {pedido.cliente.nome}</p>
          {pedido.origem === 'whatsapp' && (
            <p className="text-xs text-gray-600 mt-0.5">📱 {pedido.cliente_telefone}</p>
          )}
          {pedido.origem !== 'whatsapp' && pedido.cliente_telefone && (
            <p className="text-xs text-gray-600 mt-0.5">📞 {pedido.cliente_telefone}</p>
          )}
        </div>
      )}
      {pedido.motoboy && <p className="text-xs text-blue-400">🛵 {pedido.motoboy.nome}</p>}

      {/* [MELHORIA 1] Mostrar endereço temporário se existir */}
      {(pedido.tipo === 'delivery' || pedido.tipo?.includes('delivery')) && (
        pedido.endereco_temp_condominio_id
          ? <p className="text-xs text-amber-400">📍 {pedido.endereco_temp_condominio_nome || 'Endereço temp.'} · Q{pedido.endereco_temp_quadra} L{pedido.endereco_temp_lote}</p>
          : pedido.condominio && pedido.status === 'delivery' && (
              <p className="text-xs text-gray-500">📍 {pedido.condominio.nome}</p>
            )
      )}

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

        {/* [MELHORIA 2] Botão editar — só para status "solicitado" */}
        {pedido.status === 'solicitado' && (
          <button onClick={onEditar} className="btn-ghost p-1.5 text-gray-600 hover:text-blue-400" title="Editar pedido">
            <Pencil size={14} />
          </button>
        )}

        {pedido.status === 'solicitado' && <>
          <button onClick={() => onMudar('fazendo')}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-pizza-500/20 text-pizza-400 hover:bg-pizza-500/30 border border-pizza-500/20 flex items-center justify-center gap-1">
            Iniciar <ChevronRight size={11} />
          </button>
          {/* [MELHORIA 3] Substituiu "Devolver" por "Cancelar" com motivo */}
          <button onClick={onCancelar}
            className="text-xs py-1.5 px-2 rounded-lg font-medium bg-red-900/30 text-red-400 border border-red-900/30">
            Cancelar
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

        {pedido.status === 'pronto' && (pedido.tipo === 'delivery' || pedido.tipo === 'balcao_delivery' || pedido.tipo === 'online_delivery') && (
          <button onClick={onDespachar}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/20 flex items-center justify-center gap-1">
            <Truck size={11} /> Despachar
          </button>
        )}

        {pedido.status === 'pronto' && (pedido.tipo === 'retirada' || pedido.tipo === 'balcao_retirada' || pedido.tipo === 'online_retirada') && (
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
          <button onClick={onCancelar}
            className="text-xs py-1.5 px-2 rounded-lg font-medium bg-red-900/30 text-red-400 border border-red-900/30">
            Devolver
          </button>
        </>}

        {pedido.status === 'balcao' && pedido.tipo !== 'mesa' && <>
          <button onClick={() => onMudar('finalizado')}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg font-medium bg-pizza-500/20 text-pizza-400 hover:bg-pizza-500/30 border border-pizza-500/20 flex items-center justify-center gap-1">
            Finalizar <ChevronRight size={11} />
          </button>
          <button onClick={onCancelar}
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

// ─────────────────────────────────────────────────────────────
// [MELHORIA 3] Modal Cancelar com motivo
// ─────────────────────────────────────────────────────────────
function ModalCancelar({ pedido, onClose, onConfirm, isPending }: {
  pedido: any
  onClose: () => void
  onConfirm: (motivo: string) => void
  isPending: boolean
}) {
  const [motivo, setMotivo] = useState('')

  return (
    <Modal open onClose={onClose} title={`Cancelar Pedido #${pedido.id}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Tem certeza que deseja cancelar este pedido? O estoque será devolvido automaticamente.
        </p>
        <div>
          <label className="label">Motivo do cancelamento <span className="text-gray-600 normal-case">(opcional)</span></label>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ex: Cliente desistiu, endereço errado, fora da área de entrega..."
            className="input resize-none h-20 text-sm"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Voltar</button>
          <button
            onClick={() => onConfirm(motivo)}
            disabled={isPending}
            className="btn-danger flex-1 flex items-center justify-center gap-2">
            {isPending ? <Spinner size="sm" /> : '✕ Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Modal Motoboy
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// [MELHORIA 2] Modal Editar Pedido
// ─────────────────────────────────────────────────────────────
function ModalEditarPedido({ pedido, onClose, onSalvo }: {
  pedido: any
  onClose: () => void
  onSalvo: (pedidoAtualizado: any) => void
}) {
  const [itens, setItens] = useState<any[]>(
    (pedido.itens_pedido || []).map((item: any) => ({ ...item, _removido: false }))
  )
  const [salvando, setSalvando] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState<'pizza' | 'bebida' | 'outro'>('pizza')

  const { data: pizzas = [] } = useQuery({ queryKey: ['pizzas-disp'], queryFn: pizzasDb.listarDisponiveis })
  const { data: bebidas = [] } = useQuery({ queryKey: ['bebidas-disp'], queryFn: bebidasDb.listarDisponiveis })
  const { data: bordas = [] } = useQuery({ queryKey: ['bordas'], queryFn: bordasDb.listar })
  const { data: adicionais = [] } = useQuery({ queryKey: ['adicionais'], queryFn: ingredientesDb.listarAdicionais })

  const isDelivery = pedido.tipo?.includes('delivery')

  // Verifica se bebida pode ser alterada
  // Delivery: só pode alterar bebida enquanto não estiver em "delivery"
  // Presencial (mesa/balcao): sempre pode
  const podeAlterarBebida = !isDelivery || pedido.status !== 'delivery'

  const removerItem = (idx: number) => {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, _removido: true } : item))
  }

  const restaurarItem = (idx: number) => {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, _removido: false } : item))
  }

  const adicionarPizza = (pizza: any) => {
    setItens(prev => [...prev, {
      _novo: true,
      tipo_item: 'pizza',
      pizza_id: pizza.id,
      pizza: pizza,
      quantidade: 1,
      meia_pizza: false,
      valor_unitario: pizza.preco,
      borda_id: null,
      borda: null,
      adicionais_item: [],
      observacao: null,
    }])
  }

  const adicionarBebida = (bebida: any) => {
    if (!podeAlterarBebida) {
      toast.error('Não é possível adicionar bebida após o pedido sair para delivery')
      return
    }
    setItens(prev => [...prev, {
      _novo: true,
      tipo_item: 'bebida',
      bebida_id: bebida.id,
      bebida: bebida,
      quantidade: 1,
      valor_unitario: bebida.preco,
    }])
  }

  const alterarQuantidade = (idx: number, delta: number) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const nova = Math.max(1, (item.quantidade || 1) + delta)
      return { ...item, quantidade: nova }
    }))
  }

  const trocarBorda = (idx: number, bordaId: number | null) => {
    const borda = bordaId ? (bordas as any[]).find(b => b.id === bordaId) : null
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, borda_id: bordaId, borda } : item))
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      const itensRemovidos = itens.filter(it => !it._novo && it._removido)
      const itensNovos = itens.filter(it => it._novo && !it._removido)
      const itensAlterados = itens.filter(it => !it._novo && !it._removido)

      // 1. Devolver estoque dos itens removidos
      for (const item of itensRemovidos) {
        if (item.tipo_item === 'bebida' && item.bebida_id) {
          const { data: beb } = await supabase.from('bebidas').select('quantidade_estoque').eq('id', item.bebida_id).single()
          if (beb) await supabase.from('bebidas').update({ quantidade_estoque: beb.quantidade_estoque + item.quantidade }).eq('id', item.bebida_id)
        }
        if (item.tipo_item === 'outro' && item.outro_id) {
          const { data: out } = await supabase.from('outros_produtos').select('quantidade_estoque').eq('id', item.outro_id).single()
          if (out) await supabase.from('outros_produtos').update({ quantidade_estoque: out.quantidade_estoque + item.quantidade }).eq('id', item.outro_id)
        }
        // Para pizzas, devolver ingredientes
        if (item.tipo_item === 'pizza') {
          const { data: piz } = await supabase.from('pizzas')
            .select('pizza_ingredientes(ingrediente_id, quantidade)').eq('id', item.pizza_id).single()
          for (const pi of (piz as any)?.pizza_ingredientes || []) {
            const { data: ing } = await supabase.from('ingredientes').select('quantidade_estoque').eq('id', pi.ingrediente_id).single()
            if (ing) await supabase.from('ingredientes').update({ quantidade_estoque: Number(ing.quantidade_estoque) + pi.quantidade * item.quantidade }).eq('id', pi.ingrediente_id)
          }
        }
        await supabase.from('itens_pedido').delete().eq('id', item.id)
      }

      // 2. Atualizar quantidades dos itens alterados (sem trocar tipo/produto)
      for (const item of itensAlterados) {
        await supabase.from('itens_pedido').update({
          quantidade: item.quantidade,
          borda_id: item.borda_id ?? null,
          observacao: item.observacao ?? null,
        }).eq('id', item.id)
      }

      // 3. Inserir itens novos e dar baixa de estoque
      for (const item of itensNovos) {
        const { _novo, _removido, pizza, bebida, outro, borda, adicionais_item, ...itemData } = item
        const { data: itemSalvo } = await supabase.from('itens_pedido')
          .insert({ ...itemData, pedido_id: pedido.id }).select().single()

        // Baixa de estoque para novos itens
        if (item.tipo_item === 'bebida' && item.bebida_id) {
          const { data: beb } = await supabase.from('bebidas').select('quantidade_estoque').eq('id', item.bebida_id).single()
          if (beb) await supabase.from('bebidas').update({ quantidade_estoque: Math.max(0, beb.quantidade_estoque - item.quantidade) }).eq('id', item.bebida_id)
        }
        if (item.tipo_item === 'pizza') {
          const { data: piz } = await supabase.from('pizzas')
            .select('pizza_ingredientes(ingrediente_id, quantidade)').eq('id', item.pizza_id).single()
          for (const pi of (piz as any)?.pizza_ingredientes || []) {
            const { data: ing } = await supabase.from('ingredientes').select('quantidade_estoque').eq('id', pi.ingrediente_id).single()
            if (ing) await supabase.from('ingredientes').update({ quantidade_estoque: Math.max(0, Number(ing.quantidade_estoque) - pi.quantidade * item.quantidade) }).eq('id', pi.ingrediente_id)
          }
        }
      }

      // 4. Recalcular valor total
      const todosItensAtivos = [
        ...itensAlterados,
        ...itensNovos,
      ]
      const novoTotal = todosItensAtivos.reduce((acc, item) => {
        return acc + (Number(item.valor_unitario) * item.quantidade)
      }, 0) + Number(pedido.valor_frete || 0)

      await supabase.from('pedidos').update({ valor_total: novoTotal }).eq('id', pedido.id)

      // 5. Buscar pedido atualizado para passar para o kanban
      const pedidoAtualizado = await pedidosDb.buscarAtivo(pedido.id)
      toast.success('Pedido atualizado!')
      onSalvo(pedidoAtualizado || { ...pedido, valor_total: novoTotal, itens_pedido: todosItensAtivos })
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const itensVisiveis = itens.filter(it => !it._removido)
  const itensRemovidosCount = itens.filter(it => it._removido).length

  return (
    <Modal open onClose={onClose} title={`Editar Pedido #${pedido.id}`} size="lg">
      <div className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">

        {/* Itens atuais */}
        <div>
          <p className="label mb-2">Itens do pedido</p>
          <div className="space-y-2">
            {itens.map((item, idx) => {
              const nome = item.meia_pizza
                ? `½ ${item.pizza_metade_1?.nome} + ½ ${item.pizza_metade_2?.nome}`
                : item.pizza?.nome || item.bebida?.nome || item.outro?.nome || '?'
              const isBebida = item.tipo_item === 'bebida'
              const bloqueado = isBebida && !podeAlterarBebida

              return (
                <div key={idx} className={clsx(
                  'flex items-center gap-2 p-2.5 rounded-xl border text-sm transition-all',
                  item._removido
                    ? 'border-red-900/30 bg-red-950/20 opacity-50 line-through text-gray-500'
                    : 'border-gray-700 bg-gray-800/50'
                )}>
                  <div className="flex-1">
                    <span className="text-gray-200 font-medium">{nome}</span>
                    {item.borda && <span className="text-pizza-400 text-xs ml-1">+{item.borda.nome}</span>}
                    {item.tipo_item === 'pizza' && !item._removido && (
                      <select
                        value={item.borda_id ?? ''}
                        onChange={e => trocarBorda(idx, e.target.value ? Number(e.target.value) : null)}
                        className="input text-xs py-0.5 mt-1 w-full"
                      >
                        <option value="">Sem borda</option>
                        {(bordas as any[]).map((b: any) => (
                          <option key={b.id} value={b.id}>{b.nome} (+R${Number(b.preco).toFixed(2)})</option>
                        ))}
                      </select>
                    )}
                    {bloqueado && <span className="text-xs text-orange-400 block mt-0.5">⚠ Pedido em delivery — não pode alterar bebida</span>}
                  </div>
                  {!item._removido && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => alterarQuantidade(idx, -1)} disabled={item.quantidade <= 1}
                        className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs disabled:opacity-30">−</button>
                      <span className="w-5 text-center text-gray-200 text-xs">{item.quantidade}</span>
                      <button onClick={() => alterarQuantidade(idx, 1)}
                        className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs">+</button>
                    </div>
                  )}
                  {item._removido
                    ? <button onClick={() => restaurarItem(idx)} className="text-xs text-green-400 hover:text-green-300 px-2">↩ Restaurar</button>
                    : <button onClick={() => removerItem(idx)} disabled={bloqueado} className="p-1 text-red-500 hover:text-red-400 disabled:opacity-30" title="Remover item">
                        <Trash2 size={14} />
                      </button>
                  }
                </div>
              )
            })}
          </div>
          {itensRemovidosCount > 0 && (
            <p className="text-xs text-red-400 mt-1">{itensRemovidosCount} item(ns) marcado(s) para remoção</p>
          )}
        </div>

        {/* Adicionar itens */}
        <div className="border-t border-gray-800 pt-4">
          <p className="label mb-2">Adicionar item</p>
          <div className="flex gap-2 mb-3">
            {(['pizza', 'bebida'] as const).map(aba => (
              <button key={aba} onClick={() => setAbaAtiva(aba)}
                className={clsx('text-xs px-3 py-1.5 rounded-lg border transition-all',
                  abaAtiva === aba ? 'border-pizza-500 bg-pizza-500/10 text-pizza-400' : 'border-gray-700 text-gray-500 hover:border-gray-600')}>
                {aba === 'pizza' ? '🍕 Pizza' : '🥤 Bebida'}
              </button>
            ))}
          </div>

          {abaAtiva === 'pizza' && (
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
              {(pizzas as any[]).map((p: any) => (
                <button key={p.id} onClick={() => adicionarPizza(p)}
                  className="text-left text-xs p-2 rounded-lg border border-gray-700 hover:border-pizza-500/50 hover:bg-pizza-500/5 transition-all">
                  <span className="text-gray-300 block truncate">{p.nome}</span>
                  <span className="text-pizza-400">R$ {Number(p.preco).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}

          {abaAtiva === 'bebida' && (
            <div className={clsx('grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto', !podeAlterarBebida && 'opacity-50 pointer-events-none')}>
              {!podeAlterarBebida && (
                <p className="col-span-2 text-xs text-orange-400 mb-1">⚠ Pedido em delivery — bebidas não podem ser alteradas</p>
              )}
              {(bebidas as any[]).map((b: any) => (
                <button key={b.id} onClick={() => adicionarBebida(b)}
                  className="text-left text-xs p-2 rounded-lg border border-gray-700 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all">
                  <span className="text-gray-300 block truncate">{b.nome}</span>
                  <span className="text-blue-400">R$ {Number(b.preco).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="border-t border-gray-800 pt-3 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-gray-500">Novo total estimado: </span>
            <span className="text-gray-100 font-bold">
              R$ {(
                itens.filter(it => !it._removido).reduce((acc, it) => acc + Number(it.valor_unitario) * it.quantidade, 0)
                + Number(pedido.valor_frete || 0)
              ).toFixed(2)}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="btn-primary flex items-center gap-2">
              {salvando ? <Spinner size="sm" /> : '✓ Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Geração de HTML para impressão
// ─────────────────────────────────────────────────────────────
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

  // [MELHORIA 1] Endereço: preferir endereço temporário se existir
  let enderecoHtml = ''
  if (pedido.tipo === 'delivery' || pedido.tipo?.includes('delivery')) {
    if (pedido.endereco_temp_condominio_id) {
      const condNome = pedido.endereco_temp_condominio_nome || 'Endereço temporário'
      const q = pedido.endereco_temp_quadra ? `Q${pedido.endereco_temp_quadra}` : ''
      const l = pedido.endereco_temp_lote ? `L${pedido.endereco_temp_lote}` : ''
      const r = pedido.endereco_temp_rua || ''
      enderecoHtml = `<div><strong>📍 ENDEREÇO TEMP:</strong> ${condNome} · ${q} ${l} ${r}</div>`
    } else {
      const condNome = pedido.condominio?.nome || pedido.cliente?.condominio?.nome || ''
      const q = pedido.cliente?.quadra ? `Q${pedido.cliente.quadra}` : ''
      const l = pedido.cliente?.lote ? `L${pedido.cliente.lote}` : ''
      enderecoHtml = `<div>${condNome} · ${q} ${l}</div>`
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:8px}h1{font-size:15px;text-align:center;margin:0 0 4px}.divider{border-top:1px dashed #000;margin:6px 0}.item{margin:3px 0}.label{font-size:10px;text-transform:uppercase;color:#555}</style></head><body>
    <h1>🍕 PRODUÇÃO</h1><div class="label">Pedido</div><div><strong>#${pedido.id}</strong> · ${new Date(pedido.data_criacao).toLocaleString('pt-BR')}</div>
    <div class="divider"></div><div class="label">Cliente</div><div>${pedido.cliente?.nome || 'Balcão'}</div>
    ${enderecoHtml}
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

  // [MELHORIA 1] Endereço na nota de entrega — preferir endereço temporário
  let enderecoHtml = ''
  if (pedido.endereco_temp_condominio_id) {
    const condNome = pedido.endereco_temp_condominio_nome || 'Endereço temporário'
    const q = pedido.endereco_temp_quadra ? `Q${pedido.endereco_temp_quadra}` : ''
    const l = pedido.endereco_temp_lote ? `L${pedido.endereco_temp_lote}` : ''
    const r = pedido.endereco_temp_rua || ''
    enderecoHtml = `<div><strong>⚠ ENDEREÇO TEMP:</strong> ${condNome}</div><div>${q} ${l} ${r}</div>`
  } else {
    const condNome = pedido.condominio?.nome || pedido.cliente?.condominio?.nome || ''
    const q = pedido.cliente?.quadra ? `Q${pedido.cliente.quadra}` : ''
    const l = pedido.cliente?.lote ? `L${pedido.cliente.lote}` : ''
    const r = pedido.cliente?.rua || ''
    enderecoHtml = `<div>${condNome} · ${q} ${l} · ${r}</div>`
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:8px}h1{font-size:15px;text-align:center;margin:0 0 4px}.divider{border-top:1px dashed #000;margin:6px 0}.item{display:flex;justify-content:space-between;margin:3px 0}.label{font-size:10px;text-transform:uppercase;color:#555}.total{font-weight:bold;font-size:13px}</style></head><body>
    <h1>🍕 NOTA DE ENTREGA</h1><div class="label">Pedido</div><div><strong>#${pedido.id}</strong> · ${new Date(pedido.data_criacao).toLocaleString('pt-BR')}</div>
    <div class="divider"></div><div class="label">Cliente</div><div>${pedido.cliente?.nome || '—'}</div>
    ${enderecoHtml}
    <div>Tel: ${pedido.cliente?.telefone || pedido.cliente_telefone || ''}</div>
    <div class="divider"></div><div class="label">Motoboy</div><div>${pedido.motoboy?.nome || '—'}</div>
    <div class="divider"></div><div class="label">Itens</div>${itens}
    <div class="divider"></div>
    ${pedido.valor_frete > 0 ? `<div class="item"><span>Frete</span><span>R$ ${Number(pedido.valor_frete).toFixed(2)}</span></div>` : ''}
    <div class="item total"><span>TOTAL</span><span>R$ ${Number(pedido.valor_total).toFixed(2)}</span></div>
    <div class="divider"></div><div style="text-align:center;font-size:10px">Pagamento: ${pedido.forma_pagamento || '—'}</div></body></html>`
}
