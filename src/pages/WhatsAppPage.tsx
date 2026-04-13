import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Empty, LoadingPage, StatusBadge } from '../components/ui'
import { MessageCircle, Bell, BellOff, Phone, Clock, CheckCheck } from 'lucide-react'
import clsx from 'clsx'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'

// ── Alertas em tempo real (aparece em qualquer tela) ──
export function AlertasWhatsApp() {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase.channel('alertas-pdv')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'alertas_pdv'
      }, (payload) => {
        const alerta = payload.new as any
        if (alerta.tipo === 'humano_necessario') {
          toast((t) => (
            <div className="flex items-start gap-3">
              <span className="text-2xl">🚨</span>
              <div>
                <p className="font-bold text-sm">Atendimento humano necessário!</p>
                <p className="text-xs text-gray-600 mt-0.5">{alerta.mensagem}</p>
                <p className="text-xs text-gray-500">Tel: {alerta.telefone}</p>
                <button
                  onClick={() => { toast.dismiss(t.id); marcarLido(alerta.id) }}
                  className="mt-2 text-xs text-orange-600 font-medium">
                  Marcar como visto
                </button>
              </div>
            </div>
          ), { duration: 30000, style: { background: '#fff3e0', border: '2px solid #ff9800' } })
        }

        if (alerta.tipo === 'novo_pedido_wpp') {
          toast.success(`📱 Novo pedido via WhatsApp! ${alerta.mensagem}`, { duration: 8000 })
        }

        qc.invalidateQueries({ queryKey: ['alertas-pdv'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return null
}

async function marcarLido(id: number) {
  await supabase.from('alertas_pdv').update({ lido: true }).eq('id', id)
}

// ── Página principal do WhatsApp ──
export function WhatsAppPage() {
  const [conversaSelecionada, setConversaSelecionada] = useState<any>(null)

  const { data: conversas = [], isLoading } = useQuery({
    queryKey: ['conversas-wpp'],
    queryFn: async () => {
      const { data } = await supabase.from('conversas_whatsapp')
        .select('*').order('ultima_mensagem_em', { ascending: false })
      return data ?? []
    },
    refetchInterval: 10_000
  })

  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas-pdv'],
    queryFn: async () => {
      const { data } = await supabase.from('alertas_pdv')
        .select('*').eq('lido', false).order('created_at', { ascending: false })
      return data ?? []
    }
  })

  const alertasArr = alertas as any[]
  const conversasArr = conversas as any[]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-green-400" />
          <h1 className="font-semibold text-gray-100 text-sm">WhatsApp</h1>
        </div>
        {alertasArr.length > 0 && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-1.5">
            <Bell size={13} className="text-red-400 animate-pulse" />
            <span className="text-xs text-red-400 font-medium">{alertasArr.length} alerta{alertasArr.length > 1 ? 's' : ''} pendente{alertasArr.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Lista de conversas */}
        <div className="w-72 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
          {/* Alertas */}
          {alertasArr.length > 0 && (
            <div className="p-3 border-b border-gray-800 space-y-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">🚨 Alertas</p>
              {alertasArr.slice(0, 3).map((a: any) => (
                <div key={a.id} className="bg-red-900/20 border border-red-800/40 rounded-lg p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-red-400">
                        {a.tipo === 'humano_necessario' ? '🚨 Atendimento humano' : '📱 Novo pedido WPP'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.mensagem}</p>
                      <p className="text-xs text-gray-600">{a.telefone}</p>
                    </div>
                    <button onClick={() => marcarLido(a.id)} className="text-gray-600 hover:text-gray-400 text-xs flex-shrink-0">✓</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lista conversas */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <p className="text-xs text-gray-600 px-2 py-1">Conversas recentes</p>
            {isLoading ? <LoadingPage /> : !conversasArr.length ? (
              <Empty icon="💬" title="Nenhuma conversa" desc="Aguardando mensagens do WhatsApp" />
            ) : conversasArr.map((c: any) => (
              <button key={c.id} onClick={() => setConversaSelecionada(c)}
                className={clsx('w-full text-left p-3 rounded-xl border transition-all',
                  conversaSelecionada?.id === c.id ? 'border-green-500/40 bg-green-500/10'
                  : c.modo_humano && new Date(c.modo_humano_ate) > new Date()
                  ? 'border-orange-700/50 bg-orange-900/10 hover:border-orange-600/50'
                  : 'border-gray-800 hover:border-gray-700'
                )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={clsx('w-2 h-2 rounded-full flex-shrink-0',
                      c.modo_humano && new Date(c.modo_humano_ate) > new Date() ? 'bg-orange-400' : 'bg-green-400'
                    )} />
                    <span className="text-sm font-medium text-gray-200 truncate">
                      {c.nome_contato || c.telefone}
                    </span>
                  </div>
                  {c.modo_humano && new Date(c.modo_humano_ate) > new Date() && (
                    <span className="text-xs text-orange-400 flex-shrink-0">👤 Humano</span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5 ml-4">{c.telefone}</p>
                <p className="text-xs text-gray-700 mt-0.5 ml-4">
                  {formatDistanceToNow(new Date(c.ultima_mensagem_em), { addSuffix: true, locale: ptBR })}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Detalhes da conversa */}
        <div className="flex-1 overflow-hidden">
          {!conversaSelecionada ? (
            <div className="flex items-center justify-center h-full">
              <Empty icon="💬" title="Selecione uma conversa" desc="Clique em uma conversa para ver o histórico" />
            </div>
          ) : (
            <ConversaDetalhe conversa={conversaSelecionada} />
          )}
        </div>
      </div>
    </div>
  )
}

function ConversaDetalhe({ conversa }: { conversa: any }) {
  const qc = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const modoHumanoAtivo = conversa.modo_humano && new Date(conversa.modo_humano_ate) > new Date()

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ['mensagens-wpp', conversa.telefone],
    queryFn: async () => {
      const { data } = await supabase.from('mensagens_whatsapp')
        .select('*').eq('telefone', conversa.telefone)
        .order('created_at', { ascending: true }).limit(100)
      return data ?? []
    },
    refetchInterval: 5_000
  })

  const { data: pedidoAberto } = useQuery({
    queryKey: ['pedido-wpp', conversa.pedido_em_aberto_id],
    queryFn: async () => {
      if (!conversa.pedido_em_aberto_id) return null
      const { data } = await supabase.from('pedidos')
        .select('id, status, valor_total, data_criacao')
        .eq('id', conversa.pedido_em_aberto_id).single()
      return data
    },
    enabled: !!conversa.pedido_em_aberto_id
  })

  const { mutate: ativarModoHumano, isPending } = useMutation({
    mutationFn: async () => {
      const expiracao = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      await supabase.from('conversas_whatsapp').update({
        modo_humano: true, modo_humano_ate: expiracao
      }).eq('id', conversa.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversas-wpp'] })
      toast.success('Modo humano ativado por 10 minutos!')
    }
  })

  const { mutate: desativarModoHumano } = useMutation({
    mutationFn: async () => {
      await supabase.from('conversas_whatsapp').update({
        modo_humano: false, modo_humano_ate: null
      }).eq('id', conversa.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversas-wpp'] })
      toast.success('IA reativada!')
    }
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const mensagensArr = mensagens as any[]

  return (
    <div className="flex flex-col h-full">
      {/* Header da conversa */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-green-400" />
            <span className="font-semibold text-gray-200">{conversa.nome_contato || conversa.telefone}</span>
            {modoHumanoAtivo && (
              <span className="badge bg-orange-900/40 text-orange-400 border border-orange-800/40 text-xs">
                👤 Modo humano ativo
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{conversa.telefone}</p>
        </div>
        <div className="flex items-center gap-2">
          {pedidoAberto && (
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-400">Pedido #{(pedidoAberto as any).id}</span>
              <StatusBadge status={(pedidoAberto as any).status} />
            </div>
          )}
          {modoHumanoAtivo ? (
            <button onClick={() => desativarModoHumano()}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
              <BellOff size={13} /> Reativar IA
            </button>
          ) : (
            <button onClick={() => ativarModoHumano()} disabled={isPending}
              className="text-xs px-3 py-1.5 rounded-lg border border-orange-700/50 text-orange-400 hover:bg-orange-900/20 flex items-center gap-1.5">
              <Bell size={13} /> Assumir atendimento
            </button>
          )}
        </div>
      </div>

      {/* Aviso modo humano */}
      {modoHumanoAtivo && (
        <div className="bg-orange-900/20 border-b border-orange-800/30 px-4 py-2 text-xs text-orange-400">
          ⚠️ IA pausada para esta conversa. A atendente está respondendo diretamente pelo WhatsApp.
          Expira em: {format(new Date(conversa.modo_humano_ate), 'HH:mm', { locale: ptBR })}
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-950">
        {isLoading ? <LoadingPage /> : !mensagensArr.length ? (
          <Empty icon="💬" title="Sem mensagens registradas" />
        ) : mensagensArr.map((msg: any) => (
          <div key={msg.id}
            className={clsx('flex', msg.direcao === 'saida' ? 'justify-end' : 'justify-start')}>
            <div className={clsx('max-w-xs lg:max-w-md rounded-2xl px-3 py-2 space-y-1',
              msg.direcao === 'saida'
                ? msg.remetente === 'ia' ? 'bg-green-800/60 border border-green-700/40' : 'bg-blue-800/60 border border-blue-700/40'
                : 'bg-gray-800 border border-gray-700/50'
            )}>
              {msg.remetente && (
                <p className={clsx('text-xs font-medium',
                  msg.remetente === 'ia' ? 'text-green-400' : msg.remetente === 'atendente' ? 'text-blue-400' : 'text-gray-500'
                )}>
                  {msg.remetente === 'ia' ? '🤖 IA' : msg.remetente === 'atendente' ? '👤 Atendente' : '👤 Cliente'}
                </p>
              )}
              {msg.tipo === 'audio' && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  🎵 Áudio
                  {msg.conteudo && <span className="italic">(transcrição: {msg.conteudo})</span>}
                </div>
              )}
              {msg.tipo === 'imagem' && (
                <div className="text-xs text-gray-400">🖼️ Imagem {msg.conteudo && `— ${msg.conteudo}`}</div>
              )}
              {msg.tipo === 'figurinha' && (
                <div className="text-xs text-gray-400">🎭 Figurinha</div>
              )}
              {(msg.tipo === 'texto' || !msg.tipo) && (
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.conteudo}</p>
              )}
              <div className="flex items-center justify-end gap-1">
                <span className="text-xs text-gray-600">
                  {format(new Date(msg.created_at), 'HH:mm')}
                </span>
                {msg.direcao === 'saida' && <CheckCheck size={11} className="text-gray-600" />}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Rodapé informativo */}
      <div className="px-4 py-2 border-t border-gray-800 bg-gray-900 text-xs text-gray-600">
        {modoHumanoAtivo
          ? '👤 Responda diretamente pelo WhatsApp Business. A IA está pausada.'
          : '🤖 A IA está respondendo automaticamente. Clique em "Assumir atendimento" para intervir.'
        }
      </div>
    </div>
  )
}
