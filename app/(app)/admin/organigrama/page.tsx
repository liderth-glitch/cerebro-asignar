import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerSesionAdmin } from '@/lib/sesion'
import Topbar from '@/components/app/Topbar'
import Icono from '@/components/app/Icono'
import ClienteOrganigrama, { type Persona } from './ClienteOrganigrama'

function uno<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

export default async function AdminOrganigrama() {
  const sesion = await obtenerSesionAdmin()
  const supabase = await crearClienteServidor()

  const [{ data: usuariosRaw }, { data: gestiones }] = await Promise.all([
    supabase
      .from('usuarios')
      .select('id, nombre, rol, sede, jefe_id, gestion_id, cargo:cargos(nombre), gestion:gestiones(nombre)')
      .eq('activo', true)
      .order('nombre'),
    supabase.from('gestiones').select('id, nombre, lider_id').eq('activa', true).order('nombre'),
  ])

  const lideresGestion = new Set(
    (gestiones ?? []).map(g => g.lider_id).filter((x): x is string => !!x),
  )

  const personas: Persona[] = (usuariosRaw ?? []).map(u => ({
    id: u.id,
    nombre: u.nombre,
    rol: u.rol,
    sede: u.sede,
    jefe_id: u.jefe_id,
    gestion_id: u.gestion_id,
    cargo: uno(u.cargo as { nombre: string } | { nombre: string }[] | null)?.nombre ?? null,
    gestion: uno(u.gestion as { nombre: string } | { nombre: string }[] | null)?.nombre ?? null,
    es_lider_gestion: lideresGestion.has(u.id),
  }))

  const sinJefe = personas.filter(p => !p.jefe_id).length
  const sinGestion = personas.filter(p => !p.gestion_id).length
  const gestionesSinLider = (gestiones ?? []).filter(g => !g.lider_id).length

  return (
    <>
      <Topbar usuario={sesion} migas={[{ etiqueta: 'Organigrama' }]} />
      <main className="page fade-up">
        <div className="hstack" style={{ marginBottom: 22, justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="page__eyebrow">Administración</div>
            <h1 className="page__title">Organigrama</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)', maxWidth: 660 }}>
              El jefe directo de cada persona. De aquí salen las evaluaciones 360°, las firmas
              del PDI y el equipo que ve cada líder en su tablero. Una persona puede tener un
              líder nacional y otro de ciudad: lo que manda es esta cadena.
            </p>
          </div>
          <Link href="/admin/usuarios" className="btn btn--ghost btn--sm">
            <Icono nombre="users" className="icon icon--sm" /> Usuarios
          </Link>
        </div>

        <div className="grid-stats" style={{ marginBottom: 20 }}>
          <Kpi num={personas.length} label="Personas activas" />
          <Kpi num={sinJefe} label="Sin jefe directo" color={sinJefe > 1 ? 'var(--warning-ink)' : undefined} />
          <Kpi num={sinGestion} label="Sin gestión" color={sinGestion > 0 ? 'var(--warning-ink)' : undefined} />
          <Kpi num={gestionesSinLider} label="Gestiones sin líder" />
        </div>

        <ClienteOrganigrama personas={personas} />
      </main>
    </>
  )
}

function Kpi({ num, label, color }: { num: number; label: string; color?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: color ?? 'var(--text)' }}>{num}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{label}</div>
    </div>
  )
}
