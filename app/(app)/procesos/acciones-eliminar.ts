'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'

const BUCKET = 'documentos-procesos'

/**
 * Elimina un proceso y todo lo que cuelga de él. Irreversible.
 *
 * El permiso no depende del rol sino de `usuarios.puede_eliminar_procesos`,
 * porque los aprobadores de Calidad también son admin y no deben poder borrar.
 * La validación real vive en el RPC; aquí solo se limpian los archivos del
 * bucket, que el borrado en base de datos no toca.
 */
export async function eliminarProceso(procesoId: string) {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Las rutas se leen antes: después del borrado ya no hay de dónde sacarlas
  const { data: docs } = await supabase
    .from('documentos')
    .select('storage_path')
    .eq('proceso_id', procesoId)
  const rutas = (docs ?? [])
    .map(d => d.storage_path)
    .filter((p): p is string => !!p)

  const { data, error } = await supabase.rpc('eliminar_proceso', { p_proceso_id: procesoId })
  if (error) return { error: error.message }

  // Si esto falla quedan archivos huérfanos en el bucket, pero el proceso ya
  // se eliminó: no se revierte, solo no se reporta como fallo del borrado.
  if (rutas.length > 0) {
    await supabase.storage.from(BUCKET).remove(rutas)
  }

  const resumen = (data ?? {}) as { nombre?: string; pasos?: number; documentos?: number }

  revalidatePath('/gestiones')
  revalidatePath('/procesos/revision')
  return { ok: true, ...resumen }
}
