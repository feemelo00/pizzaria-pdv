import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motoboysDb, mesasDb, condominiosDb, configuracoesDb } from '../../lib/db'
import { supabase } from '../../lib/supabase'
import { Table, Modal, FormField, ConfirmDialog, Empty, LoadingPage } from '../../components/ui'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Aba = 'motoboys' | 'usuarios' | 'mesas' | 'condominios' | 'configuracoes'

export function EquipePage() {
  const [aba, setAba] = useState<Aba>('motoboys')
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 h-12 border-b border-gray-800 bg-gray-900 flex items-center gap-4 flex-shrink-0">
        {(['motoboys','usuarios','mesas','condominios','configuracoes'] as Aba[]).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={clsx('text-sm font-medium border-b-2 py-3 transition-colors',
              aba === a ? 'border-pizza-500 text-pizza-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            )}>
            {a === 'motoboys'    && '🛵 Motoboys'}
            {a === 'usuarios'    && '👥 Usuários'}
            {a === 'mesas'       && '🪑 Mesas'}
            {a === 'condominios' && '🏢 Condomínios'}
            {a === 'configuracoes' && '⚙️ Configurações'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {aba === 'motoboys'    && <TabMotoboys />}
        {aba === 'usuarios'    && <TabUsuarios />}
        {aba === 'mesas'       && <TabMesas />}
        {aba === 'condominios' && <TabCondominios />}
        {aba === 'configuracoes' && <TabConfiguracoes />}
      </div>
    </div>
  )
}

function TabMotoboys() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [ed, setEd] = useState<any>(null)
  const [excluindo, setExcluindo] = useState<number | null>(null)
  const [form, setForm] = useState({ nome: '', telefone: '' })
  const { data: items = [], isLoading } = useQuery({ queryKey: ['motoboys-admin'], queryFn: motoboysDb.listarTodos })
  const abrir = (item?: any) => { setEd(item||null); setForm(item ? { nome: item.nome, telefone: item.telefone||'' } : { nome:'', telefone:'' }); setModal(true) }
  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => ed ? motoboysDb.atualizar(ed.id, form) : motoboysDb.criar(form),
    onSuccess: () => { qc.invalidateQueries({queryKey:['motoboys-admin']}); qc.invalidateQueries({queryKey:['motoboys']}); setModal(false); toast.success('Salvo!') },
    onError: (e: Error) => toast.error(e.message)
  })
  const { mutate: excluir } = useMutation({
    mutationFn: (id: number) => motoboysDb.excluir(id),
    onSuccess: () => { qc.invalidateQueries({queryKey:['motoboys-admin']}); toast.success('Desativado') }
  })
  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        <button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Novo motoboy</button>
      </div>
      {isLoading ? <LoadingPage /> : !(items as any[]).length ? <Empty icon="🛵" title="Nenhum motoboy" /> : (
        <Table headers={['Nome','Telefone','Ativo','Ações']}>
          {(items as any[]).map(m => (
            <tr key={m.id} className="hover:bg-gray-800/30">
              <td className="px-4 py-3 text-sm font-medium text-gray-200">{m.nome}</td>
              <td className="px-4 py-3 text-sm text-gray-400 font-mono">{m.telefone||'—'}</td>
              <td className="px-4 py-3"><span className={`badge ${m.ativo ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-600'}`}>{m.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button onClick={() => abrir(m)} className="btn-ghost p-1.5"><Pencil size={13}/></button>
                  {m.ativo && <button onClick={() => setExcluindo(m.id)} className="btn-ghost p-1.5 text-red-600"><Trash2 size={13}/></button>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={ed ? 'Editar Motoboy' : 'Novo Motoboy'} size="sm">
        <div className="space-y-3">
          <FormField label="Nome *"><input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} className="input"/></FormField>
          <FormField label="Telefone"><input value={form.telefone} onChange={e => setForm(f => ({...f, telefone: e.target.value}))} className="input" placeholder="(00) 00000-0000"/></FormField>
          <div className="flex gap-2 pt-2"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => salvar()} disabled={isPending || !form.nome} className="btn-primary flex-1">Salvar</button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!excluindo} onClose={() => setExcluindo(null)} onConfirm={() => excluir(excluindo!)} title="Desativar motoboy" message="O motoboy será desativado." danger />
    </div>
  )
}

function TabUsuarios() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', role: 'funcionario' })
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios-admin'],
    queryFn: async () => { const { data } = await supabase.from('usuarios').select('*').order('nome'); return data ?? [] }
  })
  const { mutate: criar, isPending } = useMutation({
    mutationFn: async () => {
      const { error: e } = await supabase.auth.signUp({
        email: form.email, password: form.senha,
        options: { data: { nome: form.nome, role: form.role } }
      })
      if (e) throw new Error(e.message)
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:['usuarios-admin']}); setModal(false); toast.success('Usuário criado!') },
    onError: (e: Error) => toast.error(e.message)
  })
  const f = (k: string, v: string) => setForm(x => ({ ...x, [k]: v }))
  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        <button onClick={() => { setForm({nome:'',email:'',senha:'',role:'funcionario'}); setModal(true) }} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Novo usuário</button>
      </div>
      <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800/40 rounded-xl text-xs text-blue-400">
        💡 O usuário receberá um email para confirmar o cadastro.
      </div>
      {isLoading ? <LoadingPage /> : !(usuarios as any[]).length ? <Empty icon="👥" title="Nenhum usuário" /> : (
        <Table headers={['Nome','Email','Perfil','Criado em']}>
          {(usuarios as any[]).map(u => (
            <tr key={u.id} className="hover:bg-gray-800/30">
              <td className="px-4 py-3 text-sm font-medium text-gray-200">{u.nome}</td>
              <td className="px-4 py-3 text-sm text-gray-400">{u.email}</td>
              <td className="px-4 py-3"><span className={`badge ${u.role === 'proprietario' ? 'bg-pizza-900/40 text-pizza-400' : 'bg-gray-800 text-gray-400'}`}>{u.role === 'proprietario' ? '👑 Proprietário' : '👤 Funcionário'}</span></td>
              <td className="px-4 py-3 text-xs text-gray-600">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title="Novo Usuário" size="sm">
        <div className="space-y-3">
          <FormField label="Nome *"><input value={form.nome} onChange={e => f('nome',e.target.value)} className="input"/></FormField>
          <FormField label="Email *"><input type="email" value={form.email} onChange={e => f('email',e.target.value)} className="input"/></FormField>
          <FormField label="Senha *"><input type="password" value={form.senha} onChange={e => f('senha',e.target.value)} className="input" placeholder="Mínimo 6 caracteres"/></FormField>
          <FormField label="Perfil"><select value={form.role} onChange={e => f('role',e.target.value)} className="input"><option value="funcionario">👤 Funcionário</option><option value="proprietario">👑 Proprietário</option></select></FormField>
          <div className="flex gap-2 pt-2"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => criar()} disabled={isPending || !form.nome || !form.email || !form.senha} className="btn-primary flex-1">Criar</button></div>
        </div>
      </Modal>
    </div>
  )
}

function TabMesas() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [ed, setEd] = useState<any>(null)
  const [excluindo, setExcluindo] = useState<number | null>(null)
  const [form, setForm] = useState({ nome: '' })
  const { data: mesas = [], isLoading } = useQuery({ queryKey: ['mesas-admin'], queryFn: mesasDb.listar })
  const abrir = (item?: any) => { setEd(item||null); setForm(item ? { nome: item.nome } : { nome: '' }); setModal(true) }
  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => ed ? mesasDb.atualizar(ed.id, { nome: form.nome }) : mesasDb.criar({ nome: form.nome }),
    onSuccess: () => { qc.invalidateQueries({queryKey:['mesas-admin']}); qc.invalidateQueries({queryKey:['mesas']}); setModal(false); toast.success('Salvo!') },
    onError: (e: Error) => toast.error(e.message)
  })
  const { mutate: excluir } = useMutation({
    mutationFn: (id: number) => mesasDb.excluir(id),
    onSuccess: () => { qc.invalidateQueries({queryKey:['mesas-admin']}); toast.success('Mesa excluída') },
    onError: () => toast.error('Não é possível excluir mesa com pedidos vinculados')
  })
  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        <button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Nova mesa</button>
      </div>
      {isLoading ? <LoadingPage /> : !(mesas as any[]).length ? <Empty icon="🪑" title="Nenhuma mesa" desc="Cadastre as mesas do estabelecimento" /> : (
        <Table headers={['Mesa','Status','Ações']}>
          {(mesas as any[]).map(m => (
            <tr key={m.id} className="hover:bg-gray-800/30">
              <td className="px-4 py-3 text-sm font-medium text-gray-200">{m.nome}</td>
              <td className="px-4 py-3"><span className={clsx('badge border', m.status === 'livre' ? 'bg-green-900/40 text-green-400 border-green-800/40' : 'bg-orange-900/40 text-orange-400 border-orange-800/40')}>{m.status === 'livre' ? '🟢 Livre' : '🔴 Ocupada'}</span></td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button onClick={() => abrir(m)} className="btn-ghost p-1.5"><Pencil size={13}/></button>
                  {m.status === 'livre' && <button onClick={() => setExcluindo(m.id)} className="btn-ghost p-1.5 text-red-600 hover:text-red-400"><Trash2 size={13}/></button>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={ed ? 'Editar Mesa' : 'Nova Mesa'} size="sm">
        <div className="space-y-3">
          <FormField label="Nome da mesa *"><input value={form.nome} onChange={e => setForm({ nome: e.target.value })} className="input" placeholder="Ex: Mesa 1, Mesa VIP..." autoFocus /></FormField>
          <div className="flex gap-2 pt-2"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => salvar()} disabled={isPending || !form.nome} className="btn-primary flex-1">Salvar</button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!excluindo} onClose={() => setExcluindo(null)} onConfirm={() => excluir(excluindo!)} title="Excluir mesa" message="Tem certeza que deseja excluir esta mesa?" danger />
    </div>
  )
}

function TabCondominios() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [ed, setEd] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', valor_frete: '' })
  const { data: items = [], isLoading } = useQuery({ queryKey: ['condominios-admin'], queryFn: condominiosDb.listarTodos })
  const abrir = (item?: any) => { setEd(item||null); setForm(item ? { nome: item.nome, valor_frete: String(item.valor_frete) } : { nome:'', valor_frete:'0' }); setModal(true) }
  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => { const d = { nome: form.nome, valor_frete: Number(form.valor_frete) }; return ed ? condominiosDb.atualizar(ed.id, d) : condominiosDb.criar(d) },
    onSuccess: () => { qc.invalidateQueries({queryKey:['condominios-admin']}); qc.invalidateQueries({queryKey:['condominios']}); setModal(false); toast.success('Salvo!') },
    onError: (e: Error) => toast.error(e.message)
  })
  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        <button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Novo condomínio</button>
      </div>
      {isLoading ? <LoadingPage /> : !(items as any[]).length ? <Empty icon="🏢" title="Nenhum condomínio" /> : (
        <Table headers={['Nome','Frete','Ativo','Ações']}>
          {(items as any[]).map(c => (
            <tr key={c.id} className="hover:bg-gray-800/30">
              <td className="px-4 py-3 text-sm text-gray-200">{c.nome}</td>
              <td className="px-4 py-3 text-sm text-pizza-400 font-bold">R$ {Number(c.valor_frete).toFixed(2)}</td>
              <td className="px-4 py-3"><span className={`badge ${c.ativo ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-600'}`}>{c.ativo ? 'Sim' : 'Não'}</span></td>
              <td className="px-4 py-3"><button onClick={() => abrir(c)} className="btn-ghost p-1.5"><Pencil size={13}/></button></td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={ed ? 'Editar Condomínio' : 'Novo Condomínio'} size="sm">
        <div className="space-y-3">
          <FormField label="Nome *"><input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} className="input"/></FormField>
          <FormField label="Valor do frete *"><input type="number" step="0.01" value={form.valor_frete} onChange={e => setForm(f => ({...f, valor_frete: e.target.value}))} className="input"/></FormField>
          <div className="flex gap-2 pt-2"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => salvar()} disabled={isPending || !form.nome} className="btn-primary flex-1">Salvar</button></div>
        </div>
      </Modal>
    </div>
  )
}

// ============================================================
// CONFIGURAÇÕES DO SISTEMA
// ============================================================
function TabConfiguracoes() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ pizzas_simultaneas: '4', tempo_preparo_min: '25' })
  const [salvando, setSalvando] = useState(false)

  const { data: config, isLoading } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: configuracoesDb.buscar,
    onSuccess: (data: any) => {
      if (data) setForm({
        pizzas_simultaneas: String(data.pizzas_simultaneas),
        tempo_preparo_min: String(data.tempo_preparo_min)
      })
    }
  } as any)

  const { data: condominios = [] } = useQuery({ queryKey: ['condominios'], queryFn: condominiosDb.listarTodos })
  const [temposEntrega, setTemposEntrega] = useState<Record<number, string>>({})
  const [salvandoCond, setSalvandoCond] = useState<number | null>(null)

  // Inicializar tempos de entrega dos condomínios
  useState(() => {
    if (condominios && (condominios as any[]).length) {
      const tempos: Record<number, string> = {}
      ;(condominios as any[]).forEach((c: any) => {
        tempos[c.id] = String(c.tempo_entrega_min || 30)
      })
      setTemposEntrega(tempos)
    }
  })

  const salvarConfig = async () => {
    setSalvando(true)
    try {
      await configuracoesDb.salvar({
        pizzas_simultaneas: Number(form.pizzas_simultaneas),
        tempo_preparo_min: Number(form.tempo_preparo_min)
      })
      qc.invalidateQueries({ queryKey: ['configuracoes'] })
      toast.success('Configurações salvas!')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const salvarTempo = async (condId: number) => {
    setSalvandoCond(condId)
    try {
      await condominiosDb.atualizar(condId, { tempo_entrega_min: Number(temposEntrega[condId] || 30) })
      qc.invalidateQueries({ queryKey: ['condominios'] })
      toast.success('Tempo salvo!')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSalvandoCond(null)
    }
  }

  // Simular tempo estimado
  const pizzasSimult = Number(form.pizzas_simultaneas) || 4
  const tempoPreparo = Number(form.tempo_preparo_min) || 25

  return (
    <div className="p-4 space-y-6 max-w-2xl">
      {/* Configurações de preparo */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-200 mb-1">🍕 Capacidade de Preparo</h3>
        <p className="text-xs text-gray-500 mb-4">Configure quantas pizzas você consegue fazer ao mesmo tempo e o tempo necessário.</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Pizzas simultâneas</label>
            <input
              type="number" min="1" max="20"
              value={form.pizzas_simultaneas}
              onChange={e => setForm(f => ({...f, pizzas_simultaneas: e.target.value}))}
              className="input"
              placeholder="Ex: 4"
            />
            <p className="text-xs text-gray-600 mt-1">Quantas pizzas cabem no forno ao mesmo tempo</p>
          </div>
          <div>
            <label className="label">Tempo por lote (minutos)</label>
            <input
              type="number" min="1" max="120"
              value={form.tempo_preparo_min}
              onChange={e => setForm(f => ({...f, tempo_preparo_min: e.target.value}))}
              className="input"
              placeholder="Ex: 25"
            />
            <p className="text-xs text-gray-600 mt-1">Minutos para assar {form.pizzas_simultaneas || '?'} pizza(s)</p>
          </div>
        </div>

        {/* Simulação visual */}
        <div className="bg-gray-800/60 rounded-xl p-4 mb-4 space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Simulação de tempo</p>
          {[1, 2, 3, 4, 6, 8].map(qtd => {
            const lotes = Math.ceil(qtd / pizzasSimult)
            const tempo = lotes * tempoPreparo
            return (
              <div key={qtd} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{qtd} pizza{qtd > 1 ? 's' : ''} na fila</span>
                <span className="text-gray-300">
                  {lotes} lote{lotes > 1 ? 's' : ''} = <strong className="text-pizza-400">{tempo} min</strong> de preparo
                </span>
              </div>
            )
          })}
        </div>

        <button onClick={salvarConfig} disabled={salvando}
          className="btn-primary px-6 py-2 flex items-center gap-2">
          {salvando ? '⏳ Salvando...' : '💾 Salvar configurações'}
        </button>
      </div>

      {/* Tempos de entrega por condomínio */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-200 mb-1">🛵 Tempo de Entrega por Condomínio</h3>
        <p className="text-xs text-gray-500 mb-4">Configure o tempo médio de entrega em minutos para cada condomínio. Este tempo é somado ao tempo de preparo para calcular a estimativa total.</p>
        {isLoading ? <div className="text-gray-500 text-sm">Carregando...</div> : (
          <div className="space-y-2">
            {(condominios as any[]).map(c => (
              <div key={c.id} className="flex items-center gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-300 flex-1">{c.nome}</span>
                <span className="text-xs text-gray-600">R$ {Number(c.valor_frete).toFixed(2)}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="5" max="120"
                    value={temposEntrega[c.id] || '30'}
                    onChange={e => setTemposEntrega(prev => ({...prev, [c.id]: e.target.value}))}
                    className="w-16 bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                  />
                  <span className="text-xs text-gray-600">min</span>
                  <button
                    onClick={() => salvarTempo(c.id)}
                    disabled={salvandoCond === c.id}
                    className="text-xs text-pizza-400 hover:text-pizza-300 border border-pizza-500/30 px-2 py-1 rounded">
                    {salvandoCond === c.id ? '...' : 'Salvar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
