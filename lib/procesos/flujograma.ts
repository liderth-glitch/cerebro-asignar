/**
 * Diagramación del flujograma a partir de los pasos del procedimiento.
 *
 * No inventa contenido: dibuja las actividades que ya están escritas, en su
 * orden. Se calcula aquí, aparte del render, porque la geometría es lo único
 * que puede salir mal y así se puede probar sin navegador.
 *
 * El SVG se genera en el servidor para que salga igual en pantalla y al
 * imprimir el PDF, sin depender de una librería de diagramas.
 */

export interface OpcionesFlujo {
  /** Cuántos pasos caben en una columna antes de saltar a la siguiente. */
  porColumna?: number
  anchoCaja?: number
  /** Caracteres por línea antes de partir el texto. */
  charsPorLinea?: number
  maxLineas?: number
  separacionVertical?: number
  separacionColumnas?: number
}

export interface NodoFlujo {
  numero: number
  lineas: string[]
  x: number
  y: number
  ancho: number
  alto: number
}

export interface Flujograma {
  nodos: NodoFlujo[]
  /** Polilíneas ya resueltas: cada una son puntos "x,y" consecutivos. */
  conexiones: { puntos: { x: number; y: number }[] }[]
  ancho: number
  alto: number
}

const POR_DEFECTO: Required<OpcionesFlujo> = {
  porColumna: 6,
  anchoCaja: 190,
  charsPorLinea: 30,
  maxLineas: 3,
  separacionVertical: 34,
  separacionColumnas: 62,
}

/** Parte un título en líneas sin cortar palabras. La última se recorta con «…». */
export function partirTexto(texto: string, charsPorLinea: number, maxLineas: number): string[] {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  if (!limpio) return ['(sin título)']

  const palabras = limpio.split(' ')
  const lineas: string[] = []
  let actual = ''

  for (const palabra of palabras) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra
    if (tentativa.length <= charsPorLinea) {
      actual = tentativa
      continue
    }
    if (actual) lineas.push(actual)
    // Una palabra sola más larga que la línea se parte a la fuerza
    if (palabra.length > charsPorLinea) {
      let resto = palabra
      while (resto.length > charsPorLinea) {
        lineas.push(resto.slice(0, charsPorLinea - 1) + '-')
        resto = resto.slice(charsPorLinea - 1)
      }
      actual = resto
    } else {
      actual = palabra
    }
    if (lineas.length >= maxLineas) break
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual)

  if (lineas.length > maxLineas) lineas.length = maxLineas

  // Si quedó texto por fuera, se marca para no dar a entender que está completo
  const reconstruido = lineas.join(' ')
  if (reconstruido.length < limpio.length) {
    const ultima = lineas[lineas.length - 1]
    lineas[lineas.length - 1] =
      ultima.length > charsPorLinea - 1 ? ultima.slice(0, charsPorLinea - 1) + '…' : ultima + '…'
  }
  return lineas
}

export function calcularFlujograma(titulos: string[], opciones: OpcionesFlujo = {}): Flujograma {
  const o = { ...POR_DEFECTO, ...opciones }
  if (titulos.length === 0) {
    return { nodos: [], conexiones: [], ancho: 0, alto: 0 }
  }

  const partidos = titulos.map(t => partirTexto(t, o.charsPorLinea, o.maxLineas))
  // Altura uniforme: con cajas desiguales las flechas quedan torcidas
  const maxLineas = Math.max(...partidos.map(l => l.length))
  const alto = 22 + maxLineas * 15

  const nodos: NodoFlujo[] = partidos.map((lineas, i) => {
    const col = Math.floor(i / o.porColumna)
    const fila = i % o.porColumna
    return {
      numero: i + 1,
      lineas,
      x: col * (o.anchoCaja + o.separacionColumnas),
      y: fila * (alto + o.separacionVertical),
      ancho: o.anchoCaja,
      alto,
    }
  })

  const conexiones: Flujograma['conexiones'] = []
  for (let i = 0; i < nodos.length - 1; i++) {
    const a = nodos[i]
    const b = nodos[i + 1]
    const mismaColumna = a.x === b.x

    if (mismaColumna) {
      // Flecha recta hacia abajo
      conexiones.push({
        puntos: [
          { x: a.x + a.ancho / 2, y: a.y + a.alto },
          { x: b.x + b.ancho / 2, y: b.y },
        ],
      })
    } else {
      // Salto de columna: baja, cruza el espacio y sube al primero de la siguiente
      const canal = a.x + a.ancho + o.separacionColumnas / 2
      const bajo = a.y + a.alto + o.separacionVertical / 2
      conexiones.push({
        puntos: [
          { x: a.x + a.ancho / 2, y: a.y + a.alto },
          { x: a.x + a.ancho / 2, y: bajo },
          { x: canal, y: bajo },
          { x: canal, y: b.y - o.separacionVertical / 2 },
          { x: b.x + b.ancho / 2, y: b.y - o.separacionVertical / 2 },
          { x: b.x + b.ancho / 2, y: b.y },
        ],
      })
    }
  }

  const columnas = Math.ceil(titulos.length / o.porColumna)
  const filas = Math.min(titulos.length, o.porColumna)
  return {
    nodos,
    conexiones,
    ancho: columnas * o.anchoCaja + (columnas - 1) * o.separacionColumnas,
    alto: filas * alto + (filas - 1) * o.separacionVertical,
  }
}
