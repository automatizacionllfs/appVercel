"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EntrenadorLogin({ equipos }) {
  const router = useRouter();
  const [equipoId, setEquipoId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(event) {
    event.preventDefault();
    setError("");
    setCargando(true);
    try {
      const response = await fetch("/api/entrenador/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipoId, pin }),
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.error || "No se pudo iniciar sesión.");
      router.replace("/entrenador");
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main>
      <h1>Acceso de entrenadores</h1>
      <p>Selecciona tu equipo e introduce el PIN que te ha facilitado la organización.</p>
      <form className="entrenador-login" onSubmit={entrar}>
        <label>Equipo
          <select value={equipoId} onChange={(event) => setEquipoId(event.target.value)} required>
            <option value="">Selecciona un equipo</option>
            {equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>)}
          </select>
        </label>
        <label>PIN de 6 dígitos
          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primario" type="submit" disabled={cargando}>
          {cargando ? "Comprobando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
