-- =============================================================================
-- Comité de Control Integrado 2026-10-14 (aplicado con la migración
-- `documentos_por_paso_y_vencidos`). Copia de referencia.
-- =============================================================================

-- 1. Documentos vinculados a un paso. Los pasos se recrean en cada guardado,
--    así que el vínculo viaja con el paso (arreglo de ids) en vez de una FK
--    desde documentos, que se rompería al recrearlos.
alter table pasos add column if not exists documentos_ids uuid[] not null default '{}';

-- 2. Vencido → desactualizado. Pasa a desactualizado todo procedimiento activo
--    cuya próxima revisión ya pasó (fecha de Bogotá) y avisa al líder de la
--    gestión y a quien lo creó. Sus funciones salen del manual de cargo.
create or replace function public.marcar_procesos_vencidos()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_total int := 0;
  r record;
begin
  for r in
    update procesos p set estado = 'desactualizado'
    where p.estado = 'activo'
      and p.fecha_proxima_revision is not null
      and p.fecha_proxima_revision < v_hoy
    returning p.id, p.nombre, p.creado_por, p.fecha_proxima_revision,
      (select g.lider_id from gestiones g where g.id = p.gestion_id) as lider_id
  loop
    v_total := v_total + 1;
    perform crear_notificacion(u, 'documento_vencido', 'Documento vencido',
      '"' || r.nombre || '" venció el ' || to_char(r.fecha_proxima_revision, 'DD/MM/YYYY')
      || ' y pasó a desactualizado. Sus funciones salen del manual de cargo hasta que se actualice y se vuelva a publicar.',
      '/procesos/' || r.id)
    from (select distinct x from unnest(array[r.lider_id, r.creado_por]) x where x is not null) d(u);
  end loop;
  return v_total;
end $$;

revoke all on function public.marcar_procesos_vencidos() from public, anon, authenticated;

-- 3. PENDIENTE DE DECISIÓN — programarla todos los días a la 1:00 a. m. de Bogotá:
--    create extension if not exists pg_cron;
--    select cron.schedule('marcar-procesos-vencidos', '0 6 * * *', $$select public.marcar_procesos_vencidos()$$);
--    Ojo: hoy los colaboradores solo ven procedimientos en estado «activo»
--    (policy procesos_lectura), así que un procedimiento desactualizado deja de
--    verse para ellos.
