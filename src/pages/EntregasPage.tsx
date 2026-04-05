import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pedidosDb, motoboysDb } from '../lib/db'
import { supabase } from '../lib/supabase'
import { useRealtimePedidos } from '../hooks/useRealtime'
import { StatusBadge, Modal, LoadingPage, Empty } from '../components/ui'
import { Printer, Truck, CheckCircle } from 'lucide-react'
import type { Motoboy } from '../lib/supabase'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export function EntregasPage() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [modalEntrega, setModalEntrega] = useState<any | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos-entrega'],
    queryFn: pedidosDb.listarAtivos,
    refetchInterval: 30_000
  })

  useEffect(() => { if (data) setPedidos(data) }, [data])

  useRealtimePedidos(useCallback((p, evento) => {
    if (evento === 'UPDATE') {
      setPedidos(prev => {
        if (['finalizado','devolvido'].includes(p.status)) return prev.filter(x => x.id !== p.id)
        return prev.map(x => x.id === p.id ? { ...x, ...p } : x)
      })
    } else if (evento === 'INSERT') {
      setPedidos(prev => prev.find(x => x.id === p.id) ? prev : [...prev, p])
    }
  }, []))

  const prontos  = pedidos.filter(p => p.status === 'pronto' && p.tipo?.includes('delivery'))
  const emRota   = pedidos.filter(p => p.status === 'delivery')
  const balcao   = pedidos.filter(p => p.status === 'pronto' && !p.tipo?.includes('delivery'))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <h1 className="font-semibold text-gray-100 text-sm flex items-center gap-2">
          <Truck size={16} className="text-pizza-400" /> Entregas
        </h1>
      </div>

      {isLoading ? <LoadingPage /> : (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {/* Prontos para entrega */}
          <Secao titulo="🟢 Prontos para Despachar" count={prontos.length} cor="border-l-green-500">
            {prontos.length === 0
              ? <Empty icon="✅" title="Nenhum pedido pronto" />
              : prontos.map(p => (
                  <CardEntrega key={p.id} pedido={p}
                    acoes={[{ label: '🛵 Despachar entrega', fn: () => setModalEntrega(p) }]}
                  />
                ))
            }
          </Secao>

          {/* Balcão */}
          {balcao.length > 0 && (
            <Secao titulo="🏪 Prontos para Balcão" count={balcao.length} cor="border-l-purple-500">
              {balcao.map(p => (
                <CardEntrega key={p.id} pedido={p}
                  acoes={[{
                    label: '✅ Finalizar', fn: async () => {
                      await pedidosDb.atualizarStatus(p.id, 'balcao')
                      toast.success(`Pedido #${p.id} → balcão`)
                    }
                  }]}
                />
              ))}
            </Secao>
          )}

          {/* Em rota */}
          <Secao titulo="🛵 Em Rota de Entrega" count={emRota.length} cor="border-l-blue-500">
            {emRota.length === 0
              ? <Empty icon="🛵" title="Nenhum pedido em rota" />
              : emRota.map(p => (
                  <CardEntrega key={p.id} pedido={p}
                    acoes={[
                      { label: '✅ Finalizar entrega', fn: async () => {
                          await pedidosDb.atualizarStatus(p.id, 'finalizado', { data_finalizacao: new Date().toISOString() })
                          toast.success(`Pedido #${p.id} finalizado!`)
                        }
                      },
                      { label: '↩️ Devolver', variant: 'danger', fn: async () => {
                          await pedidosDb.atualizarStatus(p.id, 'devolvido')
                          toast('Pedido devolvido — registrado como prejuízo', { icon: '↩️' })
                        }
                      }
                    ]}
                  />
                ))
            }
          </Secao>
        </div>
      )}

      {modalEntrega && (
        <ModalDespachar
          pedido={modalEntrega}
          onClose={() => setModalEntrega(null)}
          onConfirm={() => {
            setPedidos(prev => prev.map(p => p.id === modalEntrega.id ? { ...p, status: 'delivery' } : p))
            setModalEntrega(null)
          }}
        />
      )}
    </div>
  )
}

function Secao({ titulo, count, cor, children }: { titulo: string; count: number; cor: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-300">{titulo}</h2>
        <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className={clsx('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 border-l-2 pl-4', cor)}>
        {children}
      </div>
    </div>
  )
}

