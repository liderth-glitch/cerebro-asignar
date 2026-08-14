-- =============================================================================
-- El contenido del PDI se congela al salir de borrador
-- =============================================================================
-- YA APLICADO en Supabase el 2026-08-14.
--
-- Lo que se firmó debe ser lo que quedó. La validación también está en las
-- server actions, pero la RLS deja escribir al jefe y a TH en cualquier estado,
-- así que una llamada directa a la API podría editar un plan ya firmado.
--
-- OJO: el seguimiento SÍ actualiza estas tablas con el plan vigente
-- (`pdi_acciones.estado` y notas, `pdi_compromisos.estado`/`observacion`), así
-- que solo se bloquean altas, bajas y cambios de CONTENIDO.
-- =============================================================================

create or replace function public.pdi_exigir_borrador()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_pdi uuid;
  v_estado text;
begin
  v_pdi := coalesce(new.pdi_id, old.pdi_id);
  select estado into v_estado from pdi where id = v_pdi;
  if v_estado is null or v_estado = 'borrador' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    raise exception 'El plan ya salió de borrador: no se pueden agregar elementos';
  elsif tg_op = 'DELETE' then
    raise exception 'El plan ya salió de borrador: no se pueden quitar elementos';
  end if;

  if tg_table_name = 'pdi_acciones' then
    if (new.accion_id, new.accion_libre, new.competencia_libre, new.tipo_libre,
        new.indicador, new.fecha_inicio, new.fecha_fin, new.responsable_seguimiento)
       is distinct from
       (old.accion_id, old.accion_libre, old.competencia_libre, old.tipo_libre,
        old.indicador, old.fecha_inicio, old.fecha_fin, old.responsable_seguimiento)
    then
      raise exception 'El plan ya salió de borrador: no se puede cambiar el contenido de las acciones';
    end if;
  elsif tg_table_name = 'pdi_compromisos' then
    if (new.descripcion, new.fecha_limite) is distinct from (old.descripcion, old.fecha_limite) then
      raise exception 'El plan ya salió de borrador: no se puede cambiar el texto de los compromisos';
    end if;
  end if;

  return new;
end $function$;

drop trigger if exists trg_pdi_acciones_borrador on pdi_acciones;
create trigger trg_pdi_acciones_borrador
  before insert or update or delete on pdi_acciones
  for each row execute function public.pdi_exigir_borrador();

drop trigger if exists trg_pdi_compromisos_borrador on pdi_compromisos;
create trigger trg_pdi_compromisos_borrador
  before insert or update or delete on pdi_compromisos
  for each row execute function public.pdi_exigir_borrador();

-- -----------------------------------------------------------------------------
-- Lectura del acta de origen restringida (misma fecha)
-- -----------------------------------------------------------------------------
-- El acta de un disciplinario es sensible y la policy anterior dejaba leerla a
-- CUALQUIER líder (son 27). La ruta es '{colaborador_id}/archivo', así que se
-- restringe a TH y al jefe directo, la misma regla que aplica la pantalla.
drop policy if exists actas_pdi_read on storage.objects;
create policy actas_pdi_read on storage.objects for select
  using (
    bucket_id = 'actas-pdi'
    and (
      es_admin()
      or exists (
        select 1 from usuarios u
        where u.id::text = split_part(objects.name, '/', 1)
          and u.jefe_id = auth.uid()
      )
    )
  );
