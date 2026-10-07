'use client'

import { useMemo, useState } from 'react'
import Icono from '@/components/app/Icono'
import { crearClienteNavegador } from '@/lib/supabase/client'
import type { CargoCatalogo, PasoCargo } from './SelectorCargos'
import { FormNuevoCargo, type BandaRef } from '../admin/FormNuevoCargo'
import type { CargoCreado } from '../admin/acciones-cargos'
import {
  analizarFilas, claveCargo, ErrorImportacion, type Analisis, type PasoLeido,
} from '@/lib/procesos/importar-pasos'

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

/** Lo ya resuelto en el panel de homologación: sirve para sugerir. */
export interface Homologacion { texto_muestra: string; cargo_id: string | null; clase: string }

type Resolucion =
  | { modo: 'cargo'; cargo_id: string; auto: boolean }
  | { modo: 'no_cargo'; auto: boolean }
  | { modo: 'pendiente' }

interface Actor { clave: string; nombre: string; veces: number }

const NO_CARGO = '__no_cargo__'
const CREAR = '__crear__'

/** Misma normalización que usa el panel de homologación para `texto_norm`. */
const textoNorm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

function actoresDe(pasos: PasoLeido[]): Actor[] {
  const mapa = new Map<string, Actor>()
  for (const p of pasos) for (const b of p.bloques) for (const nombre of b.nombres) {
    const clave = claveCargo(nombre)
    const a = mapa.get(clave)
    if (a) a.veces++
    else mapa.set(clave, { clave, nombre, veces: 1 })
  }
  return [...mapa.values()].sort((a, b) => b.veces - a.veces)
}

/** Primero el catálogo (sin importar tilde, género ni número), luego lo ya homologado. */
function sugerir(clave: string, cargos: CargoCatalogo[], homologaciones: Homologacion[]): Resolucion {
  const delCatalogo = cargos.find(c => claveCargo(c.nombre) === clave)
  if (delCatalogo) return { modo: 'cargo', cargo_id: delCatalogo.id, auto: true }
  const h = homologaciones.find(x => claveCargo(x.texto_muestra) === clave)
  if (h?.clase === 'no_cargo') return { modo: 'no_cargo', auto: true }
  if (h?.cargo_id && cargos.some(c => c.id === h.cargo_id)) return { modo: 'cargo', cargo_id: h.cargo_id, auto: true }
  return { modo: 'pendiente' }
}

/**
 * Arma los pasos finales: cada bloque de la descripción queda en el cargo que le
 * corresponde, con su propio texto. Lo que no es un cargo (el cliente, otra
 * área) se conserva como texto de la actividad para no perder nada.
 */
function construirPasos(pasos: PasoLeido[], resolver: (clave: string) => Resolucion): PasoImportado[] {
  return pasos.map(p => {
    const cargos: PasoCargo[] = []
    const textos: string[] = p.descripcion ? [p.descripcion] : []
    for (const b of p.bloques) {
      const sinCargo: string[] = []
      for (const nombre of b.nombres) {
        const r = resolver(claveCargo(nombre))
        if (r.modo !== 'cargo') { sinCargo.push(nombre); continue }
        const ya = cargos.find(c => c.cargo_id === r.cargo_id && c.tipo === b.tipo)
        if (ya) {
          if (!ya.descripcion.includes(b.texto)) ya.descripcion = `${ya.descripcion}\n\n${b.texto}`
        } else {
          cargos.push({ cargo_id: r.cargo_id, tipo: b.tipo, descripcion: b.texto, gestion_apoyo_id: null })
        }
      }
      if (sinCargo.length > 0) textos.push(`${sinCargo.join(' / ')}: ${b.texto}`)
    }
    return {
      numero_orden: p.numero_orden,
      nombre: p.nombre,
      descripcion: textos.join('\n\n'),
      cargo_responsable: p.cargo_responsable,
      cargos,
      entradas: p.entradas,
      periodicidad: p.periodicidad,
      salidas: p.salidas,
      acuerdo_servicio: p.acuerdo_servicio,
      tiempos: p.tiempos,
      proceso_cliente: p.proceso_cliente,
    }
  })
}

