import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import Topbar from '@/components/app/Topbar'
import Icono from '@/components/app/Icono'
import TablaPdis from './TablaPdis'

export default async function PaginaPdis() {
  const sesion = await obtenerSesion()
  const supabase = await crearClienteServidor()
  const esAdmin = sesion.rol === 'admin'
  const esLider = sesion.rol === 'lider'

  // La RLS ya limita a: propios, de reportes directos, o todos si es admin
  const { data: pdisRaw } = await supabase
    .from('pdi')
    .select('id, estado, fecha_acuerdo, proxima_revision, origen, colaborador_id, evaluacion_id')
    .order('fecha_acuerdo', { ascending: false })

  const pdis = pdisRaw ?? []
  const colabIds = [...new Set(pdis.map(p => p.colaborador_id).filter((x): x is string => !!x))]
  const evalIds = [...new Set(pdis.map(p => p.evaluacion_id).filter((x): x is string => !!x))]
  const pdiIds = pdis.map(p => p.id)

  const [{ data: colabs }, { data: evals }, { data: pdiAcc }] = await Promise.all([
    colabIds.length > 0
      ? supabase.from('usuarios').select('id, nombre, codigo_contrato').in('id', colabIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string; codigo_contrato: string | null }[] }),
    evalIds.length > 0
      ? supabase.from('evaluaciones').select('id, ciclo_id, ciclos_evaluacion:ciclo_id(id, nombre)').in('id', evalIds)
      : Promise.resolve({ data: [] as { id: string; ciclo_id: string; ciclos_evaluacion: unknown }[] }),
    pdiIds.length > 0
      ? supabase.from('pdi_acciones').select('id, pdi_id').in('pdi_id', pdiIds)
      : Promise.resolve({ data: [] as { id: string; pdi_id: string }[] }),
  ])

  const pdiAccIds = (pdiAcc ?? []).map(a => a.id)
  const { data: seguim } = pdiAccIds.length > 0
    ? await supabase.from('pdi_seguimiento_mensual').select('pdi_accion_id, avance_pct').in('pdi_accion_id', pdiAccIds)
    : { data: [] as { pdi_accion_id: string; avance_pct: number }[] }

  const ultimoAvancePorAcc = new Map<string, number>()
  for (const s of seguim ?? []) ultimoAvancePorAcc.set(s.pdi_accion_id, s.avance_pct)

  const accionesPorPdi = new Map<string, string[]>()
  for (const a of pdiAcc ?? []) {
    const arr = accionesPorPdi.get(a.pdi_id) ?? []
    arr.push(a.id)
    accionesPorPdi.set(a.pdi_id, arr)
  }

  const mapColab = new Map((colabs ?? []).map(c => [c.id, c]))
  const mapCicloPorEval = new Map(
    (evals ?? []).map(e => {
      const raw = e.ciclos_evaluacion as unknown as { id: string; nombre: string }[] | { id: string; nombre: string } | null
      return [e.id, Array.isArray(raw) ? (raw[0] ?? null) : raw]
    }),
  )

  const filas = pdis.map(p => {
    const accIds = accionesPorPdi.get(p.id) ?? []
    const avances = accIds.map(id => ultimoAvancePorAcc.get(id) ?? 0)
    const avancePromedio = avances.length > 0 ? Math.round(avances.reduce((a, b) => a + b, 0) / avances.length) : 0
    return {
      id: p.id,
      estado: p.estado,
      origen: p.origen as string | null,
      fecha_acuerdo: p.fecha_acuerdo,
      proxima_revision: p.proxima_revision,
      colaborador: mapColab.get(p.colaborador_id) ?? null,
      ciclo: p.evaluacion_id ? (mapCicloPorEval.get(p.evaluacion_id) ?? null) : null,
      numAcciones: accIds.length,
      avancePromedio,
    }
  })

  const vigentes = filas.filter(f => f.estado === 'vigente' || f.estado === 'completado')
  const enFirma = filas.filter(f => f.estado === 'en_firma')
  const borradores = filas.filter(f => f.estado === 'borrador')
  const avanceGlobal = vigentes.length > 0
    ? Math.round(vigentes.reduce((a, b) => a + b.avancePromedio, 0) / vigentes.length)
    : 0

  return (
    <>
      <Topbar usuario={sesion} migas={[
        { etiqueta: 'Desempeño', href: '/desempeno' },
        { etiqueta: 'Planes de desarrollo' },
      ]} />
      <main className="page fade-up">
        <div className="hstack" style={{ marginBottom: 24, justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="page__eyebrow">Cumplimiento</div>
            <h1 className="page__title">Planes de desarrollo</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)', maxWidth: 620 }}>
              {esAdmin ? 'Todos los PDIs de la organización.' : 'PDIs tuyos y de tus reportes directos.'}
              {' '}Confluyen aquí los planes que nacen de evaluaciones, procesos disciplinarios,
              período de prueba y otros motivos.
            </p>
          </div>
          {(esAdmin || esLider) && (
            <Link href="/desempeno/pdis/nuevo" className="btn btn--primary btn--sm">
              <Icono nombre="plus" className="icon icon--sm" /> Nuevo PDI
            </Link>
          )}
        </div>

        <div className="grid-stats" style={{ marginBottom: 24 }}>
          <KpiCard num={filas.length} label="PDIs totales" />
          <KpiCard num={vigentes.length} label="Vigentes" color="var(--success-ink)" />
          <KpiCard num={enFirma.length} label="En firma" color="var(--warning-ink)" />
          <KpiCard num={`${avanceGlobal}%`} label="Avance promedio global" color="var(--on-primary-soft)" />
        </div>

        {filas.length === 0 ? (
          <section className="card" style={{ padding: 26, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
              No hay PDIs para mostrar todavía.
            </p>
          </section>
        ) : (
          <TablaPdis filas={filas} />
        )}

        {borradores.length > 0 && (
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-3)' }}>
            Además hay {borradores.length} PDI(s) en borrador sin enviar a firma.
          </p>
        )}
      </main>
    </>
  )
}

function KpiCard({ num, label, color }: { num: number | string; label: string; color?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: color ?? 'var(--text)' }}>{num}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{label}</div>
    </div>
  )
}
