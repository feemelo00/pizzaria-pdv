import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ingredientesDb, bebidasDb, outrosDb } from '../../lib/db'
import { Table, Modal, FormField, Empty, LoadingPage } from '../../components/ui'
import { Plus, Pencil, PackagePlus, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { supabase } from '../../lib/supabase'

type Aba = 'ingredientes' | 'bebidas' | 'outros'

export function EstoquePage() {
  const [aba, setAba] = useState<Aba>('ingredientes')
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 h-12 border-b border-gray-800 bg-gray-900 flex items-center gap-4 flex-shrink-0">
        {(['ingredientes','bebidas','outros'] as Aba[]).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={clsx('text-sm font-medium border-b-2 py-3 transition-colors capitalize',
              aba === a ? 'border-pizza-500 text-pizza-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            )}>
            {a === 'ingredientes' ? '🧀 Ingredientes' : a === 'bebidas' ? '🥤 Bebidas' : '🍟 Outros'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {aba === 'ingredientes' && <TabIngredientes />}
        {aba === 'bebidas' && <TabEstoqueBebidas />}
        {aba === 'outros' && <TabEstoqueOutros />}
      </div>
    </div>
  )
}

function TabIngredientes() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [modalEntrada, setModalEntrada] = useState<any>(null)
  const [ed, setEd] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', unidade: 'g', quantidade_estoque: '0', estoque_minimo: '0', permite_adicional: false, quantidade_adicional: '', quantidade_adicional_exibida: '', unidade_adicional: '', preco_adicional: '0' })
  const [entrada, setEntrada] = useState({ quantidade: '', motivo: '' })

  const { data: ingredientes = [], isLoading } = useQuery({ queryKey: ['ingredientes-admin'], queryFn: ingredientesDb.listarTodos })

  const abrir = (item?: any) => {
    setEd(item || null)
    setForm(item ? {
      nome: item.nome, unidade: item.unidade,
      quantidade_estoque: String(item.quantidade_estoque), estoque_minimo: String(item.estoque_minimo),
      permite_adicional: item.permite_adicional, quantidade_adicional: String(item.quantidade_adicional || ''),
      quantidade_adicional_exibida: String(item.quantidade_adicional || ''), unidade_adicional: item.unidade,
      preco_adicional: String(item.preco_adicional || '0')
    } : { nome:'', unidade:'g', quantidade_estoque:'0', estoque_minimo:'0', permite_adicional: false, quantidade_adicional:'', quantidade_adicional_exibida:'', unidade_adicional:'', preco_adicional:'0' })
    setModal(true)
  }

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const d = { nome: form.nome, unidade: form.unidade, quantidade_estoque: Number(form.quantidade_estoque), estoque_minimo: Number(form.estoque_minimo), permite_adicional: form.permite_adicional, quantidade_adicional: form.permite_adicional ? Number(form.quantidade_adicional) : null, preco_adicional: form.permite_adicional ? Number(form.preco_adicional) : 0 }
      return ed ? ingredientesDb.atualizar(ed.id, d) : ingredientesDb.criar(d)
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:['ingredientes-admin']}); qc.invalidateQueries({queryKey:['ingredientes']}); setModal(false); toast.success('Salvo!') },
    onError: (e: Error) => toast.error(e.message)
  })

  const { mutate: fazerEntrada, isPending: entrando } = useMutation({
    mutationFn: () => ingredientesDb.entradaEstoque(modalEntrada.id, Number(entrada.quantidade), entrada.motivo || 'Entrada manual'),
    onSuccess: () => { qc.invalidateQueries({queryKey:['ingredientes-admin']}); setModalEntrada(null); setEntrada({quantidade:'',motivo:''}); toast.success('Estoque atualizado!') },
    onError: (e: Error) => toast.error(e.message)
  })

  const f = (k: string, v: any) => setForm(x => ({ ...x, [k]: v }))
  const baixo = (item: any) => Number(item.quantidade_estoque) <= Number(item.estoque_minimo)

  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        <button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Novo ingrediente</button>
      </div>
      {isLoading ? <LoadingPage /> : !(ingredientes as any[]).length ? <Empty icon="📦" title="Nenhum ingrediente" /> : (
        <Table headers={['Nome','Unidade','Estoque','Mínimo','Adicional','Preço Adic.','Ações']}>
          {(ingredientes as any[]).map(ing => (
            <tr key={ing.id} className={clsx('hover:bg-gray-800/30', !ing.ativo && 'opacity-40')}>
              <td className="px-4 py-3 text-sm text-gray-200 flex items-center gap-2">
                {baixo(ing) && <AlertTriangle size={13} className="text-yellow-500 flex-shrink-0" />}
                {ing.nome}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{ing.unidade}</td>
              <td className={clsx('px-4 py-3 text-sm font-bold', baixo(ing) ? 'text-red-400' : 'text-green-400')}>{Number(ing.quantidade_estoque).toFixed(3)}</td>
              <td className="px-4 py-3 text-xs text-gray-600">{Number(ing.estoque_minimo).toFixed(3)}</td>
              <td className="px-4 py-3">{ing.permite_adicional ? <span className="badge bg-pizza-900/40 text-pizza-400">Sim</span> : <span className="text-gray-700 text-xs">Não</span>}</td>
              <td className="px-4 py-3 text-xs text-gray-500">{ing.permite_adicional ? `R$ ${Number(ing.preco_adicional).toFixed(2)}` : '—'}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button onClick={() => { setModalEntrada(ing); setEntrada({quantidade:'',motivo:''}) }} className="btn-ghost p-1.5 text-green-600 hover:text-green-400" title="Entrada de estoque"><PackagePlus size={13}/></button>
                  <button onClick={() => abrir(ing)} className="btn-ghost p-1.5"><Pencil size={13}/></button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={ed ? 'Editar Ingrediente' : 'Novo Ingrediente'} size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nome *"><input value={form.nome} onChange={e => f('nome',e.target.value)} className="input"/></FormField>
            <FormField label="Unidade">
              <select value={form.unidade} onChange={e => f('unidade',e.target.value)} className="input">
                {['g','kg','ml','l','unidade'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Qtd. em estoque"><input type="number" step="0.001" value={form.quantidade_estoque} onChange={e => f('quantidade_estoque',e.target.value)} className="input"/></FormField>
            <FormField label="Estoque mínimo"><input type="number" step="0.001" value={form.estoque_minimo} onChange={e => f('estoque_minimo',e.target.value)} className="input"/></FormField>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.permite_adicional} onChange={e => f('permite_adicional', e.target.checked)} className="w-4 h-4 rounded accent-pizza-500"/>
              <span className="text-sm text-gray-300">Pode ser adicional</span>
            </label>
          </div>
          {form.permite_adicional && (
            <div className="pl-6 border-l-2 border-pizza-500/30 space-y-3">
              <div className="p-2.5 bg-gray-800/60 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">Estoque em: <strong className="text-pizza-400">{form.unidade}</strong></p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Unidade do adicional">
                    <select value={form.unidade_adicional || form.unidade} onChange={e => f('unidade_adicional', e.target.value)} className="input">
                      {form.unidade === 'kg' || form.unidade === 'g' ? <><option value="g">g (gramas)</option><option value="kg">kg (quilos)</option></> : form.unidade === 'l' || form.unidade === 'ml' ? <><option value="ml">ml</option><option value="l">l</option></> : <option value={form.unidade}>{form.unidade}</option>}
                    </select>
                  </FormField>
                  <FormField label={`Quantidade por pedido (${form.unidade_adicional || form.unidade})`}>
                    <input type="number" step="0.001" min="0" value={form.quantidade_adicional_exibida || ''}
                      onChange={e => {
                        const val = e.target.value
                        const ud = form.unidade_adicional || form.unidade
                        const ue = form.unidade
                        let em = Number(val)
                        if (ud === 'g' && ue === 'kg') em = Number(val) / 1000
                        if (ud === 'kg' && ue === 'g') em = Number(val) * 1000
                        if (ud === 'ml' && ue === 'l') em = Number(val) / 1000
                        if (ud === 'l' && ue === 'ml') em = Number(val) * 1000
                        f('quantidade_adicional_exibida', val)
                        f('quantidade_adicional', String(em))
                      }} className="input" />
                  </FormField>
                </div>
                {form.quantidade_adicional_exibida && <p className="text-xs text-gray-500 mt-1">= <strong className="text-gray-300">{Number(form.quantidade_adicional).toFixed(4)} {form.unidade}</strong> baixados do estoque</p>}
              </div>
              <FormField label="Preço cobrado por adicional (R$)">
                <input type="number" step="0.01" value={form.preco_adicional} onChange={e => f('preco_adicional',e.target.value)} className="input" placeholder="0.00"/>
              </FormField>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => salvar()} disabled={isPending || !form.nome} className="btn-primary flex-1">Salvar</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!modalEntrada} onClose={() => setModalEntrada(null)} title={`Entrada: ${modalEntrada?.nome}`} size="sm">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Estoque atual: <strong className="text-gray-300">{Number(modalEntrada?.quantidade_estoque || 0).toFixed(3)} {modalEntrada?.unidade}</strong></p>
          <FormField label={`Quantidade a adicionar (${modalEntrada?.unidade})`}>
            <input type="number" step="0.001" value={entrada.quantidade} onChange={e => setEntrada(x => ({...x, quantidade: e.target.value}))} className="input" autoFocus />
          </FormField>
          <FormField label="Motivo (opcional)">
            <input value={entrada.motivo} onChange={e => setEntrada(x => ({...x, motivo: e.target.value}))} className="input" placeholder="Ex: Compra semanal"/>
          </FormField>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModalEntrada(null)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => fazerEntrada()} disabled={entrando || !entrada.quantidade || Number(entrada.quantidade) <= 0} className="btn-primary flex-1">Confirmar Entrada</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function TabEstoqueBebidas() {
  const qc = useQueryClient()
  const [modalEntrada, setModalEntrada] = useState<any>(null)
  const [entrada, setEntrada] = useState({ quantidade: '', motivo: '' })

  const { data: bebidas = [], isLoading } = useQuery({ queryKey: ['bebidas-estoque'], queryFn: () => bebidasDb.listar() })

  const { mutate: fazerEntrada, isPending } = useMutation({
    mutationFn: async () => {
      const nova = Number(modalEntrada.quantidade_estoque) + Number(entrada.quantidade)
      await supabase.from('bebidas').update({ quantidade_estoque: nova }).eq('id', modalEntrada.id)
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:['bebidas-estoque']}); qc.invalidateQueries({queryKey:['bebidas-disp']}); setModalEntrada(null); setEntrada({quantidade:'',motivo:''}); toast.success('Estoque atualizado!') },
    onError: (e: Error) => toast.error(e.message)
  })

  return (
    <div className="p-4">
      {isLoading ? <LoadingPage /> : !(bebidas as any[]).length ? <Empty icon="🥤" title="Nenhuma bebida cadastrada" desc="Cadastre bebidas na aba Cardápio" /> : (
        <Table headers={['Nome','Tamanho','Preço','Estoque atual','Ações']}>
          {(bebidas as any[]).map(b => (
            <tr key={b.id} className="hover:bg-gray-800/30">
              <td className="px-4 py-3 text-sm text-gray-200">{b.nome}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{b.tamanho || '—'}</td>
              <td className="px-4 py-3 text-sm text-pizza-400">R$ {Number(b.preco).toFixed(2)}</td>
              <td className={clsx('px-4 py-3 text-sm font-bold', Number(b.quantidade_estoque) <= 0 ? 'text-red-400' : Number(b.quantidade_estoque) <= 5 ? 'text-yellow-400' : 'text-green-400')}>
                {Number(b.quantidade_estoque)} un
                {Number(b.quantidade_estoque) <= 5 && Number(b.quantidade_estoque) > 0 && <span className="ml-1 text-xs text-yellow-500">⚠️ baixo</span>}
                {Number(b.quantidade_estoque) <= 0 && <span className="ml-1 text-xs text-red-500">sem estoque</span>}
              </td>
              <td className="px-4 py-3">
                <button onClick={() => { setModalEntrada(b); setEntrada({quantidade:'',motivo:''}) }}
                  className="btn-ghost p-1.5 text-green-600 hover:text-green-400" title="Entrada de estoque">
                  <PackagePlus size={13}/>
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={!!modalEntrada} onClose={() => setModalEntrada(null)} title={`Entrada: ${modalEntrada?.nome}`} size="sm">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Estoque atual: <strong className="text-gray-300">{modalEntrada?.quantidade_estoque} unidades</strong></p>
          <FormField label="Quantidade a adicionar (unidades)">
            <input type="number" step="1" min="1" value={entrada.quantidade} onChange={e => setEntrada(x => ({...x, quantidade: e.target.value}))} className="input" autoFocus />
          </FormField>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModalEntrada(null)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => fazerEntrada()} disabled={isPending || !entrada.quantidade} className="btn-primary flex-1">Confirmar</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function TabEstoqueOutros() {
  const qc = useQueryClient()
  const [modalEntrada, setModalEntrada] = useState<any>(null)
  const [entrada, setEntrada] = useState({ quantidade: '' })

  const { data: outros = [], isLoading } = useQuery({ queryKey: ['outros-estoque'], queryFn: () => outrosDb.listar() })

  const { mutate: fazerEntrada, isPending } = useMutation({
    mutationFn: async () => {
      const nova = Number(modalEntrada.quantidade_estoque) + Number(entrada.quantidade)
      await supabase.from('outros_produtos').update({ quantidade_estoque: nova }).eq('id', modalEntrada.id)
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:['outros-estoque']}); qc.invalidateQueries({queryKey:['outros-disp']}); setModalEntrada(null); setEntrada({quantidade:''}); toast.success('Estoque atualizado!') },
    onError: (e: Error) => toast.error(e.message)
  })

  return (
    <div className="p-4">
      {isLoading ? <LoadingPage /> : !(outros as any[]).length ? <Empty icon="🍟" title="Nenhum item cadastrado" desc="Cadastre itens na aba Cardápio" /> : (
        <Table headers={['Nome','Tamanho','Preço','Estoque atual','Ações']}>
          {(outros as any[]).map(o => (
            <tr key={o.id} className="hover:bg-gray-800/30">
              <td className="px-4 py-3 text-sm text-gray-200">{o.nome}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{o.tamanho || '—'}</td>
              <td className="px-4 py-3 text-sm text-pizza-400">R$ {Number(o.preco).toFixed(2)}</td>
              <td className={clsx('px-4 py-3 text-sm font-bold', Number(o.quantidade_estoque) <= 0 ? 'text-red-400' : 'text-green-400')}>
                {Number(o.quantidade_estoque)} un
                {Number(o.quantidade_estoque) <= 0 && <span className="ml-1 text-xs text-red-500">sem estoque</span>}
              </td>
              <td className="px-4 py-3">
                <button onClick={() => { setModalEntrada(o); setEntrada({quantidade:''}) }}
                  className="btn-ghost p-1.5 text-green-600 hover:text-green-400">
                  <PackagePlus size={13}/>
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={!!modalEntrada} onClose={() => setModalEntrada(null)} title={`Entrada: ${modalEntrada?.nome}`} size="sm">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Estoque atual: <strong className="text-gray-300">{modalEntrada?.quantidade_estoque} unidades</strong></p>
          <FormField label="Quantidade a adicionar">
            <input type="number" step="1" min="1" value={entrada.quantidade} onChange={e => setEntrada({quantidade: e.target.value})} className="input" autoFocus />
          </FormField>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModalEntrada(null)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => fazerEntrada()} disabled={isPending || !entrada.quantidade} className="btn-primary flex-1">Confirmar</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
