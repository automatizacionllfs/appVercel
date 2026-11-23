create table if not exists alineacion_acta (
  partido_id bigint not null references partidos(id) on delete cascade,
  equipo_id bigint not null references equipos(id) on delete cascade,
  jugador_id bigint not null references jugadores(id),
  nombre text not null,
  id_clupik text,
  image_id text,
  dorsal int check (dorsal is null or dorsal between 0 and 99),
  orden int not null default 0,
  primary key (partido_id, jugador_id)
);

create index if not exists alineacion_acta_partido_equipo_orden_idx
  on alineacion_acta (partido_id, equipo_id, orden);

alter table alineacion_acta enable row level security;
revoke all on alineacion_acta from public, anon, authenticated;
grant select on alineacion_acta to anon, authenticated;

create policy "lectura publica de alineaciones de acta" on alineacion_acta
  for select to anon, authenticated using (true);

create or replace function guardar_alineacion_acta(p_partido bigint, p_jugadores jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_partido partidos%rowtype;
  v_cantidad int;
  v_insertados int;
begin
  if jsonb_typeof(p_jugadores) is distinct from 'array' then
    raise exception 'La alineación no tiene un formato válido';
  end if;

  select * into v_partido from partidos where id = p_partido;
  if not found or not (es_admin() or (
    v_partido.estado = 'programado' and v_partido.arbitro_id = usuario_actual()
  )) then
    raise exception 'No se puede guardar la alineación de este partido';
  end if;

  select count(*) into v_cantidad
  from jsonb_to_recordset(p_jugadores) as x(equipo_id bigint, jugador_id bigint, dorsal int);

  if exists (
    select 1
    from jsonb_to_recordset(p_jugadores) as x(equipo_id bigint, jugador_id bigint, dorsal int)
    where x.equipo_id not in (v_partido.local_id, v_partido.visitante_id)
       or (x.dorsal is not null and x.dorsal not between 0 and 99)
       or not exists (
         select 1 from plantilla pl
         where pl.equipo_id = x.equipo_id and pl.jugador_id = x.jugador_id
       )
  ) then
    raise exception 'La alineación contiene jugadores, equipos o dorsales no válidos';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_jugadores) as x(equipo_id bigint, jugador_id bigint, dorsal int)
    group by x.jugador_id
    having count(*) > 1
  ) then
    raise exception 'La alineación contiene jugadores duplicados';
  end if;

  delete from alineacion_acta where partido_id = p_partido;

  insert into alineacion_acta (
    partido_id, equipo_id, jugador_id, nombre, id_clupik, image_id, dorsal, orden
  )
  select
    p_partido,
    x.equipo_id,
    x.jugador_id,
    j.nombre,
    j.id_clupik,
    j.image_id,
    x.dorsal,
    x.orden::int
  from jsonb_array_elements(p_jugadores) with ordinality as item(valor, orden)
  cross join lateral jsonb_to_record(item.valor) as x(equipo_id bigint, jugador_id bigint, dorsal int)
  join jugadores j on j.id = x.jugador_id;

  get diagnostics v_insertados = row_count;
  if v_insertados <> v_cantidad then
    raise exception 'No se pudo guardar la alineación completa';
  end if;
end
$$;

revoke all on function guardar_alineacion_acta(bigint, jsonb) from public;
grant execute on function guardar_alineacion_acta(bigint, jsonb) to authenticated;
