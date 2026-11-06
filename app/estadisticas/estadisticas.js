"use client";

import { useMemo, useState } from "react";

const reloj = (segundos) => {
  if (segundos === null) return "—";
  const min = Math.floor(segundos / 60);
  const seg = Math.round(segundos % 60);
  return `${min}:${String(seg).padStart(2, "0")}`;
};

function mediaPrimerGol(eventos) {
  const primeros = new Map();
  eventos.filter((evento) => evento.tipo === "gol").forEach((evento) => {
    const tiempo = (Number(evento.parte) - 1) * 1320 + (1320 - Number(evento.restante_seg));
    const actual = primeros.get(evento.partido_id);
    if (actual === undefined || tiempo < actual) primeros.set(evento.partido_id, tiempo);
  });
  if (!primeros.size) return null;
  return [...primeros.values()].reduce((suma, tiempo) => suma + tiempo, 0) / primeros.size;
}

function resumen(eventos, partidosJugados) {
  const goles = eventos.filter((evento) => evento.tipo === "gol").length;
  return {
    primerGol: mediaPrimerGol(eventos),
    goles,
    mediaGoles: partidosJugados ? goles / partidosJugados : 0,
    amarillas: eventos.filter((evento) => evento.tipo === "amarilla").length,
    rojas: eventos.filter((evento) => evento.tipo === "roja").length,
  };
}

function TarjetasResumen({ titulo, datos, partidosJugados, nota }) {
  return (
    <section className="estadistica-card">
      <h2>{titulo}</h2>
      <dl className="metricas">
        <div><dt>Tiempo medio del primer gol</dt><dd>{reloj(datos.primerGol)}</dd></div>
        <div><dt>Goles por partido</dt><dd>{datos.mediaGoles.toFixed(2)}</dd></div>
        <div><dt>Tarjetas amarillas</dt><dd>{datos.amarillas}</dd></div>
        <div><dt>Tarjetas rojas</dt><dd>{datos.rojas}</dd></div>
      </dl>
      <p className="suave">{partidosJugados} partidos con resultado{nota ? ` · ${nota}` : ""}</p>
    </section>
  );
}

