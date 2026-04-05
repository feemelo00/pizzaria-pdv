// ============================================================
// src/pages/admin/ClientesPage.tsx
// ============================================================
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientesDb, condominiosDb } from '../../lib/db'
import { Table, Modal, FormField, ConfirmDialog, Empty, LoadingPage } from '../../components/ui'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'

export function ClientesPage() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState<{open: boolean; dados?: any}>({ open: false })
  const [excluir, setExcluir] = useState<string | null>(null)
  const [form, setForm] = useState({ telefone: '', nome: '', condominio_id: '', quadra: '', lote: '', rua: '' })

  const { data: clientes = [], isLoading } = useQuery({ queryKey: ['clientes', busca], queryFn: () => clientesDb.listar(busca) })
  const { data: condominios = [] } = useQuery({ queryKey: ['condominios'], queryFn: condominiosDb.listar })

  const abrirModal = (c?: any) => {
    setForm(c ? { telefone: c.telefone, nome: c.nome, condominio_id: String(c.condominio_id), quadra: c.quadra, lote: c.lote, rua: c.rua } : { telefone: '', nome: '', condominio_id: '', quadra: '', lote: '', rua: '' })
    setModal({ open: true, dados: c })
  }

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => modal.dados
      ? clientesDb.atualizar(modal.dados.telefone, { ...form, condominio_id: Number(form.condominio_id) })
      : clientesDb.criar({ ...form, condominio_id: Number(form.condominio_id) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientes'] }); setModal({ open: false }); toast.success('Salvo!') },
    onError: (e: Error) => toast.error(e.message)
  })
  const { mutate: remover } = useMutation({
    mutationFn: (tel: string) => clientesDb.excluir(tel),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientes'] }); toast.success('Excluído') }
  })

  const f = (k: string, v: string) => setForm(x => ({ ...x, [k]: v }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <h1 className="font-semibold text-gray-100 text-sm">Clientes</h1>
        <button onClick={() => abrirModal()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5">
          <Plus size={14} /> Novo
        </button>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="relative mb-4 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone..." className="input pl-8" />
        </div>
        {isLoading ? <LoadingPage /> : !(clientes as any[]).length ? <Empty icon="👤" title="Nenhum cliente" /> : (
          <Table headers={['Telefone','Nome','Condomínio','Endereço','Ações']}>
            {(clientes as any[]).map(c => (
              <tr key={c.telefone} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 text-sm font-mono text-gray-400">{c.telefone}</td>
                <td className="px-4 py-3 text-sm text-gray-200 font-medium">{c.nome}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{c.condominio?.nome || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">Q{c.quadra} L{c.lote} · {c.rua}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => abrirModal(c)} className="btn-ghost p-1.5"><Pencil size={13} /></button>
                    <button onClick={() => setExcluir(c.telefone)} className="btn-ghost p-1.5 text-red-600 hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.dados ? 'Editar Cliente' : 'Novo Cliente'}>
        <div className="space-y-3">
          <FormField label="Telefone *"><input value={form.telefone} onChange={e => f('telefone', e.target.value)} className="input" disabled={!!modal.dados} placeholder="(00) 00000-0000" /></FormField>
          <FormField label="Nome *"><input value={form.nome} onChange={e => f('nome', e.target.value)} className="input" /></FormField>
          <FormField label="Condomínio *">
            <select value={form.condominio_id} onChange={e => f('condominio_id', e.target.value)} className="input">
              <option value="">Selecione...</option>
              {(condominios as any[]).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quadra *"><input value={form.quadra} onChange={e => f('quadra', e.target.value)} className="input" /></FormField>
            <FormField label="Lote *"><input value={form.lote} onChange={e => f('lote', e.target.value)} className="input" /></FormField>
          </div>
          <FormField label="Rua *"><input value={form.rua} onChange={e => f('rua', e.target.value)} className="input" /></FormField>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModal({ open: false })} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => salvar()} disabled={isPending} className="btn-primary flex-1">Salvar</button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!excluir} onClose={() => setExcluir(null)} onConfirm={() => remover(excluir!)}
        title="Excluir cliente" message="Tem certeza? Esta ação não pode ser desfeita." danger />
    </div>
  )
}
