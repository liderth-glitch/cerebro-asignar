'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icono from '@/components/app/Icono'
import { aprobarItem } from '../acciones'

export default function BotonesAprobacion({ itemId }: { itemId: string }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [devolviendo, setDevolviendo] = useState(false)
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')

  function ejecutar(aprobar: boolean) {
    setError('')
    startTransition(async () => {
      const res = await aprobarItem(itemId, aprobar, nota)
      if (res?.error) { setError(res.error); return }
      setDevolviendo(false); setNota('')
      router.refresh()
    })
  }

  if (devolviendo) {
    return (
      <div className="vstack" style={{ gap: 8, minWidth: 260 }}>
        <input className="ca-input ca-input--sm" value={nota} onChange={e => setNota(e.target.value)}
          placeholder="¿Por qué se devuelve? (opcional)" />
        {error && <span style={{ fontSize: 12, color: 'var(--danger-ink)' }}>{error}</span>}
        <div className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
          <button className="btn btn--ghost btn--sm" disabled={pendiente}
            onClick={() => { setDevolviendo(false); setNota(''); setError('') }}>
            Cancelar
          </button>
          <button className="btn btn--primary btn--sm" disabled={pendiente} onClick={() => ejecutar(false)}>
            {pendiente ? 'Devolviendo…' : 'Confirmar devolución'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="vstack" style={{ gap: 4, alignItems: 'flex-end' }}>
      <div className="hstack" style={{ gap: 6 }}>
        <button className="btn btn--ghost btn--sm" disabled={pendiente} onClick={() => setDevolviendo(true)}>
          Devolver
        </button>
        <button className="btn btn--primary btn--sm" disabled={pendiente} onClick={() => ejecutar(true)}>
          <Icono nombre="check" className="icon icon--sm" /> {pendiente ? 'Aprobando…' : 'Aprobar'}
        </button>
      </div>
      {error && <span style={{ fontSize: 12, color: 'var(--danger-ink)' }}>{error}</span>}
    </div>
  )
}
