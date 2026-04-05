// ============================================================
// EstoquePage.tsx
// ============================================================
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ingredientesDb } from '../../lib/db'
import { Table, Modal, FormField, Empty, LoadingPage } from '../../components/ui'
import { Plus, Pencil, PackagePlus, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export function EstoquePage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [modalEntrada, setModalEntrada] = useState<any>(null)
  const [ed, setEd] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', unidade: 'g', quantidade_estoque: '0', estoque_minimo: '0', permite_adicional: false, quantidade_adicional: '', preco_adicional: '0' })
  const [entrada, setEntrada] = useState({ quantidade: '', motivo: '' })

  const { data: ingredientes = [], isLoading } = useQuery({ queryKey: ['ingredientes-admin'], queryFn: ingredientesDb.listarTodos })

  const abrir = (item?: any) => {
    setEd(item || null)
    setForm(item ? {
      nome: item.nome, unidade: item.unidade,
      quantidade_estoque: String(item.quantidade_estoque), estoque_minimo: String(item.estoque_minimo),
      permite_adicional: item.permite_adicional, quantidade_adicional: String(item.quantidade_adicional || ''),
      preco_adicional: String(item.preco_adicional || '0')
    } : { nome:'', unidade:'g', quantidade_estoque:'0', estoque_minimo:'0', permite_adicional: false, quantidade_adicional:'', preco_adicional:'0' })
    setModal(true)
  }

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const d = {
        nome: form.nome, unidade: form.unidade,
        quantidade_estoque: Number(form.quantidade_estoque), estoque_minimo: Number(form.estoque_minimo),
        permite_adicional: form.permite_adicional,
        quantidade_adicional: form.permite_adicional ? Number(form.quantidade_adicional) : null,
        preco_adicional: form.permite_adicional ? Number(form.preco_adicional) : 0,
      }
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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <h1 className="font-semibold text-gray-100 text-sm">Estoque de Ingredientes</h1>
        <button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Plus size={14}/> Novo</button>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        {isLoading ? <LoadingPage /> : !(ingredientes as any[]).length ? <Empty icon="📦" title="Nenhum ingrediente" /> : (
          <Table headers={['Nome','Unidade','Estoque','Mínimo','Adicional','Preço Adic.','Ações']}>
            {(ingredientes as any[]).map(ing => (
              <tr key={ing.id} className={clsx('hover:bg-gray-800/30 transition-colors', !ing.ativo && 'opacity-40')}>
                <td className="px-4 py-3 text-sm text-gray-200 flex items-center gap-2">
                  {baixo(ing) && <AlertTriangle size={13} className="text-yellow-500 flex-shrink-0" />}
                  {ing.nome}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{ing.unidade}</td>
                <td className={clsx('px-4 py-3 text-sm font-bold', baixo(ing) ? 'text-red-400' : 'text-green-400')}>
                  {Number(ing.quantidade_estoque).toFixed(3)}
                </td>
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
      </div>

      {/* Modal ingrediente */}
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
          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.permite_adicional} onChange={e => f('permite_adicional', e.target.checked)} className="w-4 h-4 rounded accent-pizza-500"/>
              <span className="text-sm text-gray-300">Pode ser adicional</span>
            </label>
          </div>
          {form.permite_adicional && (
            <div className="grid grid-cols-2 gap-3 pl-6 border-l-2 border-pizza-500/30">
              <FormField label="Qtd. adicional"><input type="number" step="0.001" value={form.quantidade_adicional} onChange={e => f('quantidade_adicional',e.target.value)} className="input" placeholder="Qtd por pedido"/></FormField>
              <FormField label="Preço adicional"><input type="number" step="0.01" value={form.preco_adicional} onChange={e => f('preco_adicional',e.target.value)} className="input"/></FormField>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => salvar()} disabled={isPending || !form.nome} className="btn-primary flex-1">Salvar</button>
          </div>
        </div>
      </Modal>

      {/* Modal entrada de estoque */}
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
