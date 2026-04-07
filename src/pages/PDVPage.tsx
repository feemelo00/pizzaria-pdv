import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { pizzasDb, bebidasDb, outrosDb, bordasDb, ingredientesDb, clientesDb, condominiosDb, pedidosDb } from '../lib/db'
import { useCarrinhoStore, type ItemCarrinho } from '../store/carrinhoStore'
import { Modal, FormField, Spinner, Empty } from '../components/ui'
import { Search, Plus, Minus, Trash2, ShoppingCart, UserSearch, X } from 'lucide-react'
import type { Pizza, Bebida, OutroProduto, Borda, Ingrediente, Cliente } from '../lib/supabase'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const TIPOS_PEDIDO = [
  { value: 'balcao_retirada', label: '🏪 Balcão · Retirada' },
  { value: 'balcao_delivery', label: '🏪 Balcão · Delivery' },
  { value: 'online_retirada', label: '📱 Online · Retirada' },
  { value: 'online_delivery', label: '📱 Online · Delivery' },
]
const FORMAS_PAG = [
  { value: 'dinheiro', label: '💵 Dinheiro' },
  { value: 'pix',      label: '📲 PIX' },
  { value: 'credito',  label: '💳 Crédito' },
  { value: 'debito',   label: '💳 Débito' },
  { value: 'vr',       label: '🍽️ VR' },
]

