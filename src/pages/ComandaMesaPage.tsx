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

// ── Agrupamento de itens da comanda ──
function agruparItens(pedidos: any[]): { key: string; nome: string; quantidade: number; valorUnitario: number; total: number; itens: any[]; pedidoStatus: string; itemId: number; pedidoId: number }[] {
  const mapa: Record<string, any> = {}

  pedidos.forEach(pedido => {
    ;(pedido.itens_pedido || []).forEach((item: any) => {
      // Gerar chave única baseada no produto
      let nome = ''
      let key = ''

      if (item.meia_pizza) {
        const n1 = item.pizza_metade_1?.nome || ''
        const n2 = item.pizza_metade_2?.nome || ''
        nome = `½ ${n1} + ½ ${n2}`
        key = `meio-${item.pizza_metade_1_id}-${item.pizza_metade_2_id}`
      } else if (item.tres_sabores) {
        const n1 = item.pizza_metade_1?.nome || ''
        const n2 = item.pizza_metade_2?.nome || ''
        const n3 = item.pizza_metade_3?.nome || ''
        nome = `⅓ ${n1} + ⅓ ${n2} + ⅓ ${n3}`
        key = `tres-${item.pizza_metade_1_id}-${item.pizza_metade_2_id}-${item.pizza_metade_3_id}`
      } else if (item.pizza_id) {
        nome = item.pizza?.nome || ''
        key = `pizza-${item.pizza_id}`
      } else if (item.bebida_id) {
        nome = item.bebida?.nome || ''
        key = `bebida-${item.bebida_id}`
      } else if (item.outro_id) {
        nome = item.outro?.nome || ''
        key = `outro-${item.outro_id}`
      }

      // Incluir borda na chave se houver
      if (item.borda_id) {
        key += `-borda-${item.borda_id}`
        nome += ` (borda ${item.borda?.nome || ''})`
      }

      // Incluir adicionais na chave
      if (item.adicionais_item?.length) {
        const adKeys = item.adicionais_item.map((a: any) => a.ingrediente_id).sort().join(',')
        key += `-adic-${adKeys}`
        nome += ` +${item.adicionais_item.map((a: any) => a.ingrediente?.nome).join(', ')}`
      }

      // Incluir observação na chave (observações diferentes = itens separados)
      if (item.observacao) {
        key += `-obs-${item.observacao}`
      }

      if (mapa[key]) {
        mapa[key].quantidade += item.quantidade
        mapa[key].total += Number(item.valor_unitario) * item.quantidade
        // Manter referência ao item mais recente e ao status do pedido mais restritivo
        mapa[key].itens.push({ item, pedidoId: pedido.id, pedidoStatus: pedido.status })
        // Se algum pedido já está em fazendo ou além, não permite remover
        if (pedido.status !== 'solicitado') {
          mapa[key].pedidoStatus = pedido.status
        }
      } else {
        mapa[key] = {
          key,
          nome,
          quantidade: item.quantidade,
          valorUnitario: Number(item.valor_unitario),
          total: Number(item.valor_unitario) * item.quantidade,
          itens: [{ item, pedidoId: pedido.id, pedidoStatus: pedido.status }],
          pedidoStatus: pedido.status,
          itemId: item.id,
          pedidoId: pedido.id,
          observacao: item.observacao,
        }
      }
    })
  })

  return Object.values(mapa).sort((a, b) => a.nome.localeCompare(b.nome))
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

  const pedidosArr = (pedidos as any[]).filter(p => (p.itens_pedido || []).length > 0)

  // Calcular totais apenas com pedidos que têm itens
  const totalConsumido = pedidosArr.reduce((acc, p) => acc + Number(p.valor_total || 0), 0)
  const totalPago = pedidosArr.reduce((acc, p) =>
    acc + (p.pagamentos || []).reduce((a: number, pg: any) => a + Number(pg.valor || 0), 0), 0)
  const saldoRestante = totalConsumido - totalPago

  // Agrupar todos os itens de todos os pedidos
  const itensAgrupados = agruparItens(pedidosArr)

  // Pagamentos totais (de todos os pedidos)
  const todosPagamentos = pedidosArr.flatMap(p => (p.pagamentos || []))

  const { mutate: removerItem, isPending: removendo } = useMutation({
    mutationFn: async ({ item, pedidoId, pedidoStatus }: { item: any; pedidoId: number; pedidoStatus: string }) => {
      if (pedidoStatus !== 'solicitado') throw new Error('Só é possível remover itens de pedidos em "solicitado"')

      // Devolver estoque de bebida/outro
      if (item.tipo_item === 'bebida' && item.bebida_id) {
        const { data: beb } = await supabase.from('bebidas').select('quantidade_estoque').eq('id', item.bebida_id).single()
        if (beb) await supabase.from('bebidas').update({ quantidade_estoque: Number(beb.quantidade_estoque) + Number(item.quantidade) }).eq('id', item.bebida_id)
      }
      if (item.tipo_item === 'outro' && item.outro_id) {
        const { data: out } = await supabase.from('outros_produtos').select('quantidade_estoque').eq('id', item.outro_id).single()
        if (out) await supabase.from('outros_produtos').update({ quantidade_estoque: Number(out.quantidade_estoque) + Number(item.quantidade) }).eq('id', item.outro_id)
      }

      // Remover adicionais e item
      await supabase.from('adicionais_item').delete().eq('item_pedido_id', item.id)
      await supabase.from('itens_pedido').delete().eq('id', item.id)

      // Recalcular total do pedido
      const { data: restantes } = await supabase.from('itens_pedido').select('valor_unitario, quantidade').eq('pedido_id', pedidoId)
      if (!restantes?.length) {
        await supabase.from('pedidos').delete().eq('id', pedidoId)
      } else {
        const novoTotal = restantes.reduce((acc, i: any) => acc + Number(i.valor_unitario) * Number(i.quantidade), 0)
        await supabase.from('pedidos').update({ valor_total: novoTotal }).eq('id', pedidoId)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comanda', mesa.id] })
      toast.success('Item removido!')
    },
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
    win.document.write(gerarHTMLComanda(mesa, itensAgrupados, totalConsumido, totalPago, saldoRestante))
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  if (isLoading) return <LoadingPage />

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
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

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-4">
        {!pedidosArr.length ? (
          <Empty icon="🍽️" title="Nenhum pedido nesta mesa" desc="Abra um pedido pelo PDV selecionando esta mesa" />
        ) : (
          <div className="space-y-4">
            {/* Resumo financeiro */}
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

            {/* Itens agrupados */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-200 text-sm">🍽️ Itens consumidos</h3>
                <span className="text-xs text-gray-500">{pedidosArr.length} pedido{pedidosArr.length > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {itensAgrupados.map((grupo) => (
                  <div key={grupo.key} className="flex items-center justify-between py-2 border-b border-gray-800/60 last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-pizza-400 w-8">{grupo.quantidade}x</span>
                        <span className="text-sm text-gray-300">{grupo.nome}</span>
                        {/* Status badge se algum ainda está solicitado */}
                        {grupo.itens.some((i: any) => i.pedidoStatus === 'solicitado') && (
                          <span className="badge bg-yellow-900/40 text-yellow-400 border border-yellow-800/40 text-xs">aguardando</span>
                        )}
                      </div>
                      {grupo.observacao && (
                        <p className="text-xs text-yellow-500 italic ml-8 mt-0.5">💬 {grupo.observacao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-200">R$ {grupo.total.toFixed(2)}</span>
                      {/* Botão remover — só para itens de pedidos em solicitado */}
                      {grupo.itens.some((i: any) => i.pedidoStatus === 'solicitado') && (
                        <button
                          onClick={() => {
                            // Pegar o primeiro item solicitado do grupo para remover
                            const itemSolicitado = grupo.itens.find((i: any) => i.pedidoStatus === 'solicitado')
                            if (itemSolicitado) {
                              removerItem({
                                item: itemSolicitado.item,
                                pedidoId: itemSolicitado.pedidoId,
                                pedidoStatus: itemSolicitado.pedidoStatus
                              })
                            }
                          }}
                          disabled={removendo}
                          title="Remover 1 unidade (devolve estoque)"
                          className="text-gray-600 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold border-t border-gray-700 pt-3 mt-2">
                <span className="text-gray-300">Total</span>
                <span className="text-gray-100">R$ {totalConsumido.toFixed(2)}</span>
              </div>
            </div>

            {/* Pagamentos registrados */}
            {todosPagamentos.length > 0 && (
              <div className="card p-4">
                <h3 className="font-semibold text-gray-200 text-sm mb-3">💳 Pagamentos registrados</h3>
                <div className="space-y-1">
                  {todosPagamentos.map((pg: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-green-400">✓ {pg.metodo}</span>
                      <span className="text-green-400 font-medium">R$ {Number(pg.valor).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal pagamento */}
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

      {/* Modal fechar mesa */}
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

function gerarHTMLComanda(mesa: any, itens: any[], total: number, pago: number, restante: number): string {
  const itensHTML = itens.map(grupo =>
    `<div class="item">
      <span>${grupo.quantidade}x ${grupo.nome}${grupo.observacao ? ` (${grupo.observacao})` : ''}</span>
      <span>R$ ${grupo.total.toFixed(2)}</span>
    </div>`
  ).join('')

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
    <div class="label">Itens</div>
    ${itensHTML}
    <div class="divider"></div>
    <div class="item total"><span>TOTAL</span><span>R$ ${total.toFixed(2)}</span></div>
    ${pago > 0 ? `<div class="item"><span>Pago</span><span>R$ ${pago.toFixed(2)}</span></div>` : ''}
    ${restante > 0 ? `<div class="item total"><span>RESTANTE</span><span>R$ ${restante.toFixed(2)}</span></div>` : ''}
    <div class="divider"></div>
    <div style="text-align:center;font-size:10px">${new Date().toLocaleString('pt-BR')}</div>
  </body></html>`
}
