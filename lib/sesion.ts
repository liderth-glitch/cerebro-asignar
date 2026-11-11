import { cache } from 'react'
import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { SesionUsuario, Rol } from '@/types'

export function obtenerIniciales(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map((p: string) => p[0]).join('').toUpperCase()
}

/** Nombre para saludar: usa el preferido si existe; si no, la última palabra del
 *  nombre (los nombres del Excel vienen "APELLIDO APELLIDO NOMBRE"), en Title Case. */
export function nombreSaludo(nombre: string, nombrePreferido: string | null): string {
  if (nombrePreferido && nombrePreferido.trim()) return nombrePreferido.trim()
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  const base = partes[partes.length - 1] ?? nombre
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()
}

/**
 * Id del usuario de la petición. `getClaims` verifica la firma del token en el
 * propio servidor (llaves ES256 del proyecto) en vez de consultar al servidor
 * de autenticación como `getUser`: una ida y vuelta menos en cada página.
 * `cache` lo comparte entre el layout y la página de una misma petición.
 */
export const obtenerUsuarioId = cache(async (): Promise<string | null> => {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getClaims()
  return (data?.claims?.sub as string | undefined) ?? null
})

/**
 * Sesión con el perfil. Con `cache`, el layout y la página (y cualquier
 * componente) que la pidan en la misma petición hacen una sola consulta.
 */
export const obtenerSesion = cache(async (): Promise<SesionUsuario> => {
  const userId = await obtenerUsuarioId()
  if (!userId) redirect('/login')

  const supabase = await crearClienteServidor()
  const { data: perfil } = await supabase
    .from('usuarios')
    .select('id, nombre, nombre_preferido, correo, rol, gestion_id')
    .eq('id', userId)
    .single()

  if (!perfil) redirect('/login')

  return {
    id: perfil.id,
    nombre: perfil.nombre,
    nombre_preferido: perfil.nombre_preferido ?? null,
    saludo: nombreSaludo(perfil.nombre, perfil.nombre_preferido ?? null),
    correo: perfil.correo,
    rol: perfil.rol as Rol,
    gestion_id: perfil.gestion_id,
    iniciales: obtenerIniciales(perfil.nombre),
  }
})

export async function obtenerSesionAdmin(): Promise<SesionUsuario> {
  const sesion = await obtenerSesion()
  if (sesion.rol !== 'admin') redirect('/dashboard')
  return sesion
}
