"use client";

import { useMemo, useState } from "react";
import AvatarJugador from "../AvatarJugador";
import { marcarSegundasAmarillas } from "../../lib/tarjetas";
import { resultadoPendiente, tieneResultado } from "../../lib/partidos";
import GoleadorJornadaCard from "./GoleadorJornadaCard";

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
    rojas: eventos.filter((evento) => evento.tipo === "roja" || evento.segundaAmarilla).length,
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
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");
  const equipo = equipos.find((item) => String(item.id) === equipoId);
  const eventosConSegundasAmarillas = useMemo(() => marcarSegundasAmarillas(eventos), [eventos]);
  const partidosConActa = new Set(eventosConSegundasAmarillas.map((evento) => evento.partido_id));
  const partidosDisputados = partidos.filter(tieneResultado);
  const resumenLiga = useMemo(() => {
    const goles = eventosConSegundasAmarillas.filter((evento) => evento.tipo === "gol").length;
    return {
      partidos: partidosDisputados.length,
      goles,
      mediaGoles: partidosDisputados.length ? goles / partidosDisputados.length : 0,
      amarillas: eventosConSegundasAmarillas.filter((evento) => evento.tipo === "amarilla").length,
      rojas: eventosConSegundasAmarillas.filter((evento) => evento.tipo === "roja" || evento.segundaAmarilla).length,
      equipos: equipos.length,
      jugadores: new Set(plantilla.map((fila) => fila.jugador?.id).filter(Boolean)).size,
    };
  }, [eventosConSegundasAmarillas, partidosDisputados.length, equipos.length, plantilla]);
  const jornadas = useMemo(() => {
    const partidosConEventos = new Set(eventosConSegundasAmarillas.map((evento) => evento.partido_id));
    return [...new Set(
      partidos
        .filter((partido) => tieneResultado(partido) || partidosConEventos.has(partido.id))
        .map((partido) => partido.jornada)
        .filter((jornada) => jornada != null),
    )].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
  }, [partidos, eventosConSegundasAmarillas]);
  const goleadoresPorJornada = useMemo(() => {
    const partidoPorId = new Map(partidos.map((partido) => [partido.id, partido]));
    const equipoPorId = new Map(equipos.map((item) => [item.id, item]));
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
  const partidosEquipo = equipo
    ? partidos.filter((partido) =>
      (partido.local_id === equipo.id || partido.visitante_id === equipo.id) &&
      (tieneResultado(partido) || resultadoPendiente(partido)),
    ).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
    : [];
  const partidosConResultado = partidosEquipo.filter(tieneResultado);
  const eventosEquipo = equipo ? eventosConSegundasAmarillas.filter((evento) => evento.equipo_id === equipo.id) : [];
  const resumenEquipo = useMemo(() => resumen(eventosEquipo, partidosConResultado.length), [eventosEquipo, partidosConResultado.length]);

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
          ...resumen(filas, partidosConResultado.length),
        };
      })
      .sort((a, b) => b.goles - a.goles || (a.dorsal ?? 999) - (b.dorsal ?? 999) || a.nombre.localeCompare(b.nombre, "es"));
  }, [plantilla, equipo?.id, eventosEquipo, partidosConResultado.length]);

  return (
    <>
      <section className="estadistica-card resumen-liga">
        <h2>Resumen de la liga</h2>
        <dl className="metricas metricas-liga">
          <div><dt>Partidos disputados</dt><dd>{resumenLiga.partidos}</dd></div>
          <div><dt>Goles</dt><dd>{resumenLiga.goles}</dd></div>
          <div><dt>Goles por partido</dt><dd>{resumenLiga.mediaGoles.toFixed(2)}</dd></div>
          <div><dt>Tarjetas amarillas</dt><dd>{resumenLiga.amarillas}</dd></div>
          <div><dt>Tarjetas rojas</dt><dd>{resumenLiga.rojas}</dd></div>
          <div><dt>Equipos</dt><dd>{resumenLiga.equipos}</dd></div>
          <div><dt>Jugadores</dt><dd>{resumenLiga.jugadores}</dd></div>
        </dl>
        <p className="suave">Los goles y las tarjetas corresponden a los eventos registrados en actas.</p>
      </section>

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
            partidosJugados={partidosConResultado.length}
            nota="estadísticas de eventos registrados en acta"
          />
          <section>
            <h2>Partidos disputados</h2>
            {!partidosEquipo.length ? <p className="suave">Todavía no hay partidos disputados para este equipo.</p> : (
              <div className="partidos-equipo">
                {partidosEquipo.map((partido) => {
                  const local = equipos.find((item) => item.id === partido.local_id);
                  const visitante = equipos.find((item) => item.id === partido.visitante_id);
                  const esLocal = partido.local_id === equipo.id;
                  const rival = esLocal ? visitante : local;
                  const pendiente = resultadoPendiente(partido);
                  const golesEquipo = esLocal ? partido.goles_local_clupik : partido.goles_visitante_clupik;
                  const golesRival = esLocal ? partido.goles_visitante_clupik : partido.goles_local_clupik;
                  return (
                    <article className="partido-equipo" key={partido.id}>
                      <div className="partido-info">
                        <strong>Jornada {partido.jornada || "—"}</strong>
                        <span className="suave">{formatFecha(partido.fecha)}</span>
                      </div>
                      <span className="partido-rival">
                        {rival?.escudo_url && <img src={rival.escudo_url} alt="" width="30" height="30" />}
                        <span>{rival?.nombre || "Rival"}</span>
                      </span>
                      <strong className={`resultado-partido ${pendiente ? "pendiente" : ""}`} aria-label={pendiente ? "Resultado pendiente" : `${golesEquipo} a ${golesRival}`}>
                        {pendiente ? "Resultado pendiente" : `${golesEquipo} – ${golesRival}`}
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
                              <AvatarJugador src={usuario.foto} />
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
