create or replace view v_tarjetas as
select p.temporada_id, j.id as jugador_id, j.nombre as jugador, e.nombre as equipo,
       count(*) filter (where ev.tipo = 'amarilla') as amarillas,
       count(*) filter (where ev.tipo = 'roja') +
       count(*) filter (where segunda.id is not null) as rojas
from eventos ev
join partidos p  on p.id = ev.partido_id
join jugadores j on j.id = ev.jugador_id
join equipos e   on e.id = ev.equipo_id
left join (
  select id
  from (
    select id, row_number() over (
      partition by partido_id, jugador_id
      order by seg_juego, id
    ) as numero_amarilla
    from eventos
    where tipo = 'amarilla' and jugador_id is not null and not anulado
  ) amarillas_ordenadas
  where numero_amarilla = 2
) segunda on segunda.id = ev.id
where ev.tipo in ('amarilla', 'roja') and not ev.anulado
group by p.temporada_id, j.id, j.nombre, e.nombre;
