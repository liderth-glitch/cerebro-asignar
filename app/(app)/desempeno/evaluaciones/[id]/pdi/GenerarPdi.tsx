'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generarPdiDesdeReporte } from '@/app/(app)/desempeno/pdis/acciones'

export default function GenerarPdi({ evaluacionId }: { evaluacionId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  return (
    <button
      className="btn btn--primary"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        const res = await generarPdiDesdeReporte(evaluacionId)
        if (res.error) { alert(res.error); return }
        if (res.pdi_id) router.push(`/desempeno/pdis/${res.pdi_id}`)
        else router.refresh()
      })}
    >
      {isPending ? 'Generando…' : 'Generar PDI desde TOP 3'}
    </button>
  )
}
