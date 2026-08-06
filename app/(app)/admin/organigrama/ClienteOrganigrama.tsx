'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icono from '@/components/app/Icono'
import { asignarJefe } from './acciones'

export interface Persona {
  id: string
  nombre: string
  cargo: string | null
  gestion: string | null
  gestion_id: string | null
  sede: string | null
  rol: string
  jefe_id: string | null
  es_lider_gestion: boolean
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface Nodo extends Persona {
  hijos: Nodo[]
  totalDescendientes: number
}

function construirArbol(personas: Persona[]): { raices: Nodo[]; porId: Map<string, Nodo> } {
  const porId = new Map<string, Nodo>()
  for (const p of personas) porId.set(p.id, { ...p, hijos: [], totalDescendientes: 0 })

  const raices: Nodo[] = []
  for (const nodo of porId.values()) {
    const padre = nodo.jefe_id ? porId.get(nodo.jefe_id) : null
    if (padre) padre.hijos.push(nodo)
    else raices.push(nodo)
  }

  // Red de seguridad: si el importador dejara un ciclo (A→B→A), esos nodos no
  // colgarían de ninguna raíz y el render recursivo no terminaría. Se corta la
  // arista que cierra el ciclo y el nodo sube a la raíz, visible y corregible.
  const alcanzados = new Set<string>()
  const marcar = (n: Nodo) => {
    if (alcanzados.has(n.id)) return
    alcanzados.add(n.id)
    n.hijos.forEach(marcar)
  }
  raices.forEach(marcar)
  for (const nodo of porId.values()) {
    if (alcanzados.has(nodo.id)) continue
    const padre = nodo.jefe_id ? porId.get(nodo.jefe_id) : null
    if (padre) padre.hijos = padre.hijos.filter(h => h.id !== nodo.id)
    raices.push(nodo)
    marcar(nodo)
  }

  const contar = (n: Nodo): number => {
    n.hijos.sort((a, b) => a.nombre.localeCompare(b.nombre))
    n.totalDescendientes = n.hijos.reduce((acc, h) => acc + 1 + contar(h), 0)
    return n.totalDescendientes
  }
  raices.forEach(contar)
  raices.sort((a, b) => b.totalDescendientes - a.totalDescendientes || a.nombre.localeCompare(b.nombre))
  return { raices, porId }
}

export default function ClienteOrganigrama({ personas }: { personas: Persona[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [gestionFiltro, setGestionFiltro] = useState('')
  const [editando, setEditando] = useState<Persona | null>(null)
  const [colapsados, setColapsados] = useState<Set<string>>(new Set())

  const { raices, porId } = useMemo(() => construirArbol(personas), [personas])

  const gestiones = useMemo(
    () => [...new Set(personas.map(p => p.gestion).filter((g): g is string => !!g))].sort(),
    [personas],
  )

  // Coincidencias de búsqueda/filtro; se muestran también sus ancestros para dar contexto
  const visibles = useMemo(() => {
    const qn = norm(q.trim())
    if (!qn && !gestionFiltro) return null // sin filtro: árbol completo
    const coincide = (p: Persona) =>
      (!gestionFiltro || p.gestion === gestionFiltro) &&
      (!qn || norm(`${p.nombre} ${p.cargo ?? ''} ${p.sede ?? ''}`).includes(qn))

    const set = new Set<string>()
    for (const p of personas) {
      if (!coincide(p)) continue
      set.add(p.id)
      let padre = p.jefe_id
      while (padre && !set.has(padre)) {
        set.add(padre)
        padre = porId.get(padre)?.jefe_id ?? null
      }
    }
    return set
  }, [personas, porId, q, gestionFiltro])

  function alternar(id: string) {
    setColapsados(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  const sinJefe = personas.filter(p => !p.jefe_id)

  return (
    <>
      <div className="hstack" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" placeholder="Buscar persona, cargo o sede…" value={q}
          onChange={e => setQ(e.target.value)} style={{ minWidth: 240, flex: 1, maxWidth: 340 }} />
        <select className="input" value={gestionFiltro} onChange={e => setGestionFiltro(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todas las gestiones</option>
          {gestiones.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        {(q || gestionFiltro) && (
          <button className="btn btn--ghost btn--sm" onClick={() => { setQ(''); setGestionFiltro('') }}>Limpiar</button>
        )}
        <span style={{ fontSize: 12.5, color: 'var(--text-3)', marginLeft: 'auto', alignSelf: 'center' }}>
          {personas.length} personas activas
        </span>
      </div>

      {sinJefe.length > 0 && (
        <section className="card" style={{ padding: 16, marginBottom: 16, borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--warning-ink)' }}>
            {sinJefe.length} {sinJefe.length === 1 ? 'persona sin jefe directo' : 'personas sin jefe directo'}
          </div>
          <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
            {sinJefe.map(p => (
              <button key={p.id} type="button" className="btn btn--ghost btn--sm" onClick={() => setEditando(p)}>
                {p.nombre} <Icono nombre="plus" className="icon icon--sm" />
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--text-3)' }}>
            La Gerencia General no debe tener jefe: es la raíz del organigrama.
          </p>
        </section>
      )}

      <section className="card" style={{ padding: 16 }}>
        {raices.map(n => (
          <Rama key={n.id} nodo={n} nivel={0} visibles={visibles}
            colapsados={colapsados} alternar={alternar} onEditar={setEditando} />
        ))}
      </section>

      {editando && (
        <ModalJefe
          persona={editando}
          personas={personas}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); router.refresh() }}
        />
      )}
    </>
  )
}

function Rama({ nodo, nivel, visibles, colapsados, alternar, onEditar }: {
  nodo: Nodo
  nivel: number
  visibles: Set<string> | null
  colapsados: Set<string>
  alternar: (id: string) => void
  onEditar: (p: Persona) => void
}) {
  if (visibles && !visibles.has(nodo.id)) return null
  const colapsado = colapsados.has(nodo.id)
  const tieneHijos = nodo.hijos.length > 0

  return (
    <div>
      <div className="hstack" style={{
        gap: 10, padding: '8px 10px', paddingLeft: 10 + nivel * 22,
        borderBottom: '1px solid var(--divider)', alignItems: 'center',
      }}>
        <button type="button" onClick={() => tieneHijos && alternar(nodo.id)}
          aria-label={tieneHijos ? (colapsado ? 'Expandir' : 'Colapsar') : undefined}
          style={{
            width: 18, height: 18, flexShrink: 0, border: 0, background: 'transparent',
            cursor: tieneHijos ? 'pointer' : 'default', color: 'var(--text-3)', padding: 0,
          }}>
          {tieneHijos && (
            <Icono nombre="chevronRight" className="icon icon--sm"
              style={{ transform: colapsado ? 'none' : 'rotate(90deg)', transition: 'transform .15s' }} />
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{nodo.nombre}</span>
            {nodo.es_lider_gestion && (
              <span className="badge badge--primary badge--no-dot" style={{ fontSize: 10.5 }}>Líder de gestión</span>
            )}
            {tieneHijos && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {nodo.hijos.length} directo{nodo.hijos.length === 1 ? '' : 's'}
                {nodo.totalDescendientes !== nodo.hijos.length && ` · ${nodo.totalDescendientes} en total`}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            {[nodo.cargo, nodo.gestion, nodo.sede].filter(Boolean).join(' · ') || 'Sin cargo ni gestión'}
          </div>
        </div>

        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEditar(nodo)}>
          Cambiar jefe
        </button>
      </div>

      {!colapsado && nodo.hijos.map(h => (
        <Rama key={h.id} nodo={h} nivel={nivel + 1} visibles={visibles}
          colapsados={colapsados} alternar={alternar} onEditar={onEditar} />
      ))}
    </div>
  )
}

function ModalJefe({ persona, personas, onCerrar, onGuardado }: {
  persona: Persona
  personas: Persona[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [q, setQ] = useState('')
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState('')

  const candidatos = useMemo(() => {
    const qn = norm(q.trim())
    return personas
      .filter(p => p.id !== persona.id)
      .filter(p => !qn || norm(`${p.nombre} ${p.cargo ?? ''} ${p.gestion ?? ''}`).includes(qn))
      .slice(0, 40)
  }, [personas, persona.id, q])

  function guardar(jefeId: string | null) {
    setError('')
    startTransition(async () => {
      const res = await asignarJefe(persona.id, jefeId)
      if (res.error) { setError(res.error); return }
      onGuardado()
    })
  }

  const jefeActual = personas.find(p => p.id === persona.jefe_id) ?? null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)',
      display: 'grid', placeItems: 'center', zIndex: 100, padding: 16,
    }} onClick={onCerrar}>
      <div className="card" style={{
        maxWidth: 520, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 22,
      }} onClick={e => e.stopPropagation()}>
        <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Jefe directo de {persona.nombre}</h3>
          <button className="btn btn--ghost btn--sm" onClick={onCerrar}>×</button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--text-3)' }}>
          Actual: <strong>{jefeActual?.nombre ?? 'sin jefe'}</strong>
        </p>

        <input className="input" placeholder="Buscar por nombre, cargo o gestión…" value={q}
          onChange={e => setQ(e.target.value)} style={{ marginBottom: 10 }} autoFocus />

        <div className="vstack" style={{ gap: 2, overflow: 'auto', flex: 1, marginBottom: 12 }}>
          {candidatos.map(c => (
            <button key={c.id} type="button" className="nav-item" style={{ textAlign: 'left' }}
              disabled={pendiente} onClick={() => guardar(c.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {[c.cargo, c.gestion, c.sede].filter(Boolean).join(' · ')}
                </div>
              </div>
            </button>
          ))}
          {candidatos.length === 0 && (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-3)', padding: 8 }}>Sin resultados.</p>
          )}
        </div>

        {error && <span style={{ fontSize: 12.5, color: 'var(--danger-ink)', marginBottom: 8 }}>{error}</span>}

        <div className="hstack" style={{ gap: 8, justifyContent: 'space-between', borderTop: '1px solid var(--divider)', paddingTop: 12 }}>
          <button className="btn btn--ghost btn--sm" disabled={pendiente || !persona.jefe_id}
            onClick={() => guardar(null)}>
            Quitar jefe
          </button>
          <button className="btn btn--ghost" onClick={onCerrar}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
