-- =====================================================================
-- Comité de Competición + asignación de árbitros guardada en el partido
-- =====================================================================

-- 1) Asignación de árbitros
alter table public.partidos
  add column if not exists arbitro1 text,
  add column if not exists arbitro2 text,
  add column if not exists crono text;

drop trigger if exists aud_partidos on public.partidos;

create trigger aud_partidos
  after update of arbitro_id, estado, descripcion, arbitro1, arbitro2, crono
  on public.partidos
  for each row execute function public.auditar();


-- 2) Documentos del Comité
create table if not exists public.comite_documentos (
  id bigint generated always as identity primary key,
  partido_id bigint not null unique
    references public.partidos(id) on delete cascade,
  fecha date not null
    default ((now() at time zone 'Europe/Madrid')::date),
  creado_por bigint default public.usuario_actual(),
  creado_en timestamptz not null default now()
);


-- 3) Sanciones
create table if not exists public.comite_sanciones (
  id bigint generated always as identity primary key,
  documento_id bigint not null
    references public.comite_documentos(id) on delete cascade,
  equipo_id bigint not null
    references public.equipos(id),
  jugador_id bigint
    references public.jugadores(id),
  incidencia text not null
    check (btrim(incidencia, E' \n\r\t') <> ''),
  resolucion text,
  articulos text,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

create index if not exists comite_sanciones_documento_idx
  on public.comite_sanciones (documento_id, orden);

create index if not exists comite_sanciones_jugador_idx
  on public.comite_sanciones (jugador_id);

create index if not exists comite_sanciones_equipo_idx
  on public.comite_sanciones (equipo_id);


-- 4) Validación de sanciones
create or replace function public.validar_comite_sancion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.equipo_id is distinct from old.equipo_id
     or new.jugador_id is distinct from old.jugador_id
     or new.documento_id is distinct from old.documento_id then

    if not exists (
      select 1
      from public.comite_documentos d
      join public.partidos p on p.id = d.partido_id
      where d.id = new.documento_id
        and new.equipo_id in (p.local_id, p.visitante_id)
    ) then
      raise exception 'Ese equipo no juega el partido del documento';
    end if;

    if new.jugador_id is not null and not exists (
      select 1
      from public.plantilla pl
      where pl.equipo_id = new.equipo_id
        and pl.jugador_id = new.jugador_id
    ) then
      raise exception 'La persona no está en la plantilla de ese equipo';
    end if;
  end if;

  new.incidencia := btrim(new.incidencia, E' \n\r\t');
  new.resolucion := nullif(btrim(new.resolucion, E' \n\r\t'), '');
  new.articulos := nullif(btrim(new.articulos, E' \n\r\t'), '');

  return new;
end;
$$;

drop trigger if exists trg_validar_comite_sancion
  on public.comite_sanciones;

create trigger trg_validar_comite_sancion
  before insert or update on public.comite_sanciones
  for each row execute function public.validar_comite_sancion();


-- 5) Impedir cambiar el partido de un documento
create or replace function public.bloquear_cambio_partido_comite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.partido_id is distinct from old.partido_id then
    raise exception
      'No se puede cambiar el partido de un documento: bórralo y crea otro';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_comite_partido_fijo
  on public.comite_documentos;

create trigger trg_comite_partido_fijo
  before update on public.comite_documentos
  for each row execute function public.bloquear_cambio_partido_comite();


-- 6) Auditoría con search_path seguro
create or replace function public.auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
  v_despues jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_antes := to_jsonb(old);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_despues := to_jsonb(new);
  end if;

  insert into public.auditoria (
    tabla,
    fila_id,
    accion,
    datos_antes,
    datos_despues,
    usuario_id
  )
  values (
    tg_table_name,
    coalesce(v_despues ->> 'id', v_antes ->> 'id')::bigint,
    tg_op,
    v_antes,
    v_despues,
    public.usuario_actual()
  );

  return null;
end;
$$;

drop trigger if exists aud_comite_documentos
  on public.comite_documentos;

