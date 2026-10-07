/**
 * Lo que hace un cargo en una actividad, escrito con las preguntas del formato
 * de calidad: «Responsable de… ¿Qué hace? … ¿Cómo lo hace? … ¿Dónde lo hace? …
 * ¿Cuándo lo hace? …». Se muestra con cada pregunta destacada y en su línea,
 * sin cambiar una palabra del texto. Si no trae preguntas sale tal cual.
 */

const PREGUNTA = /¿([^?]{2,60})\?/g

export function partirPreguntas(texto: string): { intro: string; partes: { pregunta: string; respuesta: string }[] } {
  const marcas = [...texto.matchAll(PREGUNTA)]
  if (marcas.length === 0) return { intro: texto.trim(), partes: [] }
  const partes = marcas.map((m, i) => {
    const desde = (m.index ?? 0) + m[0].length
    const hasta = i + 1 < marcas.length ? (marcas[i + 1].index ?? texto.length) : texto.length
    return { pregunta: `¿${m[1].trim()}?`, respuesta: texto.slice(desde, hasta).trim() }
  })
  return { intro: texto.slice(0, marcas[0].index ?? 0).trim(), partes }
}

export default function TextoCargo({ texto, compacto = false }: { texto: string; compacto?: boolean }) {
  const { intro, partes } = partirPreguntas(texto)
  if (partes.length === 0) return <span style={{ whiteSpace: 'pre-wrap' }}>{intro}</span>
  return (
    <span style={{ display: 'block' }}>
      {intro && <span style={{ display: 'block', marginBottom: compacto ? 1 : 4 }}>{intro}</span>}
      {partes.map((p, i) => (
        <span key={i} style={{ display: 'block', marginTop: compacto ? 1 : 3 }}>
          <b>{p.pregunta}</b> {p.respuesta}
        </span>
      ))}
    </span>
  )
}
