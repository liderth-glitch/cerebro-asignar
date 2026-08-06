'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icono from '@/components/app/Icono'
import { guardarObjetivosPdi } from '../acciones'

export default function EditorObjetivos({
  pdiId, objetivoGeneral, objetivosSmart, editable,
}: {
  pdiId: string
  objetivoGeneral: string | null
  objetivosSmart: string | null
  editable: boolean
}) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [general, setGeneral] = useState(objetivoGeneral ?? '')
  const [smart, setSmart] = useState(objetivosSmart ?? '')
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState('')

  const lineasSmart = (objetivosSmart ?? '').split('\n').map(l => l.trim()).filter(Boolean)

  function guardar() {
    setError('')
    startTransition(async () => {
      const res = await guardarObjetivosPdi({
        pdiId, objetivoGeneral: general, objetivosSmart: smart,
      })
      if (res.error) { setError(res.error); return }
      setEditando(false)
      router.refresh()
    })
  }

  return (
    <section className="card" style={{ padding: 20, marginBottom: 18 }}>
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <div className="page__eyebrow" style={{ marginBottom: 4 }}>Objetivos</div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Objetivo general y metas SMART</h2>
        </div>
        {editable && !editando && (
          <button className="btn btn--ghost btn--sm" onClick={() => setEditando(true)}>
            <Icono nombre="edit" className="icon icon--sm" /> Editar
          </button>
        )}
      </div>

      {editando ? (
        <div className="vstack" style={{ gap: 14 }}>
          <div className="field">
            <label className="field__label">Objetivo general <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional — si lo dejas vacío, el acta lo genera desde las brechas)</span></label>
            <textarea className="ca-input" rows={3} value={general} onChange={e => setGeneral(e.target.value)}
              placeholder="Fortalecer las competencias de…" style={{ resize: 'vertical', width: '100%' }} />
          </div>
          <div className="field">
            <label className="field__label">Objetivos SMART <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(uno por línea)</span></label>
            <textarea className="ca-input" rows={5} value={smart} onChange={e => setSmart(e.target.value)}
              placeholder={'Lograr en 90 días un cumplimiento mínimo del 95% de las actividades asignadas.\nMantener actualizado el 100% de las vacantes diariamente.'}
              style={{ resize: 'vertical', width: '100%' }} />
          </div>
          {error && <span style={{ fontSize: 12.5, color: 'var(--danger-ink)' }}>{error}</span>}
          <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn--ghost btn--sm" disabled={pendiente}
              onClick={() => { setEditando(false); setGeneral(objetivoGeneral ?? ''); setSmart(objetivosSmart ?? ''); setError('') }}>
              Cancelar
            </button>
            <button className="btn btn--primary btn--sm" disabled={pendiente} onClick={guardar}>
              {pendiente ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="vstack" style={{ gap: 12 }}>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Objetivo general</div>
            {objetivoGeneral
              ? <p style={{ margin: 0, fontSize: 13.5 }}>{objetivoGeneral}</p>
              : <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>Sin definir — el acta lo genera automáticamente desde las competencias con brecha.</p>}
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Objetivos SMART</div>
            {lineasSmart.length > 0
              ? <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {lineasSmart.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              : <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
                  {editable ? 'Aún no se han definido objetivos SMART. Usa "Editar" para agregarlos.' : 'Por definir con el líder.'}
                </p>}
          </div>
        </div>
      )}
    </section>
  )
}
