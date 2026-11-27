"use client";

import { resultadoPendiente } from "../../lib/partidos";
import { useMiEquipo } from "../lib/mi-equipo";
import { useMemo } from "react";
import { useFiltroSesion } from "../lib/filtros-sesion";


const fecha = (valor) => valor
  ? new Date(valor).toLocaleDateString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  : "Fecha no disponible";



export default function ActasLista({ partidos }) {
  const [jornadaSeleccionada, setJornadaSeleccionada] = useFiltroSesion("actas:jornada", "");
  const [estadoSeleccionado, setEstadoSeleccionado] = useFiltroSesion("actas:estado", "todas");
  const miEquipo = useMiEquipo();
  const [equipoElegido, setEquipoElegido] = useFiltroSesion("actas:equipo", null);

  const jornadas = useMemo(() => [...new Set(partidos.map(({ jornada }) => jornada))]
    .sort((a, b) => {
      if (a == null) return 1;
      if (b == null) return -1;
      return Number(a) - Number(b);
    }), [partidos]);

  const equipos = useMemo(() => {
    const mapa = new Map();
    partidos.forEach((partido) => {
      if (partido.local) mapa.set(String(partido.local_id), partido.local.nombre);
      if (partido.visitante) mapa.set(String(partido.visitante_id), partido.visitante.nombre);
    });
    return [...mapa]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [partidos]);

  // Si el favorito guardado no existe en esta temporada, se ignora
  const favorito = equipos.some((equipo) => equipo.id === miEquipo) ? miEquipo : "";
  const equipoValido = equipoElegido !== null
    && (equipoElegido === "" || equipos.some((equipo) => equipo.id === equipoElegido));
  const equipoSeleccionado = equipoValido ? equipoElegido : favorito;
  const jornadaSeleccionada = jornadaGuardada === "" || jornadas.some((j) =>
    (j == null ? "sin-jornada" : String(j)) === jornadaGuardada) ? jornadaGuardada : ""; 

  const partidosFiltrados = partidos.filter((partido) => {
    const coincideJornada = jornadaSeleccionada === ""
      || (jornadaSeleccionada === "sin-jornada"
        ? partido.jornada == null
        : String(partido.jornada) === jornadaSeleccionada);
    const coincideEstado = estadoSeleccionado === "todas"
      || (estadoSeleccionado === "cerrada" ? partido.estado === "cerrado" : partido.estado !== "cerrado");
    const coincideEquipo = !equipoSeleccionado
      || String(partido.local_id) === equipoSeleccionado
      || String(partido.visitante_id) === equipoSeleccionado;
    return coincideJornada && coincideEstado && coincideEquipo;
  });

  return (
    <>
      <div className="actas-filtros" aria-label="Filtrar actas">
        <label>
          Equipo
          <select value={equipoSeleccionado} onChange={(e) => setEquipoElegido(e.target.value)}>
            <option value="">Todos los equipos</option>
            {equipos.map((equipo) => (
              <option key={equipo.id} value={equipo.id}>
                {equipo.nombre}{equipo.id === favorito ? " ★ Favorito" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jornada
          <select value={jornadaSeleccionada} onChange={(e) => setJornadaSeleccionada(e.target.value)}>
            <option value="">Todas las jornadas</option>
            {jornadas.map((jornada) => (
              <option key={jornada ?? "sin-jornada"} value={jornada == null ? "sin-jornada" : String(jornada)}>
                {jornada == null ? "Sin jornada" : `Jornada ${jornada}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Acta
          <select value={estadoSeleccionado} onChange={(e) => setEstadoSeleccionado(e.target.value)}>
            <option value="todas">Todas</option>
            <option value="cerrada">Cerrada</option>
            <option value="no-cerrada">No cerrada</option>
          </select>
        </label>
      </div>
      {partidosFiltrados.length ? (
        <section className="actas-lista" aria-label="Partidos filtrados">
          {partidosFiltrados.map((partido) => {
            const pendiente = resultadoPendiente(partido);
            const contenido = (
              <>
                <span className="acta-partido-meta">
                  Jornada {partido.jornada || "—"} <span aria-hidden="true">·</span> {fecha(partido.fecha)}
                  <span className={`acta-estado ${partido.estado === "cerrado" ? "cerrada" : ""} ${!partido.actaDigitalizada ? "pendiente" : ""}`}>
                    {partido.estado === "cerrado" ? "Acta cerrada" : partido.actaDigitalizada ? "Acta en curso" : "Sin acta digital"}
                  </span>
                </span>
                <span className="acta-cruce">
                  <span className="acta-equipo">
                    {partido.local?.escudo_url && <img src={partido.local.escudo_url} alt="" width="34" height="34" />}
                    <strong>{partido.local?.nombre || "Equipo local"}</strong>
                  </span>
                  <span className={`acta-marcador ${pendiente ? "pendiente" : ""}`} aria-label={pendiente ? "Resultado pendiente" : "Marcador sincronizado"}>
                    {pendiente ? "Resultado pendiente" : `${partido.goles_local_clupik ?? "—"} : ${partido.goles_visitante_clupik ?? "—"}`}
                  </span>
                  <span className="acta-equipo visitante">
                    <strong>{partido.visitante?.nombre || "Equipo visitante"}</strong>
                    {partido.visitante?.escudo_url && <img src={partido.visitante.escudo_url} alt="" width="34" height="34" />}
                  </span>
                </span>
                <span className="acta-partido-pie">
                  <span>
                    {partido.resumen.eventos
                      ? `${partido.resumen.eventos} eventos registrados`
                      : partido.resumen.jugadoresAlineacion
                        ? "Alineación cargada"
                        : "Acta pendiente de digitalizar"}
                  </span>
                  {partido.actaDigitalizada && (
                    <span className="acta-ver-cronologia">Ver cronología <span aria-hidden="true">→</span></span>
                  )}
                </span>
              </>
            );
            return partido.actaDigitalizada
              ? <a className="acta-partido" href={`/actas/${partido.id}`} key={partido.id}>{contenido}</a>
              : <article className="acta-partido" key={partido.id}>{contenido}</article>;
          })}
        </section>
      ) : (
        <p className="actas-sin-resultados">No hay partidos que coincidan con estos filtros.</p>
      )}
    </>
  );
}
