/**
 * Módulos que se pueden apagar sin borrar nada.
 *
 * Cerebro se enfocó en su núcleo: procesos y procedimientos, políticas, glosario,
 * manuales de cargo y comités. Lo demás quedó oculto, no eliminado: el código,
 * las tablas y los datos siguen intactos. Para reactivar un módulo basta poner
 * su valor en `true`; vuelve al menú, al tablero y sus rutas dejan de redirigir.
 *
 * Archivo sin dependencias a propósito: lo usan el proxy, componentes de
 * servidor y componentes de cliente.
 */
export const MODULOS = {
  /** Evaluación de competencias y PDI. Se traslada a una plataforma aparte. */
  desempeno: false,
  /** Permisos y ausencias. */
  ausencias: false,
  /** Acogida laboral: checklist, seguimiento, jornadas de inducción y quizzes. */
  acogida: false,
  /** Capacitaciones y certificaciones. */
  capacitaciones: false,
} as const

export type Modulo = keyof typeof MODULOS

const RUTAS: Record<Modulo, string[]> = {
  desempeno: ['/desempeno'],
  ausencias: ['/ausencias', '/admin/tipos-ausencia'],
  acogida: ['/onboarding', '/induccion', '/admin/onboarding', '/admin/induccion', '/admin/quizzes'],
  capacitaciones: ['/capacitaciones', '/admin/capacitaciones'],
}

/** La ruta pertenece a un módulo apagado. Compara por segmento: `/induccion` no atrapa `/induccionX`. */
export function esRutaOculta(pathname: string): boolean {
  return (Object.keys(RUTAS) as Modulo[]).some(m =>
    !MODULOS[m] && RUTAS[m].some(r => pathname === r || pathname.startsWith(r + '/')),
  )
}
