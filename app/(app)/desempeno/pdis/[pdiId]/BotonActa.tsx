'use client'

import { useTransition } from 'react'
import Icono from '@/components/app/Icono'
import { urlActaOrigen } from '../acciones'

export default function BotonActa({ pdiId }: { pdiId: string }) {
  const [pendiente, startTransition] = useTransition()
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      disabled={pendiente}
      onClick={() => startTransition(async () => {
        const res = await urlActaOrigen(pdiId)
        if (res.error) { alert(res.error); return }
        if (res.url) window.open(res.url, '_blank', 'noopener,noreferrer')
      })}
    >
      <Icono nombre="download" className="icon icon--sm" /> {pendiente ? 'Abriendo…' : 'Ver acta'}
    </button>
  )
}
