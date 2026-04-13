import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ── Helpers ──────────────────────────────────────────────────
function ok(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ erro: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
async function json(req: Request) {
  try { return await req.json() } catch { return {} }
}

// ── Estoque: dar baixa ────────────────────────────────────────
async function darBaixaEstoque(itens: any[]) {
  for (const item of itens) {
    const qtd = item.quantidade || 1

    if (item.tipo_item === 'pizza') {
      const ingredientes = [
        ...(item.pizza_ingredientes || []),
        ...(item.pizza_metade_1_ingredientes || []).map((pi: any) => ({ ...pi, quantidade: pi.quantidade / 2 })),
        ...(item.pizza_metade_2_ingredientes || []).map((pi: any) => ({ ...pi, quantidade: pi.quantidade / 2 })),
        ...(item.pizza_metade_3_ingredientes || []).map((pi: any) => ({ ...pi, quantidade: pi.quantidade / 3 })),
      ]
      const mapa: Record<number, number> = {}
      ingredientes.forEach((pi: any) => {
        mapa[pi.ingrediente_id] = (mapa[pi.ingrediente_id] || 0) + pi.quantidade * qtd
      })
      for (const [ingId, qtdBaixa] of Object.entries(mapa)) {
        const { data } = await supabase.from('ingredientes').select('quantidade_estoque').eq('id', ingId).single()
        if (data) await supabase.from('ingredientes').update({ quantidade_estoque: Math.max(0, Number(data.quantidade_estoque) - qtdBaixa) }).eq('id', ingId)
      }
    }

    if (item.tipo_item === 'bebida' && item.bebida_id) {
      const { data } = await supabase.from('bebidas').select('quantidade_estoque').eq('id', item.bebida_id).single()
      if (data) await supabase.from('bebidas').update({ quantidade_estoque: Math.max(0, Number(data.quantidade_estoque) - qtd) }).eq('id', item.bebida_id)
    }

    if (item.tipo_item === 'outro' && item.outro_id) {
      const { data } = await supabase.from('outros_produtos').select('quantidade_estoque').eq('id', item.outro_id).single()
      if (data) await supabase.from('outros_produtos').update({ quantidade_estoque: Math.max(0, Number(data.quantidade_estoque) - qtd) }).eq('id', item.outro_id)
    }

    // Adicionais
    for (const adicional of (item.adicionais || [])) {
      const { data } = await supabase.from('ingredientes').select('quantidade_estoque').eq('id', adicional.ingrediente_id).single()
      if (data) await supabase.from('ingredientes').update({ quantidade_estoque: Math.max(0, Number(data.quantidade_estoque) - adicional.quantidade * qtd) }).eq('id', adicional.ingrediente_id)
    }
  }
}

async function devolverEstoque(pedidoId: number) {
  const { data: itens } = await supabase.from('itens_pedido')
    .select('*, pizza:pizzas!itens_pedido_pizza_id_fkey(pizza_ingredientes(ingrediente_id, quantidade)), pizza_metade_1:pizzas!itens_pedido_pizza_metade_1_id_fkey(pizza_ingredientes(ingrediente_id, quantidade)), pizza_metade_2:pizzas!itens_pedido_pizza_metade_2_id_fkey(pizza_ingredientes(ingrediente_id, quantidade))')
    .eq('pedido_id', pedidoId)

  for (const item of (itens || [])) {
    const qtd = item.quantidade || 1
    if (item.tipo_item === 'bebida' && item.bebida_id) {
      const { data } = await supabase.from('bebidas').select('quantidade_estoque').eq('id', item.bebida_id).single()
      if (data) await supabase.from('bebidas').update({ quantidade_estoque: Number(data.quantidade_estoque) + qtd }).eq('id', item.bebida_id)
    }
    if (item.tipo_item === 'outro' && item.outro_id) {
      const { data } = await supabase.from('outros_produtos').select('quantidade_estoque').eq('id', item.outro_id).single()
      if (data) await supabase.from('outros_produtos').update({ quantidade_estoque: Number(data.quantidade_estoque) + qtd }).eq('id', item.outro_id)
    }
  }
}

// ── Router ────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const path = url.pathname.replace('/pdv-api', '')
  const parts = path.split('/').filter(Boolean)

  try {

    // ═══════════════════════════════════════════════
    // GET /cardapio — cardápio completo disponível
    // ═══════════════════════════════════════════════
    if (req.method === 'GET' && parts[0] === 'cardapio') {
      const { data: pizzas } = await supabase.from('pizzas')
        .select('id, nome, tamanho, preco, pizza_ingredientes(ingrediente_id, quantidade, ingrediente:ingredientes(nome, quantidade_estoque, estoque_minimo))')
        .eq('ativo', true)

      // Filtrar pizzas com estoque suficiente
      const pizzasDisponiveis = (pizzas || []).filter(pizza =>
        pizza.pizza_ingredientes.every((pi: any) =>
          Number(pi.ingrediente?.quantidade_estoque) > Number(pi.ingrediente?.estoque_minimo || 0)
        )
      )

      const { data: bebidas } = await supabase.from('bebidas').select('id, nome, tamanho, preco, quantidade_estoque').gt('quantidade_estoque', 0)
      const { data: outros } = await supabase.from('outros_produtos').select('id, nome, tamanho, preco, quantidade_estoque').gt('quantidade_estoque', 0)
      const { data: bordas } = await supabase.from('bordas').select('id, nome, preco')
      const { data: adicionais } = await supabase.from('ingredientes').select('id, nome, preco_adicional, unidade, quantidade_adicional').eq('permite_adicional', true).gt('quantidade_estoque', 0)

      return ok({
        pizzas: pizzasDisponiveis.map((p: any) => ({ id: p.id, nome: p.nome, tamanho: p.tamanho, preco: p.preco })),
        bebidas: (bebidas || []).map((b: any) => ({ id: b.id, nome: b.nome, tamanho: b.tamanho, preco: b.preco })),
        outros: (outros || []).map((o: any) => ({ id: o.id, nome: o.nome, tamanho: o.tamanho, preco: o.preco })),
        bordas: (bordas || []).map((b: any) => ({ id: b.id, nome: b.nome, preco: b.preco })),
        adicionais: (adicionais || []).map((a: any) => ({ id: a.id, nome: a.nome, preco: a.preco_adicional, unidade: a.unidade })),
      })
    }

    // ═══════════════════════════════════════════════
    // GET /cliente/:telefone
    // ═══════════════════════════════════════════════
    if (req.method === 'GET' && parts[0] === 'cliente' && parts[1]) {
      const telefone = parts[1].replace(/\D/g, '')
      const { data } = await supabase.from('clientes')
        .select('*, condominio:condominios(id, nome, valor_frete, tempo_entrega_min)')
        .eq('telefone', telefone).single()
      if (!data) return err('Cliente não encontrado', 404)
      return ok(data)
    }

    // ═══════════════════════════════════════════════
    // POST /cliente — cadastrar novo cliente
    // ═══════════════════════════════════════════════
    if (req.method === 'POST' && parts[0] === 'cliente') {
      const body = await json(req)
      const { telefone, nome, condominio_id, quadra, lote, rua } = body
      if (!telefone || !nome) return err('telefone e nome são obrigatórios')

      const { data, error } = await supabase.from('clientes')
        .insert({ telefone: telefone.replace(/\D/g, ''), nome, condominio_id, quadra, lote, rua })
        .select('*, condominio:condominios(id, nome, valor_frete, tempo_entrega_min)')
        .single()
      if (error) return err(error.message)
      return ok(data, 201)
    }

    // ═══════════════════════════════════════════════
    // PUT /cliente/:telefone/endereco
    // ═══════════════════════════════════════════════
    if (req.method === 'PUT' && parts[0] === 'cliente' && parts[2] === 'endereco') {
      const telefone = parts[1].replace(/\D/g, '')
      const body = await json(req)
      const { condominio_id, quadra, lote, rua } = body
      const { error } = await supabase.from('clientes')
        .update({ condominio_id, quadra, lote, rua }).eq('telefone', telefone)
      if (error) return err(error.message)
      const { data } = await supabase.from('clientes')
        .select('*, condominio:condominios(id, nome, valor_frete, tempo_entrega_min)')
        .eq('telefone', telefone).single()
      return ok(data)
    }

    // ═══════════════════════════════════════════════
    // GET /condominios — listar condomínios para entrega
    // ═══════════════════════════════════════════════
    if (req.method === 'GET' && parts[0] === 'condominios') {
      const { data } = await supabase.from('condominios').select('id, nome, valor_frete, tempo_entrega_min').eq('ativo', true).order('nome')
      return ok(data || [])
    }

    // ═══════════════════════════════════════════════
    // POST /pedido — criar pedido (vindo do WhatsApp)
    // ═══════════════════════════════════════════════
    if (req.method === 'POST' && parts[0] === 'pedido') {
      const body = await json(req)
      const { cliente_telefone, itens, forma_pagamento, observacao, condominio_id, valor_frete, endereco_temp } = body

      if (!itens?.length) return err('Itens são obrigatórios')

      // Calcular valor total
      let valorTotal = 0
      for (const item of itens) {
        valorTotal += Number(item.valor_unitario) * item.quantidade
        for (const ad of (item.adicionais || [])) valorTotal += Number(ad.valor) * ad.quantidade
      }
      valorTotal += Number(valor_frete || 0)

      // Criar pedido
      const { data: pedido, error: errPedido } = await supabase.from('pedidos').insert({
        cliente_telefone: cliente_telefone?.replace(/\D/g, '') || null,
        tipo: 'delivery',
        status: 'solicitado',
        condominio_id: endereco_temp?.condominio_id || condominio_id || null,
        valor_frete: Number(valor_frete || 0),
        valor_total: valorTotal,
        forma_pagamento,
        observacao: observacao || null,
        origem: 'whatsapp',
        endereco_temp_condominio_id: endereco_temp?.condominio_id || null,
        endereco_temp_quadra: endereco_temp?.quadra || null,
        endereco_temp_lote: endereco_temp?.lote || null,
        endereco_temp_rua: endereco_temp?.rua || null,
      }).select().single()

      if (errPedido) return err(errPedido.message)

      // Criar itens
      for (const item of itens) {
        const { pizza_ingredientes, pizza_metade_1_ingredientes, pizza_metade_2_ingredientes, pizza_metade_3_ingredientes, adicionais, ...itemData } = item
        const { data: itemSalvo, error: errItem } = await supabase.from('itens_pedido')
          .insert({ ...itemData, pedido_id: pedido.id }).select().single()
        if (errItem) return err(errItem.message)

        if (adicionais?.length) {
          await supabase.from('adicionais_item').insert(
            adicionais.map((a: any) => ({ ...a, item_pedido_id: itemSalvo.id }))
          )
        }
      }

      // Baixa de estoque
      await darBaixaEstoque(itens)

      // Registrar entrega
      await supabase.from('entregas').insert({ pedido_id: pedido.id, status: 'aguardando' })

      // Atualizar conversa
      await supabase.from('conversas_whatsapp').upsert({
        telefone: cliente_telefone?.replace(/\D/g, ''),
        pedido_em_aberto_id: pedido.id,
        ultima_mensagem_em: new Date().toISOString()
      }, { onConflict: 'telefone' })

      return ok({ pedido_id: pedido.id, valor_total: valorTotal, status: 'solicitado' }, 201)
    }

    // ═══════════════════════════════════════════════
    // GET /pedido/:id — status do pedido
    // ═══════════════════════════════════════════════
    if (req.method === 'GET' && parts[0] === 'pedido' && parts[1]) {
      const { data } = await supabase.from('pedidos')
        .select('id, status, valor_total, forma_pagamento, data_criacao, motoboy:motoboys(nome), itens_pedido(quantidade, tipo_item, pizza:pizzas!itens_pedido_pizza_id_fkey(nome), bebida:bebidas(nome), outro:outros_produtos(nome))')
        .eq('id', parts[1]).single()
      if (!data) return err('Pedido não encontrado', 404)

      const statusMensagem: Record<string, string> = {
        solicitado: '🕐 Seu pedido foi recebido e está na fila!',
        fazendo: '👨‍🍳 Seu pedido está sendo preparado!',
        pronto: '✅ Seu pedido está pronto!',
        delivery: `🛵 Seu pedido saiu para entrega${(data as any).motoboy ? ` com ${(data as any).motoboy.nome}` : ''}!`,
        balcao: '🏪 Seu pedido está no balcão para retirada!',
        finalizado: '🎉 Pedido finalizado! Obrigado pela preferência!',
        devolvido: '❌ Pedido devolvido.',
      }

      return ok({
        ...(data as any),
        status_mensagem: statusMensagem[(data as any).status] || (data as any).status
      })
    }

    // ═══════════════════════════════════════════════
    // DELETE /pedido/:id — cancelar pedido e devolver estoque
    // ═══════════════════════════════════════════════
    if (req.method === 'DELETE' && parts[0] === 'pedido' && parts[1]) {
      const { data: pedido } = await supabase.from('pedidos').select('status').eq('id', parts[1]).single()
      if (!pedido) return err('Pedido não encontrado', 404)
      if (!['solicitado'].includes((pedido as any).status)) return err('Só é possível cancelar pedidos ainda em "solicitado"')

      await devolverEstoque(Number(parts[1]))
      await supabase.from('pedidos').update({ status: 'devolvido' }).eq('id', parts[1])

      return ok({ cancelado: true, pedido_id: parts[1] })
    }

    // ═══════════════════════════════════════════════
    // GET /conversa/:telefone — dados da conversa
    // ═══════════════════════════════════════════════
    if (req.method === 'GET' && parts[0] === 'conversa' && parts[1]) {
      const telefone = parts[1].replace(/\D/g, '')
      const { data } = await supabase.from('conversas_whatsapp').select('*').eq('telefone', telefone).single()

      if (!data) {
        // Criar conversa nova
        const { data: nova } = await supabase.from('conversas_whatsapp')
          .insert({ telefone, ultima_mensagem_em: new Date().toISOString() })
          .select().single()
        return ok({ ...nova, modo_humano_ativo: false })
      }

      // Verificar se modo humano expirou
      const modoHumanoAtivo = (data as any).modo_humano &&
        new Date((data as any).modo_humano_ate) > new Date()

      if ((data as any).modo_humano && !modoHumanoAtivo) {
        // Expirou — desativar
        await supabase.from('conversas_whatsapp')
          .update({ modo_humano: false, modo_humano_ate: null }).eq('telefone', telefone)
      }

      return ok({ ...(data as any), modo_humano_ativo: modoHumanoAtivo })
    }

    // ═══════════════════════════════════════════════
    // POST /conversa/modo-humano — ativar modo humano
    // ═══════════════════════════════════════════════
    if (req.method === 'POST' && parts[0] === 'conversa' && parts[1] === 'modo-humano') {
      const body = await json(req)
      const { telefone, minutos = 10 } = body
      if (!telefone) return err('telefone é obrigatório')

      const expiracao = new Date(Date.now() + minutos * 60 * 1000).toISOString()

      await supabase.from('conversas_whatsapp').upsert({
        telefone: telefone.replace(/\D/g, ''),
        modo_humano: true,
        modo_humano_ate: expiracao,
        ultima_mensagem_em: new Date().toISOString()
      }, { onConflict: 'telefone' })

      return ok({ modo_humano: true, expira_em: expiracao, minutos })
    }

    // ═══════════════════════════════════════════════
    // POST /alerta — criar alerta para o PDV
    // ═══════════════════════════════════════════════
    if (req.method === 'POST' && parts[0] === 'alerta') {
      const body = await json(req)
      const { tipo, telefone, mensagem } = body
      const { data, error } = await supabase.from('alertas_pdv')
        .insert({ tipo, telefone, mensagem }).select().single()
      if (error) return err(error.message)
      return ok(data, 201)
    }

    // ═══════════════════════════════════════════════
    // POST /mensagem/log — registrar mensagem no histórico
    // ═══════════════════════════════════════════════
    if (req.method === 'POST' && parts[0] === 'mensagem' && parts[1] === 'log') {
      const body = await json(req)
      const { telefone, direcao, tipo, conteudo, url_midia, remetente } = body

      // Garantir que a conversa existe
      const { data: conv } = await supabase.from('conversas_whatsapp')
        .select('id').eq('telefone', telefone.replace(/\D/g, '')).single()

      let conversaId = (conv as any)?.id
      if (!conversaId) {
        const { data: nova } = await supabase.from('conversas_whatsapp')
          .insert({ telefone: telefone.replace(/\D/g, ''), ultima_mensagem_em: new Date().toISOString() })
          .select('id').single()
        conversaId = (nova as any)?.id
      }

      await supabase.from('mensagens_whatsapp').insert({
        conversa_id: conversaId,
        telefone: telefone.replace(/\D/g, ''),
        direcao, tipo, conteudo, url_midia, remetente
      })

      // Atualizar última mensagem
      await supabase.from('conversas_whatsapp')
        .update({ ultima_mensagem_em: new Date().toISOString() })
        .eq('id', conversaId)

      return ok({ registrado: true })
    }

    // ═══════════════════════════════════════════════
    // GET /tempo-estimado/:condominio_id
    // ═══════════════════════════════════════════════
    if (req.method === 'GET' && parts[0] === 'tempo-estimado') {
      const condominioId = parts[1] ? Number(parts[1]) : null

      const { data: config } = await supabase.from('configuracoes').select('*').eq('id', 1).single()
      const cfg = config || { pizzas_simultaneas: 4, tempo_preparo_min: 25 }

      const { data: pedidosAtivos } = await supabase.from('pedidos')
        .select('itens_pedido(tipo_item, quantidade)')
        .in('status', ['solicitado', 'fazendo'])

      let pizzasNaFila = 0
      ;(pedidosAtivos || []).forEach((p: any) => {
        ;(p.itens_pedido || []).forEach((item: any) => {
          if (item.tipo_item === 'pizza') pizzasNaFila += item.quantidade
        })
      })

      const lotes = Math.ceil(Math.max(pizzasNaFila, 1) / (cfg as any).pizzas_simultaneas)
      const tempoPreparo = lotes * (cfg as any).tempo_preparo_min

      let tempoEntrega = 30
      if (condominioId) {
        const { data: cond } = await supabase.from('condominios').select('tempo_entrega_min').eq('id', condominioId).single()
        if ((cond as any)?.tempo_entrega_min) tempoEntrega = (cond as any).tempo_entrega_min
      }

      return ok({
        pizzas_na_fila: pizzasNaFila,
        tempo_preparo_min: tempoPreparo,
        tempo_entrega_min: tempoEntrega,
        tempo_total_min: tempoPreparo + tempoEntrega,
        mensagem: `Estimativa: aproximadamente ${tempoPreparo + tempoEntrega} minutos`
      })
    }

    return err('Rota não encontrada', 404)

  } catch (e: any) {
    console.error('Erro na API:', e)
    return err(e.message || 'Erro interno', 500)
  }
})
