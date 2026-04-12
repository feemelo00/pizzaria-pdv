import { supabase } from './supabase'
import type { StatusPedido } from './supabase'

// ============================================================
// CLIENTES
// ============================================================
export const clientesDb = {
  buscar: async (telefone: string) => {
    const { data } = await supabase
      .from('clientes').select('*, condominio:condominios(*)')
      .eq('telefone', telefone).single()
    return data
  },
  listar: async (busca?: string) => {
    let q = supabase.from('clientes').select('*, condominio:condominios(*)').order('nome')
    if (busca) q = q.or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%`)
    const { data } = await q
    return data ?? []
  },
  criar: async (dados: any) => {
    const { data, error } = await supabase.from('clientes').insert(dados).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  atualizar: async (telefone: string, dados: any) => {
    const { data, error } = await supabase.from('clientes')
      .update(dados).eq('telefone', telefone).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  excluir: async (telefone: string) => {
    const { error } = await supabase.from('clientes').delete().eq('telefone', telefone)
    if (error) throw new Error(error.message)
  }
}

// ============================================================
// CONDOMÍNIOS
// ============================================================
export const condominiosDb = {
  listar: async () => {
    const { data } = await supabase.from('condominios').select('*').eq('ativo', true).order('nome')
    return data ?? []
  },
  listarTodos: async () => {
    const { data } = await supabase.from('condominios').select('*').order('nome')
    return data ?? []
  },
  criar: async (dados: any) => {
    const { data, error } = await supabase.from('condominios').insert(dados).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  atualizar: async (id: number, dados: any) => {
    const { data, error } = await supabase.from('condominios').update(dados).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  excluir: async (id: number) => {
    const { error } = await supabase.from('condominios').update({ ativo: false }).eq('id', id)
    if (error) throw new Error(error.message)
  }
}

// ============================================================
// MOTOBOYS
// ============================================================
export const motoboysDb = {
  listar: async () => {
    const { data } = await supabase.from('motoboys').select('*').eq('ativo', true).order('nome')
    return data ?? []
  },
  listarTodos: async () => {
    const { data } = await supabase.from('motoboys').select('*').order('nome')
    return data ?? []
  },
  criar: async (dados: any) => {
    const { data, error } = await supabase.from('motoboys').insert(dados).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  atualizar: async (id: number, dados: any) => {
    const { data, error } = await supabase.from('motoboys').update(dados).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  excluir: async (id: number) => {
    const { error } = await supabase.from('motoboys').update({ ativo: false }).eq('id', id)
    if (error) throw new Error(error.message)
  }
}

// ============================================================
// INGREDIENTES
// ============================================================
export const ingredientesDb = {
  listar: async () => {
    const { data } = await supabase.from('ingredientes').select('*').eq('ativo', true).order('nome')
    return data ?? []
  },
  listarTodos: async () => {
    const { data } = await supabase.from('ingredientes').select('*').order('nome')
    return data ?? []
  },
  listarAdicionais: async () => {
    const { data } = await supabase.from('ingredientes').select('*')
      .eq('ativo', true).eq('permite_adicional', true).order('nome')
    return data ?? []
  },
  listarEstoqueBaixo: async () => {
    const { data } = await supabase.from('ingredientes').select('*')
      .eq('ativo', true).filter('quantidade_estoque', 'lte', 'estoque_minimo')
    // filtro manual porque Supabase não suporta column vs column diretamente
    const todos = data ?? []
    return todos.filter(i => i.quantidade_estoque <= i.estoque_minimo)
  },
  criar: async (dados: any) => {
    const { data, error } = await supabase.from('ingredientes').insert(dados).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  atualizar: async (id: number, dados: any) => {
    const { data, error } = await supabase.from('ingredientes').update(dados).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  excluir: async (id: number) => {
    const { error } = await supabase.from('ingredientes').update({ ativo: false }).eq('id', id)
    if (error) throw new Error(error.message)
  },
  entradaEstoque: async (id: number, quantidade: number, motivo?: string) => {
    const { data: ing } = await supabase.from('ingredientes').select('quantidade_estoque').eq('id', id).single()
    if (!ing) throw new Error('Ingrediente não encontrado')
    const novoEstoque = Number(ing.quantidade_estoque) + quantidade
    await supabase.from('ingredientes').update({ quantidade_estoque: novoEstoque }).eq('id', id)
    await supabase.from('movimentacoes_estoque').insert({
      ingrediente_id: id, tipo: 'entrada', quantidade, motivo: motivo || 'Entrada manual'
    })
  }
}

// ============================================================
// PIZZAS
// ============================================================
export const pizzasDb = {
  listar: async () => {
    const { data } = await supabase.from('pizzas').select(`
      *, pizza_ingredientes(*, ingrediente:ingredientes(*))
    `).eq('ativo', true).order('nome')
    return data ?? []
  },
  listarTodas: async () => {
    const { data } = await supabase.from('pizzas').select(`
      *, pizza_ingredientes(*, ingrediente:ingredientes(*))
    `).order('nome')
    return data ?? []
  },
  listarDisponiveis: async () => {
    const pizzas = await pizzasDb.listar()
    return pizzas.filter(pizza => {
      if (!pizza.pizza_ingredientes?.length) return true
      return pizza.pizza_ingredientes.every((pi: any) =>
        pi.ingrediente && Number(pi.ingrediente.quantidade_estoque) >= Number(pi.quantidade)
      )
    })
  },
  criar: async (dados: any, ingredientes: {ingrediente_id: number, quantidade: number}[]) => {
    const { data: pizza, error } = await supabase.from('pizzas').insert({
      nome: dados.nome, tamanho: dados.tamanho, preco: dados.preco
    }).select().single()
    if (error) throw new Error(error.message)
    if (ingredientes.length) {
      await supabase.from('pizza_ingredientes').insert(
        ingredientes.map(i => ({ pizza_id: pizza.id, ...i }))
      )
    }
    return pizza
  },
  atualizar: async (id: number, dados: any, ingredientes?: {ingrediente_id: number, quantidade: number}[]) => {
    const { error } = await supabase.from('pizzas').update(dados).eq('id', id)
    if (error) throw new Error(error.message)
    if (ingredientes) {
      await supabase.from('pizza_ingredientes').delete().eq('pizza_id', id)
      if (ingredientes.length) {
        await supabase.from('pizza_ingredientes').insert(
          ingredientes.map(i => ({ pizza_id: id, ...i }))
        )
      }
    }
  },
  excluir: async (id: number) => {
    await supabase.from('pizzas').update({ ativo: false }).eq('id', id)
  }
}

// ============================================================
// BEBIDAS / OUTROS / BORDAS
// ============================================================
export const bebidasDb = {
  listar: async () => {
    const { data } = await supabase.from('bebidas').select('*').eq('ativo', true).order('nome')
    return data ?? []
  },
  listarDisponiveis: async () => {
    const { data } = await supabase.from('bebidas').select('*')
      .eq('ativo', true).gt('quantidade_estoque', 0).order('nome')
    return data ?? []
  },
  criar: async (dados: any) => {
    const { data, error } = await supabase.from('bebidas').insert(dados).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  atualizar: async (id: number, dados: any) => {
    const { error } = await supabase.from('bebidas').update(dados).eq('id', id)
    if (error) throw new Error(error.message)
  },
  excluir: async (id: number) => {
    await supabase.from('bebidas').update({ ativo: false }).eq('id', id)
  }
}

export const outrosDb = {
  listar: async () => {
    const { data } = await supabase.from('outros_produtos').select('*').eq('ativo', true).order('nome')
    return data ?? []
  },
  listarDisponiveis: async () => {
    const { data } = await supabase.from('outros_produtos').select('*')
      .eq('ativo', true).gt('quantidade_estoque', 0).order('nome')
    return data ?? []
  },
  criar: async (dados: any) => {
    const { data, error } = await supabase.from('outros_produtos').insert(dados).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  atualizar: async (id: number, dados: any) => {
    const { error } = await supabase.from('outros_produtos').update(dados).eq('id', id)
    if (error) throw new Error(error.message)
  },
  excluir: async (id: number) => {
    await supabase.from('outros_produtos').update({ ativo: false }).eq('id', id)
  }
}

export const bordasDb = {
  listar: async () => {
    const { data } = await supabase.from('bordas').select('*').eq('ativo', true).order('nome')
    return data ?? []
  },
  criar: async (dados: any) => {
    const { data, error } = await supabase.from('bordas').insert(dados).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  atualizar: async (id: number, dados: any) => {
    const { error } = await supabase.from('bordas').update(dados).eq('id', id)
    if (error) throw new Error(error.message)
  },
  excluir: async (id: number) => {
    await supabase.from('bordas').update({ ativo: false }).eq('id', id)
  }
}

// ============================================================
// PEDIDOS (lógica central)
// ============================================================
export const pedidosDb = {
  listarAtivos: async () => {
    const { data, error } = await supabase.from('pedidos')
      .select(`
        *,
        mesa:mesas(id, nome, status),
        cliente:clientes(nome, telefone, quadra, lote, rua, condominio:condominios(nome, valor_frete)),
        condominio:condominios!pedidos_condominio_id_fkey(nome, valor_frete, tempo_entrega_min),
        motoboy:motoboys(nome),
        itens_pedido(
          *,
          pizza:pizzas!itens_pedido_pizza_id_fkey(id, nome, preco),
          pizza_metade_1:pizzas!itens_pedido_pizza_metade_1_id_fkey(id, nome, preco),
          pizza_metade_2:pizzas!itens_pedido_pizza_metade_2_id_fkey(id, nome, preco),
          pizza_metade_3:pizzas!itens_pedido_pizza_metade_3_id_fkey(id, nome, preco),
          bebida:bebidas(id, nome),
          outro:outros_produtos(id, nome),
          borda:bordas(id, nome, preco),
          adicionais_item(*, ingrediente:ingredientes(id, nome, preco_adicional))
        )
      `)
      .in('status', ['solicitado','fazendo','pronto','delivery','balcao'])
      .order('data_criacao', { ascending: true })
    if (error) console.error('listarAtivos erro:', error)
    return data ?? []
  },
  listar: async (filtros?: { data?: string; status?: string; clienteTelefone?: string }) => {
    let q = supabase.from('pedidos')
      .select(`*, cliente:clientes(nome, telefone), motoboy:motoboys(nome)`)
      .order('data_criacao', { ascending: false })
    if (filtros?.status) q = q.eq('status', filtros.status)
    if (filtros?.clienteTelefone) q = q.eq('cliente_telefone', filtros.clienteTelefone)
    if (filtros?.data) q = q.gte('data_criacao', `${filtros.data}T00:00:00`).lte('data_criacao', `${filtros.data}T23:59:59`)
    const { data } = await q.limit(200)
    return data ?? []
  },
  buscarPorId: async (id: number) => {
    const { data } = await supabase.from('pedidos')
      .select(`*, cliente:clientes(*, condominio:condominios(*)), condominio:condominios!pedidos_condominio_id_fkey(*),
               motoboy:motoboys(*), itens_pedido(*, pizza:pizzas(*),
               pizza_metade_1:pizzas!pizza_metade_1_id(*), pizza_metade_2:pizzas!pizza_metade_2_id(*),
               bebida:bebidas(*), outro:outros_produtos(*), borda:bordas(*),
               adicionais_item(*, ingrediente:ingredientes(*))),
               pagamentos(*), entregas(*, motoboy:motoboys(*))`)
      .eq('id', id).single()
    return data
  },
  criar: async (pedidoData: any, itens: any[]) => {
    // Cria pedido
    const { data: pedido, error } = await supabase
      .from('pedidos').insert(pedidoData).select().single()
    if (error) throw new Error(error.message)

    // Cria itens
    for (const item of itens) {
      // Remove campos que não existem na tabela (usados só para baixa de estoque)
      const {
        adicionais,
        pizza_ingredientes,
        pizza_metade_1_ingredientes,
        pizza_metade_2_ingredientes,
        pizza_metade_3_ingredientes,
        ...itemData
      } = item
      const { data: itemSalvo, error: errItem } = await supabase
        .from('itens_pedido').insert({ ...itemData, pedido_id: pedido.id }).select().single()
      if (errItem) throw new Error(errItem.message)

      // Cria adicionais
      if (adicionais?.length) {
        await supabase.from('adicionais_item').insert(
          adicionais.map((a: any) => ({ ...a, item_pedido_id: itemSalvo.id }))
        )
      }
    }

    // Baixa de estoque
    await pedidosDb.darBaixaEstoque(pedido.id, itens)

    // Cria entrega se delivery
    if (pedidoData.tipo?.includes('delivery')) {
      await supabase.from('entregas').insert({ pedido_id: pedido.id, status: 'aguardando' })
    }

    return pedido
  },
  darBaixaEstoque: async (pedidoId: number, itens: any[]) => {
    const mapaEstoque: Record<number, number> = {}

    for (const item of itens) {
      const qtd = item.quantidade || 1
      // Pizza ingredientes
      if (item.tipo_item === 'pizza') {
        if (!item.meia_pizza && item.pizza_ingredientes) {
          item.pizza_ingredientes.forEach((pi: any) => {
            mapaEstoque[pi.ingrediente_id] = (mapaEstoque[pi.ingrediente_id] || 0) + pi.quantidade * qtd
          })
        } else if (item.meia_pizza) {
          item.pizza_metade_1_ingredientes?.forEach((pi: any) => {
            mapaEstoque[pi.ingrediente_id] = (mapaEstoque[pi.ingrediente_id] || 0) + (pi.quantidade / 2) * qtd
          })
          item.pizza_metade_2_ingredientes?.forEach((pi: any) => {
            mapaEstoque[pi.ingrediente_id] = (mapaEstoque[pi.ingrediente_id] || 0) + (pi.quantidade / 2) * qtd
          })
        }
      }
      // Bebidas e outros (por unidade)
      if (item.tipo_item === 'bebida' && item.bebida_id) {
        const { data: beb } = await supabase.from('bebidas').select('quantidade_estoque').eq('id', item.bebida_id).single()
        if (beb) await supabase.from('bebidas').update({ quantidade_estoque: Math.max(0, beb.quantidade_estoque - qtd) }).eq('id', item.bebida_id)
      }
      if (item.tipo_item === 'outro' && item.outro_id) {
        const { data: out } = await supabase.from('outros_produtos').select('quantidade_estoque').eq('id', item.outro_id).single()
        if (out) await supabase.from('outros_produtos').update({ quantidade_estoque: Math.max(0, out.quantidade_estoque - qtd) }).eq('id', item.outro_id)
      }
      // Adicionais
      item.adicionais?.forEach((a: any) => {
        const qAdicional = a.aplicado_em !== 'inteira' ? a.quantidade / 2 : a.quantidade
        mapaEstoque[a.ingrediente_id] = (mapaEstoque[a.ingrediente_id] || 0) + qAdicional * qtd
      })
    }

    // Aplicar baixa de ingredientes
    for (const [ingId, qtdBaixa] of Object.entries(mapaEstoque)) {
      const { data: ing } = await supabase.from('ingredientes').select('quantidade_estoque').eq('id', ingId).single()
      if (!ing) continue
      const novoEstoque = Math.max(0, Number(ing.quantidade_estoque) - qtdBaixa)
      await supabase.from('ingredientes').update({ quantidade_estoque: novoEstoque }).eq('id', ingId)
      await supabase.from('movimentacoes_estoque').insert({
        ingrediente_id: Number(ingId), tipo: 'saida_pedido',
        quantidade: qtdBaixa, motivo: `Pedido #${pedidoId}`, pedido_id: pedidoId
      })
    }
  },
  atualizarStatus: async (id: number, status: StatusPedido, extras?: any) => {
    const update: any = { status, ...extras }
    if (status === 'finalizado') update.data_finalizacao = new Date().toISOString()
    const { error } = await supabase.from('pedidos').update(update).eq('id', id)
    if (error) throw new Error(error.message)
  },
  atualizar: async (id: number, dados: any) => {
    const { error } = await supabase.from('pedidos').update(dados).eq('id', id)
    if (error) throw new Error(error.message)
  }
}