export function PDVPage() {
  const [aba, setAba] = useState<'pizzas'|'bebidas'|'outros'>('pizzas')
  const [pizzaModal, setPizzaModal] = useState<Pizza | null>(null)
  const [clienteModal, setClienteModal] = useState(false)
  const [busca, setBusca] = useState('')
  const carrinho = useCarrinhoStore()

  const { data: pizzas = [] }  = useQuery({ queryKey: ['pizzas-disp'], queryFn: pizzasDb.listarDisponiveis })
  const { data: bebidas = [] } = useQuery({ queryKey: ['bebidas-disp'], queryFn: bebidasDb.listarDisponiveis })
  const { data: outros = [] }  = useQuery({ queryKey: ['outros-disp'],  queryFn: outrosDb.listarDisponiveis })

  const { data: clienteData } = useQuery({
    queryKey: ['cliente', carrinho.clienteTelefone],
    queryFn: () => clientesDb.buscar(carrinho.clienteTelefone),
    enabled: carrinho.clienteTelefone.length >= 10
  })

  const isDelivery = carrinho.tipoPedido.includes('delivery')
  const frete = isDelivery && clienteData?.condominio ? Number(clienteData.condominio.valor_frete) : 0
  const subtotal = carrinho.getSubtotal()
  const total = subtotal + frete

  const { mutate: confirmar, isPending } = useMutation({
    mutationFn: async () => {
      if (!carrinho.itens.length) throw new Error('Adicione pelo menos um item')
      if (isDelivery && !carrinho.clienteTelefone) throw new Error('Delivery exige cliente cadastrado')
      if (isDelivery && !clienteData?.condominio_id) throw new Error('Cliente sem condomínio cadastrado')

      const pedidoData = {
        cliente_telefone: carrinho.clienteTelefone || null,
        tipo: carrinho.tipoPedido,
        status: 'solicitado',
        condominio_id: clienteData?.condominio_id || null,
        valor_frete: frete,
        valor_total: total,
        forma_pagamento: carrinho.formaPagamento,
        observacao: carrinho.observacaoGeral || null,
        origem: 'pdv'
      }
      const itens = carrinho.itens.map(item => ({
        tipo_item: item.tipo_item,
        pizza_id: item.pizza_id || null,
        bebida_id: item.bebida_id || null,
        outro_id: item.outro_id || null,
        quantidade: item.quantidade,
        meia_pizza: item.meia_pizza || false,
        pizza_metade_1_id: item.pizza_metade_1_id || null,
        pizza_metade_2_id: item.pizza_metade_2_id || null,
        borda_id: item.borda_id || null,
        observacao: item.observacao || null,
        valor_unitario: item.valor_unitario,
        // passa ingredientes para baixa de estoque
        pizza_ingredientes: item.pizza_ingredientes,
        pizza_metade_1_ingredientes: item.pizza_metade_1_ingredientes,
        pizza_metade_2_ingredientes: item.pizza_metade_2_ingredientes,
        adicionais: item.adicionais.map(a => ({
          ingrediente_id: a.ingrediente_id,
          quantidade: a.quantidade,
          aplicado_em: a.aplicado_em,
          valor: a.valor
        }))
      }))
      return pedidosDb.criar(pedidoData, itens)
    },
    onSuccess: (pedido) => {
      toast.success(`✅ Pedido #${pedido.id} criado!`, { duration: 5000 })
      carrinho.limpar()
    },
    onError: (e: Error) => toast.error(e.message)
  })

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Área esquerda: cardápio ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Barra superior */}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 space-y-2 flex-shrink-0">
          {/* Tipo pedido */}
          <div className="flex gap-1.5 flex-wrap">
            {TIPOS_PEDIDO.map(t => (
              <button key={t.value} onClick={() => carrinho.setTipo(t.value)}
                className={clsx('text-xs px-3 py-1.5 rounded-lg border transition-all',
                  carrinho.tipoPedido === t.value
                    ? 'bg-pizza-500/20 text-pizza-400 border-pizza-500/40'
                    : 'text-gray-500 border-gray-700 hover:border-gray-600'
                )}>{t.label}</button>
            ))}
          </div>
          {/* Busca cliente */}
          <BuscaCliente onAbrirModal={() => setClienteModal(true)} />
        </div>

        {/* Abas cardápio + busca */}
      <div className="flex items-center border-b border-gray-800 bg-gray-900 flex-shrink-0 gap-2 pr-3">
        <div className="flex gap-0">
          {(['pizzas','bebidas','outros'] as const).map(a => (
            <button key={a} onClick={() => { setAba(a); setBusca('') }}
              className={clsx('px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize',
                aba === a ? 'border-pizza-500 text-pizza-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              )}>
              {a === 'pizzas' ? '🍕 Pizzas' : a === 'bebidas' ? '🥤 Bebidas' : '🍟 Outros'}
            </button>
          ))}
        </div>
        <div className="flex-1 relative max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar..."
            className="input pl-8 py-1.5 text-xs h-8"
          />
          {busca && (
            <button onClick={() => setBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

        {/* Grid produtos - VERSÃO DE TESTE */}
        <div className="flex-1 overflow-y-auto p-3">
          
          {/* TESTE: Mostrar o valor da busca */}
          <div className="bg-yellow-100 p-2 mb-3 text-black">
            <strong>DEBUG:</strong> Buscando por: "{busca}"
          </div>
          
          {aba === 'pizzas' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {/* TESTE: Mostrar quantas pizzas existem */}
              <div className="col-span-4 bg-blue-100 p-2 text-black mb-2">
                Total de pizzas: {pizzas?.length || 0}
              </div>
              
              {pizzas && pizzas.map(p => {
                const matches = !busca || p.nome.toLowerCase().includes(busca.toLowerCase());
                return (
                  <div key={p.id} className={`border p-2 ${matches ? 'bg-green-100' : 'bg-red-100 hidden'}`}>
                    <div><strong>{p.nome}</strong></div>
                    <div>{p.tamanho}</div>
                    <div>R$ {p.preco}</div>
                    <div className="text-xs">
                      Match: {matches ? 'SIM' : 'NÃO'} | 
                      Busca: "{busca}" | 
                      Nome: "{p.nome.toLowerCase()}"
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Faça o mesmo para bebidas e outros se quiser testar */}
        </div>

      {/* ── Carrinho direito ── */}
      <div className="w-72 xl:w-80 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-pizza-400" />
            <span className="font-semibold text-gray-200 text-sm">Pedido</span>
          </div>
          {carrinho.itens.length > 0 && (
            <button onClick={carrinho.limpar} className="text-xs text-gray-600 hover:text-red-400 transition-colors">
              Limpar
            </button>
          )}
        </div>

        {/* Itens */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {carrinho.itens.length === 0
            ? <Empty icon="🛒" title="Carrinho vazio" desc="Selecione itens ao lado" />
            : carrinho.itens.map(item => <ItemCarrinhoCard key={item._id} item={item} />)
          }
        </div>

        {/* Observação */}
        <div className="px-3 pb-2">
          <textarea value={carrinho.observacaoGeral}
            onChange={e => carrinho.setObservacao(e.target.value)}
            placeholder="Observação geral do pedido..."
            className="input text-xs resize-none h-14" />
        </div>

        {/* Forma pagamento */}
        <div className="px-3 pb-2">
          <div className="grid grid-cols-3 gap-1">
            {FORMAS_PAG.map(f => (
              <button key={f.value} onClick={() => carrinho.setPagamento(f.value)}
                className={clsx('text-xs py-1.5 rounded-lg border transition-all',
                  carrinho.formaPagamento === f.value
                    ? 'bg-pizza-500/20 text-pizza-400 border-pizza-500/40'
                    : 'text-gray-600 border-gray-700 hover:border-gray-600'
                )}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* Totais */}
        <div className="px-3 py-2 border-t border-gray-800 space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span>
          </div>
          {isDelivery && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Frete ({clienteData?.condominio?.nome || '—'})</span>
              <span>R$ {frete.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-100 pt-1">
            <span>Total</span><span className="text-pizza-400">R$ {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Botão confirmar */}
        <div className="p-3 border-t border-gray-800">
          <button onClick={() => confirmar()} disabled={isPending || !carrinho.itens.length}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {isPending ? <Spinner size="sm" /> : '✅ Confirmar Pedido'}
          </button>
        </div>
      </div>

      {/* Modais */}
      {pizzaModal && (
        <ModalPizza
          pizza={pizzaModal}
          todasPizzas={pizzas as Pizza[]}
          onClose={() => setPizzaModal(null)}
        />
      )}
      <ModalCliente open={clienteModal} onClose={() => setClienteModal(false)} />
    </div>
  )
}

// ── Card produto ──
function CardProduto({ nome, sub, preco, onClick }: {
  nome: string; sub: string; preco: number; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="text-left p-3 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-pizza-500/40 rounded-xl transition-all active:scale-95 group">
      <div className="font-medium text-gray-200 text-sm leading-tight mb-1 group-hover:text-white">{nome}</div>
      {sub && <div className="text-xs text-gray-600 mb-2">{sub}</div>}
      <div className="text-pizza-400 font-bold text-sm">R$ {Number(preco).toFixed(2)}</div>
    </button>
  )
}

// ── Item no carrinho ──
function ItemCarrinhoCard({ item }: { item: ItemCarrinho }) {
  const { removerItem, atualizarQtd } = useCarrinhoStore()
  let desc = ''
  if (item.tipo_item === 'pizza') {
    desc = item.meia_pizza
      ? `½ ${item.pizza_metade_1_nome} + ½ ${item.pizza_metade_2_nome}`
      : item.pizza_nome || ''
    if (item.borda_nome) desc += ` | Borda: ${item.borda_nome}`
  } else {
    desc = item.bebida_nome || item.outro_nome || ''
  }
  const totalAdicionais = item.adicionais.reduce((a, ad) => a + ad.valor * ad.quantidade, 0)
  const precoFinal = (item.valor_unitario + totalAdicionais) * item.quantidade

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700/40 p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-300 leading-tight truncate">{desc}</p>
          {item.adicionais.length > 0 && (
            <p className="text-xs text-green-500 mt-0.5">+{item.adicionais.map(a => a.nome).join(', ')}</p>
          )}
          {item.observacao && <p className="text-xs text-yellow-500 italic mt-0.5">{item.observacao}</p>}
        </div>
        <button onClick={() => removerItem(item._id)} className="text-gray-700 hover:text-red-400 flex-shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <button onClick={() => atualizarQtd(item._id, item.quantidade - 1)}
            className="w-6 h-6 rounded border border-gray-700 text-gray-400 hover:border-gray-500 flex items-center justify-center">
            <Minus size={11} />
          </button>
          <span className="text-xs font-bold text-gray-300 w-4 text-center">{item.quantidade}</span>
          <button onClick={() => atualizarQtd(item._id, item.quantidade + 1)}
            className="w-6 h-6 rounded border border-gray-700 text-gray-400 hover:border-gray-500 flex items-center justify-center">
            <Plus size={11} />
          </button>
        </div>
        <span className="text-xs font-bold text-gray-200">R$ {precoFinal.toFixed(2)}</span>
      </div>
    </div>
  )
}

// ── Busca cliente inline ──
function BuscaCliente({ onAbrirModal }: { onAbrirModal: () => void }) {
  const { clienteTelefone, setCliente } = useCarrinhoStore()
  const [input, setInput] = useState(clienteTelefone)

  const { data: cliente } = useQuery({
    queryKey: ['cliente', input],
    queryFn: () => clientesDb.buscar(input.replace(/\D/g, '')),
    enabled: input.replace(/\D/g, '').length >= 10,
    retry: false
  })

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <UserSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input value={input} onChange={e => { setInput(e.target.value); setCliente(e.target.value.replace(/\D/g,'')) }}
          placeholder="Telefone do cliente..." className="input pl-8 py-1.5 text-xs" />
      </div>
      {cliente
        ? <span className="text-xs text-green-400 whitespace-nowrap">✓ {cliente.nome}</span>
        : input.replace(/\D/g,'').length >= 10
          ? <button onClick={onAbrirModal} className="text-xs text-pizza-400 whitespace-nowrap hover:text-pizza-300">+ Cadastrar</button>
          : null
      }
      {(input || clienteTelefone) && (
        <button onClick={() => { setInput(''); setCliente('') }} className="text-gray-600 hover:text-gray-400">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// ── Modal Pizza (inteira ou meio a meio) ──
function ModalPizza({ pizza, todasPizzas, onClose }: {
  pizza: Pizza; todasPizzas: Pizza[]; onClose: () => void
}) {
  const { adicionarItem } = useCarrinhoStore()
  const [modo, setModo] = useState<'inteira'|'meio'>('inteira')
  const [sabor2, setSabor2] = useState<Pizza | null>(null)
  const [borda, setBorda] = useState<Borda | null>(null)
  const [adicionais, setAdicionais] = useState<ItemCarrinho['adicionais']>([])
  const [obs, setObs] = useState('')
  const [qtd, setQtd] = useState(1)
  const [adicionaisConfig, setAdicionaisConfig] = useState<Record<number, {unidade: string, quantidade: string}>>({})

  const { data: bordas = [] }     = useQuery({ queryKey: ['bordas'], queryFn: bordasDb.listar })
  const { data: ingsAdic = [] }   = useQuery({ queryKey: ['adicionais'], queryFn: ingredientesDb.listarAdicionais })
  const { data: pizza1Info } = useQuery({ queryKey: ['pizza', pizza.id], queryFn: () => pizzasDb.listar().then(l => l.find((p: any) => p.id === pizza.id)) })
  const { data: pizza2Info } = useQuery({ queryKey: ['pizza', sabor2?.id], queryFn: () => sabor2 ? pizzasDb.listar().then(l => l.find((p: any) => p.id === sabor2.id)) : null, enabled: !!sabor2 })

  const calcPreco = () => {
    let base = modo === 'inteira' ? Number(pizza.preco) : Math.max(Number(pizza.preco), Number(sabor2?.preco || 0))
    if (borda) base += Number(borda.preco)
    return base
  }
  const totalAdicionais = adicionais.reduce((a, ad) => a + ad.valor * ad.quantidade, 0)
  const precoTotal = (calcPreco() + totalAdicionais) * qtd

  const toggleAdicionalComQtd = (ing: Ingrediente, aplicado_em: 'inteira'|'metade_1'|'metade_2', qtd: number) => {
  const existe = adicionais.find(a => a.ingrediente_id === ing.id && a.aplicado_em === aplicado_em)
  if (existe) {
    setAdicionais(prev => prev.filter(a => !(a.ingrediente_id === ing.id && a.aplicado_em === aplicado_em)))
  } else {
    setAdicionais(prev => [...prev, {
      ingrediente_id: ing.id,
      nome: ing.nome,
      quantidade: qtd,
      aplicado_em,
      valor: Number(ing.preco_adicional)
    }])
  }
}
const isSelected = (id: number, em: string) =>
  adicionais.some(a => a.ingrediente_id === id && a.aplicado_em === em)

  const confirmar = () => {
    if (modo === 'meio' && !sabor2) { toast.error('Selecione o 2º sabor'); return }
    adicionarItem({
      _id: crypto.randomUUID(),
      tipo_item: 'pizza',
      meia_pizza: modo === 'meio',
      pizza_id: modo === 'inteira' ? pizza.id : undefined,
      pizza_nome: modo === 'inteira' ? pizza.nome : undefined,
      pizza_ingredientes: (pizza1Info as any)?.pizza_ingredientes?.map((pi: any) => ({ ingrediente_id: pi.ingrediente_id, quantidade: pi.quantidade })),
      pizza_metade_1_id: modo === 'meio' ? pizza.id : undefined,
      pizza_metade_1_nome: modo === 'meio' ? pizza.nome : undefined,
      pizza_metade_1_ingredientes: (pizza1Info as any)?.pizza_ingredientes?.map((pi: any) => ({ ingrediente_id: pi.ingrediente_id, quantidade: pi.quantidade })),
      pizza_metade_2_id: sabor2?.id,
      pizza_metade_2_nome: sabor2?.nome,
      pizza_metade_2_ingredientes: (pizza2Info as any)?.pizza_ingredientes?.map((pi: any) => ({ ingrediente_id: pi.ingrediente_id, quantidade: pi.quantidade })),
      borda_id: borda?.id,
      borda_nome: borda?.nome,
      borda_preco: borda ? Number(borda.preco) : undefined,
      quantidade: qtd,
      valor_unitario: calcPreco(),
      observacao: obs || undefined,
      adicionais
    })
    toast.success('Pizza adicionada!', { duration: 1500 })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={modo === 'inteira' ? `🍕 ${pizza.nome}` : '½ Meio a Meio'} size="lg">
      <div className="space-y-5">
        {/* Modo */}
        <div className="flex gap-2">
          {(['inteira','meio'] as const).map(m => (
            <button key={m} onClick={() => { setModo(m); setSabor2(null) }}
              className={clsx('flex-1 py-2 rounded-lg border text-sm font-medium transition-all',
                modo === m ? 'bg-pizza-500/20 border-pizza-500/50 text-pizza-400' : 'border-gray-700 text-gray-500 hover:border-gray-600'
              )}>
              {m === 'inteira' ? '🍕 Pizza inteira' : '½ Meio a meio'}
            </button>
          ))}
        </div>

        {/* Sabor 2 */}
        {modo === 'meio' && (
          <div>
            <label className="label">2º Sabor</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
              {todasPizzas.filter(p => p.id !== pizza.id).map(p => (
                <button key={p.id} onClick={() => setSabor2(p)}
                  className={clsx('p-2 rounded-lg border text-xs text-left transition-all',
                    sabor2?.id === p.id ? 'border-pizza-500/60 bg-pizza-500/10 text-pizza-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  )}>
                  <div className="font-medium">{p.nome}</div>
                  <div className="text-gray-600">R$ {Number(p.preco).toFixed(2)}</div>
                </button>
              ))}
            </div>
            {sabor2 && (
              <p className="text-xs text-pizza-400 mt-2">
                💰 Preço: maior entre os sabores = R$ {Math.max(Number(pizza.preco), Number(sabor2.preco)).toFixed(2)}
              </p>
            )}
          </div>
        )}

        {/* Bordas */}
        {(bordas as Borda[]).length > 0 && (
          <div>
            <label className="label">Borda</label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setBorda(null)}
                className={clsx('px-3 py-1.5 rounded-lg border text-xs transition-all',
                  !borda ? 'border-gray-500 text-gray-300 bg-gray-800' : 'border-gray-700 text-gray-600 hover:border-gray-600'
                )}>Sem borda</button>
              {(bordas as Borda[]).map(b => (
                <button key={b.id} onClick={() => setBorda(b)}
                  className={clsx('px-3 py-1.5 rounded-lg border text-xs transition-all',
                    borda?.id === b.id ? 'border-pizza-500/60 bg-pizza-500/10 text-pizza-300' : 'border-gray-700 text-gray-500 hover:border-gray-600'
                  )}>
                  {b.nome} <span className="text-gray-600">+R${Number(b.preco).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Adicionais */}
        {(ingsAdic as Ingrediente[]).length > 0 && (
          <div>
            <label className="label">Adicionais</label>
            <div className="space-y-1.5">
              {(ingsAdic as Ingrediente[]).map((ing: Ingrediente) => {
                const unidadeEstoque = ing.unidade || 'g'
                const unidadesCompativeis: Record<string, string[]> = {
                  'kg': ['g', 'kg'], 'g': ['g', 'kg'],
                  'l': ['ml', 'l'], 'ml': ['ml', 'l'],
                  'unidade': ['unidade'],
                }
                const opcoes = unidadesCompativeis[unidadeEstoque] || [unidadeEstoque]

                const converter = (valor: number, de: string, para: string): number => {
                  if (de === para) return valor
                  if (de === 'g'  && para === 'kg') return valor / 1000
                  if (de === 'kg' && para === 'g')  return valor * 1000
                  if (de === 'ml' && para === 'l')  return valor / 1000
                  if (de === 'l'  && para === 'ml') return valor * 1000
                  return valor
                }

                const estadoAtual = adicionaisConfig[ing.id] || { unidade: opcoes[0], quantidade: '' }

                const selecionados = modo === 'meio'
                  ? (['metade_1','metade_2','inteira'] as const).filter(em => isSelected(ing.id, em))
                  : isSelected(ing.id, 'inteira') ? ['inteira'] : []

                return (
                  <div key={ing.id} className="bg-gray-800/50 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-300 font-medium">{ing.nome}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          estoque em <strong className="text-gray-400">{unidadeEstoque}</strong>
                        </span>
                      </div>
                      <span className="text-xs text-pizza-400">+R${Number(ing.preco_adicional).toFixed(2)}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={estadoAtual.unidade}
                        onChange={e => setAdicionaisConfig((prev: any) => ({
                          ...prev, [ing.id]: { ...estadoAtual, unidade: e.target.value }
                        }))}
                        className="bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 text-xs focus:outline-none">
                        {opcoes.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input
                        type="number" step="1" min="0"
                        value={estadoAtual.quantidade}
                        placeholder={`qtd em ${estadoAtual.unidade}`}
                        onChange={e => setAdicionaisConfig((prev: any) => ({
                          ...prev, [ing.id]: { ...estadoAtual, quantidade: e.target.value }
                        }))}
                        className="w-24 bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 text-xs focus:outline-none" />
                      {estadoAtual.quantidade && (
                        <span className="text-xs text-gray-500">
                          = {converter(Number(estadoAtual.quantidade), estadoAtual.unidade, unidadeEstoque).toFixed(4)} {unidadeEstoque}
                        </span>
                      )}
                    </div>

                    {modo === 'meio' ? (
                      <div className="flex gap-1 flex-wrap">
                        {(['metade_1','metade_2','inteira'] as const).map(em => (
                          <button key={em} onClick={() => {
                            const qtdConvertida = converter(
                              Number(estadoAtual.quantidade || ing.quantidade_adicional || 1),
                              estadoAtual.unidade, unidadeEstoque
                            )
                            toggleAdicionalComQtd(ing, em, qtdConvertida)
                          }}
                            className={clsx('px-2 py-1 text-xs rounded border transition-all',
                              isSelected(ing.id, em)
                                ? 'bg-pizza-500/30 border-pizza-500/50 text-pizza-300'
                                : 'border-gray-700 text-gray-600 hover:border-gray-600'
                            )}>
                            {em === 'metade_1' ? '½1' : em === 'metade_2' ? '½2' : 'Toda'}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button onClick={() => {
                        const qtdConvertida = converter(
                          Number(estadoAtual.quantidade || ing.quantidade_adicional || 1),
                          estadoAtual.unidade, unidadeEstoque
                        )
                        toggleAdicionalComQtd(ing, 'inteira', qtdConvertida)
                      }}
                        className={clsx('w-full py-1 text-xs rounded border transition-all',
                          isSelected(ing.id, 'inteira')
                            ? 'bg-pizza-500/30 border-pizza-500/50 text-pizza-300'
                            : 'border-gray-700 text-gray-600 hover:border-gray-600'
                        )}>
                        {isSelected(ing.id, 'inteira') ? '✓ Adicionado' : '+ Adicionar'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Observação */}
        <div>
          <label className="label">Observação</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Ex: sem cebola, bem assada..." className="input resize-none h-14 text-sm" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-800">
        <div className="flex items-center gap-2 border border-gray-700 rounded-lg">
          <button onClick={() => setQtd(q => Math.max(1, q - 1))} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white">
            <Minus size={14} />
          </button>
          <span className="w-6 text-center font-bold text-gray-200">{qtd}</span>
          <button onClick={() => setQtd(q => q + 1)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-600">Total do item</div>
          <div className="text-lg font-bold text-pizza-400">R$ {precoTotal.toFixed(2)}</div>
        </div>
        <button onClick={confirmar} className="btn-primary px-6 py-2.5">Adicionar</button>
      </div>
    </Modal>
  )
}

// ── Modal Cadastro/Busca Cliente ──
function ModalCliente({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setCliente } = useCarrinhoStore()
  const [tel, setTel] = useState('')
  const [form, setForm] = useState({ nome: '', condominio_id: '', quadra: '', lote: '', rua: '' })
  const [modo, setModo] = useState<'busca'|'cadastro'>('busca')
  const [clienteExistente, setClienteExistente] = useState<Cliente | null>(null)

  const { data: condominios = [] } = useQuery({ queryKey: ['condominios'], queryFn: condominiosDb.listar })

  const buscar = async () => {
    const t = tel.replace(/\D/g, '')
    if (t.length < 10) { toast.error('Telefone inválido'); return }
    const c = await clientesDb.buscar(t)
    if (c) { setClienteExistente(c); setCliente(t); toast.success(`Cliente encontrado: ${c.nome}`) }
    else { setClienteExistente(null); setModo('cadastro') }
  }

  const { mutate: cadastrar, isPending } = useMutation({
    mutationFn: () => clientesDb.criar({ telefone: tel.replace(/\D/g,''), ...form, condominio_id: Number(form.condominio_id) }),
    onSuccess: (c) => { setCliente(c.telefone); toast.success('Cliente cadastrado!'); onClose() },
    onError: (e: Error) => toast.error(e.message)
  })

  return (
    <Modal open={open} onClose={onClose} title="Identificar Cliente" size="md">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input value={tel} onChange={e => setTel(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()}
            placeholder="(00) 00000-0000" className="input flex-1" />
          <button onClick={buscar} className="btn-secondary px-4 flex-shrink-0">
            <Search size={16} />
          </button>
        </div>

        {clienteExistente && (
          <div className="p-3 bg-green-900/20 border border-green-800/40 rounded-xl">
            <p className="text-sm font-medium text-green-400">✓ {clienteExistente.nome}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {(clienteExistente.condominio as any)?.nome} · Q{clienteExistente.quadra} L{clienteExistente.lote}
            </p>
            <button onClick={onClose} className="btn-primary mt-3 w-full py-2 text-sm">
              Usar este cliente
            </button>
          </div>
        )}

        {modo === 'cadastro' && !clienteExistente && (
          <div className="space-y-3 border-t border-gray-800 pt-4">
            <p className="text-sm text-gray-500">Cliente não encontrado. Preencha os dados:</p>
            <FormField label="Nome *">
              <input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} className="input" />
            </FormField>
            <FormField label="Condomínio *">
              <select value={form.condominio_id} onChange={e => setForm(f => ({...f, condominio_id: e.target.value}))} className="input">
                <option value="">Selecione...</option>
                {(condominios as any[]).map(c => (
                  <option key={c.id} value={c.id}>{c.nome} (frete R${Number(c.valor_frete).toFixed(2)})</option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Quadra *">
                <input value={form.quadra} onChange={e => setForm(f => ({...f, quadra: e.target.value}))} className="input" />
              </FormField>
              <FormField label="Lote *">
                <input value={form.lote} onChange={e => setForm(f => ({...f, lote: e.target.value}))} className="input" />
              </FormField>
            </div>
            <FormField label="Rua *">
              <input value={form.rua} onChange={e => setForm(f => ({...f, rua: e.target.value}))} className="input" />
            </FormField>
            <button onClick={() => cadastrar()} disabled={isPending || !form.nome || !form.condominio_id}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
              {isPending ? <Spinner size="sm" /> : 'Cadastrar e selecionar'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// Pizzas filtradas
const pizzasFiltradas = useMemo(() => {
  console.log('Buscando por:', busca)
  console.log('Total de pizzas:', pizzas?.length)
  if (!busca) return pizzas || []
  const termo = busca.toLowerCase().trim()
  const resultado = (pizzas || []).filter(p => 
    p.nome?.toLowerCase().includes(termo)
  )
  console.log('Pizzas encontradas:', resultado.length)
  return resultado
}, [pizzas, busca])

// Bebidas filtradas
const bebidasFiltradas = useMemo(() => {
  if (!busca) return bebidas || []
  const termo = busca.toLowerCase().trim()
  return (bebidas || []).filter(b => 
    b.nome?.toLowerCase().includes(termo)
  )
}, [bebidas, busca])

// Outros filtrados
const outrosFiltrados = useMemo(() => {
  if (!busca) return outros || []
  const termo = busca.toLowerCase().trim()
  return (outros || []).filter(o => 
    o.nome?.toLowerCase().includes(termo)
  )
}, [outros, busca])