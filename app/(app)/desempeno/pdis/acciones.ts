'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import {
  calcularReporte, calcularTop3Acciones,
  type Plan, type Item, type Respuesta, type Ponderacion,
  type NivelEsperado, type Accion, type Modalidad,
} from '@/lib/desempeno/calculo'
import { esOrigenPdi, type OrigenPdi } from '@/lib/desempeno/origen'

/** Refresca la vista del PDI (ruta canónica) y la lista. */
function revalidarPdi(pdiId: string) {
  revalidatePath(`/desempeno/pdis/${pdiId}`)
  revalidatePath('/desempeno/pdis')
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}
function enMeses(meses: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}

export async function generarPdiDesdeReporte(evaluacionId: string) {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. No duplicar
  const { data: existente } = await supabase
    .from('pdi').select('id').eq('evaluacion_id', evaluacionId).maybeSingle()
  if (existente) return { pdi_id: existente.id }

  // 2. Recalcular TOP 3
  const { data: evaluacion } = await supabase
    .from('evaluaciones').select('colaborador_id').eq('id', evaluacionId).single()
  if (!evaluacion) return { error: 'Evaluación no encontrada' }

  const { data: colab } = await supabase
    .from('usuarios').select('cargo_id').eq('id', evaluacion.colaborador_id).single()
  const { data: cargo } = colab?.cargo_id
    ? await supabase.from('cargos').select('banda').eq('id', colab.cargo_id).single()
    : { data: null }
  const banda = cargo?.banda ?? 'B1'
  const modalidad: Modalidad = ['B3', 'B4', 'B5'].includes(banda) ? '360°' : '270°'

  const [
    { data: planes },
    { data: ponderaciones },
    { data: nivelesEsperados },
    { data: items },
    { data: acciones },
  ] = await Promise.all([
    supabase.from('plan_evaluacion').select('id, tipo_evaluador').eq('evaluacion_id', evaluacionId),
    supabase.from('ponderaciones_desempeno').select('modalidad, tipo_evaluador, peso'),
    supabase.from('matriz_niveles_esperados').select('banda, competencia, nivel'),
    supabase.from('items_cuestionario').select('id, competencia').eq('activo', true),
    supabase.from('acciones_desarrollo')
      .select('id, competencia, tipo, nombre, banda_min, banda_max, prioridad_min, esfuerzo_th, duracion')
      .eq('activo', true),
  ])

  const planIds = (planes ?? []).map(p => p.id)
  const { data: respuestas } = planIds.length > 0
    ? await supabase.from('respuestas').select('plan_evaluacion_id, item_id, calificacion').in('plan_evaluacion_id', planIds)
    : { data: [] }

  const reporte = calcularReporte({
    banda, modalidad,
    planes: (planes ?? []) as Plan[],
    items: (items ?? []) as Item[],
    respuestas: (respuestas ?? []) as Respuesta[],
    ponderaciones: (ponderaciones ?? []) as Ponderacion[],
    nivelesEsperados: (nivelesEsperados ?? []) as NivelEsperado[],
  })
  const top3 = calcularTop3Acciones({
    banda, resultados: reporte.porCompetencia, acciones: (acciones ?? []) as Accion[],
  })

  if (top3.length === 0) return { error: 'No hay acciones recomendadas (sin brechas o sin respuestas).' }

  // 3. Crear PDI
  const hoy = hoyISO()
  const proxStr = enMeses(3)

  const { data: pdi, error: errPdi } = await supabase
    .from('pdi')
    .insert({
      evaluacion_id: evaluacionId,
      colaborador_id: evaluacion.colaborador_id,
      origen: 'competencias',
      fecha_acuerdo: hoy,
      proxima_revision: proxStr,
      estado: 'borrador',
      creado_por: user.id,
    })
    .select('id').single()
  if (errPdi || !pdi) return { error: errPdi?.message ?? 'No se pudo crear el PDI' }

  // 4. Crear pdi_acciones desde el TOP 3
  const filas = top3.map(t => ({
    pdi_id: pdi.id,
    accion_id: t.accion.id,
    fecha_inicio: hoy,
    fecha_fin: proxStr,
    responsable_seguimiento: 'Jefe directo',
    estado: 'Pendiente',
  }))
  const { error: errAcc } = await supabase.from('pdi_acciones').insert(filas)
  if (errAcc) return { error: errAcc.message }

  revalidarPdi(pdi.id)
  return { pdi_id: pdi.id }
}