// ============================================================
// FINANCEIRO / KPIs
// ============================================================
export const financeiroDb = {
  kpisDia: async (data: string) => {
    const inicio = `${data}T00:00:00`
    const fim = `${data}T23:59:59`
    const { data: pedidos } = await supabase.from('pedidos')
      .select('status, valor_total, tipo, motoboy_id, condominio_id, motoboy:motoboys(nome), condominio:condominios(nome)')
      .gte('data_criacao', inicio).lte('data_criacao', fim)

    const todos = pedidos ?? []
    const finalizados = todos.filter(p => p.status === 'finalizado')
    const devolvidos = todos.filter(p => p.status === 'devolvido')

    const faturamento = finalizados.reduce((a, p) => a + Number(p.valor_total), 0)
    const prejuizo = devolvidos.reduce((a, p) => a + Number(p.valor_total), 0)
    const totalDelivery = todos.filter(p => p.tipo?.includes('delivery') && p.status !== 'devolvido').length

    // Entregas por motoboy
    const porMotoboy: Record<string, { nome: string; qtd: number; condominios: Record<string, number> }> = {}
    finalizados.filter(p => p.tipo?.includes('delivery') && p.motoboy_id).forEach(p => {
      const key = String(p.motoboy_id)
      if (!porMotoboy[key]) porMotoboy[key] = { nome: (p.motoboy as any)?.nome || '?', qtd: 0, condominios: {} }
      porMotoboy[key].qtd++
      const cond = (p.condominio as any)?.nome || 'Outro'
      porMotoboy[key].condominios[cond] = (porMotoboy[key].condominios[cond] || 0) + 1
    })

    return {
      totalPedidos: todos.filter(p => p.status !== 'devolvido').length,
      faturamento,
      prejuizo,
      totalDelivery,
      totalBalcao: todos.filter(p => !p.tipo?.includes('delivery') && p.status !== 'devolvido').length,
      devolvidos: devolvidos.length,
      ticketMedio: finalizados.length ? faturamento / finalizados.length : 0,
      porMotoboy: Object.values(porMotoboy)
    }
  },
  kpisMes: async (ano: number, mes: number) => {
    const inicio = `${ano}-${String(mes).padStart(2,'0')}-01T00:00:00`
    const fim = new Date(ano, mes, 0)
    const fimStr = `${ano}-${String(mes).padStart(2,'0')}-${String(fim.getDate()).padStart(2,'0')}T23:59:59`
    const { data: pedidos } = await supabase.from('pedidos')
      .select('status, valor_total, data_criacao').gte('data_criacao', inicio).lte('data_criacao', fimStr)
    const todos = pedidos ?? []
    return {
      faturamento: todos.filter(p => p.status === 'finalizado').reduce((a, p) => a + Number(p.valor_total), 0),
      prejuizo: todos.filter(p => p.status === 'devolvido').reduce((a, p) => a + Number(p.valor_total), 0),
      totalPedidos: todos.filter(p => p.status !== 'devolvido').length
    }
  }
}

