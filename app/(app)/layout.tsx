import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import AppShell from '@/components/app/AppShell'
import Sidebar from '@/components/app/Sidebar'

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesion()

  const supabase = await crearClienteServidor()
  // El jefe inmediato aprueba el entrenamiento de la acogida sin importar su rol:
  // muchos jefes son 'colaborador'. Por eso el menú se guía por tener equipo, no
  // por el rol. Va contra la vista `directorio_usuarios` porque la RLS de
  // `usuarios` solo deja ver la propia fila a quien no es admin.
  const [{ count }, { count: reportes }] = await Promise.all([
    supabase.from('procesos')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_revision'),
    supabase.from('directorio_usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('jefe_id', sesion.id).eq('activo', true),
  ])

  return (
    <AppShell>
      <Sidebar
        rol={sesion.rol}
        aprobacionesPendientes={count ?? 0}
        tieneEquipo={(reportes ?? 0) > 0}
        gestionId={sesion.gestion_id}
      />
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
        {children}
      </div>
    </AppShell>
  )
}