export default function ImportarPasosExcel({
  onImportar, hayPasos, cargos, homologaciones, bandas, esAdmin, onCargoCreado,
}: {
  onImportar: (pasos: PasoImportado[], reemplazar: boolean) => void
  hayPasos: boolean
  cargos: CargoCatalogo[]
  homologaciones: Homologacion[]
  bandas: BandaRef[]
  esAdmin: boolean
  onCargoCreado: (cargo: CargoCreado) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [hojas, setHojas] = useState<Record<string, unknown[][]>>({})
  const [hoja, setHoja] = useState('')
  const [analisis, setAnalisis] = useState<Analisis | null>(null)
  const [elegidas, setElegidas] = useState<Record<string, Resolucion>>({})
  const [creandoPara, setCreandoPara] = useState<Actor | null>(null)
  const [reemplazar, setReemplazar] = useState(false)

  const actores = useMemo(() => (analisis ? actoresDe(analisis.pasos) : []), [analisis])
  const resolver = (clave: string): Resolucion => elegidas[clave] ?? sugerir(clave, cargos, homologaciones)
  const pendientes = actores.filter(a => resolver(a.clave).modo === 'pendiente')
  const cargosOrden = useMemo(() => [...cargos].sort((a, b) => a.nombre.localeCompare(b.nombre)), [cargos])

  function cerrar() {
    setAbierto(false); setAnalisis(null); setError(''); setReemplazar(false)
    setHojas({}); setHoja(''); setElegidas({}); setCreandoPara(null)
  }

  function analizarHoja(nombre: string, todas: Record<string, unknown[][]>) {
    setHoja(nombre); setError(''); setAnalisis(null); setElegidas({}); setCreandoPara(null)
    try {
      setAnalisis(analizarFilas(todas[nombre] ?? []))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la hoja.')
    }
  }

  async function leer(archivo: File) {
    setError(''); setAnalisis(null); setCargando(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await archivo.arrayBuffer(), { type: 'array' })
      if (wb.SheetNames.length === 0) throw new ErrorImportacion('El archivo no tiene ninguna hoja.')
      const todas: Record<string, unknown[][]> = {}
      for (const n of wb.SheetNames) {
        todas[n] = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], {
          header: 1, defval: '', blankrows: false, raw: false,
        })
      }
      setHojas(todas)
      analizarHoja(wb.SheetNames[0], todas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setCargando(false)
    }
  }

  function elegir(actor: Actor, valor: string) {
    if (valor === CREAR) { setCreandoPara(actor); return }
    setElegidas(prev => ({
      ...prev,
      [actor.clave]: !valor ? { modo: 'pendiente' }
        : valor === NO_CARGO ? { modo: 'no_cargo', auto: false }
        : { modo: 'cargo', cargo_id: valor, auto: false },
    }))
  }

  function alCrearCargo(cargo: CargoCreado) {
    onCargoCreado(cargo)
    if (creandoPara) {
      setElegidas(prev => ({ ...prev, [creandoPara.clave]: { modo: 'cargo', cargo_id: cargo.id, auto: false } }))
    }
    setCreandoPara(null)
  }

  /**
   * TH deja recordada cada equivalencia que resolvió a mano, para que el
   * próximo archivo la reconozca solo. Nunca pisa una que ya exista.
   */
  async function recordarEquivalencias() {
    if (!esAdmin) return
    const manuales = actores
      .map(a => ({ a, r: resolver(a.clave) }))
      .filter(({ r }) => r.modo !== 'pendiente' && !r.auto)
    if (manuales.length === 0) return
    const supabase = crearClienteNavegador()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('cargo_homologacion').upsert(
      manuales.map(({ a, r }) => ({
        texto_norm: textoNorm(a.nombre),
        texto_muestra: a.nombre,
        cargo_id: r.modo === 'cargo' ? r.cargo_id : null,
        clase: r.modo === 'cargo' ? 'cargo' : 'no_cargo',
        nota: 'Resuelto al importar un procedimiento desde Excel',
        resuelto_por: user?.id ?? null,
      })),
      { onConflict: 'texto_norm', ignoreDuplicates: true },
    )
  }

  async function confirmar() {
    if (!analisis || pendientes.length > 0) return
    onImportar(construirPasos(analisis.pasos, resolver), reemplazar)
    // Si falla, solo se pierde la sugerencia para la próxima vez: no bloquea la importación
    try { await recordarEquivalencias() } catch { /* sin efecto en lo importado */ }
    cerrar()
  }

  if (!abierto) {
    return (
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAbierto(true)}>
        <Icono nombre="upload" className="icon icon--sm" /> Importar desde Excel
      </button>
    )
  }

  const nombresHojas = Object.keys(hojas)
  const conBloques = analisis?.pasos.filter(p => p.bloques.length > 0).length ?? 0

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)',
      display: 'grid', placeItems: 'center', zIndex: 100, padding: 16,
    }} onClick={() => !cargando && cerrar()}>
      <div className="card" style={{
        maxWidth: 720, width: '100%', maxHeight: '88vh', overflow: 'auto', padding: 24,
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>Importar pasos desde Excel</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
          Sube el formato del procedimiento que ya trabajaste con el equipo. Cada fila con
          actividad se convierte en un paso, con el texto tal como está redactado. Si la
          descripción viene por cargo («Cargo: Responsable de… ¿Qué hace?…»), cada cargo queda
          con su propio texto.
        </p>

        {!analisis && !cargando && !nombresHojas.length && (
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

        {nombresHojas.length > 1 && (
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Hoja del archivo</label>
            <select className="ca-select ca-select--sm" value={hoja}
              onChange={e => analizarHoja(e.target.value, hojas)}>
              {nombresHojas.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="field__hint">
              El archivo trae {nombresHojas.length} hojas. Se importa una a la vez: cada hoja suele ser un procedimiento.
            </span>
          </div>
        )}

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
                {conBloques > 0 && ` · ${conBloques} con la descripción por cargo`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Hoja «{hoja}», títulos en la fila {analisis.filaTitulos}.
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

            {actores.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>
                  Cargos del archivo ({actores.length})
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-3)' }}>
                  Cada nombre se conecta con el catálogo. Los que no son un cargo (el cliente, otra
                  área) quedan como texto de la actividad.
                  {!esAdmin && ' Si falta un cargo en el catálogo, pide a Talento Humano que lo cree.'}
                </p>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                  {actores.map(a => {
                    const r = resolver(a.clave)
                    const valor = r.modo === 'cargo' ? r.cargo_id : r.modo === 'no_cargo' ? NO_CARGO : ''
                    return (
                      <div key={a.clave} style={{ padding: '8px 12px', borderBottom: '1px solid var(--divider)' }}>
                        <div className="hstack" style={{ gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{a.nombre}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                              {a.veces} {a.veces === 1 ? 'actividad' : 'actividades'}
                              {r.modo !== 'pendiente' && r.auto && ' · reconocido automáticamente'}
                            </div>
                          </div>
                          <select className="ca-select ca-select--sm" style={{
                            flex: '1 1 240px',
                            borderColor: r.modo === 'pendiente' ? 'var(--warning)' : undefined,
                          }} value={valor} onChange={e => elegir(a, e.target.value)}>
                            <option value="">Elegir…</option>
                            {cargosOrden.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            <option value={NO_CARGO}>No es un cargo (queda como texto)</option>
                            {esAdmin && <option value={CREAR}>+ Crear cargo nuevo…</option>}
                          </select>
                        </div>
                        {creandoPara?.clave === a.clave && (
                          <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'var(--surface-sunken)' }}>
                            <FormNuevoCargo bandas={bandas} nombreInicial={a.nombre}
                              alCrear={alCrearCargo} alCancelar={() => setCreandoPara(null)} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{
              maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)',
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
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                    {p.bloques.length > 0
                      ? p.bloques.map(b => b.nombres.join(' / ') + (b.tipo === 'apoyo' ? ' (apoyo)' : '')).join(' · ')
                      : `${p.descripcion.slice(0, 140)}${p.descripcion.length > 140 ? '…' : ''}`}
                  </div>
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

            <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-3)' }}>
              Los pasos quedan en el formulario para que los revises. No se guarda nada hasta que
              guardes el documento.
            </p>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-3)' }}>
              Esto importa solo las actividades. Los formatos y documentos de apoyo se adjuntan
              aparte, en <strong>«Documentos relacionados»</strong>, más abajo en esta misma página.
            </p>

            <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {pendientes.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--warning-ink)', marginRight: 'auto' }}>
                  Falta{pendientes.length === 1 ? '' : 'n'} {pendientes.length} cargo{pendientes.length === 1 ? '' : 's'} por resolver
                </span>
              )}
              <button type="button" className="btn btn--ghost"
                onClick={() => { setAnalisis(null); setHojas({}); setHoja(''); setError('') }}>
                Elegir otro archivo
              </button>
              <button type="button" className="btn btn--primary" disabled={pendientes.length > 0} onClick={confirmar}>
                <Icono nombre="check" className="icon icon--sm" />
                {reemplazar ? 'Reemplazar pasos' : 'Agregar pasos'}
              </button>
            </div>
          </>
        )}

        {!analisis && (
          <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            {nombresHojas.length > 0 && (
              <button type="button" className="btn btn--ghost" disabled={cargando}
                onClick={() => { setHojas({}); setHoja(''); setError('') }}>
                Elegir otro archivo
              </button>
            )}
            <button type="button" className="btn btn--ghost" disabled={cargando} onClick={cerrar}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
