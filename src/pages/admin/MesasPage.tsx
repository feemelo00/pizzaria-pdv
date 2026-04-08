import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mesasDb } from '../../lib/db'
import { Table, Modal, FormField, ConfirmDialog, Empty, LoadingPage } from '../../components/ui'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export function MesasPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [ed, setEd] = useState<any>(null)
  const [excluindo, setExcluindo] = useState<number | null>(null)
  const [form, setForm] = useState({ nome: '' })

  const { data: mesas = [], isLoading } = useQuery({
    queryKey: ['mesas-admin'],
    queryFn: mesasDb.listar
  })

  const abrir = (item?: any) => {
    setEd(item || null)
    setForm(item ? { nome: item.nome } : { nome: '' })
    setModal(true)
  }

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => ed
      ? mesasDb.atualizar(ed.id, { nome: form.nome })
      : mesasDb.criar({ nome: form.nome }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesas-admin'] })
      qc.invalidateQueries({ queryKey: ['mesas'] })
      setModal(false)
      toast.success('Salvo!')
    },
    onError: (e: Error) => toast.error(e.message)
  })

  const { mutate: excluir } = useMutation({
    mutationFn: (id: number) => mesasDb.excluir(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesas-admin'] })
      toast.success('Mesa excluída')
    },
    onError: () => toast.error('Não é possível excluir mesa com pedidos vinculados')
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 h-12 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <h1 className="font-semibold text-gray-100 text-sm">Mesas</h1>
        <button onClick={() => abrir()} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5">
          <Plus size={14} /> Nova mesa
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {isLoading ? <LoadingPage /> : !(mesas as any[]).length ? (
          <Empty icon="🪑" title="Nenhuma mesa cadastrada" desc="Cadastre as mesas do seu estabelecimento" />
        ) : (
          <Table headers={['Mesa', 'Status', 'Ações']}>
            {(mesas as any[]).map(m => (
              <tr key={m.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-200">{m.nome}</td>
                <td className="px-4 py-3">
                  <span className={clsx('badge border', m.status === 'livre'
                    ? 'bg-green-900/40 text-green-400 border-green-800/40'
                    : 'bg-orange-900/40 text-orange-400 border-orange-800/40'
                  )}>
                    {m.status === 'livre' ? '🟢 Livre' : '🔴 Ocupada'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => abrir(m)} className="btn-ghost p-1.5">
                      <Pencil size={13} />
                    </button>
                    {m.status === 'livre' && (
                      <button onClick={() => setExcluindo(m.id)} className="btn-ghost p-1.5 text-red-600 hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={ed ? 'Editar Mesa' : 'Nova Mesa'} size="sm">
        <div className="space-y-3">
          <FormField label="Nome da mesa *">
            <input
              value={form.nome}
              onChange={e => setForm({ nome: e.target.value })}
              className="input"
              placeholder="Ex: Mesa 1, Mesa VIP, Balcão..."
              autoFocus
            />
          </FormField>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => salvar()} disabled={isPending || !form.nome} className="btn-primary flex-1">
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={() => excluir(excluindo!)}
        title="Excluir mesa"
        message="Tem certeza que deseja excluir esta mesa?"
        danger
      />
    </div>
  )
}