"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const normalizarNombre = (nombre) => nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

function TablaGoleadores({ filas }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 10;
  const consulta = normalizarNombre(busqueda.trim());
  const filasFiltradas = filas
    .map((fila, indice) => ({ fila, indice }))
    .filter(({ fila }) => !consulta || normalizarNombre(fila.jugador).includes(consulta));
  const totalPaginas = Math.ceil(filasFiltradas.length / porPagina);
  const paginaActual = Math.min(pagina, Math.max(totalPaginas, 1));
  const posiciones = filas.map((fila, i) =>
    i > 0 && fila.goles === filas[i - 1].goles ? null : i + 1,
  );
  for (let i = 0; i < posiciones.length; i += 1) {
    if (posiciones[i] === null) posiciones[i] = posiciones[i - 1];
  }
  const filasPagina = filasFiltradas.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  return (
    <>
      <label className="buscador-goleadores">
        Buscar jugador
        <input
          type="search"
          value={busqueda}
          placeholder="Nombre del jugador"
          onChange={(event) => {
            setBusqueda(event.target.value);
            setPagina(1);
          }}
        />
      </label>
      {!filas.length ? (
        <p className="suave">Todavía no hay goles registrados.</p>
      ) : !filasFiltradas.length ? (
        <p className="suave" role="status">No hay goleadores que coincidan con “{busqueda.trim()}”.</p>
      ) : (
        <>
          <div className="tabla-scroll">
            <table className="tabla-goleadores tabla-con-podio">
              <thead><tr><th className="num">#</th><th>Jugador</th><th className="num">Goles</th></tr></thead>
              <tbody>
                {filasPagina.map(({ fila, indice }) => {
                  return (
                    <tr
                      key={`${fila.jugador_id}-${fila.equipo_id}`}
                      className={posiciones[indice] <= 3 ? `podio podio-${posiciones[indice]}` : ""}
                      role="link"
                      tabIndex={0}
                      aria-label={`${fila.jugador}, ${fila.equipo}, ${fila.goles} goles. Ver historial`}
                      onClick={() => router.push(`/jugadores/${fila.jugador_id}?equipo=${fila.equipo_id}&origen=goleadores`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") router.push(`/jugadores/${fila.jugador_id}?equipo=${fila.equipo_id}&origen=goleadores`);
                      }}
                    >
                      <td className="num">{posiciones[indice]}</td>
                      <td>
                        <span className="estadistica-jugador">
                          <span className="estadistica-jugador-foto">
                            {fila.foto && <img src={fila.foto} alt="" loading="lazy" />}
                          </span>
                          <span className="goleador-identidad">{fila.jugador}<span className="suave">{fila.equipo}</span></span>
                        </span>
                      </td>
                      <td className="num">
                        <span className="goleador-goles">
                          <strong>{fila.goles}</strong>
                          <span className="goleador-flecha" aria-hidden="true">&gt;</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPaginas > 1 && (
            <nav className="paginacion-goleadores" aria-label="Paginación de goleadores">
              <button type="button" onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual === 1}>Anterior</button>
              <span aria-live="polite">Página {paginaActual} de {totalPaginas}</span>
              <button type="button" onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual === totalPaginas}>Siguiente</button>
            </nav>
          )}
        </>
      )}
    </>
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
          <TablaGoleadores key="general" filas={goleadores} />
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
          <TablaGoleadores key={seleccionGrupo} filas={goleadoresGrupo} />
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
          {equipoSeleccionado && <TablaGoleadores key={equipoSeleccionado.id} filas={goleadoresEquipo} />}
        </section>
      )}

    </>
  );
}
