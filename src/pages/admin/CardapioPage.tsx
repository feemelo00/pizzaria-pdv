import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pizzasDb, bebidasDb, outrosDb, bordasDb, ingredientesDb, condominiosDb } from '../../lib/db'
import { Table, Modal, FormField, ConfirmDialog, Empty, LoadingPage } from '../../components/ui'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Aba = 'pizzas' | 'bebidas' | 'outros' | 'bordas'

export function CardapioPage() {
  const [aba, setAba] = useState<Aba>('pizzas')
  const abas: { key: Aba; label: string }[] = [
    { key: 'pizzas',  label: '🍕 Pizzas' },
    { key: 'bebidas', label: '🥤 Bebidas' },
    { key: 'outros',  label: '🍟 Outros' },
    { key: 'bordas',  label: '🧀 Bordas' },
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
        {aba === 'pizzas'  && <TabPizzas />}
        {aba === 'bebidas' && <TabBebidas />}
        {aba === 'outros'  && <TabOutros />}
        {aba === 'bordas'  && <TabBordas />}
      </div>
    </div>
  )
}

function TabPizzas() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [excluindo, setExcluindo] = useState<number | null>(null)
  const [form, setForm] = useState({ nome: '', tamanho: 'grande', preco: '' })
  const [ings, setIngs] = useState<{ ingrediente_id: number; nome: string; unidadeEstoque: string; unidadeDigitada: string; quantidadeDigitada: string; quantidade: string }[]>([])

  const { data: pizzas = [], isLoading } = useQuery({ queryKey: ['pizzas-admin'], queryFn: pizzasDb.listarTodas })
  const { data: ingredientes = [] } = useQuery({ queryKey: ['ingredientes'], queryFn: ingredientesDb.listar })

  const abrir = (p?: any) => {
    setEditando(p || null)
    setForm(p ? { nome: p.nome, tamanho: p.tamanho, preco: String(p.preco) } : { nome: '', tamanho: 'grande', preco: '' })
    setIngs(p?.pizza_ingredientes?.map((pi: any) => ({
      ingrediente_id: pi.ingrediente_id,
      nome: pi.ingrediente?.nome || '',
      unidadeEstoque: pi.ingrediente?.unidade || 'g',
      unidadeDigitada: pi.ingrediente?.unidade || 'g',
      quantidadeDigitada: String(pi.quantidade),
      quantidade: String(pi.quantidade)
    })) || [])
    setModal(true)
  }

  const addIng = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value)
    if (!id || ings.find(i => i.ingrediente_id === id)) return
    const ing = (ingredientes as any[]).find(i => i.id === id)
    setIngs(prev => [...prev, { ingrediente_id: id, nome: ing?.nome || '', unidadeEstoque: ing?.unidade || 'g', unidadeDigitada: ing?.unidade || 'g', quantidadeDigitada: '', quantidade: '0' }])
    e.target.value = ''
  }

  const converter = (valor: number, de: string, para: string): number => {
    if (de === para) return valor
    if (de === 'g' && para === 'kg') return valor / 1000
    if (de === 'kg' && para === 'g') return valor * 1000
    if (de === 'ml' && para === 'l') return valor / 1000
    if (de === 'l' && para === 'ml') return valor * 1000
    return valor
  }

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const dados = { nome: form.nome, tamanho: form.tamanho, preco: Number(form.preco) }
      const ingredientesData = ings.map(i => ({ ingrediente_id: i.ingrediente_id, quantidade: Number(i.quantidade) }))
      return editando ? pizzasDb.atualizar(editando.id, dados, ingredientesData) : pizzasDb.criar(dados, ingredientesData)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pizzas-admin'] }); qc.invalidateQueries({ queryKey: ['pizzas-disp'] }); setModal(false); toast.success('Pizza salva!') },
    onError: (e: Error) => toast.error(e.message)
  })
  const { mutate: excluir } = useMutation({
    mutationFn: (id: number) => pizzasDb.excluir(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pizzas-admin'] }); toast.success('Pizza desativada') }
  })

  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        <button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Nova pizza</button>
      </div>
      {isLoading ? <LoadingPage /> : !(pizzas as any[]).length ? <Empty icon="🍕" title="Nenhuma pizza" /> : (
        <Table headers={['Nome','Tamanho','Preço','Ingredientes','Ativo','Ações']}>
          {(pizzas as any[]).map(p => (
            <tr key={p.id} className={clsx('hover:bg-gray-800/30', !p.ativo && 'opacity-40')}>
              <td className="px-4 py-3 text-sm font-medium text-gray-200">{p.nome}</td>
              <td className="px-4 py-3 text-sm text-gray-400 capitalize">{p.tamanho}</td>
              <td className="px-4 py-3 text-sm text-pizza-400 font-bold">R$ {Number(p.preco).toFixed(2)}</td>
              <td className="px-4 py-3 text-xs text-gray-500">{p.pizza_ingredientes?.map((pi: any) => pi.ingrediente?.nome).join(', ') || '—'}</td>
              <td className="px-4 py-3"><span className={`badge ${p.ativo ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-600'}`}>{p.ativo ? 'Sim' : 'Não'}</span></td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button onClick={() => abrir(p)} className="btn-ghost p-1.5"><Pencil size={13}/></button>
                  {p.ativo && <button onClick={() => setExcluindo(p.id)} className="btn-ghost p-1.5 text-red-600"><Trash2 size={13}/></button>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Pizza' : 'Nova Pizza'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nome *"><input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} className="input"/></FormField>
            <FormField label="Tamanho">
              <select value={form.tamanho} onChange={e => setForm(f => ({...f, tamanho: e.target.value}))} className="input">
                {['pequena','media','grande','familia'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Preço *"><input type="number" step="0.01" value={form.preco} onChange={e => setForm(f => ({...f, preco: e.target.value}))} className="input" placeholder="0.00"/></FormField>
          <div>
            <label className="label">Ingredientes da receita</label>
            <select onChange={addIng} className="input mb-2">
              <option value="">+ Adicionar ingrediente...</option>
              {(ingredientes as any[]).map(i => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
            </select>
            <div className="space-y-2">
              {ings.map((ing, idx) => {
                const opcoesUnidade: Record<string, string[]> = { 'kg': ['g','kg'], 'g': ['g','kg'], 'l': ['ml','l'], 'ml': ['ml','l'], 'unidade': ['unidade'] }
                const opcoes = opcoesUnidade[ing.unidadeEstoque] || [ing.unidadeEstoque]
                return (
                  <div key={ing.ingrediente_id} className="bg-gray-800/50 rounded-lg px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{ing.nome}</span>
                      <button onClick={() => setIngs(prev => prev.filter((_, j) => j !== idx))} className="text-gray-600 hover:text-red-400"><X size={13}/></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Estoque em: <strong className="text-gray-400">{ing.unidadeEstoque}</strong> · Digitar em:</span>
                      <select value={ing.unidadeDigitada}
                        onChange={e => {
                          const u = e.target.value
                          setIngs(prev => prev.map((i, j) => j === idx ? { ...i, unidadeDigitada: u, quantidade: String(converter(Number(i.quantidadeDigitada || 0), u, i.unidadeEstoque)) } : i))
                        }}
                        className="bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 text-xs focus:outline-none">
                        {opcoes.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input type="number" step="0.001" min="0" value={ing.quantidadeDigitada}
                        placeholder={`qtd em ${ing.unidadeDigitada}`}
                        onChange={e => {
                          const val = e.target.value
                          const emEstoque = converter(Number(val), ing.unidadeDigitada, ing.unidadeEstoque)
                          setIngs(prev => prev.map((i, j) => j === idx ? { ...i, quantidadeDigitada: val, quantidade: String(emEstoque) } : i))
                        }}
                        className="w-24 bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 text-xs focus:outline-none"/>
                      {ing.quantidadeDigitada && (
                        <span className="text-xs text-gray-500">= {Number(ing.quantidade).toFixed(4)} {ing.unidadeEstoque}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => salvar()} disabled={isPending || !form.nome || !form.preco} className="btn-primary flex-1">Salvar</button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!excluindo} onClose={() => setExcluindo(null)} onConfirm={() => excluir(excluindo!)} title="Desativar pizza" message="A pizza será desativada." danger />
    </div>
  )
}

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
