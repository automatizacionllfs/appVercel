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
        old.restante_seg, old.creado_por, old.creado_en)
       and not (
         old.anulado and not new.anulado
         and (new.partido_id, new.equipo_id, new.jugador_id, new.parte,
              new.restante_seg, new.creado_por, new.creado_en)
         is not distinct from
             (old.partido_id, old.equipo_id, old.jugador_id, old.parte,
              old.restante_seg, old.creado_por, old.creado_en)
         and (new.jugador_id is not null or new.tipo = 'gol')
       ) then
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
