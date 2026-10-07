import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import Topbar from '@/components/app/Topbar'
import FormularioProceso from '../FormularioProceso'

export default async function PaginaNuevoProceso({ searchParams }: { searchParams: Promise<{ gestion?: string }> }) {
  const { gestion: gestionId } = await searchParams
  const sesion = await obtenerSesion()

  if (sesion.rol === 'colaborador') redirect('/dashboard')

  const supabase = await crearClienteServidor()

  const [{ data: gestiones }, { data: tiposDoc }, { data: cargos }, { data: homologaciones }, { data: bandas }] = await Promise.all([
    supabase.from('gestiones').select('id, nombre').eq('activa', true).order('nombre'),
    supabase.from('tipos_documento').select('id, nombre, prefijo').order('orden'),
    supabase.from('cargos').select('id, nombre, banda').order('nombre'),
    supabase.from('cargo_homologacion').select('texto_muestra, cargo_id, clase'),
    supabase.from('bandas').select('codigo, nombre').order('orden'),
  ])

  return (
    <>
      <Topbar usuario={sesion} migas={[{ etiqueta: 'Nuevo proceso' }]} />
      <main className="page page--narrow fade-up">
        <FormularioProceso
          gestiones={gestiones ?? []}
          gestionIdInicial={gestionId ?? sesion.gestion_id ?? ''}
          rol={sesion.rol}
          tiposDocumento={tiposDoc ?? []}
          cargos={cargos ?? []}
          homologaciones={homologaciones ?? []}
          bandas={bandas ?? []}
        />
      </main>
    </>
  )
}
