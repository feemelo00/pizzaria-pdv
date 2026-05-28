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

async function buscarUsuario(userId: string): Promise<Usuario | null> {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('[authStore] buscarUsuario erro:', error)
      return null
    }
    return data
  } catch (err) {
    console.error('[authStore] buscarUsuario exceção:', err)
    return null
  }
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

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const usuario = await buscarUsuario(session.user.id)
        set({ usuario, loading: false })
      } else {
        set({ loading: false })
      }
    } catch (err) {
      console.error('[authStore] inicializar erro:', err)
      set({ loading: false })
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const usuario = await buscarUsuario(session.user.id)
        set({ usuario })
      } else if (event === 'SIGNED_OUT') {
        set({ usuario: null, iniciado: false })
      } else if (event === 'TOKEN_REFRESHED') {
        // Sessão renovada, mantém usuário
      }
    })
  },

  logout: async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[authStore] logout erro:', err)
    } finally {
      set({ usuario: null, iniciado: false })
    }
  }
}))
