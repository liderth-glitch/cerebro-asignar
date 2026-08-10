'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icono from '@/components/app/Icono'
import { agregarCompromisoPdi, actualizarCompromisoPdi, eliminarCompromisoPdi } from '../acciones'

export interface Compromiso {
  id: string
  descripcion: string
  fecha_limite: string | null
  estado: string
  observacion: string | null
  fecha_revision: string | null
}

const badgeEstado: Record<string, string> = {
  Pendiente: 'badge--neutral',
  'En curso': 'badge--warning',
  Cumplido: 'badge--success',
  Incumplido: 'badge--danger',
}
const ESTADOS = ['Pendiente', 'En curso', 'Cumplido', 'Incumplido']

export default function Compromisos({
  pdiId, compromisos, puedeAgregar, puedeSeguir, fechaLimiteDefault,
}: {
  pdiId: string
  compromisos: Compromiso[]
  /** Solo en borrador: el acta se firma con los compromisos ya acordados. */
  puedeAgregar: boolean
  /** El jefe o TH califican el cumplimiento; el colaborador no se autocalifica. */
  puedeSeguir: boolean
  fechaLimiteDefault: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fechaLimite, setFechaLimite] = useState(fechaLimiteDefault)

  function agregar() {
    if (!descripcion.trim()) { setError('Describe el compromiso'); return }
    setError('')
    startTransition(async () => {
      const res = await agregarCompromisoPdi({ pdi_id: pdiId, descripcion, fecha_limite: fechaLimite })
      if (res.error) { setError(res.error); return }
      setDescripcion(''); setFechaLimite(fechaLimiteDefault); setAbierto(false)
      router.refresh()
    })
  }

  return (
    <section className="card" style={{ padding: 22, marginBottom: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <div className="page__eyebrow" style={{ marginBottom: 4 }}>Acuerdos del colaborador</div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Compromisos individuales</h2>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-3)', maxWidth: 620 }}>
          A diferencia de las acciones de desarrollo —que son lo que la empresa ofrece—, aquí queda
          por escrito lo que el colaborador se compromete a cumplir: puntualidad, trato, conducta y
          demás acuerdos que no se resuelven con formación.
        </p>
      </div>

      {compromisos.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
          Este plan aún no tiene compromisos registrados.
        </p>
      ) : (
        <div className="vstack" style={{ gap: 10 }}>
          {compromisos.map(c => (
            <Fila key={c.id} compromiso={c} pdiId={pdiId}
              puedeSeguir={puedeSeguir} puedeEliminar={puedeAgregar} />
          ))}
        </div>
      )}

      {puedeAgregar && (
        abierto ? (
          <div className="card" style={{ padding: 16, marginTop: 12, background: 'var(--surface)' }}>
            <div className="vstack" style={{ gap: 12 }}>
              <div className="field">
                <label className="field__label">Compromiso</label>
                <textarea className="ca-textarea" rows={2} value={descripcion}
                  onChange={e => setDescripcion(e.target.value)} style={{ resize: 'vertical' }}
                  placeholder="Ej: Llegar a la hora acordada y avisar con anticipación cualquier novedad." />
                <span className="field__hint">Redáctalo como un acuerdo concreto y verificable.</span>
              </div>
              <div className="field" style={{ maxWidth: 220 }}>
                <label className="field__label">Fecha límite</label>
                <input type="date" className="ca-input" value={fechaLimite}
                  onChange={e => setFechaLimite(e.target.value)} />
              </div>
              {error && <span style={{ fontSize: 12.5, color: 'var(--danger-ink)' }}>{error}</span>}
              <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn--ghost btn--sm" disabled={pendiente}
                  onClick={() => { setAbierto(false); setError(''); setDescripcion('') }}>
                  Cancelar
                </button>
                <button type="button" className="btn btn--primary btn--sm" disabled={pendiente} onClick={agregar}>
                  {pendiente ? 'Agregando…' : 'Agregar compromiso'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 12 }}
            onClick={() => setAbierto(true)}>
            <Icono nombre="plus" className="icon icon--sm" /> Agregar compromiso
          </button>
        )
      )}
    </section>
  )
}

function Fila({ compromiso, pdiId, puedeSeguir, puedeEliminar }: {
  compromiso: Compromiso
  pdiId: string
  puedeSeguir: boolean
  puedeEliminar: boolean
}) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [estado, setEstado] = useState(compromiso.estado)
  const [observacion, setObservacion] = useState(compromiso.observacion ?? '')
  const [pendiente, startTransition] = useTransition()

  function guardar() {
    startTransition(async () => {
      const res = await actualizarCompromisoPdi({
        compromiso_id: compromiso.id, pdi_id: pdiId, estado, observacion,
      })
      if (res.error) { alert(res.error); return }
      setEditando(false)
      router.refresh()
    })
  }

  return (
    <div className="card" style={{ padding: 16, background: 'var(--surface-sunken)' }}>
      <div className="hstack" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>{compromiso.descripcion}</div>
          <div className="hstack" style={{ gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-3)' }}>
            <span className={`badge ${badgeEstado[compromiso.estado] ?? 'badge--neutral'}`}>{compromiso.estado}</span>
            {compromiso.fecha_limite && <span>Límite: {compromiso.fecha_limite}</span>}
            {compromiso.fecha_revision && <span>· Revisado {compromiso.fecha_revision}</span>}
          </div>
          {compromiso.observacion && !editando && (
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 6, whiteSpace: 'pre-wrap' }}>
              {compromiso.observacion}
            </div>
          )}

          {editando && (
            <div className="vstack" style={{ gap: 10, marginTop: 12 }}>
              <div className="hstack" style={{ gap: 10, flexWrap: 'wrap' }}>
                <select className="ca-select" value={estado} onChange={e => setEstado(e.target.value)}
                  style={{ maxWidth: 170 }}>
                  {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <textarea className="ca-textarea" rows={2} value={observacion}
                onChange={e => setObservacion(e.target.value)} style={{ resize: 'vertical' }}
                placeholder="Cómo va el cumplimiento del acuerdo…" />
              <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost btn--sm" disabled={pendiente}
                  onClick={() => { setEditando(false); setEstado(compromiso.estado); setObservacion(compromiso.observacion ?? '') }}>
                  Cancelar
                </button>
                <button className="btn btn--primary btn--sm" disabled={pendiente} onClick={guardar}>
                  {pendiente ? 'Guardando…' : 'Guardar seguimiento'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="hstack" style={{ gap: 4, flexShrink: 0 }}>
          {puedeSeguir && !editando && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditando(true)}>
              Seguimiento
            </button>
          )}
          {puedeEliminar && (
            <button type="button" className="btn btn--ghost btn--sm" title="Quitar compromiso" disabled={pendiente}
              onClick={() => {
                if (!confirm('¿Quitar este compromiso del plan?')) return
                startTransition(async () => {
                  const res = await eliminarCompromisoPdi({ compromiso_id: compromiso.id, pdi_id: pdiId })
                  if (res?.error) alert(res.error)
                  else router.refresh()
                })
              }}>
              <Icono nombre="trash" className="icon icon--sm" style={{ color: 'var(--danger-ink)' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