/**
 * Crea un PDI desde una fuente distinta a la evaluación de competencias:
 * proceso disciplinario, período de prueba u otro motivo.
 */
export async function crearPdiManual(args: {
  colaborador_id: string
  origen: OrigenPdi
  origen_detalle: string
  acta_origen_path: string | null
  fecha_acuerdo: string
  proxima_revision: string
}) {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión requerida' }

  if (!args.colaborador_id) return { error: 'Elige el colaborador' }
  if (!esOrigenPdi(args.origen) || args.origen === 'competencias') {
    return { error: 'Origen no válido. La evaluación de competencias genera su PDI desde el reporte.' }
  }
  if (!args.fecha_acuerdo || !args.proxima_revision) return { error: 'Indica las fechas del plan' }
  if (args.proxima_revision < args.fecha_acuerdo) {
    return { error: 'La próxima revisión no puede ser anterior a la fecha de acuerdo' }
  }

  const { data: pdi, error } = await supabase
    .from('pdi')
    .insert({
      evaluacion_id: null,
      colaborador_id: args.colaborador_id,
      origen: args.origen,
      origen_detalle: args.origen_detalle.trim() || null,
      acta_origen_path: args.acta_origen_path,
      fecha_acuerdo: args.fecha_acuerdo,
      proxima_revision: args.proxima_revision,
      estado: 'borrador',
      creado_por: user.id,
    })
    .select('id').single()
  if (error || !pdi) return { error: error?.message ?? 'No se pudo crear el PDI' }

  revalidatePath('/desempeno/pdis')
  return { pdi_id: pdi.id }
}

/** URL firmada para consultar el acta que soporta el origen del PDI. */
export async function urlActaOrigen(path: string) {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.storage.from('actas-pdi').createSignedUrl(path, 600)
  if (error || !data) return { error: error?.message ?? 'No se pudo abrir el acta' }
  return { ok: true, url: data.signedUrl }
}

export async function guardarObjetivosPdi(args: {
  pdiId: string
  objetivoGeneral: string
  objetivosSmart: string
}) {
  const supabase = await crearClienteServidor()
  const objetivo_general = args.objetivoGeneral.trim() || null
  const objetivos_smart = args.objetivosSmart.trim() || null
  const { error } = await supabase
    .from('pdi')
    .update({ objetivo_general, objetivos_smart, updated_at: new Date().toISOString() })
    .eq('id', args.pdiId)
  if (error) return { error: error.message }
  revalidarPdi(args.pdiId)
  return { ok: true }
}

export async function reemplazarAccionPdi(args: {
  pdi_id: string
  pdi_accion_id: string
  nueva_accion_id: string
}) {
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('pdi_acciones')
    .update({ accion_id: args.nueva_accion_id })
    .eq('id', args.pdi_accion_id)
  if (error) return { error: error.message }
  revalidarPdi(args.pdi_id)
  return { ok: true }
}

export async function agregarAccionPdi(args: {
  pdi_id: string
  // Catálogo:
  accion_id?: string | null
  // Manual:
  accion_libre?: string
  competencia_libre?: string
  tipo_libre?: string
  // Comunes:
  fecha_inicio: string
  fecha_fin: string
  responsable_seguimiento: string
}) {
  const supabase = await crearClienteServidor()

  const esManual = !args.accion_id
  if (esManual && !(args.accion_libre ?? '').trim()) {
    return { error: 'Describe la acción de desarrollo' }
  }
  if (!args.fecha_inicio || !args.fecha_fin) return { error: 'Indica las fechas de inicio y fin' }
  if (args.fecha_fin < args.fecha_inicio) return { error: 'La fecha fin no puede ser anterior al inicio' }

  const { error } = await supabase.from('pdi_acciones').insert({
    pdi_id: args.pdi_id,
    accion_id: esManual ? null : args.accion_id,
    accion_libre: esManual ? args.accion_libre!.trim() : null,
    competencia_libre: esManual ? ((args.competencia_libre ?? '').trim() || null) : null,
    tipo_libre: esManual ? ((args.tipo_libre ?? '').trim() || null) : null,
    fecha_inicio: args.fecha_inicio,
    fecha_fin: args.fecha_fin,
    responsable_seguimiento: args.responsable_seguimiento || 'Jefe directo',
    estado: 'Pendiente',
  })
  if (error) return { error: error.message }
  revalidarPdi(args.pdi_id)
  return { ok: true }
}