function formatFecha(fecha) {
  if (!fecha) return "Fecha no disponible";
  return new Date(fecha).toLocaleDateString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Estadisticas({ equipos, partidos, eventos, plantilla, equipoInicial = "" }) {
  const [equipoId, setEquipoId] = useState(String(equipoInicial));
  const equipo = equipos.find((item) => String(item.id) === equipoId);
  const partidosConActa = new Set(eventos.map((evento) => evento.partido_id));
  const partidosEquipo = equipo
    ? partidos.filter((partido) =>
      (partido.local_id === equipo.id || partido.visitante_id === equipo.id) &&
      partido.goles_local_clupik !== null &&
      partido.goles_visitante_clupik !== null,
    ).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
    : [];
  const eventosEquipo = equipo ? eventos.filter((evento) => evento.equipo_id === equipo.id) : [];
  const resumenEquipo = useMemo(() => resumen(eventosEquipo, partidosEquipo.length), [eventosEquipo, partidosEquipo.length]);

  const usuarios = useMemo(() => {
    const eventosPorJugador = new Map();
    eventosEquipo.forEach((evento) => {
      if (!eventosPorJugador.has(evento.jugador_id)) eventosPorJugador.set(evento.jugador_id, []);
      eventosPorJugador.get(evento.jugador_id).push(evento);
    });
    return plantilla
      .filter((fila) => fila.equipo_id === equipo?.id && fila.jugador?.id_clupik)
      .map((fila) => {
        const filas = eventosPorJugador.get(fila.jugador.id) || [];
        return {
          id: fila.jugador.id,
          nombre: fila.jugador.nombre,
          dorsal: fila.dorsal,
          foto: fila.jugador.foto,
          ...resumen(filas, partidosEquipo.length),
        };
      })
      .sort((a, b) => b.goles - a.goles || (a.dorsal ?? 999) - (b.dorsal ?? 999) || a.nombre.localeCompare(b.nombre, "es"));
  }, [plantilla, equipo?.id, eventosEquipo, partidosEquipo.length]);

  return (
    <>
      <p className="suave">Selecciona un equipo para consultar sus estad&iacute;sticas y las de sus jugadores.</p>
      <label className="selector-equipo">
        Equipo
        <select value={equipoId} onChange={(event) => setEquipoId(event.target.value)}>
          <option value="">Selecciona un equipo</option>
          {equipos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select>
      </label>

      {equipo && (
        <>
          <div className="equipo-destacado">
            {equipo.escudo_url && <img src={equipo.escudo_url} alt={`Escudo de ${equipo.nombre}`} width="76" height="76" />}
            <div>
              <span className="suave">{equipo.grupo?.nombre || "Equipo"}</span>
              <h2>{equipo.nombre}</h2>
            </div>
          </div>
          <TarjetasResumen
            titulo="Resumen del equipo"
            datos={resumenEquipo}
            partidosJugados={partidosEquipo.length}
            nota="estadísticas de eventos registrados en acta"
          />
          <section>
            <h2>Partidos disputados</h2>
            {!partidosEquipo.length ? <p className="suave">Todavía no hay resultados registrados para este equipo.</p> : (
              <div className="partidos-equipo">
                {partidosEquipo.map((partido) => {
                  const local = equipos.find((item) => item.id === partido.local_id);
                  const visitante = equipos.find((item) => item.id === partido.visitante_id);
                  const esLocal = partido.local_id === equipo.id;
                  const rival = esLocal ? visitante : local;
                  const golesEquipo = Number(esLocal ? partido.goles_local_clupik : partido.goles_visitante_clupik);
                  const golesRival = Number(esLocal ? partido.goles_visitante_clupik : partido.goles_local_clupik);
                  return (
                    <article className="partido-equipo" key={partido.id}>
                      <div className="partido-info">
                        <strong>Jornada {partido.jornada || "—"}</strong>
                        <span className="suave">{formatFecha(partido.fecha)}</span>
                      </div>
                      <span className="partido-rival">
                        {rival?.escudo_url && <img src={rival.escudo_url} alt="" width="30" height="30" />}
                        <span>{esLocal ? "vs" : "en"} {rival?.nombre || "Rival"}</span>
                      </span>
                      <strong className="resultado-partido" aria-label={`${golesEquipo} a ${golesRival}`}>
                        {golesEquipo} – {golesRival}
                      </strong>
                      {(partido.estado === "cerrado" || partidosConActa.has(partido.id)) && (
                        <a className="enlace-acta-estadisticas" href={`/actas/${partido.id}?desde=estadisticas&equipo=${equipo.id}`}>
                          Ver acta y cronología <span aria-hidden="true">→</span>
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <section>
            <h2>Estadísticas por jugador</h2>
            {!usuarios.length ? <p className="suave">No hay jugadores de Clupik sincronizados para este equipo.</p> : (
              <div className="tabla-scroll">
                <table className="tabla-con-podio">
                  <thead><tr><th className="num">#</th><th className="num">Dorsal</th><th>Jugador</th><th className="num">1.er gol</th><th className="num">Goles/partido</th><th className="num">🟨</th><th className="num">🟥</th></tr></thead>
                  <tbody>
                    {usuarios.map((usuario, indice) => (
                      <tr key={usuario.id} className={indice < 3 ? `podio podio-${indice + 1}` : ""}>
                        <td className="num">{indice + 1}</td>
                        <td className="num">{usuario.dorsal ?? "–"}</td>
                        <td>
                          <span className="estadistica-jugador">
                            <span className="estadistica-jugador-foto">
                              {usuario.foto && <img src={usuario.foto} alt="" loading="lazy" />}
                            </span>
                            {usuario.nombre}
                          </span>
                        </td>
                        <td className="num">{reloj(usuario.primerGol)}</td>
                        <td className="num">{usuario.mediaGoles.toFixed(2)}</td>
                        <td className="num">{usuario.amarillas}</td>
                        <td className="num">{usuario.rojas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="nota-datos">Se muestran los jugadores de la plantilla sincronizada desde Clupik. La media individual se calcula sobre los partidos con resultado del equipo.</p>
          </section>
        </>
      )}
    </>
  );
}
