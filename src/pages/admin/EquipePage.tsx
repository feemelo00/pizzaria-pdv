import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motoboysDb } from '../../lib/db'
import { supabase } from '../../lib/supabase'
import { Table, Modal, FormField, ConfirmDialog, Empty, LoadingPage } from '../../components/ui'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Aba = 'motoboys' | 'usuarios'

export function EquipePage() {
  const [aba, setAba] = useState<Aba>('motoboys')
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 h-12 border-b border-gray-800 bg-gray-900 flex items-center gap-4 flex-shrink-0">
        {(['motoboys','usuarios'] as Aba[]).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={clsx('text-sm font-medium border-b-2 py-3 transition-colors capitalize',
              aba === a ? 'border-pizza-500 text-pizza-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            )}>
            {a === 'motoboys' ? '🛵 Motoboys' : '👥 Usuários do Sistema'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {aba === 'motoboys' ? <TabMotoboys /> : <TabUsuarios />}
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
      <div className="flex justify-end mb-4"><button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Novo motoboy</button></div>
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
      const { error } = await supabase.auth.admin?.createUser({
        email: form.email, password: form.senha, email_confirm: true,
        user_metadata: { nome: form.nome, role: form.role }
      }) || {}
      // Se não tiver admin API, usar signUp normal
      if (!supabase.auth.admin) {
        const { error: e } = await supabase.auth.signUp({
          email: form.email, password: form.senha,
          options: { data: { nome: form.nome, role: form.role } }
        })
        if (e) throw new Error(e.message)
      } else if (error) throw new Error((error as any).message)
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:['usuarios-admin']}); setModal(false); toast.success('Usuário criado! Verifique o email de confirmação.') },
    onError: (e: Error) => toast.error(e.message)
  })
  const f = (k: string, v: string) => setForm(x => ({ ...x, [k]: v }))
  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        <button onClick={() => { setForm({nome:'',email:'',senha:'',role:'funcionario'}); setModal(true) }} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Novo usuário</button>
      </div>
      <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800/40 rounded-xl text-xs text-blue-400">
        💡 Para criar usuários, use o painel do Supabase em Authentication → Users → Invite user. Ou crie diretamente aqui (o usuário receberá um email de confirmação).
      </div>
      {isLoading ? <LoadingPage /> : !(usuarios as any[]).length ? <Empty icon="👥" title="Nenhum usuário" /> : (
        <Table headers={['Nome','Email','Perfil','Criado em']}>
          {(usuarios as any[]).map(u => (
            <tr key={u.id} className="hover:bg-gray-800/30">
              <td className="px-4 py-3 text-sm font-medium text-gray-200">{u.nome}</td>
              <td className="px-4 py-3 text-sm text-gray-400">{u.email}</td>
              <td className="px-4 py-3">
                <span className={`badge ${u.role === 'proprietario' ? 'bg-pizza-900/40 text-pizza-400' : 'bg-gray-800 text-gray-400'}`}>
                  {u.role === 'proprietario' ? '👑 Proprietário' : '👤 Funcionário'}
                </span>
              </td>
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
          <FormField label="Perfil">
            <select value={form.role} onChange={e => f('role',e.target.value)} className="input">
              <option value="funcionario">👤 Funcionário</option>
              <option value="proprietario">👑 Proprietário</option>
            </select>
          </FormField>
          <div className="flex gap-2 pt-2"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => criar()} disabled={isPending || !form.nome || !form.email || !form.senha} className="btn-primary flex-1">Criar</button></div>
        </div>
      </Modal>
    </div>
  )
}
