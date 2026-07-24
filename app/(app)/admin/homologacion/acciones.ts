'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'

/** Resuelve un texto libre: lo mapea a un cargo del catálogo, o lo marca como "no es un cargo". */
export async function homologar(texto: string, cargoId: string | null, clase: 'cargo' | 'no_cargo', nota: string) {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase.rpc('homologar_cargo', {
    p_texto: texto,
    p_cargo_id: cargoId,
    p_clase: clase,
    p_nota: nota,
  })
  if (error) return { error: error.message }

  revalidatePath('/admin/homologacion')
  return { ok: true, afectados: (data as number) ?? 0 }
}
