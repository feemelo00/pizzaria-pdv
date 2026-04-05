import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam variáveis de ambiente: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } }
})

export type Database = {
  public: {
    Tables: {
      condominios:    { Row: Condominio;    Insert: Omit<Condominio, 'id'|'created_at'> }
      clientes:       { Row: Cliente;       Insert: Omit<Cliente, 'data_criacao'|'updated_at'> }
      motoboys:       { Row: Motoboy;       Insert: Omit<Motoboy, 'id'|'created_at'> }
      ingredientes:   { Row: Ingrediente;   Insert: Omit<Ingrediente, 'id'|'created_at'|'updated_at'> }
      pizzas:         { Row: Pizza;         Insert: Omit<Pizza, 'id'|'created_at'|'updated_at'> }
      pizza_ingredientes: { Row: PizzaIngrediente; Insert: Omit<PizzaIngrediente, 'id'> }
      bebidas:        { Row: Bebida;        Insert: Omit<Bebida, 'id'|'created_at'|'updated_at'> }
      outros_produtos:{ Row: OutroProduto;  Insert: Omit<OutroProduto, 'id'|'created_at'|'updated_at'> }
      bordas:         { Row: Borda;         Insert: Omit<Borda, 'id'|'created_at'> }
      pedidos:        { Row: Pedido;        Insert: Omit<Pedido, 'id'|'data_criacao'|'updated_at'> }
      itens_pedido:   { Row: ItemPedido;    Insert: Omit<ItemPedido, 'id'|'created_at'> }
      adicionais_item:{ Row: AdicionalItem; Insert: Omit<AdicionalItem, 'id'> }
      entregas:       { Row: Entrega;       Insert: Omit<Entrega, 'id'|'created_at'> }
      pagamentos:     { Row: Pagamento;     Insert: Omit<Pagamento, 'id'|'created_at'> }
      usuarios:       { Row: Usuario;       Insert: Omit<Usuario, 'created_at'> }
    }
  }
}

// Tipos das entidades
export type Condominio = {
  id: number; nome: string; valor_frete: number; ativo: boolean; created_at: string
}
export type Cliente = {
  telefone: string; nome: string; condominio_id: number; quadra: string
  lote: string; rua: string; data_criacao: string; updated_at: string
  condominio?: Condominio
}
export type Motoboy = {
  id: number; nome: string; telefone: string | null; ativo: boolean; created_at: string
}
export type Ingrediente = {
  id: number; nome: string; quantidade_estoque: number; unidade: string
  permite_adicional: boolean; quantidade_adicional: number | null
  preco_adicional: number; estoque_minimo: number; ativo: boolean
  created_at: string; updated_at: string
}
export type Pizza = {
  id: number; nome: string; tamanho: string; preco: number; ativo: boolean
  created_at: string; updated_at: string
  pizza_ingredientes?: PizzaIngrediente[]
}
export type PizzaIngrediente = {
  id: number; pizza_id: number; ingrediente_id: number; quantidade: number
  ingrediente?: Ingrediente
}
export type Bebida = {
  id: number; nome: string; tamanho: string | null; preco: number
  quantidade_estoque: number; ativo: boolean; created_at: string; updated_at: string
}
export type OutroProduto = {
  id: number; nome: string; tamanho: string | null; preco: number
  quantidade_estoque: number; ativo: boolean; created_at: string; updated_at: string
}
export type Borda = {
  id: number; nome: string; preco: number; ativo: boolean; created_at: string
}
export type StatusPedido = 'solicitado'|'fazendo'|'pronto'|'delivery'|'balcao'|'finalizado'|'devolvido'
export type TipoPedido = 'balcao_retirada'|'balcao_delivery'|'online_retirada'|'online_delivery'
export type Pedido = {
  id: number; cliente_telefone: string | null; tipo: TipoPedido; status: StatusPedido
  condominio_id: number | null; valor_frete: number; valor_total: number
  forma_pagamento: string | null; motoboy_id: number | null; observacao: string | null
  origem: string; data_criacao: string; data_finalizacao: string | null; updated_at: string
  cliente?: Cliente; condominio?: Condominio; motoboy?: Motoboy
  itens_pedido?: ItemPedidoCompleto[]
}
export type ItemPedido = {
  id: number; pedido_id: number; tipo_item: string; pizza_id: number | null
  bebida_id: number | null; outro_id: number | null; quantidade: number
  meia_pizza: boolean; pizza_metade_1_id: number | null; pizza_metade_2_id: number | null
  borda_id: number | null; observacao: string | null; valor_unitario: number; created_at: string
}
export type ItemPedidoCompleto = ItemPedido & {
  pizza?: Pizza; pizza_metade_1?: Pizza; pizza_metade_2?: Pizza
  bebida?: Bebida; outro?: OutroProduto; borda?: Borda
  adicionais_item?: (AdicionalItem & { ingrediente?: Ingrediente })[]
}
export type AdicionalItem = {
  id: number; item_pedido_id: number; ingrediente_id: number
  quantidade: number; aplicado_em: string; valor: number
}
export type Entrega = {
  id: number; pedido_id: number; motoboy_id: number | null; status: string
  data_saida: string | null; data_entrega: string | null; created_at: string
  motoboy?: Motoboy
}
export type Pagamento = {
  id: number; pedido_id: number; metodo: string; valor: number; confirmado: boolean; created_at: string
}
export type Usuario = {
  id: string; nome: string; email: string; role: 'funcionario'|'proprietario'
  ativo: boolean; created_at: string
}