// ============================================================
// MESAS
// ============================================================
export const mesasDb = {
  listar: async () => {
    const { data } = await supabase.from('mesas').select('*').order('nome')
    return data ?? []
  },
  criar: async (dados: any) => {
    const { data, error } = await supabase.from('mesas').insert(dados).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  atualizar: async (id: number, dados: any) => {
    const { error } = await supabase.from('mesas').update(dados).eq('id', id)
    if (error) throw new Error(error.message)
  },
  excluir: async (id: number) => {
    const { error } = await supabase.from('mesas').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
  ocupar: async (id: number) => {
    await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', id)
  },
  liberar: async (id: number) => {
    await supabase.from('mesas').update({ status: 'livre' }).eq('id', id)
  },
  buscarComanda: async (mesaId: number) => {
    const { data, error } = await supabase.from('pedidos')
      .select(`
        *,
        itens_pedido(
          *,
          pizza:pizzas!itens_pedido_pizza_id_fkey(id, nome, preco),
          pizza_metade_1:pizzas!itens_pedido_pizza_metade_1_id_fkey(id, nome, preco),
          pizza_metade_2:pizzas!itens_pedido_pizza_metade_2_id_fkey(id, nome, preco),
          pizza_metade_3:pizzas!itens_pedido_pizza_metade_3_id_fkey(id, nome, preco),
          bebida:bebidas(id, nome),
          outro:outros_produtos(id, nome),
          borda:bordas(id, nome, preco),
          adicionais_item(*, ingrediente:ingredientes(id, nome))
        ),
        pagamentos(*)
      `)
      .eq('mesa_id', mesaId)
      .not('status', 'in', `(devolvido,finalizado)`)
      .order('data_criacao', { ascending: true })
    if (error) console.error('Erro buscarComanda:', error)
    return data ?? []
  }
}

// ============================================================
// CONFIGURAÇÕES DO SISTEMA
// ============================================================
export const configuracoesDb = {
  get: async (chave: string) => {
    const { data } = await supabase.from('configuracoes').select('valor').eq('chave', chave).single()
    return data?.valor ?? null
  },
  set: async (chave: string, valor: string) => {
    const { error } = await supabase.from('configuracoes')
      .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: 'chave' })
    if (error) throw new Error(error.message)
  },
  listar: async () => {
    const { data } = await supabase.from('configuracoes').select('*').order('chave')
    return data ?? []
  },
  calcularTempoEstimado: async (pizzasNaFila: number, condominioId?: number | null) => {
    const [capStr, tempoStr] = await Promise.all([
      configuracoesDb.get('capacidade_pizzas'),
      configuracoesDb.get('tempo_por_lote_min')
    ])
    const capacidade = Number(capStr || 4)
    const tempoPorLote = Number(tempoStr || 25)
    const lotes = Math.ceil(pizzasNaFila / capacidade)
    const tempoPreparo = lotes * tempoPorLote

    let tempoEntrega = 30
    if (condominioId) {
      const { data: cond } = await supabase.from('condominios')
        .select('tempo_entrega_min').eq('id', condominioId).single()
      if (cond?.tempo_entrega_min) tempoEntrega = cond.tempo_entrega_min
    }

    return {
      tempoPreparo,
      tempoEntrega,
      total: tempoPreparo + tempoEntrega,
      lotes,
      capacidade,
      tempoPorLote
    }
  }
}

