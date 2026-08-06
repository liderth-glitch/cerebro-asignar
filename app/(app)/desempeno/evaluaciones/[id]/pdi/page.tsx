import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import Topbar from '@/components/app/Topbar'
import Icono from '@/components/app/Icono'
import GenerarPdi from './GenerarPdi'

/**
 * Puente desde la evaluación hacia el PDI.
 * El PDI vive en /desempeno/pdis/[pdiId] porque ya no depende de una evaluación
 * (también nace de disciplinarios, período de prueba u otros motivos).
 */
export default async function PaginaPdiDesdeEvaluacion({ params }: { params: Promise<{ id: string }> }) {
  const { id: evaluacionId } = await params
  const sesion = await obtenerSesion()
  const supabase = await crearClienteServidor()

  const { data: evaluacion } = await supabase
    .from('evaluaciones').select('id, ciclo_id, colaborador_id').eq('id', evaluacionId).single()
  if (!evaluacion) notFound()

  const { data: colaborador } = await supabase
    .from('usuarios').select('id, nombre, jefe_id').eq('id', evaluacion.colaborador_id).single()
  if (!colaborador) notFound()

  const esAdmin = sesion.rol === 'admin'
  const esElColaborador = sesion.id === colaborador.id
  const esJefeDirecto = sesion.id === colaborador.jefe_id
  if (!esAdmin && !esElColaborador && !esJefeDirecto) redirect('/desempeno')

  // Si el PDI ya existe, la ruta canónica es la del PDI
  const { data: pdi } = await supabase
    .from('pdi').select('id').eq('evaluacion_id', evaluacionId).maybeSingle()
  if (pdi) redirect(`/desempeno/pdis/${pdi.id}`)

  const { data: ciclo } = await supabase
    .from('ciclos_evaluacion').select('id, nombre').eq('id', evaluacion.ciclo_id).single()

  return (
    <>
      <Topbar usuario={sesion} migas={[
        { etiqueta: 'Desempeño', href: '/desempeno' },
        { etiqueta: 'Ciclos', href: '/desempeno/ciclos' },
        { etiqueta: ciclo?.nombre ?? '', href: `/desempeno/ciclos/${ciclo?.id}` },
        { etiqueta: 'PDI' },
      ]} />
      <main className="page fade-up">
        <div style={{ marginBottom: 20 }}>
          <Link href={`/desempeno/evaluaciones/${evaluacionId}/reporte`} className="btn btn--ghost btn--sm">
            <Icono nombre="chevronRight" className="icon icon--sm" style={{ transform: 'rotate(180deg)' }} /> Volver al reporte
          </Link>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div className="page__eyebrow">Plan de Desarrollo Individual · {ciclo?.nombre}</div>
          <h1 className="page__title">{colaborador.nombre}</h1>
        </div>

        <section className="card" style={{ padding: 26, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>Aún no hay PDI para esta evaluación</h2>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-3)', maxWidth: 480, marginInline: 'auto' }}>
            Se generará un borrador con las 3 acciones recomendadas por el motor de cálculo (TOP 3).
            Luego podrás cambiar, agregar o quitar acciones antes de enviar a firma.
          </p>
          {(esAdmin || esJefeDirecto) ? (
            <GenerarPdi evaluacionId={evaluacionId} />
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-3)' }}>
              Tu líder o Talento Humano generará el plan a partir de esta evaluación.
            </p>
          )}
        </section>
      </main>
    </>
  )
}
