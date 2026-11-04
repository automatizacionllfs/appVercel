"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const fmt = (f) => new Date(f).toLocaleString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const reloj = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const TIPOS = { gol: "Gol", amarilla: "Amarilla", roja: "Roja" };
const tiempoJuego = (e) => (e.parte - 1) * 1320 + (1320 - e.restante_seg);

export default function Arbitro() {
  const [sesion, setSesion] = useState(undefined);
  const [yo, setYo] = useState(undefined);
  const [partidos, setPartidos] = useState([]);
  const [abierto, setAbierto] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => l.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sesion) { setYo(undefined); return; }
    supabase.from("usuarios").select("id,nombre,rol").ilike("email", sesion.user.email).maybeSingle()
      .then(({ data }) => setYo(data || null));
  }, [sesion]);

  useEffect(() => {
    if (!yo || abierto) return;
    let q = supabase.from("partidos")
      .select("id,jornada,fecha,estado,local:equipos!partidos_local_id_fkey(nombre),visitante:equipos!partidos_visitante_id_fkey(nombre)")
      .order("fecha");
    q = yo.rol === "admin" ? q.eq("estado", "programado") : q.eq("arbitro_id", yo.id);
    q.limit(100).then(({ data }) => setPartidos(data || []));
  }, [yo, abierto]);

  const entrar = () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/arbitro` } });
  const salir = () => supabase.auth.signOut();
  
  const sincronizar = async () => {
    const r = await fetch("/api/sync", { headers: { Authorization: `Bearer ${sesion.access_token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return alert(`Error: ${j.error || r.status}`);
    alert(`Sincronizado: ${j.equipos} equipos, ${j.jugadores} jugadores, ${j.partidos} partidos`);
    window.location.reload();
  };

  if (sesion === undefined) return <main><p>Cargando…</p></main>;
  if (!sesion) return (
    <main>
      <h1>Acceso de árbitros</h1>
      <button className="primario" onClick={entrar}>Entrar con Google</button>
    </main>
  );
  if (yo === undefined) return <main><p>Cargando…</p></main>;
  if (yo === null) return (
    <main>
      <h1>Sin acceso</h1>
      <p>El correo {sesion.user.email} no está autorizado. Pide al organizador que lo añada.</p>
      <button onClick={salir}>Salir</button>
    </main>
  );
  if (abierto) return <Partido id={abierto} yo={yo} volver={() => setAbierto(null)} />;

  return (
    <main>
      <h1>Hola, {yo.nombre}</h1>
      <h2>{yo.rol === "admin" ? "Partidos sin cerrar" : "Tus partidos"}</h2>
      {partidos.length === 0 && <p className="suave">No tienes partidos asignados.</p>}
      {partidos.map((p) => (
        <button key={p.id} className="tarjeta" onClick={() => setAbierto(p.id)}>
          <strong>{p.local.nombre} – {p.visitante.nombre}</strong>
          <div className="suave">Jornada {p.jornada} · {fmt(p.fecha)}{p.estado === "cerrado" ? " · Cerrado" : ""}</div>
        </button>
      ))}
{yo.rol === "admin" && <p><button onClick={sincronizar}>Sincronizar con Clupik</button></p>}
<p><button className="mini" onClick={salir}>Salir</button></p>    </main>
  );
}

