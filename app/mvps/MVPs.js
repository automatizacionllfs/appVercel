"use client";

import { useRouter } from "next/navigation";

export default function MVPs({ ranking }) {
  const router = useRouter();

  if (!ranking.length) return <p className="suave">Todavía no se han seleccionado MVPs.</p>;

  return (
    <section>
      <h2>Ranking de MVPs</h2>
      <div className="tabla-scroll">
        <table className="tabla-mvps tabla-con-podio">
          <thead><tr><th className="num">#</th><th>Jugador</th><th>Equipo</th><th className="num">Premios</th></tr></thead>
          <tbody>
            {ranking.map((fila, indice) => (
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
                    <span className="estadistica-jugador-foto">{fila.foto && <img src={fila.foto} alt="" loading="lazy" />}</span>
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
    </section>
  );
}