export async function eliminarAccionPdi(args: { pdi_accion_id: string; pdi_id: string }) {
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('pdi_acciones').delete().eq('id', args.pdi_accion_id)
  if (error) return { error: error.message }
  revalidarPdi(args.pdi_id)
  return { ok: true }
}

export async function enviarPdiAFirma(pdiId: string) {
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('pdi')
    .update({ estado: 'en_firma', updated_at: new Date().toISOString() })
    .eq('id', pdiId)
  if (error) return { error: error.message }
  revalidarPdi(pdiId)
  return { ok: true }
}

export type TipoFirma = 'colaborador' | 'jefe' | 'th'

export async function firmarPdi(args: { pdiId: string; tipo: TipoFirma }) {
  const { pdiId, tipo } = args
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión requerida' }

  const { data: perfil } = await supabase
    .from('usuarios').select('id, nombre, rol').eq('id', user.id).single()
  if (!perfil) return { error: 'Perfil no encontrado' }

  const { data: pdi } = await supabase
    .from('pdi').select('id, colaborador_id, estado, firma_colaborador, firma_jefe, firma_th')
    .eq('id', pdiId).single()
  if (!pdi) return { error: 'PDI no encontrado' }
  if (pdi.estado !== 'en_firma' && pdi.estado !== 'vigente') return { error: 'El PDI no está en firma' }

  const { data: colab } = await supabase
    .from('usuarios').select('id, jefe_id').eq('id', pdi.colaborador_id).single()
  if (!colab) return { error: 'Colaborador no encontrado' }

  if (tipo === 'colaborador' && perfil.id !== colab.id) return { error: 'Solo el colaborador puede firmar como colaborador' }
  if (tipo === 'jefe' && perfil.id !== colab.jefe_id) return { error: 'Solo el jefe directo puede firmar como jefe' }
  if (tipo === 'th' && perfil.rol !== 'admin') return { error: 'Solo TH (admin) puede firmar como TH' }

  const marca = `${perfil.nombre} — ${new Date().toISOString()}`
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (tipo === 'colaborador') patch.firma_colaborador = marca
  if (tipo === 'jefe') patch.firma_jefe = marca
  if (tipo === 'th') patch.firma_th = marca

  const firmaColab = tipo === 'colaborador' ? marca : pdi.firma_colaborador
  const firmaJefe = tipo === 'jefe' ? marca : pdi.firma_jefe
  const firmaTh = tipo === 'th' ? marca : pdi.firma_th
  if (firmaColab && firmaJefe && firmaTh) {
    patch.estado = 'vigente'
    patch.fecha_firma_completa = new Date().toISOString()
  }

  const { error } = await supabase.from('pdi').update(patch).eq('id', pdiId)
  if (error) return { error: error.message }
  revalidarPdi(pdiId)
  return { ok: true }
}

export async function registrarSeguimiento(args: {
  pdiAccionId: string
  pdiId: string
  fechaCorte: string
  avancePct: number
  comentario: string
}) {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión requerida' }

  const { error } = await supabase.from('pdi_seguimiento_mensual').insert({
    pdi_accion_id: args.pdiAccionId,
    fecha_corte: args.fechaCorte,
    avance_pct: args.avancePct,
    comentario: args.comentario || null,
    registrado_por: user.id,
  })
  if (error) return { error: error.message }

  if (args.avancePct === 100) {
    await supabase.from('pdi_acciones').update({ estado: 'Completada' }).eq('id', args.pdiAccionId)
  } else if (args.avancePct > 0) {
    await supabase.from('pdi_acciones').update({ estado: 'En curso' }).eq('id', args.pdiAccionId)
  }

  revalidarPdi(args.pdiId)
  return { ok: true }
}
