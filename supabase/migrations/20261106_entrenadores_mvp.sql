create table if not exists entrenador_pins (
  equipo_id bigint primary key references equipos(id) on delete cascade,
  pin_hash text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

drop policy if exists "lectura publica" on mvp;

alter table entrenador_pins enable row level security;

create table if not exists entrenador_pin_intentos (
  equipo_id bigint primary key references equipos(id) on delete cascade,
  intentos smallint not null default 0,
  bloqueado_hasta timestamptz
);

alter table entrenador_pin_intentos enable row level security;

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
