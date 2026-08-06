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
    <section className="card" style={{ padding: 22 }}>
      <div className="vstack" style={{ gap: 18 }}>
        {/* Colaborador */}
        <div className="field">
          <label className="field__label">Colaborador</label>
          {elegida ? (
            <div className="hstack" style={{
              gap: 10, padding: '10px 12px', border: '1px solid var(--border)',
              borderRadius: 8, background: 'var(--bg-2)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{elegida.nombre}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  {[elegida.cargo, elegida.codigo_contrato].filter(Boolean).join(' · ') || 'Sin cargo asignado'}
                </div>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setUsuarioId(''); setBusca('') }}>
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <input className="ca-input" placeholder="Buscar por nombre, código o cargo…"
                value={busca} onChange={e => setBusca(e.target.value)} />
              {busca.trim() && (
                <div className="vstack" style={{
                  gap: 2, maxHeight: 220, overflowY: 'auto', marginTop: 2,
                  border: '1px solid var(--border)', borderRadius: 8, padding: 4,
                }}>
                  {filtradas.map(p => (
                    <button key={p.id} type="button" className="nav-item" style={{ textAlign: 'left' }}
                      onClick={() => { setUsuarioId(p.id); setBusca('') }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
                        {(p.cargo || p.codigo_contrato) && (
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {[p.cargo, p.codigo_contrato].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                  {filtradas.length === 0 && (
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-3)', padding: 8 }}>Sin resultados.</p>
                  )}
                </div>
              )}
              <span className="field__hint">
                {personas.length} {personas.length === 1 ? 'persona disponible' : 'personas disponibles'}
              </span>
            </>
          )}
        </div>

        {/* Origen */}
        <div className="field">
          <label className="field__label">Origen del plan</label>
          <select className="ca-select" value={origen} onChange={e => setOrigen(e.target.value as OrigenPdi)}>
            {ORIGENES_MANUALES.map(o => (
              <option key={o} value={o}>{etiquetaOrigen[o]}</option>
            ))}
          </select>
          <span className="field__hint">
            Los PDI que nacen de una evaluación de competencias se generan desde el reporte de la evaluación.
          </span>
        </div>

        <div className="field">
          <label className="field__label">Detalle del origen</label>
          <textarea className="ca-textarea" rows={4} value={detalle} onChange={e => setDetalle(e.target.value)}
            placeholder="Describe la situación que da origen al plan…" style={{ resize: 'vertical' }} />
          <span className="field__hint">Motivo, hallazgos o contexto que sustenta el plan.</span>
        </div>

        <div className="field">
          <label className="field__label">Acta de soporte</label>
          <input type="file" accept=".pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5 }} />
          <span className="field__hint">
            Opcional. Por ejemplo, el acta del proceso disciplinario o la evaluación de período de prueba.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div className="field">
            <label className="field__label">Fecha de acuerdo</label>
            <input type="date" className="ca-input" value={fechaAcuerdo} onChange={e => setFechaAcuerdo(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Próxima revisión</label>
            <input type="date" className="ca-input" value={proximaRevision} onChange={e => setProximaRevision(e.target.value)} />
            <span className="field__hint">Fecha en que se evalúa el cierre del plan.</span>
          </div>
        </div>

        {error && <span style={{ fontSize: 12.5, color: 'var(--danger-ink)' }}>{error}</span>}

        <div className="hstack" style={{ gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--divider)', paddingTop: 16 }}>
          <button type="button" className="btn btn--ghost" disabled={pendiente}
            onClick={() => router.push('/desempeno/pdis')}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primary" onClick={guardar} disabled={pendiente}>
            <Icono nombre="plus" className="icon icon--sm" />
            {subiendo ? 'Subiendo acta…' : pendiente ? 'Creando…' : 'Crear PDI'}
          </button>
        </div>
      </div>
    </section>
  )
}
