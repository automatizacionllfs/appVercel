"use client";

import { useState } from "react";
import AvatarJugador from "../AvatarJugador";

export default function AlineacionActa({ local, visitante, alineacionLocal = [], alineacionVisitante = [] }) {
  const [activo, setActivo] = useState("local");
  const equipos = [
    { clave: "local", nombre: local?.nombre || "Equipo local", jugadores: alineacionLocal },
    { clave: "visitante", nombre: visitante?.nombre || "Equipo visitante", jugadores: alineacionVisitante },
  ];
  const seleccionado = equipos.find((equipo) => equipo.clave === activo);
  const hayAlineacion = alineacionLocal.length + alineacionVisitante.length > 0;

  return (
    <details className="acta-alineacion">
      <summary>
        <span className="acta-alineacion-titulo">Alineación del partido</span>
      </summary>
      <div className="acta-alineacion-contenido">
        {!hayAlineacion ? (
          <p className="suave">Todavía no se ha guardado la alineación de este partido.</p>
        ) : (
          <>
            <div className="fila">
              {equipos.map(({ clave, nombre }) => (
                <button
                  key={clave}
                  type="button"
                  className={activo === clave ? "on" : ""}
                  aria-pressed={activo === clave}
                  onClick={() => setActivo(clave)}
                >
                  {nombre}
                </button>
              ))}
            </div>
            <section className="acta-alineacion-equipo" style={{ marginTop: 12 }}>
              {!seleccionado.jugadores.length ? <p className="suave">Sin jugadores guardados.</p> : (
                <ul>
                  {seleccionado.jugadores.map((jugador) => (
                    <li key={jugador.jugador_id}>
                      <span className="acta-alineacion-dorsal">{jugador.entrenador ? "E" : jugador.dorsal ?? "–"}</span>
                      <AvatarJugador src={jugador.foto} />
                      <strong>{jugador.nombre}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </details>
  );
}
