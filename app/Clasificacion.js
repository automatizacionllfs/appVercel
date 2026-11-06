"use client";

import { useMemo, useState } from "react";

function crearTabla(equipos, partidos, grupoId = null) {
  const filas = new Map(
    equipos
      .filter((equipo) => grupoId === null || equipo.grupo_id === grupoId)
      .map((equipo) => [equipo.id, {
        ...equipo,
        jugados: 0,
        ganados: 0,
        empatados: 0,
        perdidos: 0,
        aFavor: 0,
        enContra: 0,
        puntos: 0,
      }]),
  );

  partidos.forEach((partido) => {
    const local = filas.get(partido.local_id);
    const visitante = filas.get(partido.visitante_id);
    if (!local || !visitante) return;

    const golesLocal = Number(partido.goles_local_clupik);
    const golesVisitante = Number(partido.goles_visitante_clupik);
    local.jugados += 1;
    visitante.jugados += 1;
    local.aFavor += golesLocal;
    local.enContra += golesVisitante;
    visitante.aFavor += golesVisitante;
    visitante.enContra += golesLocal;

    if (golesLocal > golesVisitante) {
      local.ganados += 1;
      visitante.perdidos += 1;
      local.puntos += 3;
    } else if (golesLocal < golesVisitante) {
      visitante.ganados += 1;
      local.perdidos += 1;
      visitante.puntos += 3;
    } else {
      local.empatados += 1;
      visitante.empatados += 1;
      local.puntos += 1;
      visitante.puntos += 1;
    }
  });

  return [...filas.values()].sort((a, b) =>
    b.puntos - a.puntos ||
    (b.aFavor - b.enContra) - (a.aFavor - a.enContra) ||
    b.aFavor - a.aFavor ||
    a.nombre.localeCompare(b.nombre, "es"),
  );
}

function TablaLiga({ filas }) {
  if (!filas.length) return <p className="suave">Todavía no hay resultados para mostrar.</p>;
  return (
    <div className="tabla-scroll">
      <table>
        <thead>
          <tr><th className="num">#</th><th>Equipo</th><th className="num">PJ</th><th className="num">DG</th><th className="num">Pts</th></tr>
        </thead>
        <tbody>
          {filas.map((equipo, i) => (
            <tr key={equipo.id}>
              <td className="num">{i + 1}</td>
              <td>
                <span className="nombre-equipo">
                  {equipo.escudo_url && <img src={equipo.escudo_url} alt="" width="28" height="28" />}
                  {equipo.nombre}
                </span>
              </td>
              <td className="num">{equipo.jugados}</td>
              <td className="num">{equipo.aFavor - equipo.enContra}</td>
              <td className="num"><strong>{equipo.puntos}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
      <table className="tabla-goleadores">
        <thead><tr><th className="num">#</th><th>Jugador</th><th className="num">Goles</th></tr></thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={`${fila.jugador_id}-${fila.equipo_id}`} className={posiciones[i] <= 3 ? `podio podio-${posiciones[i]}` : ""}>
              <td className="num">{posiciones[i]}</td>
              <td>{fila.jugador}<div className="suave">{fila.equipo}</div></td>
              <td className="num"><strong>{fila.goles}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Clasificacion({ goleadores, equipos, partidos }) {
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
  const tablaGeneral = useMemo(() => crearTabla(equipos, partidos), [equipos, partidos]);
  const tablaGrupo = useMemo(
    () => crearTabla(equipos, partidos, seleccionGrupo),
    [equipos, partidos, seleccionGrupo],
  );
  const equipoSeleccionado = equipos.find((equipo) => String(equipo.id) === equipoId);
  const goleadoresEquipo = equipoSeleccionado
    ? goleadores.filter((fila) => fila.equipo_id === equipoSeleccionado.id)
    : [];
  const goleadoresGrupo = vista === "grupos"
    ? goleadores.filter((fila) => fila.grupo === grupos.find((grupo) => grupo.id === seleccionGrupo)?.nombre)
    : goleadores;

  return (
    <>
      <nav className="pestanas" aria-label="Vistas de clasificación">
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
          <h2>Clasificación general</h2>
          <TablaLiga filas={tablaGeneral} />
        </section>
      )}

      {vista === "grupos" && (
        <section>
          <h2>Clasificación por grupos</h2>
          <div className="filtros-grupo" aria-label="Seleccionar grupo">
            {grupos.map((grupo) => (
              <button key={grupo.id} type="button" className={seleccionGrupo === grupo.id ? "on" : ""} onClick={() => setGrupoId(grupo.id)}>
                {grupo.nombre}
              </button>
            ))}
          </div>
          <TablaLiga filas={tablaGrupo} />
        </section>
      )}

      {vista === "equipos" && (
        <section>
          <h2>Clasificación por equipo</h2>
          <label className="selector-equipo">
            Equipo
            <select value={equipoId} onChange={(event) => setEquipoId(event.target.value)}>
              <option value="">Selecciona un equipo</option>
              {equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>)}
            </select>
          </label>
          {equipoSeleccionado && (
            <>
              <TablaLiga filas={tablaGeneral.filter((equipo) => equipo.id === equipoSeleccionado.id)} />
              <h2>Goleadores de {equipoSeleccionado.nombre}</h2>
              <TablaGoleadores filas={goleadoresEquipo} />
            </>
          )}
        </section>
      )}

      {vista !== "equipos" && (
        <section>
          <h2>{vista === "grupos" ? `Goleadores · ${grupos.find((grupo) => grupo.id === seleccionGrupo)?.nombre || ""}` : "Máximos goleadores"}</h2>
          <TablaGoleadores filas={goleadoresGrupo} />
        </section>
      )}
      <p className="nota-datos">La clasificación se calcula con los resultados sincronizados de Clupik.</p>
    </>
  );
}
