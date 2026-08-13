import { redirect } from 'next/navigation'
import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import Topbar from '@/components/app/Topbar'
import Icono from '@/components/app/Icono'
import { hoyISO } from '@/lib/documentos/vigencia'
import BotonesAprobacion from './BotonesAprobacion'

const ETIQUETA_ETAPA: Record<string, string> = {
  induccion: 'Inducción',
  socializacion: 'Socialización',
  entrenamiento: 'Entrenamiento',
}

function uno<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

export default async function PaginaSeguimientoAcogida() {
  const sesion = await obtenerSesion()
  const supabase = await crearClienteServidor()
  const esAdmin = sesion.rol === 'admin'

  // Ve esta pantalla quien aprueba algo: TH o quien tenga reportes directos
  const { count: reportes } = await supabase
    .from('usuarios')
    .select('id', { count: 'exact', head: true })
    .eq('jefe_id', sesion.id)
    .eq('activo', true)
  if (!esAdmin && (reportes ?? 0) === 0) redirect('/onboarding')

  // La RLS ya limita: admin ve todo, el jefe solo a su gente
  const { data: acogidasRaw } = await supabase
    .from('onboarding')
    .select('id, usuario_id, fecha_inicio, estado, usuario:usuarios!onboarding_usuario_id_fkey(nombre, jefe_id, gestion:gestiones(nombre))')
    .in('estado', ['en_curso', 'completado'])
    .order('fecha_inicio', { ascending: false })

  const acogidas = acogidasRaw ?? []
  const ids = acogidas.map(a => a.id)

  const { data: itemsRaw } = ids.length > 0
    ? await supabase
        .from('onboarding_items')
        .select('id, onboarding_id, etapa, orden, titulo, obligatorio, fecha_limite, estado, reportado_at, nota')
        .in('onboarding_id', ids)
        .order('orden')
    : { data: [] as never[] }

  const items = itemsRaw ?? []
  const hoy = hoyISO()

  const porAcogida = new Map<string, typeof items>()
  for (const it of items) {
    const arr = porAcogida.get(it.onboarding_id) ?? []
    arr.push(it)
    porAcogida.set(it.onboarding_id, arr)
  }

  const filas = acogidas.map(a => {
    const u = uno(a.usuario as unknown as { nombre: string; jefe_id: string | null; gestion: unknown } | null)
    const g = uno(u?.gestion as { nombre: string } | { nombre: string }[] | null)
    const props = porAcogida.get(a.id) ?? []
    const total = props.length
    const aprobados = props.filter(i => i.estado === 'aprobado').length
    const vencidos = props.filter(i =>
      i.estado !== 'aprobado' && i.fecha_limite && i.fecha_limite < hoy).length
    // Solo aprueba entrenamiento el jefe; inducción y socialización son de TH
    const mios = props.filter(i => {
      if (i.estado !== 'reportado') return false
      if (i.etapa === 'entrenamiento') return esAdmin || u?.jefe_id === sesion.id
      return esAdmin
    })
    return {
      id: a.id,
      nombre: u?.nombre ?? '—',
      gestion: g?.nombre ?? null,
      fecha_inicio: a.fecha_inicio,
      estado: a.estado,
      total,
      aprobados,
      vencidos,
      pct: total > 0 ? Math.round((aprobados / total) * 100) : 0,
      esperanMi: mios,
    }
  })

  const esperando = filas.flatMap(f => f.esperanMi.map(i => ({ ...i, persona: f.nombre })))
  const enCurso = filas.filter(f => f.estado === 'en_curso')
  const totalVencidos = filas.reduce((a, f) => a + f.vencidos, 0)

  return (
    <>
      <Topbar usuario={sesion} migas={[
        { etiqueta: 'Acogida', href: '/onboarding' },
        { etiqueta: 'Seguimiento' },
      ]} />
      <main className="page fade-up">
        <div className="hstack" style={{ marginBottom: 22, justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="page__eyebrow">Acogida laboral</div>
            <h1 className="page__title">Seguimiento</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)', maxWidth: 620 }}>
              {esAdmin
                ? 'Quién está en acogida, cómo va y qué pasos esperan tu aprobación.'
                : 'La acogida de tu equipo. Apruebas los pasos de entrenamiento en el cargo.'}
            </p>
          </div>
          <Link href="/onboarding" className="btn btn--ghost btn--sm">
            <Icono nombre="bookmark" className="icon icon--sm" /> Mi acogida
          </Link>
        </div>

        <div className="grid-stats" style={{ marginBottom: 22 }}>
          <Kpi num={enCurso.length} label="En acogida" />
          <Kpi num={esperando.length} label="Esperan tu aprobación"
            color={esperando.length > 0 ? 'var(--warning-ink)' : undefined} />
          <Kpi num={totalVencidos} label="Pasos vencidos"
            color={totalVencidos > 0 ? 'var(--danger-ink)' : undefined} />
        </div>

        {/* Lo accionable primero */}
        <section className="card" style={{ padding: 22, marginBottom: 18 }}>
          <div className="page__eyebrow" style={{ marginBottom: 4 }}>Pendiente de ti</div>
          <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>Esperan tu aprobación</h2>

          {esperando.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
              Nada pendiente por ahora. Cuando alguien reporte un paso, aparecerá aquí.
            </p>
          ) : (
            <div className="vstack" style={{ gap: 10 }}>
              {esperando.map(i => (
                <div key={i.id} className="card" style={{ padding: 14, background: 'var(--surface-sunken)' }}>
                  <div className="hstack" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <strong style={{ fontSize: 14 }}>{i.persona}</strong>
                        <span className="badge badge--neutral badge--no-dot" style={{ fontSize: 10.5 }}>
                          {ETIQUETA_ETAPA[i.etapa] ?? i.etapa}
                        </span>
                        {i.fecha_limite && i.fecha_limite < hoy && (
                          <span className="badge badge--danger">Vencido</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13.5 }}>{i.titulo}</div>
                      {i.nota && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Nota previa: {i.nota}</div>
                      )}
                    </div>
                    <BotonesAprobacion itemId={i.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Panorama */}
        <section className="card card--table">
          <div className="table-scroll">
            <table className="table table--in-card">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th style={{ width: 170 }}>Gestión</th>
                  <th style={{ width: 110 }}>Inicio</th>
                  <th style={{ width: 200 }}>Avance aprobado</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Vencidos</th>
                  <th style={{ width: 110 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.id}>
                    <td><div className="row-title">{f.nombre}</div></td>
                    <td style={{ fontSize: 12.5 }}>{f.gestion ?? '—'}</td>
                    <td className="text-mono" style={{ fontSize: 12.5 }}>{f.fecha_inicio}</td>
                    <td>
                      <div className="hstack" style={{ gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1, background: 'var(--border)', height: 6, borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{
                            width: `${f.pct}%`, height: '100%',
                            background: f.pct === 100 ? 'var(--success)' : 'var(--primary)',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', minWidth: 62, textAlign: 'right' }}>
                          {f.aprobados}/{f.total}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: f.vencidos > 0 ? 'var(--danger-ink)' : 'var(--text-3)' }}>
                      {f.vencidos || '—'}
                    </td>
                    <td>
                      <span className={`badge ${f.estado === 'completado' ? 'badge--success' : 'badge--neutral'}`}>
                        {f.estado === 'completado' ? 'Completada' : 'En curso'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-3)', fontSize: 13 }}>
                    No hay acogidas en curso.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
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
