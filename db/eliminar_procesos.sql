-- =============================================================================
-- Permiso de eliminación de procesos, restringido a una sola persona
-- =============================================================================
-- Hoy la policy `procesos_admin_eliminar` deja borrar a CUALQUIER admin, y los
-- aprobadores de Calidad (John William, Diana Cano, Andrea Ossa) son admin. Un
-- borrado arrastra pasos, cargos, documentos e historial y no se puede deshacer.
-- Por eso el permiso pasa a ser una marca explícita por usuario, no el rol.
--
-- Correr una sola vez en el SQL Editor de Supabase.
-- =============================================================================

-- 1. Marca explícita. Por defecto nadie puede.
alter table usuarios
  add column if not exists puede_eliminar_procesos boolean not null default false;

comment on column usuarios.puede_eliminar_procesos is
  'Permite eliminar procesos definitivamente. Se otorga persona por persona, no por rol: un borrado arrastra pasos, documentos e historial y es irreversible.';

-- 2. Solo Simón. Para otorgarlo a alguien más, repetir este update con su nombre.
update usuarios set puede_eliminar_procesos = true
where correo = 'liderth@asignar.com.co';

-- 3. La policy deja de mirar el rol y pasa a mirar la marca
drop policy if exists procesos_admin_eliminar on procesos;
create policy procesos_eliminar_autorizado on procesos for delete
  using (exists (
    select 1 from usuarios u
    where u.id = auth.uid() and u.activo and u.puede_eliminar_procesos
  ));

-- 3b. Los adjuntos se borran del bucket con las credenciales de quien elimina, y
--     `documentos_storage_eliminar` exige rol lider/admin. Si esta marca se otorga
--     a alguien que no lo es, las filas se borrarían y los archivos quedarían
--     huérfanos. Se permite borrar también a quien tenga la marca.
drop policy if exists doc_storage_del_autorizado on storage.objects;
create policy doc_storage_del_autorizado on storage.objects for delete
  using (
    bucket_id = 'documentos-procesos'
    and exists (
      select 1 from usuarios u
      where u.id = auth.uid() and u.activo and u.puede_eliminar_procesos
    )
  );

-- 4. Borrado completo en una sola operación.
--    Va como SECURITY DEFINER porque `historial_versiones` no tiene policy de
--    DELETE: sin esto el borrado fallaría a medias y dejaría el proceso a medio
--    eliminar. La función valida el permiso por su cuenta antes de tocar nada.
create or replace function public.eliminar_proceso(p_proceso_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nombre text;
  v_pasos int;
  v_docs int;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida';
  end if;

  if not exists (
    select 1 from usuarios u
    where u.id = auth.uid() and u.activo and u.puede_eliminar_procesos
  ) then
    raise exception 'No tienes permiso para eliminar procesos';
  end if;

  select nombre into v_nombre from procesos where id = p_proceso_id;
  if v_nombre is null then
    raise exception 'El proceso no existe';
  end if;

  select count(*) into v_pasos from pasos where proceso_id = p_proceso_id;
  select count(*) into v_docs  from documentos where proceso_id = p_proceso_id;

  -- Hijos primero, de más profundo a más superficial
  delete from paso_cargos where paso_id in (select id from pasos where proceso_id = p_proceso_id);
  delete from pasos               where proceso_id = p_proceso_id;
  delete from documentos          where proceso_id = p_proceso_id;
  delete from historial_versiones where proceso_id = p_proceso_id;
  delete from procesos            where id = p_proceso_id;

  return jsonb_build_object('nombre', v_nombre, 'pasos', v_pasos, 'documentos', v_docs);
end
$function$;

revoke all on function public.eliminar_proceso(uuid) from public;
grant execute on function public.eliminar_proceso(uuid) to authenticated;

-- Comprobación
select nombre, correo, puede_eliminar_procesos
from usuarios where puede_eliminar_procesos;
