alter table plantilla add column if not exists entrenador boolean not null default false;
alter table alineacion_acta add column if not exists entrenador boolean not null default false;

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
    partido_id, equipo_id, jugador_id, nombre, id_clupik, image_id, dorsal, orden, entrenador
  )
  select
    p_partido,
    x.equipo_id,
    x.jugador_id,
    j.nombre,
    j.id_clupik,
    j.image_id,
    case when pl.entrenador then 0 else x.dorsal end,
    x.orden::int,
    pl.entrenador
  from jsonb_array_elements(p_jugadores) with ordinality as item(valor, orden)
  cross join lateral jsonb_to_record(item.valor) as x(equipo_id bigint, jugador_id bigint, dorsal int)
  join jugadores j on j.id = x.jugador_id
  join plantilla pl on pl.equipo_id = x.equipo_id and pl.jugador_id = x.jugador_id;

  get diagnostics v_insertados = row_count;
  if v_insertados <> v_cantidad then
    raise exception 'No se pudo guardar la alineación completa';
  end if;
end
$$;
