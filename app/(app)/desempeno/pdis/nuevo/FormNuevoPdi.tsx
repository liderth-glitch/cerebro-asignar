'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icono from '@/components/app/Icono'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { crearPdiManual } from '../acciones'
import { ORIGENES_MANUALES, etiquetaOrigen, type OrigenPdi } from '@/lib/desempeno/origen'

const BUCKET = 'actas-pdi'
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}
function enMeses(meses: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}

export default function FormNuevoPdi({ personas }: {
  personas: { id: string; nombre: string; codigo_contrato: string | null; cargo: string | null }[]
}) {
  const router = useRouter()
  const supabase = crearClienteNavegador()
  const [pendiente, startTransition] = useTransition()
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  const [busca, setBusca] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [origen, setOrigen] = useState<OrigenPdi>('disciplinario')
  const [detalle, setDetalle] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [fechaAcuerdo, setFechaAcuerdo] = useState(hoyISO())
  const [proximaRevision, setProximaRevision] = useState(enMeses(3))

  const filtradas = useMemo(() => {
    const q = norm(busca.trim())
    return personas
      .filter(p => !q || norm(`${p.nombre} ${p.codigo_contrato ?? ''} ${p.cargo ?? ''}`).includes(q))
      .slice(0, 30)
  }, [personas, busca])

  const elegida = personas.find(p => p.id === usuarioId) ?? null

  function guardar() {
    if (!usuarioId) { setError('Elige el colaborador'); return }
    setError('')
    startTransition(async () => {
      let actaPath: string | null = null
      if (archivo) {
        setSubiendo(true)
        const ruta = `${usuarioId}/${Date.now()}-${archivo.name.replace(/[^\w.\-]/g, '_')}`
        const { error: errSub } = await supabase.storage.from(BUCKET).upload(ruta, archivo)
        setSubiendo(false)
        if (errSub) { setError(errSub.message); return }
        actaPath = ruta
      }
      const res = await crearPdiManual({
        colaborador_id: usuarioId,
        origen,
        origen_detalle: detalle,
        acta_origen_path: actaPath,
        fecha_acuerdo: fechaAcuerdo,
        proxima_revision: proximaRevision,
      })
      if (res.error) { setError(res.error); return }
      if (res.pdi_id) router.push(`/desempeno/pdis/${res.pdi_id}`)
    })
  }

  return (
    <section className="card card--padded">
      <div className="vstack" style={{ gap: 16 }}>
        {/* Colaborador */}
        <div className="field">
          <label className="field__label">Colaborador</label>
          {elegida ? (
            <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge--primary">{elegida.nombre}</span>
              {elegida.cargo && <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{elegida.cargo}</span>}
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setUsuarioId(''); setBusca('') }}>
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <input className="ca-input ca-input--sm" placeholder="Buscar por nombre, código o cargo…"
                value={busca} onChange={e => setBusca(e.target.value)} />
              {busca && (
                <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {filtradas.map(p => (
                    <button key={p.id} type="button" className="nav-item" style={{ textAlign: 'left', fontSize: 12.5 }}
                      onClick={() => { setUsuarioId(p.id); setBusca('') }}>
                      <span style={{ flex: 1 }}>{p.nombre}</span>
                      {p.cargo && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.cargo}</span>}
                    </button>
                  ))}
                  {filtradas.length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-3)', padding: 6 }}>Sin coincidencias.</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Origen */}
        <div className="field">
          <label className="field__label">Origen del plan</label>
          <select className="ca-select ca-select--sm" value={origen} onChange={e => setOrigen(e.target.value as OrigenPdi)}>
            {ORIGENES_MANUALES.map(o => (
              <option key={o} value={o}>{etiquetaOrigen[o]}</option>
            ))}
          </select>
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--text-3)' }}>
            Los PDI que nacen de una evaluación de competencias se generan desde el reporte de la evaluación.
          </p>
        </div>

        <div className="field">
          <label className="field__label">
            Detalle del origen <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(motivo, hallazgos, contexto)</span>
          </label>
          <textarea className="ca-input" rows={4} value={detalle} onChange={e => setDetalle(e.target.value)}
            placeholder="Describe la situación que da origen al plan…" style={{ resize: 'vertical', width: '100%' }} />
        </div>

        <div className="field">
          <label className="field__label">
            Acta de soporte <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional — PDF o imagen)</span>
          </label>
          <input type="file" accept=".pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5 }} />
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--text-3)' }}>
            Por ejemplo, el acta del proceso disciplinario o la evaluación de período de prueba.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <div className="field">
            <label className="field__label">Fecha de acuerdo</label>
            <input type="date" className="ca-input ca-input--sm" value={fechaAcuerdo} onChange={e => setFechaAcuerdo(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Próxima revisión</label>
            <input type="date" className="ca-input ca-input--sm" value={proximaRevision} onChange={e => setProximaRevision(e.target.value)} />
          </div>
        </div>

        {error && <span style={{ fontSize: 12.5, color: 'var(--danger-ink)' }}>{error}</span>}

        <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost btn--sm" disabled={pendiente}
            onClick={() => router.push('/desempeno/pdis')}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={guardar} disabled={pendiente}>
            <Icono nombre="plus" className="icon icon--sm" />
            {subiendo ? 'Subiendo acta…' : pendiente ? 'Creando…' : 'Crear PDI'}
          </button>
        </div>
      </div>
    </section>
  )
}
