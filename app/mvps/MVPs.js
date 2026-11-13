"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AvatarJugador from "../AvatarJugador";

const normalizarNombre = (nombre) => nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

export default function MVPs({ ranking }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 10;
  const consulta = normalizarNombre(busqueda.trim());
  const filasFiltradas = ranking
    .map((fila, indice) => ({ fila, indice }))
    .filter(({ fila }) => !consulta || normalizarNombre(fila.jugador).includes(consulta));
  const totalPaginas = Math.ceil(filasFiltradas.length / porPagina);
  const paginaActual = Math.min(pagina, Math.max(totalPaginas, 1));
  const rankingPagina = filasFiltradas.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  return (
    <section>
      <h2>Ranking de MVPs</h2>
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
      {!ranking.length ? (
        <p className="suave">Todavía no se han seleccionado MVPs.</p>
      ) : !filasFiltradas.length ? (
        <p className="suave" role="status">No hay jugadores que coincidan con “{busqueda.trim()}”.</p>
      ) : (
        <>
          <div className="tabla-scroll">
            <table className="tabla-mvps tabla-con-podio">
              <thead><tr><th className="num">#</th><th>Jugador</th><th>Equipo</th><th className="num">Premios</th></tr></thead>
              <tbody>
                {rankingPagina.map(({ fila, indice }) => (
                  <tr
                    key={`${fila.jugadorId}-${fila.equipoId}`}
                    className={indice < 3 ? `podio podio-${indice + 1}` : ""}
                    role="link"
                    tabIndex={0}
                    aria-label={`${fila.jugador}, ${fila.equipo}, ${fila.premios} premios MVP. Ver historial`}
                    onClick={() => router.push(`/jugadores/${fila.jugadorId}?equipo=${fila.equipoId}&origen=mvps`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") router.push(`/jugadores/${fila.jugadorId}?equipo=${fila.equipoId}&origen=mvps`);
                    }}
                  >
                    <td className="num">{indice + 1}</td>
                    <td>
                      <span className="estadistica-jugador">
                        <span className="estadistica-jugador-foto"><AvatarJugador src={fila.foto} /></span>
                        {fila.jugador}
                      </span>
                    </td>
                    <td>{fila.equipo}</td>
                    <td className="num">
                      <span className="goleador-goles">
                        <strong>{fila.premios}</strong>
                        <span className="goleador-flecha" aria-hidden="true">&gt;</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPaginas > 1 && (
            <nav className="paginacion-goleadores" aria-label="Paginación del ranking de MVPs">
              <button type="button" onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual === 1}>Anterior</button>
              <span aria-live="polite">Página {paginaActual} de {totalPaginas}</span>
              <button type="button" onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual === totalPaginas}>Siguiente</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
