'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icono from '@/components/app/Icono'
import { eliminarProceso } from '../acciones-eliminar'

export default function BotonEliminarProceso({
  procesoId, nombre, numPasos, numDocs,
}: {
  procesoId: string
  nombre: string
  numPasos: number
  numDocs: number
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState('')

  const confirmado = texto.trim().toLowerCase() === nombre.trim().toLowerCase()

  function borrar() {
    if (!confirmado) return
    setError('')
    startTransition(async () => {
      const res = await eliminarProceso(procesoId)
      if (res?.error) { setError(res.error); return }
      // El borrado ya ocurrió; si algún archivo quedó atrás hay que decirlo
      if (res?.aviso) alert(res.aviso)
      router.push('/gestiones')
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAbierto(true)}
        style={{ color: 'var(--danger-ink)' }}>
        <Icono nombre="trash" className="icon icon--sm" /> Eliminar
      </button>

      {abierto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'var(--overlay)',
          display: 'grid', placeItems: 'center', zIndex: 100, padding: 16,
        }} onClick={() => !pendiente && setAbierto(false)}>
          <div className="card" style={{ maxWidth: 520, width: '100%', padding: 24 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--danger-ink)' }}>
              Eliminar «{nombre}»
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--text-2)' }}>
              Esto borra el documento y todo lo que cuelga de él. <strong>No se puede deshacer</strong> y
              no queda registro en el historial.
            </p>

            <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13, color: 'var(--text-2)' }}>
              <li>{numPasos} {numPasos === 1 ? 'actividad' : 'actividades'} con sus cargos</li>
              <li>{numDocs} {numDocs === 1 ? 'archivo adjunto' : 'archivos adjuntos'}</li>
              <li>Todo el historial de versiones</li>
            </ul>

            <div className="field" style={{ marginBottom: 14 }}>
              <label className="field__label">
                Escribe el nombre del documento para confirmar
              </label>
              <input className="ca-input" value={texto} onChange={e => setTexto(e.target.value)}
                placeholder={nombre} autoFocus />
            </div>

            {error && (
              <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--danger-ink)' }}>{error}</p>
            )}

            <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost" disabled={pendiente}
                onClick={() => { setAbierto(false); setTexto(''); setError('') }}>
                Cancelar
              </button>
              <button className="btn btn--primary" disabled={!confirmado || pendiente}
                onClick={borrar}
                style={confirmado ? { background: 'var(--danger-ink)', borderColor: 'var(--danger-ink)' } : undefined}>
                {pendiente ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
