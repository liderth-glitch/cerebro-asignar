/**
 * Lectura del formato en Excel del procedimiento.
 *
 * Se separa de la UI para poder probarla: el formato de calidad viene con
 * encabezado de logo y control documental encima de la tabla, y los títulos de
 * las columnas no siempre se escriben igual, así que el parseo tiene reglas que
 * conviene verificar contra archivos reales.
 */

export type CampoPaso =
  | 'nombre' | 'descripcion' | 'entradas' | 'salidas' | 'periodicidad'
  | 'acuerdo_servicio' | 'proceso_cliente' | 'tiempos' | 'cargo_responsable'

export interface PasoLeido {
  numero_orden: number
  nombre: string
  descripcion: string
  cargo_responsable: string
  entradas: string
  periodicidad: string
  salidas: string
  acuerdo_servicio: string
  tiempos: string
  proceso_cliente: string
}

export interface Analisis {
  pasos: PasoLeido[]
  reconocidas: { campo: CampoPaso; titulo: string }[]
  ignoradas: string[]
  /** 1-indexada, para mostrarla tal como la ve el usuario en Excel. */
  filaTitulos: number
  descartadas: number
}

export const norm = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()

/** Variantes aceptadas por campo, en vez de exigir una plantilla exacta. */
export const COLUMNAS: { campo: CampoPaso; alias: string[] }[] = [
  { campo: 'nombre', alias: ['actividad', 'actividades', 'nombre de la actividad', 'paso', 'pasos'] },
  { campo: 'descripcion', alias: ['descripcion', 'descripcion de la actividad', 'procedimiento', 'como se hace', 'detalle'] },
  { campo: 'entradas', alias: ['entradas', 'entrada', 'insumos', 'insumo'] },
  { campo: 'salidas', alias: ['salidas', 'salida', 'salidas - entregables', 'salidas-entregables', 'entregables', 'entregable', 'producto'] },
  { campo: 'periodicidad', alias: ['periodicidad', 'frecuencia'] },
  { campo: 'acuerdo_servicio', alias: ['acuerdo de servicio', 'acuerdo servicio', 'acuerdo', 'sla', 'nivel de servicio'] },
  { campo: 'proceso_cliente', alias: ['cargo o proceso cliente', 'proceso cliente', 'cargo cliente', 'cliente'] },
  { campo: 'tiempos', alias: ['tiempos', 'tiempo', 'duracion', 'tiempo estimado'] },
  { campo: 'cargo_responsable', alias: ['responsable', 'cargo responsable', 'cargo', 'responsables'] },
]

export const ETIQUETA: Record<CampoPaso, string> = {
  nombre: 'Actividad',
  descripcion: 'Descripción',
  entradas: 'Entradas',
  salidas: 'Salidas',
  periodicidad: 'Periodicidad',
  acuerdo_servicio: 'Acuerdo de servicio',
  proceso_cliente: 'Cargo o proceso cliente',
  tiempos: 'Tiempo',
  cargo_responsable: 'Responsable',
}

/** Ubica la fila de títulos saltándose el encabezado del formato. */
export function ubicarTitulos(
  filas: unknown[][],
): { indice: number; mapa: Map<number, CampoPaso> } | null {
  const limite = Math.min(filas.length, 25)
  for (let i = 0; i < limite; i++) {
    const fila = filas[i] ?? []
    const mapa = new Map<number, CampoPaso>()
    const usados = new Set<CampoPaso>()
    let tieneActividad = false

    fila.forEach((celda, col) => {
      const t = norm(celda)
      if (!t) return
      for (const { campo, alias } of COLUMNAS) {
        if (!alias.includes(t)) continue
        // Si el campo ya se asignó, se queda con la primera columna que lo trajo
        if (usados.has(campo)) return
        usados.add(campo)
        mapa.set(col, campo)
        if (campo === 'nombre') tieneActividad = true
        return
      }
    })

    // Sin columna de actividad no hay paso que crear
    if (tieneActividad && mapa.size >= 2) return { indice: i, mapa }
  }
  return null
}

export class ErrorImportacion extends Error {}

/** Convierte la hoja (como matriz) en pasos. Lanza `ErrorImportacion` si no puede. */
export function analizarFilas(filas: unknown[][]): Analisis {
  const titulos = ubicarTitulos(filas)
  if (!titulos) {
    throw new ErrorImportacion(
      'No se encontró la fila de títulos. El archivo necesita una columna «Actividad» y ' +
      'al menos otra del formato (Entradas, Descripción, Salidas…).',
    )
  }

  const { indice, mapa } = titulos
  const filaTit = filas[indice] ?? []
  const columnaDe = new Map<CampoPaso, number>()
  for (const [col, campo] of mapa) columnaDe.set(campo, col)

  const pasos: PasoLeido[] = []
  let descartadas = 0

  for (let i = indice + 1; i < filas.length; i++) {
    const fila = filas[i] ?? []
    const valor = (campo: CampoPaso): string => {
      const col = columnaDe.get(campo)
      return col === undefined ? '' : String(fila[col] ?? '').trim()
    }
    const nombre = valor('nombre')
    if (!nombre) {
      // Fila sin actividad: separador, total o nota al pie
      if (fila.some(c => String(c ?? '').trim())) descartadas++
      continue
    }
    pasos.push({
      numero_orden: pasos.length + 1,
      nombre,
      descripcion: valor('descripcion'),
      cargo_responsable: valor('cargo_responsable'),
      entradas: valor('entradas'),
      periodicidad: valor('periodicidad'),
      salidas: valor('salidas'),
      acuerdo_servicio: valor('acuerdo_servicio'),
      tiempos: valor('tiempos'),
      proceso_cliente: valor('proceso_cliente'),
    })
  }

  if (pasos.length === 0) {
    throw new ErrorImportacion('Se encontró la tabla, pero ninguna fila tiene actividad escrita.')
  }

  const reconocidas = [...mapa.entries()].map(([col, campo]) => ({
    campo, titulo: String(filaTit[col] ?? '').trim() || ETIQUETA[campo],
  }))
  const ignoradas = filaTit
    .map((c, col) => (mapa.has(col) ? null : String(c ?? '').trim()))
    .filter((c): c is string => !!c)

  return { pasos, reconocidas, ignoradas, filaTitulos: indice + 1, descartadas }
}
