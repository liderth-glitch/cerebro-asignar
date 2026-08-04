'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icono from '@/components/app/Icono'
import { agregarAccionPdi, eliminarAccionPdi } from './acciones'

interface CatalogoItem {
  id: string
  nombre: string
  competencia: string
  tipo: string
}

export function BotonBorrarAccion({ pdiAccionId, evaluacionId }: { pdiAccionId: string; evaluacionId: string }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      title="Quitar acción"
      disabled={pendiente}
      onClick={() => {
        if (!confirm('¿Quitar esta acción del plan?')) return
        startTransition(async () => {
          const res = await eliminarAccionPdi({ pdi_accion_id: pdiAccionId, evaluacion_id: evaluacionId })
          if (res?.error) alert(res.error)
          else router.refresh()
        })
      }}
    >
      <Icono nombre="trash" className="icon icon--sm" style={{ color: 'var(--danger-ink)' }} />
    </button>
  )
}

export function AgregarAccion({
  pdiId, evaluacionId, catalogo, fechaInicioDefault, fechaFinDefault,
}: {
  pdiId: string
  evaluacionId: string
  catalogo: CatalogoItem[]
  fechaInicioDefault: string
  fechaFinDefault: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [modo, setModo] = useState<'catalogo' | 'manual'>('catalogo')
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [accionId, setAccionId] = useState('')
  const [accionLibre, setAccionLibre] = useState('')
  const [competenciaLibre, setCompetenciaLibre] = useState('')
  const [tipoLibre, setTipoLibre] = useState('')
  const [fechaInicio, setFechaInicio] = useState(fechaInicioDefault)
  const [fechaFin, setFechaFin] = useState(fechaFinDefault)
  const [responsable, setResponsable] = useState('Jefe directo')

  const catalogoOrdenado = useMemo(
    () => [...catalogo].sort((a, b) => a.competencia.localeCompare(b.competencia) || a.nombre.localeCompare(b.nombre)),
    [catalogo],
  )

  function limpiar() {
    setModo('catalogo'); setAccionId(''); setAccionLibre(''); setCompetenciaLibre(''); setTipoLibre('')
    setFechaInicio(fechaInicioDefault); setFechaFin(fechaFinDefault); setResponsable('Jefe directo')
    setError(''); setAbierto(false)
  }

  function guardar() {
    if (modo === 'catalogo' && !accionId) { setError('Elige una acción del catálogo'); return }
    if (modo === 'manual' && !accionLibre.trim()) { setError('Describe la acción de desarrollo'); return }
    setError('')
    startTransition(async () => {
      const res = await agregarAccionPdi({
        pdi_id: pdiId,
        evaluacion_id: evaluacionId,
        accion_id: modo === 'catalogo' ? accionId : null,
        accion_libre: modo === 'manual' ? accionLibre : undefined,
        competencia_libre: modo === 'manual' ? competenciaLibre : undefined,
        tipo_libre: modo === 'manual' ? tipoLibre : undefined,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        responsable_seguimiento: responsable,
      })
      if (res?.error) { setError(res.error); return }
      limpiar()
      router.refresh()
    })
  }

  if (!abierto) {
    return (
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAbierto(true)} style={{ marginTop: 12 }}>
        <Icono nombre="plus" className="icon icon--sm" /> Agregar acción
      </button>
    )
  }

  return (
    <section className="card" style={{ padding: 16, marginTop: 12, background: 'var(--surface)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14.5, fontWeight: 700 }}>Agregar acción de desarrollo</h3>

      <div className="hstack" style={{ gap: 6, marginBottom: 12 }}>
        <button type="button" className={`btn btn--sm ${modo === 'catalogo' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setModo('catalogo')}>
          Del catálogo
        </button>
        <button type="button" className={`btn btn--sm ${modo === 'manual' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setModo('manual')}>
          Manual
        </button>
      </div>

      <div className="vstack" style={{ gap: 12 }}>
        {modo === 'catalogo' ? (
          <div className="field">
            <label className="field__label">Acción del catálogo</label>
            <select className="ca-select ca-select--sm" value={accionId} onChange={e => setAccionId(e.target.value)}>
              <option value="">Seleccionar…</option>
              {catalogoOrdenado.map(c => (
                <option key={c.id} value={c.id}>{c.competencia} · {c.nombre} ({c.tipo})</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="field">
              <label className="field__label">Acción de desarrollo</label>
              <textarea className="ca-input" rows={2} value={accionLibre} onChange={e => setAccionLibre(e.target.value)}
                placeholder="Describe la acción, compromiso o actividad…" style={{ resize: 'vertical', width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <div className="field">
                <label className="field__label">Competencia (opcional)</label>
                <input className="ca-input ca-input--sm" value={competenciaLibre} onChange={e => setCompetenciaLibre(e.target.value)}
                  placeholder="Ej. Comunicación efectiva" />
              </div>
              <div className="field">
                <label className="field__label">Tipo (opcional)</label>
                <input className="ca-input ca-input--sm" value={tipoLibre} onChange={e => setTipoLibre(e.target.value)}
                  placeholder="Lectura, Curso, Mentoría…" />
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <div className="field">
            <label className="field__label">Inicio</label>
            <input type="date" className="ca-input ca-input--sm" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Fin</label>
            <input type="date" className="ca-input ca-input--sm" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Responsable</label>
            <input className="ca-input ca-input--sm" value={responsable} onChange={e => setResponsable(e.target.value)}
              placeholder="Jefe directo" />
          </div>
        </div>

        {error && <span style={{ fontSize: 12.5, color: 'var(--danger-ink)' }}>{error}</span>}
        <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={limpiar} disabled={pendiente}>Cancelar</button>
          <button type="button" className="btn btn--primary btn--sm" onClick={guardar} disabled={pendiente}>
            {pendiente ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
      </div>
    </section>
  )
}
