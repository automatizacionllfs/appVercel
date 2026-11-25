"use client";

import { useState } from "react";
import { guardarMiEquipo, useMiEquipo } from "./lib/mi-equipo";

export default function MiEquipo({ equipos }) {
  const miEquipoId = useMiEquipo();
  const [cambiando, setCambiando] = useState(false);
  if (!equipos.length) return null;

  // Si el id guardado es de otra temporada, se ignora
  const equipo = equipos.find((item) => String(item.id) === miEquipoId);

  if (!equipo || cambiando) {
    return (
      <div className="mi-equipo">
        <label>
          {equipo ? "Cambiar mi equipo" : "Elige tu equipo para acceder más rápido"}
          <select
            value={equipo ? String(equipo.id) : ""}
            onChange={(e) => {
              guardarMiEquipo(e.target.value);
              setCambiando(false);
            }}
          >
            <option value="">Selecciona un equipo</option>
            {equipos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </label>
        {cambiando && <button type="button" className="mini" onClick={() => setCambiando(false)}>Cancelar</button>}
      </div>
    );
  }

  return (
    <div className="mi-equipo mi-equipo-activo">
      <span className="mi-equipo-nombre">
        {equipo.escudo_url && <img src={equipo.escudo_url} alt="" width="28" height="28" />}
        <strong>{equipo.nombre}</strong>
      </span>
      <a href={`/estadisticas?equipo=${equipo.id}`}>Mis estadísticas</a>
      <a href="/actas?mis=1">Mis actas</a>
      <button type="button" className="mini" onClick={() => setCambiando(true)}>Cambiar</button>
      <button type="button" className="mini" onClick={() => guardarMiEquipo("")}>Quitar</button>
    </div>
  );
}