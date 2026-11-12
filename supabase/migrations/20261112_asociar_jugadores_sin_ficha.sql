create or replace function validar_evento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from partidos p
      where p.id = new.partido_id
        and new.equipo_id in (p.local_id, p.visitante_id)
    ) then
      raise exception 'Ese equipo no juega este partido';
    end if;
    if new.jugador_id is null and new.tipo <> 'gol' then
      raise exception 'Solo un gol puede registrarse sin jugador';
    end if;
    if new.jugador_id is not null and not exists (
      select 1 from plantilla pl
      where pl.equipo_id = new.equipo_id and pl.jugador_id = new.jugador_id
    ) then
      raise exception 'El jugador no esta en la plantilla de ese equipo';
    end if;
  else
    if not es_admin()
       and coalesce(current_setting('app.fusionar_jugador', true), 'false') <> 'true'
       and
       (new.partido_id, new.equipo_id, new.jugador_id, new.tipo, new.parte,
        new.restante_seg, new.creado_por, new.creado_en)
       is distinct from
       (old.partido_id, old.equipo_id, old.jugador_id, old.tipo, old.parte,
        old.restante_seg, old.creado_por, old.creado_en) then
      raise exception 'Un evento no se edita: anulalo y crea otro';
    end if;
    if new.anulado and not old.anulado then
      new.anulado_por := usuario_actual();
      new.anulado_en := now();
    elsif not new.anulado then
      new.anulado_por := null;
      new.anulado_en := null;
    end if;
  end if;
  return new;
end $$;

create or replace function fusionar_jugador(p_origen bigint, p_destino bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from usuarios
    where id = usuario_actual() and activo and rol in ('admin', 'arbitro')
  ) then
    raise exception 'Solo un árbitro o administrador autorizado puede asociar jugadores';
  end if;
  if not exists (
    select 1
      from jugadores origen
      join jugadores destino on destino.id = p_destino
     where origen.id = p_origen
       and origen.sin_ficha
       and destino.id_clupik is not null
       and not destino.sin_ficha
  ) then
    raise exception 'El jugador de origen debe estar sin ficha y el destino debe tener ficha de Clupik';
  end if;
  if not exists (
    select 1
      from plantilla po
      join plantilla pd on pd.equipo_id = po.equipo_id
     where po.jugador_id = p_origen
       and pd.jugador_id = p_destino
  ) then
    raise exception 'Los dos jugadores deben pertenecer a la plantilla del mismo equipo';
  end if;

  perform set_config('app.fusionar_jugador', 'true', true);
  update eventos set jugador_id = p_destino where jugador_id = p_origen;
  perform set_config('app.fusionar_jugador', 'false', true);
  update mvp set jugador_id = p_destino where jugador_id = p_origen;
  delete from plantilla po
   where po.jugador_id = p_origen
     and exists (
       select 1 from plantilla pd
       where pd.jugador_id = p_destino and pd.equipo_id = po.equipo_id
     );
  update plantilla set jugador_id = p_destino where jugador_id = p_origen;
  delete from jugadores where id = p_origen;
end $$;

revoke execute on function fusionar_jugador(bigint, bigint) from public, anon;
grant execute on function fusionar_jugador(bigint, bigint) to authenticated;
