create table if not exists inscripciones_acta (
  id          bigint generated always as identity primary key,
  partido_id  bigint not null references partidos(id) on delete cascade,
  equipo_id   bigint not null references equipos(id) on delete cascade,
  jugador_id  bigint not null references jugadores(id) on delete cascade,
  creado_por  bigint references usuarios(id),
  creado_en   timestamptz not null default now(),
  unique (partido_id, jugador_id)
);

alter table inscripciones_acta enable row level security;
create policy "arbitros consultan inscripciones de acta" on inscripciones_acta
  for select to authenticated using (usuario_actual() is not null);
revoke all on inscripciones_acta from anon;
grant select on inscripciones_acta to authenticated;

create or replace function crear_jugador_sin_ficha(
  p_partido bigint, p_equipo bigint, p_nombre text, p_dorsal int
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_jug bigint;
begin
  if not exists (
    select 1 from partidos p
    where p.id = p_partido
      and p_equipo in (p.local_id, p.visitante_id)
      and (es_admin() or (p.estado = 'programado' and p.arbitro_id = usuario_actual()))
  ) then
    raise exception 'Sin permiso sobre este partido o equipo incorrecto';
  end if;
  if length(trim(coalesce(p_nombre, ''))) < 3 then
    raise exception 'Nombre demasiado corto';
  end if;

  insert into jugadores (nombre, sin_ficha, pendiente_revision, creado_por)
  values (trim(p_nombre), true, true, usuario_actual())
  returning id into v_jug;

  insert into plantilla (equipo_id, jugador_id, dorsal) values (p_equipo, v_jug, p_dorsal);
  insert into inscripciones_acta (partido_id, equipo_id, jugador_id, creado_por)
  values (p_partido, p_equipo, v_jug, usuario_actual());
  return v_jug;
end $$;
