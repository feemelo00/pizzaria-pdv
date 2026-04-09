import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mesasDb, pedidosDb } from '../lib/db'
import { supabase } from '../lib/supabase'
import { Modal, FormField, LoadingPage, Empty, StatusBadge } from '../components/ui'
import { Receipt, CreditCard, CheckCircle, Trash2 } from 'lucide-react'
import type { Mesa } from '../lib/supabase'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function ComandaMesaPage() {
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null)

  const { data: mesas = [], isLoading } = useQuery({
    queryKey: ['mesas'],
    queryFn: mesasDb.listar,
    refetchInterval: 15_000
  })

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 h-12 border-b border-gray-800 flex items-center">
          <h2 className="font-semibold text-gray-200 text-sm">🪑 Mesas</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? <LoadingPage /> : (mesas as Mesa[]).map(mesa => (
            <button key={mesa.id} onClick={() => setMesaSelecionada(mesa)}
              className={clsx('w-full text-left p-3 rounded-xl border transition-all',
                mesaSelecionada?.id === mesa.id ? 'border-pizza-500/60 bg-pizza-500/10'
                : mesa.status === 'ocupada' ? 'border-orange-800/50 bg-orange-900/10 hover:border-orange-700/60'
                : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600/50'
              )}>
              <div className="font-medium text-gray-200 text-sm">{mesa.nome}</div>
              <div className={clsx('text-xs mt-0.5', mesa.status === 'ocupada' ? 'text-orange-400' : 'text-green-400')}>
                {mesa.status === 'ocupada' ? '🔴 Ocupada' : '🟢 Livre'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {!mesaSelecionada
          ? <div className="flex items-center justify-center h-full">
              <Empty icon="🪑" title="Selecione uma mesa" desc="Clique em uma mesa para ver a comanda" />
            </div>
          : <ComandaMesa key={mesaSelecionada.id} mesa={mesaSelecionada}
              onAtualizar={(m) => setMesaSelecionada(m)} />
        }
      </div>
    </div>
  )
}

function ComandaMesa({ mesa, onAtualizar }: { mesa: Mesa; onAtualizar: (m: Mesa) => void }) {
  const qc = useQueryClient()
  const [modalPagamento, setModalPagamento] = useState(false)
  const [valorPagamento, setValorPagamento] = useState('')
  const [metodoPagamento, setMetodoPagamento] = useState('dinheiro')
  const [modalFechar, setModalFechar] = useState(false)

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['comanda', mesa.id],
    queryFn: () => mesasDb.buscarComanda(mesa.id),
    refetchInterval: 10_000
  })

  const pedidosArr = pedidos as any[]
  const totalConsumido = pedidosArr.reduce((acc, p) => acc + Number(p.valor_total || 0), 0)
  const totalPago = pedidosArr.reduce((acc, p) =>
    acc + (p.pagamentos || []).reduce((a: number, pg: any) => a + Number(pg.valor || 0), 0), 0)
  const saldoRestante = totalConsumido - totalPago

  const { mutate: removerItem, isPending: removendo } = useMutation({
    mutationFn: async ({ item, pedidoId, pedidoStatus }: { item: any; pedidoId: number; pedidoStatus: string }) => {
      if (pedidoStatus !== 'solicitado') throw new Error('Só é possível remover itens de pedidos em "solicitado"')

      if (item.tipo_item === 'bebida' && item.bebida_id) {
        const { data: beb } = await supabase.from('bebidas').select('quantidade_estoque').eq('id', item.bebida_id).single()
        if (beb) await supabase.from('bebidas').update({ quantidade_estoque: Number(beb.quantidade_estoque) + Number(item.quantidade) }).eq('id', item.bebida_id)
      }
      if (item.tipo_item === 'outro' && item.outro_id) {
        const { data: out } = await supabase.from('outros_produtos').select('quantidade_estoque').eq('id', item.outro_id).single()
        if (out) await supabase.from('outros_produtos').update({ quantidade_estoque: Number(out.quantidade_estoque) + Number(item.quantidade) }).eq('id', item.outro_id)
      }

      await supabase.from('adicionais_item').delete().eq('item_pedido_id', item.id)
      await supabase.from('itens_pedido').delete().eq('id', item.id)

      const { data: restantes } = await supabase.from('itens_pedido').select('valor_unitario, quantidade').eq('pedido_id', pedidoId)
      if (!restantes?.length) {
        await supabase.from('pedidos').delete().eq('id', pedidoId)
      } else {
        const novoTotal = restantes.reduce((acc, i: any) => acc + Number(i.valor_unitario) * Number(i.quantidade), 0)
        await supabase.from('pedidos').update({ valor_total: novoTotal }).eq('id', pedidoId)
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comanda', mesa.id] }); toast.success('Item removido!') },
    onError: (e: Error) => toast.error(e.message)
  })

  const { mutate: registrarPagamento, isPending: pagando } = useMutation({
    mutationFn: async () => {
      const valor = Number(valorPagamento)
      if (!valor || valor <= 0) throw new Error('Valor inválido')
      if (valor > saldoRestante + 0.01) throw new Error(`Valor maior que o saldo (R$ ${saldoRestante.toFixed(2)})`)
      const pedidoComSaldo = pedidosArr.find(p => {
        const pago = (p.pagamentos || []).reduce((a: number, pg: any) => a + Number(pg.valor), 0)
        return Number(p.valor_total) > pago
      })
      if (!pedidoComSaldo) throw new Error('Todos os pedidos já foram pagos')
      await supabase.from('pagamentos').insert({ pedido_id: pedidoComSaldo.id, metodo: metodoPagamento, valor, confirmado: true })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comanda', mesa.id] })
      setModalPagamento(false); setValorPagamento('')
      toast.success('Pagamento registrado!')
    },
    onError: (e: Error) => toast.error(e.message)
  })

  const { mutate: fecharMesa, isPending: fechando } = useMutation({
    mutationFn: async () => {
      if (saldoRestante > 0.01) throw new Error(`Ainda há R$ ${saldoRestante.toFixed(2)} em aberto`)
      for (const p of pedidosArr) {
        if (!['finalizado','devolvido'].includes(p.status)) {
          await pedidosDb.atualizarStatus(p.id, 'finalizado')
        }
      }
      await mesasDb.liberar(mesa.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesas'] })
      qc.invalidateQueries({ queryKey: ['comanda', mesa.id] })
      toast.success(`${mesa.nome} fechada e liberada!`)
      onAtualizar({ ...mesa, status: 'livre' })
    },
    onError: (e: Error) => toast.error(e.message)
  })

  const imprimirComanda = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(gerarHTMLComanda(mesa, pedidosArr, totalConsumido, totalPago, saldoRestante))
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  if (isLoading) return <LoadingPage />

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-100">{mesa.nome}</h2>
          <span className={clsx('badge border text-xs',
            mesa.status === 'ocupada' ? 'bg-orange-900/40 text-orange-400 border-orange-800/40' : 'bg-green-900/40 text-green-400 border-green-800/40')}>
            {mesa.status === 'ocupada' ? '🔴 Ocupada' : '🟢 Livre'}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={imprimirComanda} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Receipt size={13} /> Imprimir comanda
          </button>
          {mesa.status === 'ocupada' && <>
            <button onClick={() => setModalPagamento(true)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
              <CreditCard size={13} /> Registrar pagamento
            </button>
            <button onClick={() => setModalFechar(true)} disabled={saldoRestante > 0.01}
              className={clsx('text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all',
                saldoRestante > 0.01 ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700' : 'bg-green-600 text-white hover:bg-green-500')}>
              <CheckCircle size={13} />
              {saldoRestante > 0.01 ? `Falta R$ ${saldoRestante.toFixed(2)}` : 'Fechar mesa'}
            </button>
          </>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!pedidosArr.length ? (
          <Empty icon="🍽️" title="Nenhum pedido nesta mesa" desc="Abra um pedido pelo PDV selecionando esta mesa" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-4">
                <div className="text-xs text-gray-500 mb-1">Total consumido</div>
                <div className="text-xl font-bold text-gray-100">R$ {totalConsumido.toFixed(2)}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-gray-500 mb-1">Total pago</div>
                <div className="text-xl font-bold text-green-400">R$ {totalPago.toFixed(2)}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-gray-500 mb-1">Saldo restante</div>
                <div className={clsx('text-xl font-bold', saldoRestante > 0 ? 'text-orange-400' : 'text-green-400')}>
                  R$ {saldoRestante.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {pedidosArr.map((pedido) => (
                <div key={pedido.id} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-200">Pedido #{pedido.id}</span>
                      <StatusBadge status={pedido.status} />
                    </div>
                    <span className="text-xs text-gray-500">
                      {format(new Date(pedido.data_criacao), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    {(pedido.itens_pedido || []).map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between text-sm py-0.5">
                        <span className="text-gray-400 flex-1">
                          {item.quantidade}x {item.meia_pizza
                            ? `½ ${item.pizza_metade_1?.nome} + ½ ${item.pizza_metade_2?.nome}`
                            : item.pizza?.nome || item.bebida?.nome || item.outro?.nome}
                          {item.borda && ` (borda ${item.borda.nome})`}
                          {(item.adicionais_item || []).length > 0 && (
                            <span className="text-green-500 ml-1">
                              +{item.adicionais_item.map((a: any) => a.ingrediente?.nome).join(', ')}
                            </span>
                          )}
                        </span>
                        <span className="text-gray-300 font-medium mx-3">
                          R$ {(Number(item.valor_unitario) * Number(item.quantidade)).toFixed(2)}
                        </span>
                        {pedido.status === 'solicitado' && (
                          <button
                            onClick={() => removerItem({ item, pedidoId: pedido.id, pedidoStatus: pedido.status })}
                            disabled={removendo}
                            title="Remover item (devolve estoque)"
                            className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between text-sm font-bold border-t border-gray-800 pt-2">
                    <span className="text-gray-300">Subtotal</span>
                    <span className="text-gray-100">R$ {Number(pedido.valor_total).toFixed(2)}</span>
                  </div>

                  {(pedido.pagamentos || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {(pedido.pagamentos || []).map((pg: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs text-green-500">
                          <span>✓ Pago ({pg.metodo})</span>
                          <span>R$ {Number(pg.valor).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal open={modalPagamento} onClose={() => setModalPagamento(false)} title="Registrar Pagamento" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-gray-800/60 rounded-xl text-sm">
            <div className="flex justify-between text-gray-400"><span>Total consumido</span><span>R$ {totalConsumido.toFixed(2)}</span></div>
            <div className="flex justify-between text-green-400"><span>Já pago</span><span>R$ {totalPago.toFixed(2)}</span></div>
            <div className="flex justify-between text-orange-400 font-bold mt-1 pt-1 border-t border-gray-700">
              <span>Saldo restante</span><span>R$ {saldoRestante.toFixed(2)}</span>
            </div>
          </div>
          <FormField label="Forma de pagamento">
            <select value={metodoPagamento} onChange={e => setMetodoPagamento(e.target.value)} className="input">
              <option value="dinheiro">💵 Dinheiro</option>
              <option value="pix">📲 PIX</option>
              <option value="credito">💳 Crédito</option>
              <option value="debito">💳 Débito</option>
              <option value="vr">🍽️ VR</option>
            </select>
          </FormField>
          <FormField label="Valor pago agora (R$)">
            <input type="number" step="0.01" min="0.01" value={valorPagamento}
              onChange={e => setValorPagamento(e.target.value)}
              placeholder={`Máx: R$ ${saldoRestante.toFixed(2)}`}
              className="input" autoFocus />
          </FormField>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModalPagamento(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => registrarPagamento()} disabled={pagando || !valorPagamento} className="btn-primary flex-1">
              Confirmar pagamento
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modalFechar} onClose={() => setModalFechar(false)} title="Fechar Mesa" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Todos os pedidos serão finalizados e a <strong className="text-gray-200">{mesa.nome}</strong> será liberada.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setModalFechar(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => { fecharMesa(); setModalFechar(false) }} disabled={fechando}
              className="flex-1 py-2 px-4 rounded-lg font-medium text-white bg-green-600 hover:bg-green-500 transition-colors">
              Fechar e liberar mesa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function gerarHTMLComanda(mesa: any, pedidos: any[], total: number, pago: number, restante: number): string {
  const itensHTML = pedidos.map(p => {
    const itens = (p.itens_pedido || []).map((item: any) =>
      `<div class="item">
        <span>${item.quantidade}x ${item.meia_pizza
          ? `½ ${item.pizza_metade_1?.nome} + ½ ${item.pizza_metade_2?.nome}`
          : item.pizza?.nome || item.bebida?.nome || item.outro?.nome || ''}</span>
        <span>R$ ${(Number(item.valor_unitario) * Number(item.quantidade)).toFixed(2)}</span>
      </div>`
    ).join('')
    return `<div class="pedido"><div class="label">Pedido #${p.id}</div>${itens}</div>`
  }).join('<div class="divider"></div>')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:8px}
    h1{font-size:16px;text-align:center;margin:0 0 4px}
    .divider{border-top:1px dashed #000;margin:6px 0}
    .item{display:flex;justify-content:space-between;margin:2px 0}
    .label{font-size:10px;text-transform:uppercase;color:#555;margin-bottom:4px}
    .total{font-weight:bold;font-size:13px}
  </style></head>
  <body>
    <h1>🍕 COMANDA</h1>
    <div style="text-align:center;font-size:14px;font-weight:bold;margin-bottom:8px">${mesa.nome}</div>
    <div class="divider"></div>
    ${itensHTML}
    <div class="divider"></div>
    <div class="item total"><span>TOTAL</span><span>R$ ${total.toFixed(2)}</span></div>
    ${pago > 0 ? `<div class="item"><span>Pago</span><span>R$ ${pago.toFixed(2)}</span></div>` : ''}
    ${restante > 0 ? `<div class="item total"><span>RESTANTE</span><span>R$ ${restante.toFixed(2)}</span></div>` : ''}
    <div class="divider"></div>
    <div style="text-align:center;font-size:10px">${new Date().toLocaleString('pt-BR')}</div>
  </body></html>`
}
