import { calcularFlujograma, type OpcionesFlujo } from '@/lib/procesos/flujograma'

/**
 * Flujograma del procedimiento, dibujado con los títulos de sus pasos.
 *
 * Va en SVG generado en el servidor, sin librería de diagramas, para que salga
 * idéntico en pantalla y al imprimir. Usa `currentColor` para heredar el color
 * del tema en la ficha y el negro del documento oficial en el PDF.
 *
 * Se dibuja POR BLOQUES: un procedimiento largo en un solo lienzo se encoge
 * hasta volverse ilegible al ajustarlo al ancho de la página. Cada bloque tiene
 * ancho fijo y tamaño natural, y los siguientes continúan la numeración.
 */

/** Pasos por bloque: 2 columnas de 6 caben legibles en el ancho de una hoja. */
const POR_COLUMNA = 6
const COLUMNAS_POR_BLOQUE = 2
const POR_BLOQUE = POR_COLUMNA * COLUMNAS_POR_BLOQUE

export default function Flujograma({ titulos, opciones, idPrefijo = 'flujo' }: {
  titulos: string[]
  opciones?: OpcionesFlujo
  /** Distingue los marcadores si hay más de un flujograma en la página. */
  idPrefijo?: string
}) {
  if (titulos.length === 0) return null

  const bloques: string[][] = []
  for (let i = 0; i < titulos.length; i += POR_BLOQUE) {
    bloques.push(titulos.slice(i, i + POR_BLOQUE))
  }

  return (
    <div className="vstack" style={{ gap: 18 }}>
      {bloques.map((grupo, b) => {
        const desde = b * POR_BLOQUE + 1
        const hasta = desde + grupo.length - 1
        return (
          <div key={b} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            {bloques.length > 1 && (
              <div style={{ fontSize: 10.5, opacity: 0.6, marginBottom: 6 }}>
                {b > 0 && <>Viene del paso {desde - 1}. </>}
                Pasos {desde} a {hasta}
              </div>
            )}
            <BloqueFlujo
              titulos={grupo}
              numeroInicial={desde}
              idMarcador={`${idPrefijo}-${b}`}
              opciones={opciones}
            />
          </div>
        )
      })}
    </div>
  )
}

function BloqueFlujo({ titulos, numeroInicial, idMarcador, opciones }: {
  titulos: string[]
  numeroInicial: number
  idMarcador: string
  opciones?: OpcionesFlujo
}) {
  const f = calcularFlujograma(titulos, {
    porColumna: POR_COLUMNA,
    numeroInicial,
    ...opciones,
  })
  if (f.nodos.length === 0) return null

  const M = 14 // margen para que la flecha y el borde no queden pegados al canto
  const anchoTotal = f.ancho + M * 2

  return (
    <svg
      viewBox={`${-M} ${-M} ${anchoTotal} ${f.alto + M * 2}`}
      // Tamaño natural, nunca estirado a todo el ancho: así el texto no se encoge
      style={{ width: anchoTotal, maxWidth: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label={`Flujograma, pasos ${numeroInicial} a ${numeroInicial + titulos.length - 1}`}
    >
      <defs>
        <marker id={idMarcador} viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>

      {f.conexiones.map((c, i) => (
        <polyline
          key={i}
          points={c.puntos.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeOpacity="0.55"
          markerEnd={`url(#${idMarcador})`}
        />
      ))}

      {f.nodos.map(n => (
        <g key={n.numero}>
          <rect
            x={n.x} y={n.y} width={n.ancho} height={n.alto} rx="8"
            fill="none" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.45"
          />
          {/* Número de la actividad, para casar el diagrama con la tabla de pasos */}
          <circle cx={n.x + 15} cy={n.y + 15} r="9.5" fill="currentColor" fillOpacity="0.09" />
          <text
            x={n.x + 15} y={n.y + 15} textAnchor="middle" dominantBaseline="central"
            fontSize="9.5" fontWeight="700" fill="currentColor" fillOpacity="0.75"
          >
            {n.numero}
          </text>
          {n.lineas.map((linea, j) => (
            <text
              key={j}
              x={n.x + n.ancho / 2}
              y={n.y + 34 + j * 15}
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
            >
              {linea}
            </text>
          ))}
        </g>
      ))}
    </svg>
  )
}
