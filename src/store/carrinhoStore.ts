import { create } from 'zustand'

export interface ItemCarrinho {
  _id: string // UUID local
  tipo_item: 'pizza' | 'bebida' | 'outro'
  // Pizza inteira
  pizza_id?: number
  pizza_nome?: string
  pizza_preco?: number
  pizza_ingredientes?: { ingrediente_id: number; quantidade: number }[]
  // Meio a meio
  meia_pizza?: boolean
  pizza_metade_1_id?: number
  pizza_metade_1_nome?: string
  pizza_metade_1_ingredientes?: { ingrediente_id: number; quantidade: number }[]
  pizza_metade_2_id?: number
  pizza_metade_2_nome?: string
  pizza_metade_2_ingredientes?: { ingrediente_id: number; quantidade: number }[]
  tres_sabores?: boolean
  pizza_metade_3_id?: number
  pizza_metade_3_nome?: string
  pizza_metade_3_ingredientes?: { ingrediente_id: number; quantidade: number }[]
  // Borda
  borda_id?: number
  borda_nome?: string
  borda_preco?: number
  // Bebida / Outro
  bebida_id?: number
  bebida_nome?: string
  outro_id?: number
  outro_nome?: string
  // Comuns
  quantidade: number
  valor_unitario: number
  observacao?: string
  adicionais: {
    ingrediente_id: number
    nome: string
    quantidade: number
    aplicado_em: 'inteira' | 'metade_1' | 'metade_2'
    valor: number
  }[]
}

interface CarrinhoStore {
  itens: ItemCarrinho[]
  clienteTelefone: string
  tipoPedido: string
  observacaoGeral: string
  formaPagamento: string
  adicionarItem: (item: ItemCarrinho) => void
  removerItem: (id: string) => void
  atualizarQtd: (id: string, qtd: number) => void
  limpar: () => void
  setCliente: (tel: string) => void
  setTipo: (tipo: string) => void
  setObservacao: (obs: string) => void
  setPagamento: (pag: string) => void
  getTotal: () => number
  getSubtotal: () => number
}

export const useCarrinhoStore = create<CarrinhoStore>((set, get) => ({
  itens: [],
  clienteTelefone: '',
  tipoPedido: 'balcao_retirada',
  observacaoGeral: '',
  formaPagamento: 'dinheiro',

  adicionarItem: (item) => set(s => ({ itens: [...s.itens, item] })),
  removerItem: (id) => set(s => ({ itens: s.itens.filter(i => i._id !== id) })),
  atualizarQtd: (id, qtd) => set(s => ({
    itens: qtd <= 0
      ? s.itens.filter(i => i._id !== id)
      : s.itens.map(i => i._id === id ? { ...i, quantidade: qtd } : i)
  })),
  limpar: () => set({ itens: [], clienteTelefone: '', observacaoGeral: '', formaPagamento: 'dinheiro' }),
  setCliente: (tel) => set({ clienteTelefone: tel }),
  setTipo: (tipo) => set({ tipoPedido: tipo }),
  setObservacao: (obs) => set({ observacaoGeral: obs }),
  setPagamento: (pag) => set({ formaPagamento: pag }),

  getSubtotal: () => get().itens.reduce((acc, item) => {
    const totalAdicionais = item.adicionais.reduce((a, ad) => a + ad.valor * ad.quantidade, 0)
    return acc + (item.valor_unitario + totalAdicionais) * item.quantidade
  }, 0),

  getTotal: () => get().getSubtotal() // frete será somado no componente
}))
