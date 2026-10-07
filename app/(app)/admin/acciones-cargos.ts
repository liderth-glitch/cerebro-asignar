'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { claveCargo } from '@/lib/procesos/importar-pasos'

export interface CargoCreado { id: string; nombre: string; banda: string }

export type ResultadoCrearCargo =
  | { ok: true; cargo: CargoCreado }
  | { ok: false; error: string }

/**
 * Crea un cargo en el catálogo. Solo TH (admin): el catálogo alimenta los
 * procedimientos, los manuales de cargo y el organigrama, así que no se deja
 * crear desde cualquier rol. La RLS de `cargos` exige lo mismo.
 */
export async function crearCargo(nombre: string, banda: string): Promise<ResultadoCrearCargo> {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (limpio.length < 3) return { ok: false, error: 'Escribe el nombre del cargo.' }
  if (limpio.length > 100) return { ok: false, error: 'El nombre es demasiado largo.' }
  if (!banda) return { ok: false, error: 'Elige la banda del cargo.' }

  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  const { data: perfil } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return { ok: false, error: 'Solo Talento Humano puede crear cargos.' }

  // Evita duplicar un cargo que ya existe con otra tilde, género o número
  const { data: existentes } = await supabase.from('cargos').select('nombre, activo')
  const clave = claveCargo(limpio)
  const igual = (existentes ?? []).find(c => claveCargo(c.nombre) === clave)
  if (igual) {
    return {
      ok: false,
      error: igual.activo
        ? `Ya existe el cargo «${igual.nombre}».`
        : `Ya existe «${igual.nombre}», pero está inactivo. Reactívalo en vez de crear otro.`,
    }
  }

  const { data, error } = await supabase
    .from('cargos').insert({ nombre: limpio, banda }).select('id, nombre, banda').single()
  if (error || !data) return { ok: false, error: 'No se pudo crear el cargo.' }

  revalidatePath('/cargos')
  revalidatePath('/admin/organigrama')
  revalidatePath('/admin/homologacion')
  return { ok: true, cargo: data }
}
