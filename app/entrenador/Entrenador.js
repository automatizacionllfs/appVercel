"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const fecha = (valor, conHora = true) => new Date(valor).toLocaleString("es-ES", {
  timeZone: "Europe/Madrid",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
});

export default function Entrenador() {
  const router = useRouter();
  const [partidos, setPartidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [selecciones, setSelecciones] = useState({});
  const [guardando, setGuardando] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    fetch("/api/entrenador/partidos", { cache: "no-store" })
      .then(async (response) => {
        const resultado = await response.json();
        if (response.status === 401) {
          router.replace("/entrenador/login");
          return;
        }
        if (!response.ok) throw new Error(resultado.error || "No se pudieron cargar los partidos.");
        setPartidos(resultado.partidos || []);
        setSelecciones(Object.fromEntries((resultado.partidos || []).map((partido) =>
          [partido.id, String(partido.voto?.jugadorId || "")],
        )));
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [router]);

  async function guardar(partidoId) {
    setGuardando(String(partidoId));
    setError("");
    setMensaje("");
    try {
      const response = await fetch("/api/entrenador/voto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partidoId, jugadorId: selecciones[partidoId] }),
      });
      const resultado = await response.json();
      if (response.status === 401) {
        router.replace("/entrenador/login");
        return;
      }
      if (!response.ok) throw new Error(resultado.error || "No se pudo guardar el voto.");
      setMensaje("Voto guardado. Puedes cambiarlo mientras la votación siga abierta.");
      const refresco = await fetch("/api/entrenador/partidos", { cache: "no-store" });
      const datos = await refresco.json();
      if (!refresco.ok) throw new Error(datos.error || "No se pudo actualizar el partido.");
      setPartidos(datos.partidos || []);
      setSelecciones(Object.fromEntries((datos.partidos || []).map((partido) =>
        [partido.id, String(partido.voto?.jugadorId || "")],
      )));
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando("");
    }
  }

  async function salir() {
    const response = await fetch("/api/entrenador/logout", { method: "POST" });
    if (!response.ok) {
      const resultado = await response.json().catch(() => ({}));
      setError(resultado.error || "No se pudo cerrar la sesión.");
      return;
    }
    router.replace("/entrenador/login");
  }

  if (cargando) return <main><p>Cargando partidos…</p></main>;
  const jornadas = new Map();
  partidos.forEach((partido) => {
    const jornada = partido.jornada ?? "sin-jornada";
    jornadas.set(jornada, [...(jornadas.get(jornada) || []), partido]);
  });
  const ordenadas = [...jornadas].sort(([a], [b]) =>
    a === "sin-jornada" ? 1 : b === "sin-jornada" ? -1 : Number(a) - Number(b),
  );
  const textoEstado = {
    pendiente: "Pendiente de abrir",
    abierta: "Votación abierta",
    votada: "Votación abierta · voto guardado",
    cerrada: "Votación cerrada",
  };

  return (
    <main>
      <h1>Votación MVP</h1>
      <p>Elige al jugador más destacado del equipo rival. Tu voto no será visible para el otro equipo.</p>
      {error && <p className="error">{error}</p>}
      {mensaje && <p className="entrenador-mensaje" role="status">{mensaje}</p>}
      {!partidos.length && <p className="suave">Tu equipo todavía no tiene partidos programados.</p>}
      {ordenadas.map(([jornada, lista]) => (
        <section className="entrenador-jornada" key={jornada}>
          <h2>{jornada === "sin-jornada" ? "Partidos" : `Jornada ${jornada}`}</h2>
          <div className="entrenador-partidos">
            {lista.map((partido) => {
              const abierto = partido.estado === "abierta" || partido.estado === "votada";
              return (
                <article className="entrenador-partido" key={partido.id}>
                  <div className="entrenador-partido-titulo">
                    <span className={`entrenador-estado ${partido.estado}`}>{textoEstado[partido.estado]}</span>
                    <strong>{partido.local.nombre} – {partido.visitante.nombre}</strong>
                    <span className="suave">{fecha(partido.fecha)}</span>
                  </div>
                  <p>Votas al MVP de <strong>{partido.rival.nombre}</strong>.</p>
                  <p className="entrenador-plazo">
                    {partido.estado === "pendiente"
                      ? <>Se abre el {fecha(partido.abre)}.</>
                      : <>Plazo para votar hasta el <strong>{fecha(partido.cierra)}</strong> (hora peninsular).</>}
                  </p>
                  {abierto ? (
                    <div className="entrenador-voto">
                      <label>Jugador del equipo rival
                        <select
                          value={selecciones[partido.id] || ""}
                          onChange={(event) => setSelecciones((actual) => ({ ...actual, [partido.id]: event.target.value }))}
                        >
                          <option value="">Selecciona un jugador</option>
                          {partido.jugadoresRival.map((jugador) => (
                            <option key={jugador.id} value={jugador.id}>
                              {jugador.nombre}{jugador.dorsal === null ? "" : ` · #${jugador.dorsal}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!partido.jugadoresRival.length && <p className="suave">El rival no tiene jugadores cargados en la plantilla.</p>}
                      <button
                        type="button"
                        className="primario"
                        disabled={!selecciones[partido.id] || guardando === String(partido.id)}
                        onClick={() => guardar(partido.id)}
                      >
                        {guardando === String(partido.id) ? "Guardando…" : partido.voto ? "Guardar cambio" : "Guardar voto"}
                      </button>
                      {partido.voto && <p>Tu voto actual: <strong>{partido.voto.jugador?.nombre}</strong></p>}
                    </div>
                  ) : partido.voto ? (
                    <p>Tu voto: <strong>{partido.voto.jugador?.nombre}</strong></p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <button type="button" onClick={salir}>Cerrar sesión</button>
    </main>
  );
}
