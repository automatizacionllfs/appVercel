"use client";

import { useMemo } from "react";
import AvatarJugador from "./AvatarJugador";
import { marcarSegundasAmarillas } from "../lib/tarjetas";
import { tieneResultado } from "../lib/partidos";
import GoleadorJornadaCard from "./estadisticas/GoleadorJornadaCard";

export default function GoleadoresJornada({ equipos, partidos, eventos }) {
  const eventosConSegundasAmarillas = useMemo(() => marcarSegundasAmarillas(eventos), [eventos]);
  const goleadoresPorJornada = useMemo(() => {
    const partidoPorId = new Map(partidos.map((partido) => [partido.id, partido]));
    const equipoPorId = new Map(equipos.map((equipo) => [equipo.id, equipo]));
    const porJornada = new Map();
    eventosConSegundasAmarillas.forEach((evento) => {
      if (evento.tipo !== "gol" || !evento.jugador_id || !evento.jugador?.nombre) return;
      const partido = partidoPorId.get(evento.partido_id);
      if (partido?.jornada == null) return;
      const jornada = String(partido.jornada);
      const equipo = equipoPorId.get(evento.equipo_id);
      if (!porJornada.has(jornada)) porJornada.set(jornada, new Map());
      const goleadores = porJornada.get(jornada);
      const clave = `${evento.jugador_id}:${evento.equipo_id}`;
      const goleador = goleadores.get(clave) || {
        jugadorId: evento.jugador_id,
        nombre: evento.jugador.nombre,
        equipoId: evento.equipo_id,
        equipo: equipo?.nombre || "Equipo",
        escudoUrl: equipo?.escudo_url,
        foto: evento.jugador.foto,
        goles: 0,
      };
      goleador.goles += 1;
      goleadores.set(clave, goleador);
    });
    return new Map([...porJornada].map(([jornada, goleadores]) => [
      jornada,
      [...goleadores.values()].sort((a, b) =>
        b.goles - a.goles || a.nombre.localeCompare(b.nombre, "es"),
      )[0] || null,
    ]));
  }, [eventosConSegundasAmarillas, partidos, equipos]);
  const jornadas = useMemo(() => {
    const partidosConEventos = new Set(eventosConSegundasAmarillas.map((evento) => evento.partido_id));
    return [...new Set(
      partidos
        .filter((partido) => tieneResultado(partido) || partidosConEventos.has(partido.id))
        .map((partido) => partido.jornada)
        .filter((jornada) => jornada != null),
    )].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
  }, [partidos, eventosConSegundasAmarillas]);

  return (
    <details className="goleadores-jornada">
      <summary>Máximo goleador de la Jornada</summary>
      {!jornadas.length ? (
        <p className="suave">Todavía no hay jornadas disputadas.</p>
      ) : (
        <div className="goleadores-jornada-lista">
          {jornadas.map((jornada) => {
            const goleador = goleadoresPorJornada.get(String(jornada));
            return (
              <article className="goleador-jornada" key={jornada}>
                <strong className="goleador-jornada-titulo">Jornada {jornada}</strong>
                {goleador ? (
                  <>
                    <span className="estadistica-jugador-foto goleador-jornada-foto">
                      <AvatarJugador src={goleador.foto} />
                    </span>
                    <div className="goleador-jornada-identidad">
                      <strong>{goleador.nombre}</strong>
                      <span className="suave">{goleador.equipo}</span>
                    </div>
                    <span className="goleador-jornada-goles" aria-label={`${goleador.goles} goles`}>
                      <strong>{goleador.goles}</strong>
                      <span>{goleador.goles === 1 ? "gol" : "goles"}</span>
                    </span>
                    <GoleadorJornadaCard jornada={jornada} jugador={goleador} />
                  </>
                ) : (
                  <p className="suave goleador-jornada-sin-goles">No hay goles con autor registrados en esta jornada.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </details>
  );
}
