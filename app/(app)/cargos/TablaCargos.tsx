'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Icono from '@/components/app/Icono'

export interface CargoFila {
  id: string
  nombre: string
  banda: string
  actividades: number
  apoyos: number
  gestiones: number
  personas: number
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function TablaCargos({ filas }: { filas: CargoFila[] }) {
  const [q, setQ] = useState('')
  const [banda, setBanda] = useState('')
  const [soloConFunciones, setSoloConFunciones] = useState(false)

  const bandas = useMemo(
    () => [...new Set(filas.map(f => f.banda).filter(Boolean))].sort(),
    [filas],
  )

  const vis = useMemo(() => {
    const qn = norm(q.trim())
    return filas.filter(f => {
      if (banda && f.banda !== banda) return false
      if (soloConFunciones && f.actividades + f.apoyos === 0) return false
      if (qn && !norm(f.nombre).includes(qn)) return false
      return true
    })
  }, [filas, q, banda, soloConFunciones])

  return (
    <>
      <div className="hstack" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="ca-input" placeholder="Buscar cargo…" value={q} onChange={e => setQ(e.target.value)}
          style={{ minWidth: 220, flex: 1, maxWidth: 320 }} />
        <select className="ca-select" value={banda} onChange={e => setBanda(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="">Todas las bandas</option>
          {bandas.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <label className="hstack" style={{ gap: 6, fontSize: 13, alignItems: 'center' }}>
          <input type="checkbox" checked={soloConFunciones} onChange={e => setSoloConFunciones(e.target.checked)} />
          Solo con funciones
        </label>
        <span style={{ fontSize: 12.5, color: 'var(--text-3)', marginLeft: 'auto', alignSelf: 'center' }}>
          {vis.length} de {filas.length}
        </span>
      </div>

      <section className="card card--table">
        <div className="table-scroll">
          <table className="table table--in-card">
            <thead>
              <tr>
                <th>Cargo</th>
                <th style={{ width: 70 }}>Banda</th>
                <th style={{ width: 100, textAlign: 'center' }}>Personas</th>
                <th style={{ width: 110, textAlign: 'center' }}>Actividades</th>
                <th style={{ width: 90, textAlign: 'center' }}>Apoyos</th>
                <th style={{ width: 90, textAlign: 'center' }}>Gestiones</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {vis.map(f => {
                const sinFunciones = f.actividades + f.apoyos === 0
                return (
                  <tr key={f.id} style={{ opacity: sinFunciones ? 0.6 : 1 }}>
                    <td><div className="row-title">{f.nombre}</div></td>
                    <td><span className="badge badge--neutral badge--no-dot">{f.banda}</span></td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {f.personas || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>
                      {f.actividades || <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)' }}>
                      {f.apoyos || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)' }}>
                      {f.gestiones || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/cargos/${f.id}`} className="btn btn--ghost btn--sm">
                        <Icono nombre="chevronRight" className="icon icon--sm" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {vis.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-3)', fontSize: 13 }}>
                  Ningún cargo coincide con los filtros.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
