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

/** Un cargo (o varios con el mismo texto) dentro de la descripción de una actividad. */
export interface BloqueCargo {
  /** Tal como vienen escritos, sin las notas entre paréntesis */
  nombres: string[]
  tipo: 'responsable' | 'apoyo'
  /** Qué hace, cómo, dónde y cuándo; conserva las notas como «(Función propuesta por validar)» */
  texto: string
}

export interface PasoLeido {
  numero_orden: number
  nombre: string
  /** Lo que no pertenece a ningún cargo. Vacío cuando la descripción venía partida por cargos */
  descripcion: string
  cargo_responsable: string
  entradas: string
  periodicidad: string
  salidas: string
  acuerdo_servicio: string
  tiempos: string
  proceso_cliente: string
  bloques: BloqueCargo[]
}

export interface Analisis {
  pasos: PasoLeido[]
  reconocidas: { campo: CampoPaso; titulo: string }[]
  ignoradas: string[]
  /** 1-indexada, para mostrarla tal como la ve el usuario en Excel. */
  filaTitulos: number
  descartadas: number
}

/** Minúsculas, sin tildes y sin signos: «Salidas – Entregables» y «Salidas-Entregables» quedan iguales. */
export const norm = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-‐-―_/\\.,;:()[\]"'«»¿?¡!]/g, ' ')
    .replace(/\s+/g, ' ').trim()

/** Variantes aceptadas por campo, en vez de exigir una plantilla exacta. */
export const COLUMNAS: { campo: CampoPaso; alias: string[] }[] = [
  { campo: 'nombre', alias: ['actividad', 'actividades', 'nombre de la actividad', 'paso', 'pasos'] },
  { campo: 'descripcion', alias: ['descripcion', 'descripcion de la actividad', 'procedimiento', 'como se hace', 'detalle'] },
  { campo: 'entradas', alias: ['entradas', 'entrada', 'insumos', 'insumo'] },
  { campo: 'salidas', alias: ['salidas', 'salida', 'salidas entregables', 'salida entregable', 'entregables', 'entregable', 'producto'] },
  { campo: 'periodicidad', alias: ['periodicidad', 'frecuencia', 'periodicidad o frecuencia', 'frecuencia o periodicidad'] },
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

/**
 * Campo de un título de columna. Primero busca la coincidencia exacta con todos
 * los campos —así «Cargo o proceso cliente» no cae en «Cargo»— y solo si no hay
 * ninguna prueba con las partes de un título compuesto («Salidas o productos»).
 */
export function campoDeTitulo(titulo: unknown): CampoPaso | null {
  const t = norm(titulo)
  if (!t) return null
  const exacto = COLUMNAS.find(c => c.alias.includes(t))
  if (exacto) return exacto.campo
  const partes = t.split(/ o | y /).map(p => p.trim()).filter(Boolean)
  if (partes.length < 2) return null
  for (const parte of partes) {
    const c = COLUMNAS.find(col => col.alias.includes(parte))
    if (c) return c.campo
  }
  return null
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

    fila.forEach((celda, col) => {
      const campo = campoDeTitulo(celda)
      // Si el campo ya se asignó, se queda con la primera columna que lo trajo
      if (!campo || usados.has(campo)) return
      usados.add(campo)
      mapa.set(col, campo)
    })

    // Sin columna de actividad no hay paso que crear
    if (usados.has('nombre') && mapa.size >= 2) return { indice: i, mapa }
  }
  return null
}

/** «Paso 3. Perfilamiento…» → «Perfilamiento…»: la numeración la pone el sistema. */
export function limpiarNombreActividad(nombre: string): string {
  return nombre.replace(/^\s*paso\s*\d+\s*[.:)\-–—]?\s*/i, '').trim()
}

// ---------------------------------------------------------------------------
// Descripción partida por cargo
// ---------------------------------------------------------------------------

