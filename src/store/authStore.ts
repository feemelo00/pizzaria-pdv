import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../lib/supabase'

interface AuthStore {
  usuario: Usuario | null
  loading: boolean
  iniciado: boolean
  setUsuario: (u: Usuario | null) => void
  setLoading: (v: boolean) => void
  inicializar: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  usuario: null,
  loading: true,
  iniciado: false,

  setUsuario: (u) => set({ usuario: u }),
  setLoading: (v) => set({ loading: v }),

  inicializar: async () => {
    if (get().iniciado) return
    set({ iniciado: true })

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', session.user.id)
        .single()
      set({ usuario: data, loading: false })
    } else {
      set({ loading: false })
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', session.user.id)
          .single()
        set({ usuario: data })
      } else if (event === 'SIGNED_OUT') {
        set({ usuario: null, iniciado: false })
      }
    })
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ usuario: null, iniciado: false })
  }
}))