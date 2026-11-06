-- =====================================================================
-- LLFS Puerto Real - Esquema Supabase (Postgres)
-- Ejecutar entero en: Supabase > SQL Editor > New query
-- =====================================================================

-- ---------- TIPOS ----------
create type tipo_evento   as enum ('gol', 'amarilla', 'roja');
create type rol_usuario   as enum ('admin', 'arbitro');
create type estado_partido as enum ('programado', 'cerrado');

-- ---------- USUARIOS (lista blanca de quien puede entrar a escribir) ----------
-- El email puede estar vacio al principio (solo conoces el nombre del arbitro).
-- Cuando lo rellenes, esa persona podra entrar con Google usando ese correo.
create table usuarios (
  id     bigint generated always as identity primary key,
  nombre text not null,
  email  text unique,
  rol    rol_usuario not null default 'arbitro',
  activo boolean not null default true
);

-- ---------- FUNCIONES AUXILIARES DE PERMISOS ----------
create or replace function usuario_actual() returns bigint
language sql stable security definer set search_path = public as $$
  select id from usuarios
  where activo and email is not null
    and lower(email) = lower(auth.jwt() ->> 'email')
  limit 1
$$;

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuarios
    where activo and rol = 'admin' and email is not null
      and lower(email) = lower(auth.jwt() ->> 'email')
  )
$$;

-- ---------- CATALOGO (viene de Clupik) ----------
create table temporadas (
  id        bigint generated always as identity primary key,
  id_clupik text unique,
  nombre    text not null,                 -- '2026/2027'
  activa    boolean not null default false
);

create table grupos (
  id           bigint generated always as identity primary key,
  temporada_id bigint not null references temporadas(id),
  id_clupik    text not null,
  nombre       text not null,              -- 'Grupo 1'
  unique (temporada_id, id_clupik)
);

-- Los equipos de Clupik son por temporada (su id cambia cada año)
create table equipos (
  id           bigint generated always as identity primary key,
  temporada_id bigint not null references temporadas(id),
  grupo_id     bigint references grupos(id),
  id_clupik    text not null,
  nombre       text not null,
  escudo_url   text,
  unique (temporada_id, id_clupik)
);

-- La persona. id_clupik = user_id de Clupik (se mantiene entre temporadas)
create table jugadores (
  id                 bigint generated always as identity primary key,
  id_clupik          text unique,
  nombre             text not null,
  apodo              text,
  image_id           text,
  sin_ficha          boolean not null default false,
  pendiente_revision boolean not null default false,
  creado_por         bigint references usuarios(id),
  creado_en          timestamptz not null default now(),
  constraint ficha_coherente check (sin_ficha or id_clupik is not null)
);

-- Jugador en un equipo (dorsal y baja dependen de la temporada/equipo)
create table plantilla (
  id         bigint generated always as identity primary key,
  equipo_id  bigint not null references equipos(id) on delete cascade,
  jugador_id bigint not null references jugadores(id),
  dorsal     int,
  baja       boolean not null default false,   -- dorsal -1 en Clupik
  unique (equipo_id, jugador_id)
);

create table partidos (
  id                      bigint generated always as identity primary key,
  id_clupik               text not null unique,
  temporada_id            bigint not null references temporadas(id),
  grupo_id                bigint references grupos(id),
  jornada                 int,
  fecha                   timestamptz,          -- se muestra en Europe/Madrid
  local_id                bigint not null references equipos(id),
  visitante_id            bigint not null references equipos(id),
  goles_local_clupik      int,                  -- informativo, lo escribe Clupik
  goles_visitante_clupik  int,
  descripcion             text,
  arbitro_id              bigint references usuarios(id),   -- asignacion interna
  estado                  estado_partido not null default 'programado',
  cerrado_por             bigint references usuarios(id),
  cerrado_en              timestamptz
);

