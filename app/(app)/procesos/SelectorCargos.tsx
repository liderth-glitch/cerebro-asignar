'use client'

import { useState } from 'react'
import Icono from '@/components/app/Icono'

export interface CargoCatalogo { id: string; nombre: string; banda: string }
export interface GestionRef { id: string; nombre: string }

export interface PasoCargo {
  cargo_id: string
  tipo: 'responsable' | 'apoyo'
  descripcion: string
  gestion_apoyo_id: string | null
}

export default function SelectorCargos({
  cargos, gestiones, seleccion, textoHeredado, gestionActualId, alCambiar,
}: {
  cargos: CargoCatalogo[]
  gestiones: GestionRef[]
  seleccion: PasoCargo[]
  /** Lo que había en el campo de texto libre, para poder homologarlo */
  textoHeredado: string
  gestionActualId: string
  alCambiar: (siguiente: PasoCargo[]) => void
}) {
  const [agregando, setAgregando] = useState<'responsable' | 'apoyo' | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const responsables = seleccion.filter(c => c.tipo === 'responsable')
  const apoyos = seleccion.filter(c => c.tipo === 'apoyo')
  const nombreCargo = (id: string) => cargos.find(c => c.id === id)?.nombre ?? 'Cargo'
  const sinHomologar = seleccion.length === 0 && textoHeredado.trim() !== ''

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const disponibles = cargos
    .filter(c => !seleccion.some(s => s.cargo_id === c.id && s.tipo === agregando))
    .filter(c => !busqueda.trim() || norm(c.nombre).includes(norm(busqueda)))
    .slice(0, 30)

  function agregar(cargoId: string) {
    if (!agregando) return
    alCambiar([...seleccion, {
      cargo_id: cargoId,
      tipo: agregando,
      descripcion: '',
      gestion_apoyo_id: agregando === 'apoyo' ? null : null,
    }])
    setBusqueda('')
    setAgregando(null)
  }

  function quitar(i: number) {
    alCambiar(seleccion.filter((_, j) => j !== i))
  }

  function actualizar(idx: number, campo: keyof PasoCargo, valor: string) {
    alCambiar(seleccion.map((c, j) => j === idx ? { ...c, [campo]: valor } : c))
  }

  function fila(c: PasoCargo, esApoyo: boolean) {
    const idx = seleccion.indexOf(c)
    return (
      <div key={`${c.tipo}-${c.cargo_id}`} style={{
        border: '1px solid var(--border)', borderRadius: 8, padding: 10,
        background: esApoyo ? 'var(--surface-sunken)' : 'transparent',
      }}>
        <div className="hstack" style={{ gap: 8, marginBottom: 6 }}>
          <strong style={{ fontSize: 12.5, flex: 1 }}>{nombreCargo(c.cargo_id)}</strong>
          <button type="button" className="btn btn--ghost btn--sm" title="Quitar"
            onClick={() => quitar(idx)}>
            <Icono nombre="x" className="icon icon--sm" />
          </button>
        </div>
        <textarea
          className="ca-textarea" style={{ minHeight: 48, fontSize: 12.5 }}
          placeholder={esApoyo
            ? 'Qué apoyo presta este cargo (ej. divulgación de la vacante en redes)…'
            : 'Qué hace, cómo lo hace, dónde y cuándo…'}
          value={c.descripcion}
          onChange={e => actualizar(idx, 'descripcion', e.target.value)}
        />
        {esApoyo && (
          <select className="ca-select ca-select--sm" style={{ marginTop: 6 }}
            value={c.gestion_apoyo_id ?? ''}
            onChange={e => actualizar(idx, 'gestion_apoyo_id', e.target.value)}>
            <option value="">¿De qué gestión viene el apoyo?</option>
            {gestiones.filter(g => g.id !== gestionActualId).map(g => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </select>
        )}
      </div>
    )
  }

  return (
    <div className="field paso-grid--full">
      <label className="field__label">Cargos de la actividad</label>

      {sinHomologar && (
        <div className="hstack" style={{
          gap: 8, padding: '7px 10px', borderRadius: 7, marginBottom: 8,
          background: 'var(--warning-soft)', border: '1px solid var(--warning)',
        }}>
          <Icono nombre="info" className="icon icon--sm" style={{ color: 'var(--warning-ink)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--warning-ink)' }}>
            Sin homologar — antes decía «{textoHeredado}». Elige el cargo del catálogo que corresponde.
          </span>
        </div>
      )}

      <div className="vstack" style={{ gap: 8 }}>
        {responsables.length > 0 && (
          <div className="vstack" style={{ gap: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>RESPONSABLES</span>
            {responsables.map(c => fila(c, false))}
          </div>
        )}

        {apoyos.length > 0 && (
          <div className="vstack" style={{ gap: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>
              CARGOS DE APOYO <span style={{ fontWeight: 400 }}>· de otra gestión</span>
            </span>
            {apoyos.map(c => fila(c, true))}
          </div>
        )}

        {agregando ? (
          <div className="paso-card" style={{ padding: 10 }}>
            <input className="ca-input ca-input--sm" autoFocus
              placeholder={`Buscar cargo ${agregando === 'apoyo' ? 'de apoyo' : 'responsable'}…`}
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {disponibles.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-3)', padding: 6 }}>
                  Ningún cargo coincide. Si falta en el catálogo, créalo en Administración.
                </span>
              )}
              {disponibles.map(c => (
                <button key={c.id} type="button" onClick={() => agregar(c.id)}
                  style={{
                    textAlign: 'left', padding: '6px 8px', borderRadius: 6, fontSize: 12.5,
                    display: 'flex', gap: 8, alignItems: 'center',
                  }}
                  className="nav-item">
                  <span style={{ flex: 1 }}>{c.nombre}</span>
                  <span className="text-mono" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{c.banda}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 6 }}
              onClick={() => { setAgregando(null); setBusqueda('') }}>Cancelar</button>
          </div>
        ) : (
          <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAgregando('responsable')}>
              <Icono nombre="plus" className="icon icon--sm" /> Cargo responsable
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAgregando('apoyo')}>
              <Icono nombre="plus" className="icon icon--sm" /> Cargo de apoyo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
