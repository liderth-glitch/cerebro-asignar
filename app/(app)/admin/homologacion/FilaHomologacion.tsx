'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icono from '@/components/app/Icono'
import { homologar } from './acciones'

export interface CargoOpc { id: string; nombre: string; banda: string }
export interface TextoPendiente {
  texto: string
  veces: number
  sugerencia_id: string | null
  sugerencia_nombre: string | null
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function FilaHomologacion({ item, cargos }: { item: TextoPendiente; cargos: CargoOpc[] }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [ok, setOk] = useState<string | null>(null)
  const [modo, setModo] = useState<'cargo' | 'no_cargo'>('cargo')
  const [cargoId, setCargoId] = useState<string>(item.sugerencia_id ?? '')
  const [busqueda, setBusqueda] = useState('')
  const [nota, setNota] = useState('')

  const opciones = useMemo(() => {
    const q = norm(busqueda.trim())
    return cargos.filter(c => !q || norm(c.nombre).includes(q)).slice(0, 40)
  }, [cargos, busqueda])

  function guardar() {
    if (modo === 'cargo' && !cargoId) { setError('Elige el cargo del catálogo'); return }
    setError(''); setOk(null)
    startTransition(async () => {
      const res = await homologar(item.texto, modo === 'cargo' ? cargoId : null, modo, nota)
      if (res.error) { setError(res.error); return }
      setOk(modo === 'cargo'
        ? `Enlazado en ${res.afectados} actividad${res.afectados === 1 ? '' : 'es'}`
        : 'Marcado como no-cargo')
      router.refresh()
    })
  }

  return (
    <div className="paso-card">
      <div className="hstack" style={{ gap: 10, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 10 }}>
        <div className="hstack" style={{ gap: 8, minWidth: 0 }}>
          <Icono nombre="users" className="icon icon--sm" style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <strong style={{ fontSize: 14 }}>{item.texto}</strong>
          <span className="text-mono" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            {item.veces} activid.
          </span>
        </div>
        {item.sugerencia_nombre && modo === 'cargo' && !cargoId && (
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>coincide con el catálogo</span>
        )}
      </div>

      <div className="hstack" style={{ gap: 6, marginBottom: 10 }}>
        <button type="button" className={`btn btn--sm ${modo === 'cargo' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setModo('cargo')}>Es un cargo</button>
        <button type="button" className={`btn btn--sm ${modo === 'no_cargo' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setModo('no_cargo')}>No es un cargo</button>
      </div>

      {modo === 'cargo' ? (
        <div className="vstack" style={{ gap: 8 }}>
          <input className="ca-input ca-input--sm" placeholder="Buscar cargo del catálogo…"
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="ca-select ca-select--sm" value={cargoId} onChange={e => setCargoId(e.target.value)}>
            <option value="">Seleccionar cargo…</option>
            {opciones.map(c => <option key={c.id} value={c.id}>{c.nombre} · {c.banda}</option>)}
          </select>
        </div>
      ) : (
        <input className="ca-input ca-input--sm" placeholder="Nota (ej. cliente externo, comité, genérico)…"
          value={nota} onChange={e => setNota(e.target.value)} />
      )}

      <div className="hstack" style={{ gap: 8, marginTop: 10, alignItems: 'center' }}>
        <button type="button" className="btn btn--primary btn--sm" onClick={guardar} disabled={pendiente}>
          {pendiente ? 'Guardando…' : 'Aplicar'}
        </button>
        {error && <span style={{ fontSize: 12.5, color: 'var(--danger-ink)' }}>{error}</span>}
        {ok && <span className="hstack" style={{ gap: 4, fontSize: 12.5, color: 'var(--success-ink)' }}>
          <Icono nombre="check" className="icon icon--sm" /> {ok}
        </span>}
      </div>
    </div>
  )
}
