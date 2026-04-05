import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bebidasDb, outrosDb, bordasDb, condominiosDb } from '../../lib/db'
import { Table, Modal, FormField, ConfirmDialog, Empty, LoadingPage } from '../../components/ui'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Aba = 'bebidas' | 'outros' | 'bordas' | 'condominios'

export function CardapioPage() {
  const [aba, setAba] = useState<Aba>('bebidas')

  const abas: { key: Aba; label: string }[] = [
    { key: 'bebidas', label: '🥤 Bebidas' },
    { key: 'outros', label: '🍟 Outros' },
    { key: 'bordas', label: '🧀 Bordas' },
    { key: 'condominios', label: '🏢 Condomínios' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 h-12 border-b border-gray-800 bg-gray-900 flex items-center gap-4 flex-shrink-0">
        {abas.map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className={clsx('text-sm font-medium border-b-2 py-3 transition-colors',
              aba === a.key ? 'border-pizza-500 text-pizza-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            )}>{a.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {aba === 'bebidas'     && <TabBebidas />}
        {aba === 'outros'      && <TabOutros />}
        {aba === 'bordas'      && <TabBordas />}
        {aba === 'condominios' && <TabCondominios />}
      </div>
    </div>
  )
}

// ── Bebidas ──
function TabBebidas() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [ed, setEd] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', tamanho: '', preco: '', quantidade_estoque: '0' })
  const { data: items = [], isLoading } = useQuery({ queryKey: ['bebidas-admin'], queryFn: () => bebidasDb.listar() })
  const f = (k: string, v: string) => setForm(x => ({ ...x, [k]: v }))
  const abrir = (item?: any) => { setEd(item||null); setForm(item ? { nome: item.nome, tamanho: item.tamanho||'', preco: String(item.preco), quantidade_estoque: String(item.quantidade_estoque) } : { nome:'', tamanho:'', preco:'', quantidade_estoque:'0' }); setModal(true) }
  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => { const d = { ...form, preco: Number(form.preco), quantidade_estoque: Number(form.quantidade_estoque) }; return ed ? bebidasDb.atualizar(ed.id, d) : bebidasDb.criar(d) },
    onSuccess: () => { qc.invalidateQueries({queryKey:['bebidas-admin']}); qc.invalidateQueries({queryKey:['bebidas-disp']}); setModal(false); toast.success('Salvo!') },
    onError: (e: Error) => toast.error(e.message)
  })
  return (
    <div className="p-4">
      <div className="flex justify-end mb-4"><button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Nova bebida</button></div>
      {isLoading ? <LoadingPage /> : !(items as any[]).length ? <Empty icon="🥤" title="Nenhuma bebida" /> : (
        <Table headers={['Nome','Tamanho','Preço','Estoque','Ações']}>
          {(items as any[]).map(b => (
            <tr key={b.id} className="hover:bg-gray-800/30">
              <td className="px-4 py-3 text-sm text-gray-200">{b.nome}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{b.tamanho||'—'}</td>
              <td className="px-4 py-3 text-sm text-pizza-400 font-bold">R$ {Number(b.preco).toFixed(2)}</td>
              <td className="px-4 py-3 text-sm text-gray-400">{b.quantidade_estoque} un</td>
              <td className="px-4 py-3"><button onClick={() => abrir(b)} className="btn-ghost p-1.5"><Pencil size={13}/></button></td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={ed ? 'Editar Bebida' : 'Nova Bebida'} size="sm">
        <div className="space-y-3">
          <FormField label="Nome *"><input value={form.nome} onChange={e => f('nome',e.target.value)} className="input"/></FormField>
          <FormField label="Tamanho"><input value={form.tamanho} onChange={e => f('tamanho',e.target.value)} placeholder="Ex: 350ml" className="input"/></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Preço *"><input type="number" step="0.01" value={form.preco} onChange={e => f('preco',e.target.value)} className="input"/></FormField>
            <FormField label="Estoque"><input type="number" value={form.quantidade_estoque} onChange={e => f('quantidade_estoque',e.target.value)} className="input"/></FormField>
          </div>
          <div className="flex gap-2 pt-2"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => salvar()} disabled={isPending} className="btn-primary flex-1">Salvar</button></div>
        </div>
      </Modal>
    </div>
  )
}

// ── Outros ──
function TabOutros() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [ed, setEd] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', tamanho: '', preco: '', quantidade_estoque: '0' })
  const { data: items = [], isLoading } = useQuery({ queryKey: ['outros-admin'], queryFn: () => outrosDb.listar() })
  const f = (k: string, v: string) => setForm(x => ({ ...x, [k]: v }))
  const abrir = (item?: any) => { setEd(item||null); setForm(item ? { nome: item.nome, tamanho: item.tamanho||'', preco: String(item.preco), quantidade_estoque: String(item.quantidade_estoque) } : { nome:'', tamanho:'', preco:'', quantidade_estoque:'0' }); setModal(true) }
  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => { const d = { ...form, preco: Number(form.preco), quantidade_estoque: Number(form.quantidade_estoque) }; return ed ? outrosDb.atualizar(ed.id, d) : outrosDb.criar(d) },
    onSuccess: () => { qc.invalidateQueries({queryKey:['outros-admin']}); qc.invalidateQueries({queryKey:['outros-disp']}); setModal(false); toast.success('Salvo!') },
    onError: (e: Error) => toast.error(e.message)
  })
  return (
    <div className="p-4">
      <div className="flex justify-end mb-4"><button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Novo item</button></div>
      {isLoading ? <LoadingPage /> : !(items as any[]).length ? <Empty icon="🍟" title="Nenhum item" /> : (
        <Table headers={['Nome','Tamanho','Preço','Estoque','Ações']}>
          {(items as any[]).map(b => (
            <tr key={b.id} className="hover:bg-gray-800/30">
              <td className="px-4 py-3 text-sm text-gray-200">{b.nome}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{b.tamanho||'—'}</td>
              <td className="px-4 py-3 text-sm text-pizza-400 font-bold">R$ {Number(b.preco).toFixed(2)}</td>
              <td className="px-4 py-3 text-sm text-gray-400">{b.quantidade_estoque} un</td>
              <td className="px-4 py-3"><button onClick={() => abrir(b)} className="btn-ghost p-1.5"><Pencil size={13}/></button></td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={ed ? 'Editar Item' : 'Novo Item'} size="sm">
        <div className="space-y-3">
          <FormField label="Nome *"><input value={form.nome} onChange={e => f('nome',e.target.value)} className="input"/></FormField>
          <FormField label="Tamanho"><input value={form.tamanho} onChange={e => f('tamanho',e.target.value)} className="input"/></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Preço *"><input type="number" step="0.01" value={form.preco} onChange={e => f('preco',e.target.value)} className="input"/></FormField>
            <FormField label="Estoque"><input type="number" value={form.quantidade_estoque} onChange={e => f('quantidade_estoque',e.target.value)} className="input"/></FormField>
          </div>
          <div className="flex gap-2 pt-2"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => salvar()} disabled={isPending} className="btn-primary flex-1">Salvar</button></div>
        </div>
      </Modal>
    </div>
  )
}

// ── Bordas ──
function TabBordas() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [ed, setEd] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', preco: '' })
  const { data: items = [], isLoading } = useQuery({ queryKey: ['bordas-admin'], queryFn: bordasDb.listar })
  const abrir = (item?: any) => { setEd(item||null); setForm(item ? { nome: item.nome, preco: String(item.preco) } : { nome:'', preco:'' }); setModal(true) }
  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => { const d = { nome: form.nome, preco: Number(form.preco) }; return ed ? bordasDb.atualizar(ed.id, d) : bordasDb.criar(d) },
    onSuccess: () => { qc.invalidateQueries({queryKey:['bordas-admin']}); qc.invalidateQueries({queryKey:['bordas']}); setModal(false); toast.success('Salvo!') },
    onError: (e: Error) => toast.error(e.message)
  })
  return (
    <div className="p-4">
      <div className="flex justify-end mb-4"><button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Nova borda</button></div>
      {isLoading ? <LoadingPage /> : !(items as any[]).length ? <Empty icon="🧀" title="Nenhuma borda" /> : (
        <Table headers={['Nome','Preço','Ações']}>
          {(items as any[]).map(b => (
            <tr key={b.id} className="hover:bg-gray-800/30">
              <td className="px-4 py-3 text-sm text-gray-200">{b.nome}</td>
              <td className="px-4 py-3 text-sm text-pizza-400 font-bold">R$ {Number(b.preco).toFixed(2)}</td>
              <td className="px-4 py-3"><button onClick={() => abrir(b)} className="btn-ghost p-1.5"><Pencil size={13}/></button></td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={ed ? 'Editar Borda' : 'Nova Borda'} size="sm">
        <div className="space-y-3">
          <FormField label="Sabor *"><input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} className="input" placeholder="Ex: Catupiry"/></FormField>
          <FormField label="Preço *"><input type="number" step="0.01" value={form.preco} onChange={e => setForm(f => ({...f, preco: e.target.value}))} className="input"/></FormField>
          <div className="flex gap-2 pt-2"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => salvar()} disabled={isPending} className="btn-primary flex-1">Salvar</button></div>
        </div>
      </Modal>
    </div>
  )
}

// ── Condomínios ──
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
      <div className="flex justify-end mb-4"><button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Novo condomínio</button></div>
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
          <div className="flex gap-2 pt-2"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => salvar()} disabled={isPending} className="btn-primary flex-1">Salvar</button></div>
        </div>
      </Modal>
    </div>
  )
}
