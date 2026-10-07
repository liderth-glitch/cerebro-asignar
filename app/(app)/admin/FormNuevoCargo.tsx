'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Icono from '@/components/app/Icono'
import { crearCargo, type CargoCreado } from './acciones-cargos'

export interface BandaRef { codigo: string; nombre: string }

/**
 * Formulario corto para crear un cargo: nombre + banda. Se usa suelto (botón en
 * organigrama y homologación) o embebido en el importador de pasos, donde el
 * nombre llega prellenado con lo que traía el Excel.
 */
export function FormNuevoCargo({ bandas, nombreInicial = '', alCrear, alCancelar }: {
  bandas: BandaRef[]
  nombreInicial?: string
  alCrear: (cargo: CargoCreado) => void
  alCancelar: () => void
}) {
  const [nombre, setNombre] = useState(nombreInicial)
  const [banda, setBanda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    setGuardando(true); setError('')
    const res = await crearCargo(nombre, banda)
    setGuardando(false)
    if (!res.ok) { setError(res.error); return }
    alCrear(res.cargo)
  }

  return (
    <div className="vstack" style={{ gap: 8 }}>
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input className="ca-input ca-input--sm" style={{ flex: '2 1 180px' }} value={nombre}
          onChange={e => setNombre(e.target.value)} placeholder="Nombre del cargo" autoFocus />
        <select className="ca-select ca-select--sm" style={{ flex: '1 1 150px' }} value={banda}
          onChange={e => setBanda(e.target.value)}>
          <option value="">Banda…</option>
          {bandas.map(b => <option key={b.codigo} value={b.codigo}>{b.codigo} · {b.nombre}</option>)}
        </select>
      </div>
      {error && <span style={{ fontSize: 12, color: 'var(--danger-ink)' }}>{error}</span>}
      <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost btn--sm" disabled={guardando} onClick={alCancelar}>
          Cancelar
        </button>
        <button type="button" className="btn btn--primary btn--sm" disabled={guardando || !nombre.trim() || !banda}
          onClick={guardar}>
          <Icono nombre="check" className="icon icon--sm" /> {guardando ? 'Creando…' : 'Crear cargo'}
        </button>
      </div>
    </div>
  )
}

/** Botón «Nuevo cargo» que despliega el formulario y refresca la página al crear. */
export default function BotonNuevoCargo({ bandas }: { bandas: BandaRef[] }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [creado, setCreado] = useState('')

  if (!abierto) {
    return (
      <div className="vstack" style={{ gap: 4, alignItems: 'flex-end' }}>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setAbierto(true); setCreado('') }}>
          <Icono nombre="plus" className="icon icon--sm" /> Nuevo cargo
        </button>
        {creado && <span style={{ fontSize: 12, color: 'var(--success-ink)' }}>Cargo «{creado}» creado.</span>}
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 14, width: 'min(100%, 440px)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Nuevo cargo</div>
      <FormNuevoCargo
        bandas={bandas}
        alCancelar={() => setAbierto(false)}
        alCrear={c => { setCreado(c.nombre); setAbierto(false); router.refresh() }}
      />
    </div>
  )
}
