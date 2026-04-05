import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Spinner } from '../components/ui'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !senha) { toast.error('Preencha email e senha'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setLoading(false)
    if (error) {
      toast.error('Email ou senha incorretos')
    } else {
      toast.success('Bem-vindo!')
      navigate('/pdv')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🍕</div>
          <h1 className="text-2xl font-bold text-gray-100">PDV Pizzaria</h1>
          <p className="text-gray-500 text-sm mt-1">Faça login para continuar</p>
        </div>

        {/* Card */}
        <form onSubmit={handleLogin} className="card p-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              className="input"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
          >
            {loading ? <Spinner size="sm" /> : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-700 mt-6">
          Sistema PDV · Versão 1.0
        </p>
      </div>
    </div>
  )
}