// ============================================================
// TEMPO ESTIMADO DE ENTREGA
// ============================================================
export const tempoEstimadoDb = {
  calcular: async (condominioId?: number | null): Promise<{ preparo: number; entrega: number; total: number; pizzasNaFila: number }> => {
    const config = await configuracoesDb.buscar()

    const { data: pedidosAtivos } = await supabase.from('pedidos')
      .select('itens_pedido(tipo_item, quantidade)')
      .in('status', ['solicitado', 'fazendo'])

    let pizzasNaFila = 0
    ;(pedidosAtivos ?? []).forEach((p: any) => {
      ;(p.itens_pedido ?? []).forEach((item: any) => {
        if (item.tipo_item === 'pizza') pizzasNaFila += item.quantidade
      })
    })

    const lotes = Math.ceil(Math.max(pizzasNaFila, 1) / config.pizzas_simultaneas)
    const tempoPreparo = lotes * config.tempo_preparo_min

    let tempoEntrega = 30
    if (condominioId) {
      const { data: cond } = await supabase.from('condominios')
        .select('tempo_entrega_min').eq('id', condominioId).single()
      if (cond?.tempo_entrega_min) tempoEntrega = cond.tempo_entrega_min
    }

    return { preparo: tempoPreparo, entrega: tempoEntrega, total: tempoPreparo + tempoEntrega, pizzasNaFila }
  }
}