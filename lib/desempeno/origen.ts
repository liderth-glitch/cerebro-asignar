/**
 * Fuentes que pueden originar un Plan de Desarrollo Individual.
 * El PDI es el embudo único: competencias, disciplinario, período de prueba y otros
 * convergen en el mismo módulo, indicando de dónde viene cada plan.
 */
export const ORIGENES_PDI = ['competencias', 'disciplinario', 'periodo_prueba', 'otro'] as const

export type OrigenPdi = (typeof ORIGENES_PDI)[number]

export const etiquetaOrigen: Record<OrigenPdi, string> = {
  competencias: 'Evaluación de competencias',
  disciplinario: 'Proceso disciplinario',
  periodo_prueba: 'Período de prueba',
  otro: 'Otro motivo',
}

export const badgeOrigen: Record<OrigenPdi, string> = {
  competencias: 'badge--primary',
  disciplinario: 'badge--danger',
  periodo_prueba: 'badge--warning',
  otro: 'badge--neutral',
}

/** Orígenes que se crean manualmente (competencias se genera desde el reporte). */
export const ORIGENES_MANUALES = ORIGENES_PDI.filter(o => o !== 'competencias')

export function esOrigenPdi(v: string | null | undefined): v is OrigenPdi {
  return !!v && (ORIGENES_PDI as readonly string[]).includes(v)
}

/** Etiqueta segura para un valor que viene de la BD. */
export function nombreOrigen(v: string | null | undefined): string {
  return esOrigenPdi(v) ? etiquetaOrigen[v] : 'Sin origen'
}

export function claseBadgeOrigen(v: string | null | undefined): string {
  return esOrigenPdi(v) ? badgeOrigen[v] : 'badge--neutral'
}
