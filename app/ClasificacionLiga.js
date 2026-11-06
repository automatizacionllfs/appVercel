"use client";

import { useMemo, useState } from "react";

function calcularTabla(equipos, partidos, grupoId) {
  const filas = new Map(
    equipos
      .filter((equipo) => grupoId === null || equipo.grupo_id === grupoId)
      .map((equipo) => [equipo.id, {
        ...equipo,
        jugados: 0,
        ganados: 0,
        empatados: 0,
        perdidos: 0,
        golesFavor: 0,
        golesContra: 0,
        puntos: 0,
      }]),
  );

  partidos.forEach((partido) => {
    const local = filas.get(partido.local_id);
    const visitante = filas.get(partido.visitante_id);
    if (!local || !visitante || partido.goles_local_clupik === null || partido.goles_visitante_clupik === null) return;

    const golesLocal = Number(partido.goles_local_clupik);
    const golesVisitante = Number(partido.goles_visitante_clupik);
    local.jugados += 1;
    visitante.jugados += 1;
    local.golesFavor += golesLocal;
    local.golesContra += golesVisitante;
    visitante.golesFavor += golesVisitante;
    visitante.golesContra += golesLocal;

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
    (b.golesFavor - b.golesContra) - (a.golesFavor - a.golesContra) ||
    b.golesFavor - a.golesFavor ||
    a.nombre.localeCompare(b.nombre, "es"),
  );
}

function TablaLiga({ filas }) {
  if (!filas.length) return <p className="suave">Todavía no hay equipos para mostrar.</p>;
  return (
    <div className="tabla-scroll">
      <table className="tabla-liga tabla-con-podio">
        <thead>
          <tr>
            <th className="num">#</th><th>Equipo</th><th className="num">PJ</th>
            <th className="num">PG</th><th className="num">PE</th><th className="num">PP</th>
            <th className="num" title="Goles a favor">GF</th><th className="num" title="Goles en contra">GC</th><th className="num">Puntos</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((equipo, i) => (
            <tr key={equipo.id} className={i < 3 ? `podio podio-${i + 1}` : ""}>
              <td className="num">{i + 1}</td>
              <td>
                <span className="nombre-equipo">
                  {equipo.escudo_url && <img src={equipo.escudo_url} alt="" width="28" height="28" />}
                  {equipo.nombre}
                </span>
              </td>
              <td className="num">{equipo.jugados}</td>
              <td className="num">{equipo.ganados}</td>
              <td className="num">{equipo.empatados}</td>
              <td className="num">{equipo.perdidos}</td>
              <td className="num">{equipo.golesFavor}</td>
              <td className="num">{equipo.golesContra}</td>
              <td className="num"><strong>{equipo.puntos}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ClasificacionLiga({ equipos, partidos }) {
  const grupos = useMemo(() => {
    const vistos = new Map();
    equipos.forEach((equipo) => {
      if (equipo.grupo_id && equipo.grupo?.nombre) vistos.set(equipo.grupo_id, equipo.grupo.nombre);
    });
    return [...vistos].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [equipos]);
  const [vista, setVista] = useState("general");
  const [grupoId, setGrupoId] = useState(null);
  const seleccionGrupo = grupos.some((grupo) => grupo.id === grupoId) ? grupoId : grupos[0]?.id;
  const general = useMemo(() => calcularTabla(equipos, partidos, null), [equipos, partidos]);
  const grupo = useMemo(() => calcularTabla(equipos, partidos, seleccionGrupo), [equipos, partidos, seleccionGrupo]);

  return (
    <>
      <nav className="pestanas" aria-label="Vistas de clasificación">
        <button type="button" className={vista === "general" ? "activa" : ""} aria-pressed={vista === "general"} onClick={() => setVista("general")}>Tabla general</button>
        <button type="button" className={vista === "grupos" ? "activa" : ""} aria-pressed={vista === "grupos"} onClick={() => setVista("grupos")}>Por grupos</button>
      </nav>
      {vista === "general" ? (
        <section>
          <h2>Clasificación general</h2>
          <TablaLiga filas={general} />
        </section>
      ) : (
        <section>
          <h2>Clasificación por grupos</h2>
          <div className="filtros-grupo" aria-label="Seleccionar grupo">
            {grupos.map((item) => (
              <button key={item.id} type="button" className={seleccionGrupo === item.id ? "on" : ""} aria-pressed={seleccionGrupo === item.id} onClick={() => setGrupoId(item.id)}>
                {item.nombre}
              </button>
            ))}
          </div>
          <TablaLiga filas={grupo} />
        </section>
      )}
      <p className="nota-datos">La clasificación se calcula con los marcadores de los partidos jugados.</p>
    </>
  );
}
