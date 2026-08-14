-- =============================================================================
-- Aprobación de pasos de la acogida (Etapa 8.G)
-- =============================================================================
-- YA APLICADO en Supabase el 2026-08-14. Queda aquí como registro: sin esto no
-- había forma de aprobar y la acogida no cerraba nunca.
--
-- El aprobador se deduce de la etapa, como define el procedimiento oficial:
-- TH en inducción y socialización, jefe inmediato en entrenamiento.
-- =============================================================================

create or replace function public.aprobar_item_onboarding(
  p_item uuid, p_aprobar boolean, p_nota text default null
)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_etapa text; v_estado text; v_dueno uuid; v_jefe uuid; v_onb uuid;
  v_pendientes int;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;

  select i.etapa, i.estado, o.usuario_id, u.jefe_id, o.id
    into v_etapa, v_estado, v_dueno, v_jefe, v_onb
  from onboarding_items i
  join onboarding o on o.id = i.onboarding_id
  join usuarios u on u.id = o.usuario_id
  where i.id = p_item;

  if v_dueno is null then raise exception 'Ítem no encontrado'; end if;

  if v_etapa in ('induccion', 'socializacion') then
    if not es_admin() then
      raise exception 'Solo Talento Humano aprueba los pasos de inducción y socialización';
    end if;
  elsif v_etapa = 'entrenamiento' then
    if not (es_admin() or auth.uid() = v_jefe) then
      raise exception 'Solo el jefe inmediato o Talento Humano aprueban el entrenamiento';
    end if;
  else
    raise exception 'Etapa desconocida: %', v_etapa;
  end if;

  if v_dueno = auth.uid() then
    raise exception 'No puedes aprobar los pasos de tu propia acogida';
  end if;

  if p_aprobar then
    update onboarding_items
    set estado = 'aprobado', aprobado_por = auth.uid(), aprobado_at = now(),
        nota = nullif(btrim(coalesce(p_nota, '')), '')
    where id = p_item;
  else
    update onboarding_items
    set estado = 'pendiente', aprobado_por = null, aprobado_at = null, reportado_at = null,
        nota = nullif(btrim(coalesce(p_nota, '')), '')
    where id = p_item;
  end if;

  -- La acogida se cierra cuando no queda ningún obligatorio sin aprobar
  select count(*) into v_pendientes
  from onboarding_items
  where onboarding_id = v_onb and obligatorio and estado <> 'aprobado';

  update onboarding
  set estado = case when v_pendientes = 0 then 'completado' else 'en_curso' end
  where id = v_onb and estado <> 'cancelado';
end $function$;

revoke all on function public.aprobar_item_onboarding(uuid, boolean, text) from public;
grant execute on function public.aprobar_item_onboarding(uuid, boolean, text) to authenticated;
