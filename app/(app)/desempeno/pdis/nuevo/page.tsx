import { redirect } from 'next/navigation'
import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import Topbar from '@/components/app/Topbar'
import Icono from '@/components/app/Icono'
import FormNuevoPdi from './FormNuevoPdi'

function uno<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

export default async function PaginaNuevoPdi() {
  const sesion = await obtenerSesion()
  const esAdmin = sesion.rol === 'admin'
  const esLider = sesion.rol === 'lider'
  if (!esAdmin && !esLider) redirect('/desempeno/pdis')

  const supabase = await crearClienteServidor()

  // Admin: toda la organización. Líder: solo sus reportes directos.
  const consulta = supabase
    .from('usuarios')
    .select('id, nombre, codigo_contrato, cargo:cargos(nombre)')
    .eq('activo', true)
    .order('nombre')
  const { data: personasRaw } = esAdmin
    ? await consulta
    : await consulta.eq('jefe_id', sesion.id)

  const personas = (personasRaw ?? []).map(p => ({
    id: p.id,
    nombre: p.nombre,
    codigo_contrato: p.codigo_contrato,
    cargo: uno(p.cargo as { nombre: string } | { nombre: string }[] | null)?.nombre ?? null,
  }))

  return (
    <>
      <Topbar usuario={sesion} migas={[
        { etiqueta: 'Desempeño', href: '/desempeno' },
        { etiqueta: 'Planes de desarrollo', href: '/desempeno/pdis' },
        { etiqueta: 'Nuevo' },
      ]} />
      <main className="page fade-up">
        <div style={{ marginBottom: 20 }}>
          <Link href="/desempeno/pdis" className="btn btn--ghost btn--sm">
            <Icono nombre="chevronRight" className="icon icon--sm" style={{ transform: 'rotate(180deg)' }} /> Volver
          </Link>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div className="page__eyebrow">Plan de desarrollo</div>
          <h1 className="page__title">Nuevo PDI</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)', maxWidth: 620 }}>
            Crea un plan a partir de un proceso disciplinario, una evaluación de período de prueba u otro
            motivo. Queda registrado el origen y, si la subes, el acta que lo soporta.
          </p>
        </div>

        {personas.length === 0 ? (
          <section className="card" style={{ padding: 26, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
              No tienes colaboradores a cargo para crear un plan.
            </p>
          </section>
        ) : (
          <FormNuevoPdi personas={personas} />
        )}
      </main>
    </>
  )
}
