import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

type PedidoCallback = (pedido: any, evento: 'INSERT' | 'UPDATE') => void

export function useRealtimePedidos(onPedido: PedidoCallback) {
  const cbRef = useRef(onPedido)
  cbRef.current = onPedido

  useEffect(() => {
    const channel = supabase
      .channel('pedidos-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pedidos'
      }, payload => {
        cbRef.current(payload.new, 'INSERT')
        // Alerta sonoro (usando API do navegador)
        try {
          const ctx = new AudioContext()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.setValueAtTime(880, ctx.currentTime)
          osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
          gain.gain.setValueAtTime(0.3, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
          osc.start(ctx.currentTime)
          osc.stop(ctx.currentTime + 0.4)
        } catch {}

        toast.success(
          `🍕 Novo pedido #${payload.new.id}!`,
          { duration: 8000, id: `pedido-${payload.new.id}` }
        )
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pedidos'
      }, payload => {
        cbRef.current(payload.new, 'UPDATE')
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])
}

// Hook para estoque baixo (alertas)
export function useAlertaEstoque(onAlerta: (ingrediente: any) => void) {
  const cbRef = useRef(onAlerta)
  cbRef.current = onAlerta

  useEffect(() => {
    const channel = supabase
      .channel('estoque-alerta')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ingredientes'
      }, payload => {
        const ing = payload.new
        if (Number(ing.quantidade_estoque) <= Number(ing.estoque_minimo)) {
          cbRef.current(ing)
          toast(`⚠️ Estoque baixo: ${ing.nome}`, {
            icon: '⚠️',
            style: { background: '#451a03', color: '#fed7aa', border: '1px solid #92400e' },
            duration: 10000,
            id: `estoque-${ing.id}`
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])
}