function Partido({ id, yo, volver }) {
  const [p, setP] = useState(null);
  const [pl, setPl] = useState([]);
  const [ev, setEv] = useState([]);
  const [tipo, setTipo] = useState("gol");
  const [eq, setEq] = useState(null);
  const [busca, setBusca] = useState("");
  const [jug, setJug] = useState(null);
  const [parte, setParte] = useState(1);
  const [min, setMin] = useState(0);
  const [seg, setSeg] = useState(0);
  const [msg, setMsg] = useState("");

  const cargar = useCallback(async () => {
    const { data: part } = await supabase.from("partidos")
      .select("id,jornada,fecha,estado,local_id,visitante_id,local:equipos!partidos_local_id_fkey(nombre),visitante:equipos!partidos_visitante_id_fkey(nombre)")
      .eq("id", id).single();
    const { data: plan } = await supabase.from("plantilla")
      .select("id,dorsal,baja,equipo_id,jugador:jugadores(id,nombre)")
      .in("equipo_id", [part.local_id, part.visitante_id]);
    const { data: eventos } = await supabase.from("eventos")
      .select("id,tipo,parte,restante_seg,anulado,equipo_id,jugador:jugadores(nombre)")
      .eq("partido_id", id);
    setP(part); setPl(plan || []); setEv(eventos || []);
    setEq((e) => e ?? part.local_id);
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!p) return <main><p>Cargando…</p></main>;

  const editable = p.estado === "programado" || yo.rol === "admin";
  const goles = (t) => ev.filter((e) => e.tipo === "gol" && !e.anulado && e.equipo_id === t).length;
  const restante = min * 60 + seg;
  const lista = pl
    .filter((x) => x.equipo_id === eq && x.jugador.nombre.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (a.dorsal ?? 999) - (b.dorsal ?? 999));
  const orden = [...ev].sort((a, b) => tiempoJuego(a) - tiempoJuego(b));

  const elegir = (x) => {
    if (x.baja && !confirm(`${x.jugador.nombre} está de baja. ¿Asignarle el evento igualmente?`)) return;
    setJug(x);
  };

  const guardar = async () => {
    setMsg("");
    if (!jug) return setMsg("Elige un jugador.");
    if (restante > 1320) return setMsg("El reloj no puede pasar de 22:00.");
    const { error } = await supabase.from("eventos").insert({
      partido_id: id, equipo_id: eq, jugador_id: jug.jugador.id, tipo, parte, restante_seg: restante, creado_por: yo.id,
    });
    if (error) return setMsg(error.message);
    setJug(null); setBusca("");
    cargar();
  };

  const anular = async (e) => {
    const { error } = await supabase.from("eventos").update({ anulado: !e.anulado }).eq("id", e.id);
    if (error) setMsg(error.message); else cargar();
  };

  const sinFicha = async () => {
    const nombre = prompt("Nombre y apellidos del jugador sin ficha");
    if (!nombre) return;
    const dorsal = parseInt(prompt("Dorsal"), 10);
    const { error } = await supabase.rpc("crear_jugador_sin_ficha", {
      p_partido: id, p_equipo: eq, p_nombre: nombre, p_dorsal: Number.isNaN(dorsal) ? null : dorsal,
    });
    if (error) setMsg(error.message); else { setBusca(""); cargar(); }
  };

  const cerrar = async () => {
    if (!confirm("¿Cerrar el acta? Después solo el organizador podrá reabrirla.")) return;
    const { error } = await supabase.rpc("cerrar_acta", { p_partido: id });
    if (error) setMsg(error.message); else cargar();
  };
  const reabrir = async () => {
    const { error } = await supabase.rpc("reabrir_acta", { p_partido: id });
    if (error) setMsg(error.message); else cargar();
  };

  return (
    <main>
      <button className="mini" onClick={volver}>‹ Mis partidos</button>
      <h1>Jornada {p.jornada}</h1>
      <div className="marcador">
        <span>{p.local.nombre}</span><strong>{goles(p.local_id)} – {goles(p.visitante_id)}</strong><span>{p.visitante.nombre}</span>
      </div>
      {p.estado === "cerrado" && <p className="suave">Acta cerrada.</p>}

      {editable && (
        <>
          <h2>Nuevo evento</h2>
          <div className="fila">
            {Object.entries(TIPOS).map(([k, v]) => (
              <button key={k} className={tipo === k ? "on" : ""} onClick={() => setTipo(k)}>{v}</button>
            ))}
          </div>
          <div className="fila" style={{ marginTop: 8 }}>
            {[[p.local_id, p.local.nombre], [p.visitante_id, p.visitante.nombre]].map(([t, n]) => (
              <button key={t} className={eq === t ? "on" : ""} onClick={() => { setEq(t); setJug(null); setBusca(""); }}>{n}</button>
            ))}
          </div>

          {jug ? (
            <p style={{ marginTop: 12 }}><strong>#{jug.dorsal ?? "–"} {jug.jugador.nombre}</strong>{" "}
              <button className="mini" onClick={() => setJug(null)}>Cambiar</button></p>
          ) : (
            <>
              <input style={{ marginTop: 8 }} placeholder="Buscar jugador" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <div className="lista">
                {lista.map((x) => (
                  <button key={x.id} onClick={() => elegir(x)}>#{x.dorsal ?? "–"} {x.jugador.nombre}{x.baja ? " (baja)" : ""}</button>
                ))}
              </div>
              <button className="mini" onClick={sinFicha}>¿No aparece? Sin ficha</button>
            </>
          )}

          <h2>Reloj del pabellón (lo que marca)</h2>
          <div className="fila">
            <button className={parte === 1 ? "on" : ""} onClick={() => setParte(1)}>1ª parte</button>
            <button className={parte === 2 ? "on" : ""} onClick={() => setParte(2)}>2ª parte</button>
          </div>
          <div className="fila" style={{ marginTop: 8 }}>
            <select aria-label="Minutos" value={min} onChange={(e) => setMin(+e.target.value)}>
              {Array.from({ length: 23 }, (_, i) => <option key={i} value={i}>{i} min</option>)}
            </select>
            <select aria-label="Segundos" value={seg} onChange={(e) => setSeg(+e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i * 5).map((s) => <option key={s} value={s}>{String(s).padStart(2, "0")} s</option>)}
            </select>
          </div>
          <p className="suave">Quedan {reloj(restante)} · minuto de juego {reloj(1320 - restante)}</p>
          {msg && <p className="error">{msg}</p>}
          <button className="primario" style={{ width: "100%" }} onClick={guardar}>Guardar {TIPOS[tipo].toLowerCase()}</button>
        </>
      )}

      <h2>Eventos del partido</h2>
      {orden.length === 0 && <p className="suave">Aún no hay eventos.</p>}
      {orden.map((e) => (
        <div key={e.id} className={`evento ${e.anulado ? "anulado" : ""}`}>
          <span className={`tipo-${e.tipo}`}>
            {e.parte}ª · {reloj(e.restante_seg)} · {TIPOS[e.tipo]} · {e.jugador.nombre}
          </span>
          {editable && <button className="mini" onClick={() => anular(e)}>{e.anulado ? "Restaurar" : "Anular"}</button>}
        </div>
      ))}

      <h2>Acta</h2>
      {p.estado === "programado"
        ? <button className="peligro" style={{ width: "100%" }} onClick={cerrar}>Cerrar acta</button>
        : yo.rol === "admin" && <button style={{ width: "100%" }} onClick={reabrir}>Reabrir acta</button>}
    </main>
  );
}