-- ---------- EVENTOS (goles y tarjetas) ----------
-- Un jugador puede tener varios eventos en el mismo partido.
-- Reloj del pabellon: 2 partes de 22 min, cuenta hacia atras.
-- Se guarda lo que marca el reloj (restante_seg) y se calcula el tiempo jugado.
create table eventos (
  id           bigint generated always as identity primary key,
  partido_id   bigint not null references partidos(id),
  equipo_id    bigint not null references equipos(id),
  jugador_id   bigint references jugadores(id),
  tipo         tipo_evento not null,
  parte        smallint not null check (parte in (1, 2)),
  restante_seg int not null check (restante_seg between 0 and 1320),
  seg_juego    int generated always as ((parte - 1) * 1320 + (1320 - restante_seg)) stored,
  creado_por   bigint not null references usuarios(id),
  creado_en    timestamptz not null default now(),
  anulado      boolean not null default false,
  anulado_por  bigint references usuarios(id),
  anulado_en   timestamptz
);
create index on eventos (partido_id);
create index on eventos (jugador_id);

-- Fase 4: MVP votado por el entrenador rival
create table mvp (
  id                bigint generated always as identity primary key,
  partido_id        bigint not null references partidos(id),
  equipo_votante_id bigint not null references equipos(id),
  jugador_id        bigint not null references jugadores(id),
  creado_en         timestamptz not null default now(),
  unique (partido_id, equipo_votante_id)
);

-- PIN de acceso independiente para cada entrenador/equipo.
-- El PIN solo se guarda con bcrypt; estas tablas no tienen políticas de lectura
-- para clientes públicos o autenticados.
create table entrenador_pins (
  equipo_id bigint primary key references equipos(id) on delete cascade,
  pin_hash text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table entrenador_pin_intentos (
  equipo_id bigint primary key references equipos(id) on delete cascade,
  intentos smallint not null default 0,
  bloqueado_hasta timestamptz
);

create or replace function registrar_fallo_pin_entrenador(p_equipo_id bigint)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bloqueado_hasta timestamptz;
begin
  insert into entrenador_pin_intentos (equipo_id, intentos)
  values (p_equipo_id, 1)
  on conflict (equipo_id) do update
    set intentos = case
      when entrenador_pin_intentos.bloqueado_hasta is not null
        and entrenador_pin_intentos.bloqueado_hasta <= now() then 1
      else entrenador_pin_intentos.intentos + 1
    end,
    bloqueado_hasta = case
      when entrenador_pin_intentos.bloqueado_hasta > now()
        then entrenador_pin_intentos.bloqueado_hasta
      when (case
        when entrenador_pin_intentos.bloqueado_hasta is not null
          and entrenador_pin_intentos.bloqueado_hasta <= now() then 1
        else entrenador_pin_intentos.intentos + 1
      end) >= 5 then now() + interval '15 minutes'
      else null
    end
  returning bloqueado_hasta into v_bloqueado_hasta;
  return v_bloqueado_hasta;
end;
$$;

revoke all on function registrar_fallo_pin_entrenador(bigint) from public, anon, authenticated;
grant execute on function registrar_fallo_pin_entrenador(bigint) to service_role;

-- ---------- AUDITORIA ----------
create table auditoria (
  id             bigint generated always as identity primary key,
  tabla          text not null,
  fila_id        bigint,
  accion         text not null,
  datos_antes    jsonb,
  datos_despues  jsonb,
  usuario_id     bigint,
  creado_en      timestamptz not null default now()
);

create or replace function auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_antes jsonb; v_despues jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_antes := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_despues := to_jsonb(new); end if;
  insert into auditoria (tabla, fila_id, accion, datos_antes, datos_despues, usuario_id)
  values (tg_table_name,
          coalesce(v_despues ->> 'id', v_antes ->> 'id')::bigint,
          tg_op, v_antes, v_despues, usuario_actual());
  return null;
end $$;

create trigger aud_eventos after insert or update or delete on eventos
  for each row execute function auditar();
-- Solo cambios hechos por personas (la sincronizacion no toca estas columnas)
create trigger aud_partidos after update of arbitro_id, estado, descripcion on partidos
  for each row execute function auditar();

-- ---------- VALIDACION DE EVENTOS ----------
create or replace function validar_evento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from partidos p
                   where p.id = new.partido_id
                     and new.equipo_id in (p.local_id, p.visitante_id)) then
      raise exception 'Ese equipo no juega este partido';
    end if;
    if new.jugador_id is null and new.tipo <> 'gol' then
      raise exception 'Solo un gol puede registrarse sin jugador';
    end if;
    if new.jugador_id is not null and not exists (select 1 from plantilla pl
                   where pl.equipo_id = new.equipo_id and pl.jugador_id = new.jugador_id) then
      raise exception 'El jugador no esta en la plantilla de ese equipo';
    end if;
  else
    -- Solo se puede anular / restaurar; el resto es inmutable salvo para admin
    if not es_admin() and
       (new.partido_id, new.equipo_id, new.jugador_id, new.tipo, new.parte,
        new.restante_seg, new.creado_por, new.creado_en)
       is distinct from
       (old.partido_id, old.equipo_id, old.jugador_id, old.tipo, old.parte,
        old.restante_seg, old.creado_por, old.creado_en) then
      raise exception 'Un evento no se edita: anulalo y crea otro';
    end if;
    if new.anulado and not old.anulado then
      new.anulado_por := usuario_actual();
      new.anulado_en  := now();
    elsif not new.anulado then
      new.anulado_por := null;
      new.anulado_en  := null;
    end if;
  end if;
  return new;
