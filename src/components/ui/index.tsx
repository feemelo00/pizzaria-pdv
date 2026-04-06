import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

// ============================================================
// MODAL
// ============================================================
export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string
  children: ReactNode; size?: 'sm'|'md'|'lg'|'xl'
}) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className={clsx('relative bg-gray-900 border border-gray-700 rounded-2xl w-full shadow-2xl', sizes[size])}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="font-semibold text-gray-100">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <div className="p-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ============================================================
// BADGE DE STATUS
// ============================================================
const statusConfig: Record<string, { label: string; cls: string }> = {
  solicitado: { label: 'Solicitado',  cls: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50' },
  fazendo:    { label: 'Fazendo',     cls: 'bg-orange-900/40 text-orange-400 border-orange-800/50' },
  pronto:     { label: 'Pronto',      cls: 'bg-green-900/40  text-green-400  border-green-800/50'  },
  delivery:   { label: 'Delivery',    cls: 'bg-blue-900/40   text-blue-400   border-blue-800/50'   },
  balcao:     { label: 'Balcão',      cls: 'bg-purple-900/40 text-purple-400 border-purple-800/50' },
  finalizado: { label: 'Finalizado',  cls: 'bg-gray-800      text-gray-400   border-gray-700'      },
  devolvido:  { label: 'Devolvido',   cls: 'bg-red-900/40    text-red-400    border-red-800/50'    },
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, cls: 'bg-gray-800 text-gray-400 border-gray-700' }
  return (
    <span className={clsx('badge border', cfg.cls)}>{cfg.label}</span>
  )
}

// ============================================================
// SPINNER
// ============================================================
export function Spinner({ size = 'md' }: { size?: 'sm'|'md'|'lg' }) {
  const s = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }
  return (
    <div className={clsx('animate-spin rounded-full border-2 border-gray-700 border-t-pizza-500', s[size])} />
  )
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )
}

// ============================================================
// EMPTY STATE
// ============================================================
export function Empty({ icon, title, desc }: { icon: string; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="font-medium text-gray-300">{title}</p>
      {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
    </div>
  )
}

// ============================================================
// CAMPO DE FORMULÁRIO
// ============================================================
export function FormField({ label, error, children }: {
  label: string; error?: string; children: ReactNode
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}

// ============================================================
// CONFIRM DIALOG
// ============================================================
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger = false }: {
  open: boolean; onClose: () => void; onConfirm: () => void
  title: string; message: string; danger?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-gray-400 text-sm mb-6">{message}</p>
      <div className="flex gap-2 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => { onConfirm(); onClose() }}>
          Confirmar
        </button>
      </div>
    </Modal>
  )
}

// ============================================================
// TABLE WRAPPER
// ============================================================
export function Table({ headers, children, empty }: {
  headers: string[]; children: ReactNode; empty?: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {children}
        </tbody>
      </table>
    </div>
  )
}