create trigger aud_comite_documentos
  after insert or update or delete on public.comite_documentos
  for each row execute function public.auditar();

drop trigger if exists aud_comite_sanciones
  on public.comite_sanciones;

create trigger aud_comite_sanciones
  after insert or update or delete on public.comite_sanciones
  for each row execute function public.auditar();


-- 7) RLS: lectura pública, escritura solo para administradores
alter table public.comite_documentos enable row level security;
alter table public.comite_sanciones enable row level security;

drop policy if exists "lectura publica"
  on public.comite_documentos;

create policy "lectura publica"
  on public.comite_documentos
  for select to anon, authenticated
  using (true);

drop policy if exists "admin escribe"
  on public.comite_documentos;

create policy "admin escribe"
  on public.comite_documentos
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "lectura publica"
  on public.comite_sanciones;

create policy "lectura publica"
  on public.comite_sanciones
  for select to anon, authenticated
  using (true);

drop policy if exists "admin escribe"
  on public.comite_sanciones;

create policy "admin escribe"
  on public.comite_sanciones
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

grant select
  on public.comite_documentos, public.comite_sanciones
  to anon, authenticated;

grant insert, update, delete
  on public.comite_documentos, public.comite_sanciones
  to authenticated;


-- 8) Fusionar jugadores: mover referencias antes de borrar el origen
create or replace function public.fusionar_jugador(
  p_origen bigint,
  p_destino bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.usuarios
    where id = public.usuario_actual()
      and activo
      and rol in ('admin', 'arbitro')
  ) then
    raise exception
      'Solo un árbitro o administrador autorizado puede asociar jugadores';
  end if;

  if not exists (
    select 1
    from public.jugadores origen
    join public.jugadores destino on destino.id = p_destino
    where origen.id = p_origen
      and origen.sin_ficha
      and destino.id_clupik is not null
      and not destino.sin_ficha
  ) then
    raise exception
      'El jugador de origen debe estar sin ficha y el destino debe tener ficha de Clupik';
  end if;

  if not exists (
    select 1
    from public.plantilla po
    join public.plantilla pd on pd.equipo_id = po.equipo_id
    where po.jugador_id = p_origen
      and pd.jugador_id = p_destino
  ) then
    raise exception
      'Los dos jugadores deben pertenecer a la plantilla del mismo equipo';
  end if;

  perform set_config('app.fusionar_jugador', 'true', true);

  update public.eventos
  set jugador_id = p_destino
  where jugador_id = p_origen;

  perform set_config('app.fusionar_jugador', 'false', true);

  update public.mvp
  set jugador_id = p_destino
  where jugador_id = p_origen;

  update public.inscripciones_acta
  set jugador_id = p_destino
  where jugador_id = p_origen;

  delete from public.alineacion_acta o
  where o.jugador_id = p_origen
    and exists (
      select 1
      from public.alineacion_acta d
      where d.partido_id = o.partido_id
        and d.jugador_id = p_destino
    );

  update public.alineacion_acta a
  set jugador_id = p_destino,
      nombre = j.nombre,
      id_clupik = j.id_clupik,
      image_id = j.image_id
  from public.jugadores j
  where a.jugador_id = p_origen
    and j.id = p_destino;

  delete from public.plantilla po
  where po.jugador_id = p_origen
    and exists (
      select 1
      from public.plantilla pd
      where pd.jugador_id = p_destino
        and pd.equipo_id = po.equipo_id
    );

  update public.plantilla
  set jugador_id = p_destino
  where jugador_id = p_origen;

  update public.comite_sanciones
  set jugador_id = p_destino
  where jugador_id = p_origen;

  delete from public.jugadores
  where id = p_origen;
end;
$$;

revoke execute
  on function public.fusionar_jugador(bigint, bigint)
  from public, anon;

grant execute
  on function public.fusionar_jugador(bigint, bigint)
  to authenticated;


-- 9) Las funciones auxiliares se invocan mediante triggers, no por RPC
revoke execute
  on function public.auditar()
  from public, anon, authenticated;

revoke execute
  on function public.validar_comite_sancion()
  from public, anon, authenticated;