end $$;

create trigger trg_validar_evento before insert or update on eventos
  for each row execute function validar_evento();

-- ---------- FUNCIONES DE NEGOCIO (las llama la app) ----------
-- Crear jugador "sin ficha" al vuelo desde el partido
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
  return v_jug;
end $$;

create or replace function cerrar_acta(p_partido bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update partidos
     set estado = 'cerrado', cerrado_por = usuario_actual(), cerrado_en = now()
   where id = p_partido and estado = 'programado'
     and (es_admin() or arbitro_id = usuario_actual());
  if not found then raise exception 'No se puede cerrar este acta'; end if;
end $$;

create or replace function reabrir_acta(p_partido bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo un administrador puede reabrir'; end if;
  update partidos set estado = 'programado', cerrado_por = null, cerrado_en = null
   where id = p_partido;
end $$;

create or replace function guardar_descripcion_acta(p_partido bigint, p_descripcion text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update partidos
     set descripcion = nullif(btrim(p_descripcion), '')
   where id = p_partido
     and (es_admin() or (estado = 'programado' and arbitro_id = usuario_actual()));
  if not found then raise exception 'No se puede guardar la descripción de este acta'; end if;
end $$;

-- Cuando un jugador sin ficha se inscribe en Clupik: se fusiona con su ficha real
create or replace function fusionar_jugador(p_origen bigint, p_destino bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo un administrador'; end if;
  update eventos set jugador_id = p_destino where jugador_id = p_origen;
  delete from plantilla po
   where po.jugador_id = p_origen
     and exists (select 1 from plantilla pd
                 where pd.jugador_id = p_destino and pd.equipo_id = po.equipo_id);
  update plantilla set jugador_id = p_destino where jugador_id = p_origen;
  delete from jugadores where id = p_origen;
end $$;

revoke execute on function crear_jugador_sin_ficha, cerrar_acta, reabrir_acta, guardar_descripcion_acta, fusionar_jugador
  from public, anon;
grant execute on function crear_jugador_sin_ficha, cerrar_acta, reabrir_acta, guardar_descripcion_acta, fusionar_jugador
  to authenticated;

-- ---------- SEGURIDAD (RLS) ----------
-- Lectura publica del catalogo; escritura solo admin (la sincronizacion usa la
-- clave de servicio, que se salta estas reglas).
do $$
declare t text;
begin
  foreach t in array array['temporadas','grupos','equipos','jugadores','plantilla','partidos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "lectura publica" on %I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin escribe" on %I for all to authenticated using (es_admin()) with check (es_admin())', t);
  end loop;
end $$;

alter table mvp enable row level security;
create policy "admin gestiona mvp" on mvp for all to authenticated
  using (es_admin()) with check (es_admin());

alter table entrenador_pins enable row level security;
alter table entrenador_pin_intentos enable row level security;

-- usuarios: cada uno ve su propia ficha; el admin ve y gestiona todas
alter table usuarios enable row level security;
create policy "ver propio o admin" on usuarios for select to authenticated
  using (es_admin() or lower(email) = lower(auth.jwt() ->> 'email'));
create policy "admin gestiona usuarios" on usuarios for all to authenticated
  using (es_admin()) with check (es_admin());

-- auditoria: solo admin
alter table auditoria enable row level security;
create policy "admin ve auditoria" on auditoria for select to authenticated using (es_admin());

-- eventos: el publico solo ve los no anulados; el arbitro asignado escribe
-- mientras el partido siga abierto; el admin siempre.
alter table eventos enable row level security;
create policy "lectura publica" on eventos for select to anon, authenticated
  using (not anulado or usuario_actual() is not null);

create policy "arbitro inserta" on eventos for insert to authenticated
  with check (
    creado_por = usuario_actual()
    and exists (select 1 from partidos p
                where p.id = partido_id
                  and (es_admin() or (p.estado = 'programado' and p.arbitro_id = usuario_actual())))
  );

create policy "arbitro anula" on eventos for update to authenticated
  using (
    exists (select 1 from partidos p
            where p.id = partido_id
              and (es_admin() or (p.estado = 'programado' and p.arbitro_id = usuario_actual())))
  )
  with check (true);

create policy "admin gestiona eventos" on eventos for all to authenticated
  using (es_admin()) with check (es_admin());

-- ---------- VISTAS PUBLICAS (estadisticas) ----------
create view v_goleadores as
select p.temporada_id, j.id as jugador_id, j.nombre as jugador,
       e.id as equipo_id, e.nombre as equipo, g.nombre as grupo,
       count(*) as goles,
       count(distinct ev.partido_id) as partidos_con_gol
from eventos ev
join partidos p  on p.id = ev.partido_id
join jugadores j on j.id = ev.jugador_id
join equipos e   on e.id = ev.equipo_id
left join grupos g on g.id = e.grupo_id
where ev.tipo = 'gol' and not ev.anulado
group by p.temporada_id, j.id, j.nombre, e.id, e.nombre, g.nombre;

-- Equivale a tu tabla ancha J1..J13 (la app la pivota)
create view v_goles_jornada as
select p.temporada_id, j.id as jugador_id, j.nombre as jugador,
       e.nombre as equipo, p.jornada, count(*) as goles
from eventos ev
join partidos p  on p.id = ev.partido_id
join jugadores j on j.id = ev.jugador_id
join equipos e   on e.id = ev.equipo_id
where ev.tipo = 'gol' and not ev.anulado
group by p.temporada_id, j.id, j.nombre, e.nombre, p.jornada;

create view v_tarjetas as
select p.temporada_id, j.id as jugador_id, j.nombre as jugador, e.nombre as equipo,
       count(*) filter (where ev.tipo = 'amarilla') as amarillas,
       count(*) filter (where ev.tipo = 'roja')     as rojas
from eventos ev
join partidos p  on p.id = ev.partido_id
join jugadores j on j.id = ev.jugador_id
join equipos e   on e.id = ev.equipo_id
where ev.tipo in ('amarilla', 'roja') and not ev.anulado
group by p.temporada_id, j.id, j.nombre, e.nombre;

-- Tiempo (segundos de juego) hasta el primer gol de cada equipo en cada partido
create view v_primer_gol as
select ev.partido_id, ev.equipo_id, min(ev.seg_juego) as seg_primer_gol
from eventos ev
where ev.tipo = 'gol' and not ev.anulado
group by ev.partido_id, ev.equipo_id;

grant select on v_goleadores, v_goles_jornada, v_tarjetas, v_primer_gol to anon, authenticated;

-- ---------- PRIMER ADMINISTRADOR (cambia nombre y correo y ejecuta) ----------
-- insert into usuarios (nombre, email, rol) values ('Tu nombre', 'tu@correo.com', 'admin');
