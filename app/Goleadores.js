"use client";

import { useMemo, useState } from "react";

function TablaGoleadores({ filas }) {
  if (!filas.length) return <p className="suave">Todavía no hay goles registrados.</p>;
  const posiciones = filas.map((fila, i) =>
    i > 0 && fila.goles === filas[i - 1].goles ? null : i + 1,
  );
  for (let i = 0; i < posiciones.length; i += 1) {
    if (posiciones[i] === null) posiciones[i] = posiciones[i - 1];
  }

  return (
    <div className="tabla-scroll">
      <table className="tabla-goleadores tabla-con-podio">
        <thead><tr><th className="num">#</th><th>Jugador</th><th className="num">Goles</th></tr></thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={`${fila.jugador_id}-${fila.equipo_id}`} className={posiciones[i] <= 3 ? `podio podio-${posiciones[i]}` : ""}>
              <td className="num">{posiciones[i]}</td>
              <td>
                {fila.jugador}<div className="suave">{fila.equipo}</div>
              </td>
              <td className="num">
                <span className="goleador-goles">
                  <a className="enlace-acta-estadisticas" href={`/jugadores/${fila.jugador_id}?equipo=${fila.equipo_id}`}>Historial</a>
                  <strong>{fila.goles}</strong>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Goleadores({ goleadores, equipos }) {
  const [vista, setVista] = useState("general");
  const grupos = useMemo(() => {
    const vistos = new Map();
    equipos.forEach((equipo) => {
      if (equipo.grupo_id && equipo.grupo?.nombre) vistos.set(equipo.grupo_id, equipo.grupo.nombre);
    });
    return [...vistos].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [equipos]);
  const [grupoId, setGrupoId] = useState(null);
  const [equipoId, setEquipoId] = useState("");
  const seleccionGrupo = grupos.some((grupo) => grupo.id === grupoId) ? grupoId : grupos[0]?.id;
  const equipoSeleccionado = equipos.find((equipo) => String(equipo.id) === equipoId);
  const goleadoresEquipo = equipoSeleccionado
    ? goleadores.filter((fila) => fila.equipo_id === equipoSeleccionado.id)
    : [];
  const goleadoresGrupo = vista === "grupos"
    ? goleadores.filter((fila) => fila.grupo === grupos.find((grupo) => grupo.id === seleccionGrupo)?.nombre)
    : goleadores;

  return (
    <>
      <nav className="pestanas" aria-label="Vistas de goleadores">
        {[
          ["general", "Tabla general"],
          ["grupos", "Por grupos"],
          ["equipos", "Por equipos"],
        ].map(([id, label]) => (
          <button key={id} type="button" className={vista === id ? "activa" : ""} aria-pressed={vista === id} onClick={() => setVista(id)}>
            {label}
          </button>
        ))}
      </nav>

      {vista === "general" && (
        <section>
          <h2>Goleadores de la liga</h2>
          <TablaGoleadores filas={goleadores} />
        </section>
      )}

      {vista === "grupos" && (
        <section>
          <h2>Goleadores por grupo</h2>
          <div className="filtros-grupo" aria-label="Seleccionar grupo">
            {grupos.map((grupo) => (
              <button key={grupo.id} type="button" className={seleccionGrupo === grupo.id ? "on" : ""} aria-pressed={seleccionGrupo === grupo.id} onClick={() => setGrupoId(grupo.id)}>
                {grupo.nombre}
              </button>
            ))}
          </div>
          <TablaGoleadores filas={goleadoresGrupo} />
        </section>
      )}

      {vista === "equipos" && (
        <section>
          <h2>Goleadores por equipo</h2>
          <label className="selector-equipo">
            Equipo
            <select value={equipoId} onChange={(event) => setEquipoId(event.target.value)}>
              <option value="">Selecciona un equipo</option>
              {equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>)}
            </select>
          </label>
          {equipoSeleccionado && <TablaGoleadores filas={goleadoresEquipo} />}
        </section>
      )}

    </>
  );
}