function CardEntrega({ pedido, acoes }: {
  pedido: any
  acoes: { label: string; variant?: string; fn: () => void }[]
}) {
  const imprimirEntrega = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(gerarHTMLEntrega(pedido))
    win.document.close()
    win.print()
  }

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-100">#{pedido.id}</span>
          <StatusBadge status={pedido.status} />
        </div>
        <button onClick={imprimirEntrega} className="btn-ghost p-1.5 text-gray-600 hover:text-gray-300" title="Imprimir nota de entrega">
          <Printer size={15} />
        </button>
      </div>

      {pedido.cliente && (
        <div className="text-sm">
          <p className="text-gray-300 font-medium">{pedido.cliente.nome}</p>
          {pedido.tipo?.includes('delivery') && (
            <p className="text-xs text-gray-600 mt-0.5">
              {pedido.condominio?.nome} · Q{pedido.cliente.quadra} L{pedido.cliente.lote} · {pedido.cliente.rua}
            </p>
          )}
        </div>
      )}

      {pedido.motoboy && (
        <p className="text-xs text-blue-400">🛵 {pedido.motoboy.nome}</p>
      )}

      <div className="text-xs text-gray-500 space-y-0.5">
        {(pedido.itens_pedido || []).map((item: any, i: number) => (
          <div key={i}>{item.quantidade}x {
            item.meia_pizza
              ? `½ ${item.pizza_metade_1?.nome} + ½ ${item.pizza_metade_2?.nome}`
              : item.pizza?.nome || item.bebida?.nome || item.outro?.nome
          }</div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{pedido.forma_pagamento}</span>
        <span className="font-bold text-gray-200">R$ {Number(pedido.valor_total).toFixed(2)}</span>
      </div>

      <div className="flex gap-1.5 pt-1">
        {acoes.map((acao, i) => (
          <button key={i} onClick={acao.fn}
            className={clsx('flex-1 text-xs py-2 rounded-lg font-medium transition-all',
              acao.variant === 'danger'
                ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900/30'
                : 'btn-primary'
            )}>
            {acao.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Modal para despachar entrega (selecionar motoboy)
function ModalDespachar({ pedido, onClose, onConfirm }: {
  pedido: any; onClose: () => void; onConfirm: () => void
}) {
  const [motoboyId, setMotoboyId] = useState<number | null>(null)
  const { data: motoboys = [] } = useQuery({ queryKey: ['motoboys'], queryFn: motoboysDb.listar })

  const { mutate: despachar, isPending } = useMutation({
    mutationFn: async () => {
      if (!motoboyId) throw new Error('Selecione um motoboy')
      await pedidosDb.atualizarStatus(pedido.id, 'delivery', { motoboy_id: motoboyId })
      await supabase.from('entregas').upsert({
        pedido_id: pedido.id, motoboy_id: motoboyId,
        status: 'saiu', data_saida: new Date().toISOString()
      }, { onConflict: 'pedido_id' })
    },
    onSuccess: () => {
      // Imprimir nota de entrega automaticamente
      const win = window.open('', '_blank')
      if (win) {
        const motoboy = (motoboys as Motoboy[]).find(m => m.id === motoboyId)
        win.document.write(gerarHTMLEntrega({ ...pedido, motoboy }))
        win.document.close()
        win.print()
      }
      toast.success('Motoboy despachado! Nota impressa.')
      onConfirm()
    },
    onError: (e: Error) => toast.error(e.message)
  })

  return (
    <Modal open onClose={onClose} title={`Despachar Pedido #${pedido.id}`} size="sm">
      <div className="space-y-4">
        <div>
          <label className="label">Selecione o Motoboy</label>
          <div className="grid grid-cols-1 gap-2">
            {(motoboys as Motoboy[]).map(m => (
              <button key={m.id} onClick={() => setMotoboyId(m.id)}
                className={clsx('px-4 py-3 rounded-xl border text-left transition-all',
                  motoboyId === m.id
                    ? 'border-pizza-500/60 bg-pizza-500/10 text-pizza-300'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                )}>
                🛵 {m.nome} {m.telefone && <span className="text-gray-600 text-xs ml-2">{m.telefone}</span>}
              </button>
            ))}
          </div>
          {!(motoboys as any[]).length && <p className="text-sm text-gray-500">Nenhum motoboy ativo cadastrado</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => despachar()} disabled={!motoboyId || isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Truck size={15} /> Despachar e Imprimir
          </button>
        </div>
      </div>
    </Modal>
  )
}

// HTML da nota de entrega (com preço e motoboy)
function gerarHTMLEntrega(pedido: any): string {
  const itens = (pedido.itens_pedido || []).map((item: any) => {
    let desc = item.meia_pizza
      ? `½ ${item.pizza_metade_1?.nome} + ½ ${item.pizza_metade_2?.nome}`
      : item.pizza?.nome || item.bebida?.nome || item.outro?.nome || ''
    if (item.borda) desc += ` | Borda: ${item.borda.nome}`
    if (item.adicionais_item?.length) desc += ` | +${item.adicionais_item.map((a: any) => a.ingrediente?.nome).join(', ')}`
    return `<div class="item"><span>${item.quantidade}x ${desc}</span><span>R$ ${Number(item.valor_unitario * item.quantidade).toFixed(2)}</span></div>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; }
    h1 { font-size: 15px; text-align: center; margin: 0 0 4px; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .item { display: flex; justify-content: space-between; margin: 3px 0; }
    .label { font-size: 10px; text-transform: uppercase; color: #555; }
    .total { font-weight: bold; font-size: 14px; }
  </style></head>
  <body>
    <h1>🍕 NOTA DE ENTREGA</h1>
    <div class="label">Pedido</div>
    <div><strong>#${pedido.id}</strong> · ${new Date(pedido.data_criacao).toLocaleString('pt-BR')}</div>
    <div class="divider"></div>
    <div class="label">Cliente</div>
    <div>${pedido.cliente?.nome || '—'}</div>
    ${pedido.tipo?.includes('delivery') ? `
    <div>${pedido.condominio?.nome || ''}</div>
    <div>Q${pedido.cliente?.quadra} L${pedido.cliente?.lote} · ${pedido.cliente?.rua || ''}</div>
    <div>Tel: ${pedido.cliente?.telefone || ''}</div>` : '<div>Retirada no balcão</div>'}
    ${pedido.motoboy ? `<div class="divider"></div><div class="label">Motoboy</div><div>${pedido.motoboy?.nome}</div>` : ''}
    <div class="divider"></div>
    <div class="label">Itens</div>
    ${itens}
    <div class="divider"></div>
    ${pedido.valor_frete > 0 ? `<div class="item"><span>Frete</span><span>R$ ${Number(pedido.valor_frete).toFixed(2)}</span></div>` : ''}
    <div class="item total"><span>TOTAL</span><span>R$ ${Number(pedido.valor_total).toFixed(2)}</span></div>
    <div class="divider"></div>
    <div style="text-align:center;font-size:10px">Forma: ${pedido.forma_pagamento || '—'}</div>
  </body></html>`
}
