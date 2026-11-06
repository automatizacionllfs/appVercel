alter table partidos add column if not exists descripcion text;

drop trigger if exists aud_partidos on partidos;
create trigger aud_partidos after update of arbitro_id, estado, descripcion on partidos
  for each row execute function auditar();

create or replace function guardar_descripcion_acta(p_partido bigint, p_descripcion text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update partidos
     set descripcion = nullif(btrim(p_descripcion), '')
   where id = p_partido
     and (es_admin() or (estado = 'programado' and arbitro_id = usuario_actual()));
  if not found then raise exception 'No se puede guardar la descripción de este acta'; end if;
end $$;

revoke execute on function guardar_descripcion_acta(bigint, text) from public, anon;
grant execute on function guardar_descripcion_acta(bigint, text) to authenticated;