/**
 * Inicio de un bloque: «Psicólogo de Selección: Responsable de…». El nombre va
 * desde el fin de la oración anterior hasta los dos puntos, y lo que sigue
 * empieza por «Responsable(s)». Así no se confunde con «¿Qué hace?».
 */
const INICIO_BLOQUE = /(^|[.!?\n]\s*)([^.!?\n:]{2,160}?)\s*:\s*(?=Responsables?\b)/g

/** Notas que no son parte del nombre del cargo. */
const NOTA = /\(([^)]*)\)/g

/**
 * Parte la descripción en un bloque por cargo. Si el texto no sigue ese
 * formato devuelve cero bloques y el texto completo como resto, de modo que
 * los archivos de antes se siguen importando igual.
 */
export function partirPorCargo(texto: string): { bloques: BloqueCargo[]; resto: string } {
  const limpio = texto.trim()
  const inicios: { desde: number; cuerpo: number; nombre: string }[] = []
  for (const m of limpio.matchAll(INICIO_BLOQUE)) {
    const desde = (m.index ?? 0) + m[1].length
    inicios.push({ desde, cuerpo: (m.index ?? 0) + m[0].length, nombre: m[2].trim() })
  }
  if (inicios.length === 0) return { bloques: [], resto: limpio }

  const bloques: BloqueCargo[] = inicios.map((ini, i) => {
    const hasta = i + 1 < inicios.length ? inicios[i + 1].desde : limpio.length
    const cuerpo = limpio.slice(ini.cuerpo, hasta).trim()

    const notas = [...ini.nombre.matchAll(NOTA)].map(n => n[1].trim()).filter(Boolean)
    const esApoyo = notas.some(n => norm(n) === 'apoyo')
    // «(Apoyo)» se vuelve el tipo; las demás notas se conservan al inicio del texto
    const notasTexto = notas.filter(n => norm(n) !== 'apoyo')
    const nombres = ini.nombre.replace(NOTA, '').split('/').map(n => n.trim()).filter(Boolean)

    return {
      nombres,
      tipo: esApoyo ? 'apoyo' : 'responsable',
      texto: [...notasTexto.map(n => `(${n})`), cuerpo].join(' ').trim(),
    }
  })

  return { bloques, resto: limpio.slice(0, inicios[0].desde).trim() }
}

/** Palabras que no distinguen un cargo de otro: «Auxiliar Sala 1» = «Auxiliar de Sala 1». */
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'el', 'los'])

/**
 * Llave para comparar nombres de cargo sin que importen tildes, género ni
 * número: «Reclutadora» = «Reclutador», «Psicóloga» = «Psicólogos»,
 * «Auxiliares» = «Auxiliar».
 */
export function claveCargo(nombre: string): string {
  return norm(nombre)
    .split(' ')
    .filter(p => !CONECTORES.has(p))
    .map(p => {
      let w = p
      if (w.length > 4 && w.endsWith('es') && /[rlndz]/.test(w[w.length - 3])) w = w.slice(0, -2)
      else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1)
      if (w.length > 3 && /[ao]$/.test(w)) w = w.slice(0, -1)
      return w
    })
    .join(' ')
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
    const nombre = limpiarNombreActividad(valor('nombre'))
    if (!nombre) {
      // Fila sin actividad: separador, total o nota al pie
      if (fila.some(c => String(c ?? '').trim())) descartadas++
      continue
    }
    const { bloques, resto } = partirPorCargo(valor('descripcion'))
    pasos.push({
      numero_orden: pasos.length + 1,
      nombre,
      descripcion: resto,
      cargo_responsable: valor('cargo_responsable'),
      entradas: valor('entradas'),
      periodicidad: valor('periodicidad'),
      salidas: valor('salidas'),
      acuerdo_servicio: valor('acuerdo_servicio'),
      tiempos: valor('tiempos'),
      proceso_cliente: valor('proceso_cliente'),
      bloques,
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
