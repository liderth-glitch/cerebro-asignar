import { calcularFlujograma, type OpcionesFlujo } from '@/lib/procesos/flujograma'

/**
 * Flujograma del procedimiento, dibujado a partir de los títulos de sus pasos.
 *
 * Va en SVG generado en el servidor, sin librería de diagramas, para que salga
 * idéntico en pantalla y al imprimir el PDF. Usa `currentColor` para que herede
 * el color del tema en la ficha y el negro del documento oficial al imprimir.
 */
export default function Flujograma({ titulos, opciones, idPrefijo = 'flujo' }: {
  titulos: string[]
  opciones?: OpcionesFlujo
  /** Distingue los marcadores si hay más de un flujograma en la página. */
  idPrefijo?: string
}) {
  const f = calcularFlujograma(titulos, opciones)
  if (f.nodos.length === 0) return null

  const M = 14 // margen para que la flecha y el borde no queden pegados al canto
  const idFlecha = `${idPrefijo}-punta`

  return (
    <svg
      viewBox={`${-M} ${-M} ${f.ancho + M * 2} ${f.alto + M * 2}`}
      width="100%"
      style={{ maxWidth: f.ancho + M * 2, height: 'auto', display: 'block', margin: '0 auto' }}
      role="img"
      aria-label={`Flujograma con ${f.nodos.length} actividades`}
    >
      <defs>
        <marker id={idFlecha} viewBox="0 0 10 10" refX="9" refY="5"
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
          markerEnd={`url(#${idFlecha})`}
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
