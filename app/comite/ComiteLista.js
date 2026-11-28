"use client";

import "../globals.css";
import { useMemo } from "react";
import { useMiEquipo } from "../lib/mi-equipo";
import { useFiltroSesion } from "../lib/filtros-sesion";

const fechaDoc = (valor) => valor
  ? new Date(`${valor}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
  : "Fecha no disponible";

export default function ComiteLista({ documentos }) {
  const [jornadaGuardada, setJornada] = useFiltroSesion("comite:jornada", "");
  const miEquipo = useMiEquipo();
  const [equipoElegido, setEquipoElegido] = useFiltroSesion("comite:equipo", null);

  const jornadas = useMemo(() => [...new Set(documentos.map(({ jornada }) => jornada))]
    .sort((a, b) => {
      if (a == null) return 1;
      if (b == null) return -1;
      return Number(a) - Number(b);
    }), [documentos]);

  const equipos = useMemo(() => {
    const mapa = new Map();
    documentos.forEach((doc) => {
      if (doc.local) mapa.set(String(doc.local_id), doc.local.nombre);
      if (doc.visitante) mapa.set(String(doc.visitante_id), doc.visitante.nombre);
    });
    return [...mapa].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [documentos]);

  const favorito = equipos.some((equipo) => equipo.id === miEquipo) ? miEquipo : "";
  const equipoValido = equipoElegido !== null
    && (equipoElegido === "" || equipos.some((equipo) => equipo.id === equipoElegido));
  const equipoSeleccionado = equipoValido ? equipoElegido : favorito;
  const jornadaSeleccionada = jornadaGuardada === "" || jornadas.some((j) =>
    (j == null ? "sin-jornada" : String(j)) === jornadaGuardada) ? jornadaGuardada : "";

  const filtrados = documentos.filter((doc) => {
    const coincideJornada = jornadaSeleccionada === ""
      || (jornadaSeleccionada === "sin-jornada" ? doc.jornada == null : String(doc.jornada) === jornadaSeleccionada);
    const coincideEquipo = !equipoSeleccionado
      || String(doc.local_id) === equipoSeleccionado
      || String(doc.visitante_id) === equipoSeleccionado;
    return coincideJornada && coincideEquipo;
  });

  return (
    <>
      <div className="actas-filtros" aria-label="Filtrar documentos">
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
          <select value={jornadaSeleccionada} onChange={(e) => setJornada(e.target.value)}>
            <option value="">Todas las jornadas</option>
            {jornadas.map((jornada) => (
              <option key={jornada ?? "sin-jornada"} value={jornada == null ? "sin-jornada" : String(jornada)}>
                {jornada == null ? "Sin jornada" : `Jornada ${jornada}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtrados.length ? (
        <section className="actas-lista" aria-label="Documentos del Comité">
          {filtrados.map((doc) => (
            <article className="acta-partido" key={doc.id}>
              <span className="acta-partido-meta">
                Publicado el {fechaDoc(doc.fecha)} <span aria-hidden="true">·</span> Jornada {doc.jornada || "—"}
                {doc.grupo ? <> <span aria-hidden="true">·</span> {doc.grupo}</> : null}
                {doc.pendiente && <span className="acta-estado">Pendiente de resolución</span>}                
                {!doc.pendiente && <span className="acta-estado">Resuelto</span>}
              </span>
              <span className="acta-cruce">
                <span className="acta-equipo">
                  {doc.local?.escudo_url && <img src={doc.local.escudo_url} alt="" width="34" height="34" />}
                  <strong>{doc.local?.nombre || "Equipo local"}</strong>
                </span>
                <span className="acta-marcador">VS</span>
                <span className="acta-equipo visitante">
                  <strong>{doc.visitante?.nombre || "Equipo visitante"}</strong>
                  {doc.visitante?.escudo_url && <img src={doc.visitante.escudo_url} alt="" width="34" height="34" />}
                </span>
              </span>
              <span className="acta-partido-pie">
                <span>{doc.sanciones ? `${doc.sanciones} ${doc.sanciones === 1 ? "sanción" : "sanciones"}` : "Sin sanciones"}</span>
                <a className="boton-inicio comite-boton-acta" href={`/actas/${doc.partidoId}`}>Ver acta del partido</a>
                <a className="acta-ver-cronologia" href={`/comite/${doc.id}`}>Ver documento <span aria-hidden="true">→</span></a>
              </span>
            </article>
          ))}
        </section>
      ) : (
        <p className="actas-sin-resultados">No hay documentos que coincidan con estos filtros.</p>
      )}
    </>
  );
}
