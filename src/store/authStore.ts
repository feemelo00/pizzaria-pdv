import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../lib/supabase'

interface AuthStore {
  usuario: Usuario | null
  loading: boolean
  setUsuario: (u: Usuario | null) => void
  setLoading: (v: boolean) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  usuario: null,
  loading: true,
  setUsuario: (u) => set({ usuario: u }),
  setLoading: (v) => set({ loading: v }),
  logout: async () => {
    await supabase.auth.signOut()
    set({ usuario: null })
  }
}))

// Inicializa a sessão ao carregar
supabase.auth.getSession().then(async ({ data: { session } }) => {
  if (session?.user) {
    const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single()
    useAuthStore.getState().setUsuario(data)
  }
  useAuthStore.getState().setLoading(false)
})

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single()
    useAuthStore.getState().setUsuario(data)
  } else if (event === 'SIGNED_OUT') {
    useAuthStore.getState().setUsuario(null)
  }
})
