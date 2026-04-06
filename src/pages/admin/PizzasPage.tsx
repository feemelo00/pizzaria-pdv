// ============================================================
// PizzasPage.tsx
// ============================================================
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pizzasDb, ingredientesDb } from '../../lib/db'
import { Table, Modal, FormField, ConfirmDialog, Empty, LoadingPage } from '../../components/ui'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

export function PizzasPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [excluindo, setExcluindo] = useState<number | null>(null)
  const [form, setForm] = useState({ nome: '', tamanho: 'grande', preco: '' })
  const [ings, setIngs] = useState<{ ingrediente_id: number; nome: string; quantidade: string }[]>([])

  const { data: pizzas = [], isLoading } = useQuery({ queryKey: ['pizzas-admin'], queryFn: pizzasDb.listarTodas })
  const { data: ingredientes = [] } = useQuery({ queryKey: ['ingredientes'], queryFn: ingredientesDb.listar })

  const abrir = (p?: any) => {
    setEditando(p || null)
    setForm(p ? { nome: p.nome, tamanho: p.tamanho, preco: String(p.preco) } : { nome: '', tamanho: 'grande', preco: '' })
    setIngs(p?.pizza_ingredientes?.map((pi: any) => ({ ingrediente_id: pi.ingrediente_id, nome: pi.ingrediente?.nome || '', quantidade: String(pi.quantidade) })) || [])
    setModal(true)
  }

  const addIng = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value)
    if (!id || ings.find(i => i.ingrediente_id === id)) return
    const ing = (ingredientes as any[]).find(i => i.id === id)
    setIngs(prev => [...prev, {
      ingrediente_id: id,
      nome: ing?.nome || '',
      unidadeEstoque: ing?.unidade || 'g',
      unidadeDigitada: ing?.unidade || 'g',
      quantidadeDigitada: '',
      quantidade: '0'
    }])
    e.target.value = ''
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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <h1 className="font-semibold text-gray-100 text-sm">Pizzas</h1>
        <button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14} /> Nova</button>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        {isLoading ? <LoadingPage /> : !(pizzas as any[]).length ? <Empty icon="🍕" title="Nenhuma pizza" /> : (
          <Table headers={['Nome','Tamanho','Preço','Ingredientes','Ativo','Ações']}>
            {(pizzas as any[]).map(p => (
              <tr key={p.id} className={`hover:bg-gray-800/30 transition-colors ${!p.ativo ? 'opacity-40' : ''}`}>
                <td className="px-4 py-3 text-sm font-medium text-gray-200">{p.nome}</td>
                <td className="px-4 py-3 text-sm text-gray-400 capitalize">{p.tamanho}</td>
                <td className="px-4 py-3 text-sm text-pizza-400 font-bold">R$ {Number(p.preco).toFixed(2)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.pizza_ingredientes?.map((pi: any) => pi.ingrediente?.nome).join(', ') || '—'}</td>
                <td className="px-4 py-3"><span className={`badge ${p.ativo ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-600'}`}>{p.ativo ? 'Sim' : 'Não'}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => abrir(p)} className="btn-ghost p-1.5"><Pencil size={13} /></button>
                    {p.ativo && <button onClick={() => setExcluindo(p.id)} className="btn-ghost p-1.5 text-red-600"><Trash2 size={13} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Pizza' : 'Nova Pizza'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nome *"><input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} className="input" /></FormField>
            <FormField label="Tamanho">
              <select value={form.tamanho} onChange={e => setForm(f => ({...f, tamanho: e.target.value}))} className="input">
                {['pequena','media','grande','familia'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Preço *"><input type="number" step="0.01" value={form.preco} onChange={e => setForm(f => ({...f, preco: e.target.value}))} className="input" placeholder="0.00" /></FormField>
          <div>
            <label className="label">Ingredientes da receita</label>
            <select onChange={addIng} className="input mb-2"><option value="">+ Adicionar ingrediente...</option>
              {(ingredientes as any[]).map(i => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
            </select>
            <div className="space-y-1.5">
              {ings.map((ing, idx) => {
                const unidadeEstoque = (ing as any).unidadeEstoque || 'g'
                const unidadeDigitada = (ing as any).unidadeDigitada || unidadeEstoque

                const unidadesCompativeis: Record<string, string[]> = {
                  'kg':      ['kg', 'g'],
                  'g':       ['g', 'kg'],
                  'l':       ['l', 'ml'],
                  'ml':      ['ml', 'l'],
                  'unidade': ['unidade'],
                }
                const opcoesUnidade = unidadesCompativeis[unidadeEstoque] || [unidadeEstoque]

                const converter = (valor: number, de: string, para: string): number => {
                  if (de === para) return valor
                  if (de === 'g'  && para === 'kg') return valor / 1000
                  if (de === 'kg' && para === 'g')  return valor * 1000
                  if (de === 'ml' && para === 'l')  return valor / 1000
                  if (de === 'l'  && para === 'ml') return valor * 1000
                  return valor
                }

                return (
                  <div key={ing.ingrediente_id} className="bg-gray-800/50 rounded-lg px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{ing.nome}</span>
                      <button onClick={() => setIngs(prev => prev.filter((_, j) => j !== idx))}
                        className="text-gray-600 hover:text-red-400"><X size={13} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600 mb-0.5">Estoque em: <strong className="text-gray-400">{unidadeEstoque}</strong></span>
                        <span className="text-xs text-gray-600">Digitar em:</span>
                      </div>
                      <select
                        value={unidadeDigitada}
                        onChange={e => {
                          const novaUnidade = e.target.value
                          const qtdAtual = Number((ing as any).quantidadeDigitada || 0)
                          const emEstoque = converter(qtdAtual, novaUnidade, unidadeEstoque)
                          setIngs(prev => prev.map((i, j) => j === idx
                            ? { ...i, unidadeDigitada: novaUnidade, quantidade: String(emEstoque) }
                            : i))
                        }}
                        className="bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 text-xs focus:outline-none">
                        {opcoesUnidade.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input
                        type="number" step="0.001" min="0"
                        value={(ing as any).quantidadeDigitada || ''}
                        placeholder={`qtd em ${unidadeDigitada}`}
                        onChange={e => {
                          const val = e.target.value
                          const emEstoque = converter(Number(val), unidadeDigitada, unidadeEstoque)
                          setIngs(prev => prev.map((i, j) => j === idx
                            ? { ...i, quantidadeDigitada: val, quantidade: String(emEstoque) }
                            : i))
                        }}
                        className="w-24 bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 text-xs focus:outline-none" />
                      {(ing as any).quantidadeDigitada && (
                        <span className="text-xs text-gray-500">
                          = {Number(ing.quantidade).toFixed(4)} {unidadeEstoque}
                        </span>
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
      <ConfirmDialog open={!!excluindo} onClose={() => setExcluindo(null)} onConfirm={() => excluir(excluindo!)} title="Desativar pizza" message="A pizza será desativada e não aparecerá mais no cardápio." danger />
    </div>
  )
}
