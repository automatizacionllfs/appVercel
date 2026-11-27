"use client";

import AvatarJugador from "../AvatarJugador";
import { guardarMiEquipo, guardarMiJugador, useMiEquipo, useMiJugador } from "../lib/mi-equipo";

export default function MiJugador({ equipos, plantilla }) {
  const miEquipoId = useMiEquipo();
  const miJugadorId = useMiJugador();

  const equipo = equipos.find((e) => String(e.id) === miEquipoId);
  const jugadoresEquipo = equipo ? plantilla.filter((j) => j.equipoId === equipo.id) : [];
  const jugador = jugadoresEquipo.find((j) => String(j.id) === miJugadorId);

  if (!equipos.length) return <p className="suave">Todavía no hay equipos disponibles.</p>;

  return (
    <>
      <p className="suave">
        Elige tu equipo y tu nombre para acceder rápido a tu historial. Se guarda solo en este
        dispositivo y no hace falta iniciar sesión.
      </p>

      <section className="mi-jugador-form">
        <label>
          Equipo
          <select value={equipo ? String(equipo.id) : ""} onChange={(e) => guardarMiEquipo(e.target.value)}>
            <option value="">Selecciona tu equipo</option>
            {equipos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </label>
        <label>
          Jugador
          <select
            value={jugador ? String(jugador.id) : ""}
            disabled={!equipo}
            onChange={(e) => guardarMiJugador(e.target.value)}
          >
            <option value="">{equipo ? "Selecciona tu nombre" : "Primero elige un equipo"}</option>
            {jugadoresEquipo.map((j) => (
              <option key={j.id} value={j.id}>
                {j.dorsal == null ? "–" : `#${j.dorsal}`} {j.nombre}
              </option>
            ))}
          </select>
        </label>
      </section>

      {equipo && jugador && (
        <section className="mi-jugador-card">
          <AvatarJugador src={jugador.foto} className="mi-jugador-foto" alt={`Foto de ${jugador.nombre}`} />
          <div className="mi-jugador-datos">
            <span className="suave">{equipo.nombre}</span>
            <h2>{jugador.nombre}</h2>
            <span className="suave">Dorsal {jugador.dorsal ?? "—"}</span>
          </div>
          <div className="mi-jugador-enlaces">
            <a className="boton-inicio" href={`/jugadores/${jugador.id}?equipo=${equipo.id}&origen=jugador`}>Mi historial</a>
            <a className="boton-inicio" href={`/estadisticas?equipo=${equipo.id}`}>Estadísticas de mi equipo</a>
            <a className="boton-inicio" href="/actas">Mis actas</a>
          </div>
          <button type="button" className="mini" onClick={() => guardarMiJugador("")}>No soy yo</button>
        </section>
      )}
    </>
  );
}