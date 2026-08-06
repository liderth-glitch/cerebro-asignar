'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { enviarPdiAFirma } from '../acciones'

export function BotonEnviarAFirma({ pdiId }: { pdiId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  return (
    <button
      className="btn btn--primary"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        if (!confirm('¿Enviar este PDI a firma? Ya no podrás cambiar las acciones.')) return
        const res = await enviarPdiAFirma(pdiId)
        if (res.error) alert(res.error)
        else router.refresh()
      })}
    >
      {isPending ? 'Enviando…' : 'Enviar a firma'}
    </button>
  )
}
