'use client'

import { useState } from 'react'
import Icono from '@/components/app/Icono'
import type { PasoCargo } from './SelectorCargos'
import { analizarFilas, ErrorImportacion, type Analisis } from '@/lib/procesos/importar-pasos'

/** Coincide con la interfaz `Paso` del formulario del proceso. */
export interface PasoImportado {
  numero_orden: number
  nombre: string
  descripcion: string
  cargo_responsable: string
  cargos: PasoCargo[]
  entradas: string
  periodicidad: string
  salidas: string
  acuerdo_servicio: string
  tiempos: string
  proceso_cliente: string
}

export default function ImportarPasosExcel({ onImportar, hayPasos }: {
  onImportar: (pasos: PasoImportado[], reemplazar: boolean) => void
  hayPasos: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [analisis, setAnalisis] = useState<(Analisis & { hoja: string }) | null>(null)
  const [reemplazar, setReemplazar] = useState(false)

  function cerrar() {
    setAbierto(false); setAnalisis(null); setError(''); setReemplazar(false)
  }

  async function leer(archivo: File) {
    setError(''); setAnalisis(null); setCargando(true)
    try {
      const XLSX = await import('xlsx')
      const buf = await archivo.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const hoja = wb.SheetNames[0]
      if (!hoja) throw new ErrorImportacion('El archivo no tiene ninguna hoja.')

      const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hoja], {
        header: 1, defval: '', blankrows: false, raw: false,
      })
      setAnalisis({ ...analizarFilas(filas), hoja })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setCargando(false)
    }
  }

  function confirmar() {
    if (!analisis) return
    onImportar(analisis.pasos.map(p => ({ ...p, cargos: [] })), reemplazar)
    cerrar()
  }

  if (!abierto) {
    return (
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAbierto(true)}>
        <Icono nombre="upload" className="icon icon--sm" /> Importar desde Excel
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)',
      display: 'grid', placeItems: 'center', zIndex: 100, padding: 16,
    }} onClick={() => !cargando && cerrar()}>
      <div className="card" style={{
        maxWidth: 640, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 24,
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>Importar pasos desde Excel</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
          Sube el formato del procedimiento que ya trabajaste con el equipo. Cada fila con
          actividad se convierte en un paso, con el texto tal como está redactado.
        </p>

        {!analisis && !cargando && (
          <>
            <input type="file" accept=".xlsx,.xls,.csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) leer(f) }}
              style={{ fontSize: 13 }} />
            <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--text-3)' }}>
              Reconoce las columnas Actividad, Descripción, Entradas, Salidas, Periodicidad,
              Acuerdo de servicio, Cargo o proceso cliente, Tiempo y Responsable. No importa el
              orden de las columnas ni que el archivo traiga encabezado con logo arriba.
            </p>
          </>
        )}

        {cargando && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Leyendo el archivo…</p>}

        {error && (
          <div className="card" style={{
            padding: 14, marginTop: 12, borderColor: 'var(--danger)', background: 'var(--danger-soft)',
          }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--danger-ink)' }}>{error}</p>
          </div>
        )}

        {analisis && (
          <>
            <div className="card" style={{ padding: 14, marginBottom: 12, background: 'var(--surface-sunken)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                {analisis.pasos.length} {analisis.pasos.length === 1 ? 'paso encontrado' : 'pasos encontrados'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Hoja «{analisis.hoja}», títulos en la fila {analisis.filaTitulos}.
                {analisis.descartadas > 0 && ` Se omitieron ${analisis.descartadas} fila(s) sin actividad.`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>
                <strong>Columnas reconocidas:</strong>{' '}
                {analisis.reconocidas.map(r => r.titulo).join(' · ')}
              </div>
              {analisis.ignoradas.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--warning-ink)', marginTop: 4 }}>
                  <strong>Sin usar:</strong> {analisis.ignoradas.join(' · ')}
                </div>
              )}
            </div>

            <div style={{
              maxHeight: 220, overflow: 'auto', border: '1px solid var(--border)',
              borderRadius: 8, marginBottom: 14,
            }}>
              {analisis.pasos.slice(0, 8).map(p => (
                <div key={p.numero_orden} style={{ padding: '8px 12px', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ fontSize: 13 }}>
                    <span className="text-mono" style={{ color: 'var(--text-3)', marginRight: 6 }}>
                      {String(p.numero_orden).padStart(2, '0')}
                    </span>
                    {p.nombre}
                  </div>
                  {p.descripcion && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      {p.descripcion.slice(0, 140)}{p.descripcion.length > 140 ? '…' : ''}
                    </div>
                  )}
                </div>
              ))}
              {analisis.pasos.length > 8 && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-3)' }}>
                  y {analisis.pasos.length - 8} más…
                </div>
              )}
            </div>

            {hayPasos && (
              <label className="hstack" style={{ gap: 8, fontSize: 13, marginBottom: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={reemplazar} onChange={e => setReemplazar(e.target.checked)} />
                Reemplazar los pasos que ya tiene el documento (si no, se agregan al final)
              </label>
            )}

            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-3)' }}>
              Los pasos quedan en el formulario para que los revises. No se guarda nada hasta que
              guardes el documento, y los cargos de cada actividad se asignan aquí mismo.
            </p>

            <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--ghost"
                onClick={() => { setAnalisis(null); setError('') }}>
                Elegir otro archivo
              </button>
              <button type="button" className="btn btn--primary" onClick={confirmar}>
                <Icono nombre="check" className="icon icon--sm" />
                {reemplazar ? 'Reemplazar pasos' : 'Agregar pasos'}
              </button>
            </div>
          </>
        )}

        {!analisis && (
          <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" className="btn btn--ghost" disabled={cargando} onClick={cerrar}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
