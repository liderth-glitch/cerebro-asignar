'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Asigna (o quita) el jefe directo de una persona.
 * Valida que no se genere un ciclo: el nuevo jefe no puede colgar del propio
 * colaborador, porque el árbol quedaría sin raíz y el dashboard entraría en bucle.
 */
export async function asignarJefe(usuarioId: string, jefeId: string | null) {
  const supabase = await crearClienteServidor()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión requerida' }
  const { data: perfil } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return { error: 'Solo Talento Humano puede reasignar jefes' }

  if (jefeId === usuarioId) return { error: 'Una persona no puede ser su propio jefe' }

  if (jefeId) {
    // Recorre hacia arriba desde el nuevo jefe buscando al colaborador
    const { data: todos } = await supabase.from('usuarios').select('id, jefe_id')
    const padre = new Map((todos ?? []).map(u => [u.id, u.jefe_id as string | null]))
    let actual: string | null = jefeId
    const vistos = new Set<string>()
    while (actual) {
      if (actual === usuarioId) return { error: 'Ese cambio crearía un ciclo en el organigrama' }
      if (vistos.has(actual)) break
      vistos.add(actual)
      actual = padre.get(actual) ?? null
    }
  }

  const { error } = await supabase.from('usuarios').update({ jefe_id: jefeId }).eq('id', usuarioId)
  if (error) return { error: error.message }

  revalidatePath('/admin/organigrama')
  revalidatePath('/dashboard')
  return { ok: true }
}
