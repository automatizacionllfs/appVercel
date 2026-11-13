"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import NavegacionArbitro from "./NavegacionArbitro";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const fmt = (f) => new Date(f).toLocaleString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fechaInput = (fecha) => String(fecha).slice(0, 10);
const reloj = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const TIPOS = { gol: "Gol", amarilla: "Amarilla", roja: "Roja" };
const tiempoJuego = (e) => (e.parte - 1) * 1320 + (1320 - e.restante_seg);

export default function Arbitro() {
  const [sesion, setSesion] = useState(undefined);
  const [yo, setYo] = useState(undefined);
  const [partidos, setPartidos] = useState([]);
  const [golesActa, setGolesActa] = useState([]);
  const [errorPartidos, setErrorPartidos] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [modo, setModo] = useState("movil");
  const [filtroJornada, setFiltroJornada] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [desde, setDesde] = useState(() => fechaInput(process.env.FECHA_DESDE || "2026-09-01"));
  const [hasta, setHasta] = useState(() => fechaInput(process.env.FECHA_HASTA || "2027-06-30"));

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
      .select("id,jornada,fecha,estado,goles_local_clupik,goles_visitante_clupik,local_id,visitante_id,local:equipos!partidos_local_id_fkey(nombre),visitante:equipos!partidos_visitante_id_fkey(nombre)")
      .order("fecha");
    if (yo.rol !== "admin") q = q.eq("arbitro_id", yo.id);
    const partidoSolicitado = new URLSearchParams(window.location.search).get("partido");
    const idPartidoSolicitado = /^\d+$/.test(partidoSolicitado || "") ? partidoSolicitado : null;
    if (idPartidoSolicitado) q = q.eq("id", idPartidoSolicitado);
    q.limit(idPartidoSolicitado ? 1 : 100).then(async ({ data, error }) => {
      if (error) {
        setErrorPartidos(`No se pudieron cargar los partidos: ${error.message}`);
        return;
      }
      const lista = data || [];
      setPartidos(lista);
      setGolesActa([]);
      if (idPartidoSolicitado && lista.some((partido) => String(partido.id) === idPartidoSolicitado)) {
        setErrorPartidos("");
        setAbierto(Number(idPartidoSolicitado));
      } else if (idPartidoSolicitado) {
        setErrorPartidos("No tienes permiso para editar este partido o no se encuentra disponible.");
      } else {
        setErrorPartidos("");
      }
      const ids = lista.map((partido) => partido.id);
      if (!ids.length) {
        setGolesActa([]);
        return;
      }
      const goles = [];
      for (let desde = 0; ; desde += 1000) {
        const { data: pagina, error: errorEventos } = await supabase.from("eventos")
          .select("partido_id,equipo_id")
          .eq("tipo", "gol")
          .eq("anulado", false)
          .in("partido_id", ids)
          .order("id")
          .range(desde, desde + 999);
        if (errorEventos) {
          setErrorPartidos(`No se pudieron comparar las actas: ${errorEventos.message}`);
          return;
        }
        goles.push(...(pagina || []));
        if (!pagina || pagina.length < 1000) break;
      }
      setGolesActa(goles);
    });
  }, [yo, abierto]);

  const entrar = () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/arbitro` } });
  const salir = () => supabase.auth.signOut();
  
  const sincronizar = async () => {
    const r = await fetch("/api/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${sesion.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ desde, hasta }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return alert(`Error: ${j.error || r.status}`);
    alert(
      `Sincronizado: ${j.equipos} equipos, ${j.jugadores} jugadores, ${j.partidos} partidos.\n` +
      `Fotos recibidas de Clupik: ${j.jugadoresConFotoRecibida ?? "no disponible"}.\n` +
      `Fotos guardadas en Supabase: ${j.jugadoresConFotoGuardada ?? "no disponible"}`,
    );
    window.location.reload();
  };
  const golesActaPorPartido = new Map();
  golesActa.forEach((gol) => {
    const porEquipo = golesActaPorPartido.get(gol.partido_id) || new Map();
    porEquipo.set(gol.equipo_id, (porEquipo.get(gol.equipo_id) || 0) + 1);
    golesActaPorPartido.set(gol.partido_id, porEquipo);
  });
  const jornadas = [...new Set(partidos.map((p) => p.jornada).filter((j) => j !== null))].sort((a, b) => a - b);
  const partidosFiltrados = partidos.filter((p) =>
    (!filtroJornada || String(p.jornada) === filtroJornada) &&
    (!filtroEstado || p.estado === filtroEstado)
  );
  const partidosConEstado = partidosFiltrados.map((p) => {
    const acta = golesActaPorPartido.get(p.id);
    const golesLocalActa = acta?.get(p.local_id) || 0;
    const golesVisitanteActa = acta?.get(p.visitante_id) || 0;
    const hayResultado = p.goles_local_clupik !== null && p.goles_visitante_clupik !== null;
    const coincide = hayResultado && golesLocalActa === p.goles_local_clupik && golesVisitanteActa === p.goles_visitante_clupik;
    const esFuturo = p.fecha && new Date(p.fecha).getTime() > Date.now();
    const estado = esFuturo && !hayResultado
      ? { clase: "futuro", texto: "Pendiente / futuro" }
      : hayResultado && coincide && p.estado === "cerrado"
        ? { clase: "completo", texto: "Acta completa" }
        : {
          clase: "incompleto",
          texto: hayResultado
            ? coincide ? "Goles coinciden · acta abierta" : "Goles del acta por revisar"
            : "Pendiente de resultado Clupik",
        };
    return { p, golesLocalActa, golesVisitanteActa, hayResultado, estado };
  });
  const conteoEstados = partidosConEstado.reduce((conteo, { estado }) => {
    conteo[estado.clase] += 1;
    return conteo;
  }, { futuro: 0, incompleto: 0, completo: 0 });

  if (sesion === undefined) return <main><p>Cargando…</p></main>;
  if (!sesion) return (
    <main>
      <h1>Acceso de árbitros</h1>
      <button className="primario" onClick={entrar}>Entrar con Google</button>
      <p>
        <a className="boton-inicio" href="/" aria-label="Volver a la clasificación">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none">
            <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          Volver a la clasificación
        </a>
      </p>
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
  if (abierto) return <Partido id={abierto} yo={yo} volver={() => {
    window.history.replaceState(null, "", "/arbitro");
    setAbierto(null);
  }} modo={modo} cambiarModo={setModo} />;

  return (
    <main>
      <NavegacionArbitro />
      <h1>Hola, {yo.nombre}</h1>
      <h2>{yo.rol === "admin" ? "Partidos" : "Tus partidos"}</h2>
      {yo.rol === "admin" && (
        <form className="rango-fechas" onSubmit={(e) => { e.preventDefault(); sincronizar(); }}>
          <label>Fecha desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required /></label>
          <label>Fecha hasta<input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} required /></label>
          <button type="submit">Sincronizar con Clupik</button>
        </form>
      )}
      <div className="filtros-partidos">
        <label>Jornada
          <select value={filtroJornada} onChange={(e) => setFiltroJornada(e.target.value)}>
            <option value="">Todas</option>
            {jornadas.map((jornada) => <option key={jornada} value={jornada}>Jornada {jornada}</option>)}
          </select>
        </label>
        <label>Estado del acta
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="programado">Abierta</option>
            <option value="cerrado">Cerrada</option>
          </select>
        </label>
      </div>
      <p className="nota-datos">El estado completo compara el marcador y el cierre del acta; la sincronización disponible no permite contrastar las tarjetas con Clupik.</p>
      <div className="resumen-estados" aria-label="Total de actas por estado">
        <div><i className="semaforo-luz futuro" /><span>Pendiente / futuro</span><strong>{conteoEstados.futuro}</strong></div>
        <div><i className="semaforo-luz incompleto" /><span>Resultado disponible, acta pendiente</span><strong>{conteoEstados.incompleto}</strong></div>
        <div><i className="semaforo-luz completo" /><span>Acta cerrada y goles coinciden</span><strong>{conteoEstados.completo}</strong></div>
      </div>
      {errorPartidos && <p className="error">{errorPartidos}</p>}
      {partidos.length === 0 && <p className="suave">No tienes partidos asignados.</p>}
      {partidos.length > 0 && partidosFiltrados.length === 0 && <p className="suave">No hay partidos con esos filtros.</p>}
      {partidosConEstado.map(({ p, golesLocalActa, golesVisitanteActa, hayResultado, estado }) => {
        return (
          <button key={p.id} className={`tarjeta partido-tarjeta ${estado.clase}`} onClick={() => setAbierto(p.id)}>
            <span className="estado-partido"><i className={`semaforo-luz ${estado.clase}`} />{estado.texto}</span>
            <strong>{p.local.nombre} – {p.visitante.nombre}</strong>
            <div className="suave">Jornada {p.jornada} · {fmt(p.fecha)}{p.estado === "cerrado" ? " · Cerrado" : ""}</div>
            <div className="comparacion-goles">
              <span>Clupik <strong>{hayResultado ? `${p.goles_local_clupik} – ${p.goles_visitante_clupik}` : "Sin resultado"}</strong></span>
              <span>Acta <strong>{golesLocalActa} – {golesVisitanteActa}</strong></span>
            </div>
          </button>
        );
      })}
      <p><button className="mini" onClick={salir}>Salir</button></p>
    </main>
  );
}

function SelectorModo({ modo, cambiar }) {
  return (
    <div className={`selector-modo ${modo}`} role="radiogroup" aria-label="Modo de anotación">
      <span className="selector-modo-indicador" />
      <button type="button" role="radio" aria-checked={modo === "movil"} onClick={() => cambiar("movil")}>Móvil</button>
      <button type="button" role="radio" aria-checked={modo === "pc"} onClick={() => cambiar("pc")}>PC</button>
    </div>
  );
}

function Partido({ id, yo, volver, modo, cambiarModo }) {
  const [p, setP] = useState(null);
  const [pl, setPl] = useState([]);
  const [ev, setEv] = useState([]);
  const [tipo, setTipo] = useState("gol");
  const [eq, setEq] = useState(null);
  const [busca, setBusca] = useState("");
  const [jug, setJug] = useState(null);
  const [parte, setParte] = useState(1);
  const [min, setMin] = useState(22);
  const [seg, setSeg] = useState(0);
  const [msg, setMsg] = useState("");
  const [msgEvento, setMsgEvento] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [msgDescripcion, setMsgDescripcion] = useState("");
  const [guardandoDescripcion, setGuardandoDescripcion] = useState(false);
  const [paso, setPaso] = useState("acciones");
  const [golPropio, setGolPropio] = useState(false);
  const [ultimaAccion, setUltimaAccion] = useState("");
  const descripcionCargada = useRef(false);

  const cargar = useCallback(async () => {
    const { data: part, error: errorPartido } = await supabase.from("partidos")
      .select("id,jornada,fecha,estado,descripcion,local_id,visitante_id,goles_local_clupik,goles_visitante_clupik,local:equipos!partidos_local_id_fkey(nombre),visitante:equipos!partidos_visitante_id_fkey(nombre)")
      .eq("id", id).single();
    if (errorPartido) {
      setMsg(`No se pudo cargar el partido: ${errorPartido.message}`);
      return;
    }
    const { data: plan } = await supabase.from("plantilla")
      .select("id,dorsal,baja,equipo_id,jugador:jugadores(id,nombre)")
      .in("equipo_id", [part.local_id, part.visitante_id]);
    const { data: eventos } = await supabase.from("eventos")
      .select("id,tipo,parte,restante_seg,anulado,equipo_id,jugador:jugadores(nombre)")
      .eq("partido_id", id);
    setP(part); setPl(plan || []); setEv(eventos || []);
    if (!descripcionCargada.current) {
      setDescripcion(part.descripcion || "");
      descripcionCargada.current = true;
    }
    setEq((e) => e ?? part.local_id);
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!p) return <main>{msg ? <p className="error">{msg}</p> : <p>Cargando…</p>}</main>;

  const editable = p.estado === "programado";
  const goles = (t) => ev.filter((e) => e.tipo === "gol" && !e.anulado && e.equipo_id === t).length;
  const diferenciaLocal = p.goles_local_clupik === null ? null : p.goles_local_clupik - goles(p.local_id);
  const diferenciaVisitante = p.goles_visitante_clupik === null ? null : p.goles_visitante_clupik - goles(p.visitante_id);
  const restante = min * 60 + seg;
  const tiempoIndicado = 1320 - restante;
  const segundosDisponibles = Array.from({ length: min === 22 ? 1 : 12 }, (_, i) => i * 5);
  const cambiarMinutos = (valor) => {
    setMin(valor);
    if (valor === 22) setSeg(0);
  };
  const lista = pl
    .filter((x) => x.equipo_id === eq && (
      x.jugador.nombre.toLowerCase().includes(busca.toLowerCase()) ||
      String(x.dorsal ?? "").includes(busca.trim())
    ))
    .sort((a, b) => a.jugador.nombre.localeCompare(b.jugador.nombre, "es", { sensitivity: "base" }));
  const orden = [...ev].sort((a, b) => tiempoJuego(a) - tiempoJuego(b));

  const elegir = (x) => {
    if (x.baja && !confirm(`${x.jugador.nombre} está de baja. ¿Asignarle el evento igualmente?`)) return;
    setJug(x);
  };

  const guardar = async (jugador = jug) => {
    setMsg("");
    if (!golPropio && !jugador) return setMsg("Elige un jugador.");
    if (restante > 1320) return setMsg("El reloj no puede pasar de 22:00.");
    const { error } = await supabase.from("eventos").insert({
      partido_id: id, equipo_id: eq, jugador_id: golPropio ? null : jugador.jugador.id, tipo, parte, restante_seg: restante, creado_por: yo.id,
    });
    if (error) return setMsg(error.message);
    const accion = golPropio ? "Gol en propia puerta" : TIPOS[tipo];
    const autor = jugador ? ` · ${jugador.jugador.nombre}` : "";
    setUltimaAccion(`${accion} · ${reloj(restante)} · ${eq === p.local_id ? p.local.nombre : p.visitante.nombre}${autor}`);
    setMsg(`${accion} registrado.`);
    setJug(null); setBusca(""); setGolPropio(false); setPaso("acciones");
    cargar();
  };

  const elegirAccion = (tipoElegido, esGolPropio = false) => {
    setTipo(tipoElegido);
    setGolPropio(esGolPropio);
    setJug(null);
    setMsg("");
    setPaso(modo === "movil" ? "tiempo" : "acciones");
  };

  const anular = async (e) => {
    const { error } = await supabase.from("eventos").update({ anulado: !e.anulado }).eq("id", e.id);
    if (error) setMsg(error.message); else cargar();
  };

  const borrarEvento = async (e) => {
    if (!window.confirm("¿Borrar definitivamente este evento? Esta acción no se puede deshacer.")) return;
    setMsgEvento("");
    const { data, error } = await supabase.from("eventos")
      .delete()
      .eq("id", e.id)
      .select("id")
      .maybeSingle();
    if (error) {
      setMsgEvento(`No se pudo borrar el evento: ${error.message}`);
      return;
    }
    if (!data) {
      setMsgEvento("No se pudo borrar el evento: no se encontró o no tienes permiso.");
      return;
    }
    setMsgEvento("Evento borrado definitivamente.");
    cargar();
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
  const guardarDescripcion = async () => {
    setMsgDescripcion("");
    setGuardandoDescripcion(true);
    const texto = descripcion.trim();
    try {
      const { error } = await supabase.rpc("guardar_descripcion_acta", {
        p_partido: id,
        p_descripcion: texto || null,
      });
      if (error) {
        setMsgDescripcion(`No se pudieron guardar las incidencias: ${error.message}`);
        return;
      }
      setDescripcion(texto);
      setP((partido) => ({ ...partido, descripcion: texto || null }));
      setMsgDescripcion("Incidencias guardadas.");
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      setMsgDescripcion(`No se pudieron guardar las incidencias: ${detalle}`);
    } finally {
      setGuardandoDescripcion(false);
    }
  };

  return (
    <main className={modo === "movil" ? "vista-movil" : ""}>
      <NavegacionArbitro />
      <div className={`cabecera-partido ${modo === "movil" ? "modo-movil" : ""}`}>
        <button className="mini" onClick={volver}>‹ Mis partidos</button>
        <h1>Jornada {p.jornada}</h1>
        <div className="marcador">
          <span>{p.local.nombre}</span><strong>{goles(p.local_id)} – {goles(p.visitante_id)}</strong><span>{p.visitante.nombre}</span>
        </div>
        <div className="marcador-clupik">
          Marcador Clupik: <strong>{p.goles_local_clupik ?? "—"} – {p.goles_visitante_clupik ?? "—"}</strong>
          {diferenciaLocal !== null && diferenciaVisitante !== null && (diferenciaLocal < 0 || diferenciaVisitante < 0
            ? <span>· Revisar exceso en acta: {Math.max(0, -diferenciaLocal)} local, {Math.max(0, -diferenciaVisitante)} visitante</span>
            : <span>· Pendientes de añadir al acta: {diferenciaLocal} local, {diferenciaVisitante} visitante</span>)}
        </div>
        {editable && <SelectorModo modo={modo} cambiar={(nuevoModo) => { setPaso("acciones"); cambiarModo(nuevoModo); }} />}
        {p.estado === "cerrado" && <p className="suave">Acta cerrada.</p>}
      </div>

      {editable && (modo === "movil" ? (
        <section className="captura-movil" aria-label="Registro rápido de eventos">
          {paso === "acciones" && (
            <>
              <p className="paso-movil">Registrar evento</p>
              <div className="acciones-movil">
                <button className="accion-gol" onClick={() => elegirAccion("gol")}>Gol</button>
                <button className="accion-amarilla" onClick={() => elegirAccion("amarilla")}>Tarjeta amarilla</button>
                <button className="accion-roja" onClick={() => elegirAccion("roja")}>Tarjeta roja</button>
                <button className="accion-propio" onClick={() => elegirAccion("gol", true)}>Gol en propia puerta</button>
              </div>
              {ultimaAccion && <p className="ultima-accion">Última acción: {ultimaAccion}</p>}
              {msg && <p aria-live="polite" className={msg.includes("registrado.") ? "mensaje-ok" : "error"}>{msg}</p>}
            </>
          )}
          {paso === "tiempo" && (
            <>
              <p className="paso-movil">1. Tiempo restante</p>
              <div className="fila">
                <button className={parte === 1 ? "on" : ""} onClick={() => setParte(1)}>1ª parte</button>
                <button className={parte === 2 ? "on" : ""} onClick={() => setParte(2)}>2ª parte</button>
              </div>
              <div className="fila">
                <select aria-label="Minutos restantes" value={min} onChange={(e) => cambiarMinutos(+e.target.value)}>
                  {Array.from({ length: 23 }, (_, i) => <option key={i} value={i}>{i} min</option>)}
                </select>
                <select aria-label="Segundos restantes" value={seg} onChange={(e) => setSeg(+e.target.value)}>
                  {segundosDisponibles.map((s) => <option key={s} value={s}>{String(s).padStart(2, "0")} s</option>)}
                </select>
              </div>
              <p className="suave">Quedan {reloj(restante)} · tiempo transcurrido {reloj(tiempoIndicado)}</p>
              <button className="primario boton-paso" onClick={() => setPaso("equipo")}>Continuar</button>
              <button className="mini" onClick={() => setPaso("acciones")}>Volver</button>
            </>
          )}
          {paso === "equipo" && (
            <>
              <p className="paso-movil">2. Equipo</p>
              <div className="equipos-movil">
                {[[p.local_id, p.local.nombre], [p.visitante_id, p.visitante.nombre]].map(([t, n]) => (
                  <button key={t} className={eq === t ? "on" : ""} onClick={() => { setEq(t); setJug(null); setBusca(""); }}>{n}</button>
                ))}
              </div>
              {golPropio
                ? <button className="primario boton-paso" onClick={() => guardar(null)}>Registrar gol en propia puerta</button>
                : <button className="primario boton-paso" onClick={() => setPaso("jugador")}>Continuar</button>}
              <button className="mini" onClick={() => setPaso("tiempo")}>Volver</button>
            </>
          )}
          {paso === "jugador" && (
            <>
              <p className="paso-movil">3. Jugador</p>
              <input placeholder="Buscar jugador o dorsal" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <div className="lista jugadores-movil">
                {lista.map((x) => (
                  <button key={x.id} onClick={() => {
                    if (x.baja && !confirm(`${x.jugador.nombre} está de baja. ¿Asignarle el evento igualmente?`)) return;
                    guardar(x);
                  }}>#{x.dorsal ?? "–"} {x.jugador.nombre}{x.baja ? " (baja)" : ""}</button>
                ))}
              </div>
              <button className="mini" onClick={sinFicha}>¿No aparece? Sin ficha</button>
              {msg && <p aria-live="polite" className="error">{msg}</p>}
              <button className="mini" onClick={() => setPaso("equipo")}>Volver</button>
            </>
          )}
        </section>
      ) : (
        editable && <>
          <h2>Nuevo evento</h2>
          <div className="fila">
            {Object.entries(TIPOS).map(([k, v]) => (
              <button key={k} className={tipo === k && !golPropio ? "on" : ""} onClick={() => elegirAccion(k)}>{v}</button>
            ))}
            <button className={golPropio ? "on" : ""} onClick={() => elegirAccion("gol", true)}>Gol en propia</button>
          </div>
          <div className="fila" style={{ marginTop: 8 }}>
            {[[p.local_id, p.local.nombre], [p.visitante_id, p.visitante.nombre]].map(([t, n]) => (
              <button key={t} className={eq === t ? "on" : ""} onClick={() => { setEq(t); setJug(null); setBusca(""); }}>{n}</button>
            ))}
          </div>

          {golPropio ? <p className="suave">El gol suma al marcador del equipo seleccionado y no se asigna a un jugador.</p> : jug ? (
            <p style={{ marginTop: 12 }}><strong>#{jug.dorsal ?? "–"} {jug.jugador.nombre}</strong>{" "}
              <button className="mini" onClick={() => setJug(null)}>Cambiar</button></p>
          ) : (
            <>
              <input style={{ marginTop: 8 }} placeholder="Buscar jugador o dorsal" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <div className="lista">
                {lista.map((x) => (
                  <button key={x.id} onClick={() => elegir(x)}>#{x.dorsal ?? "–"} {x.jugador.nombre}{x.baja ? " (baja)" : ""}</button>
                ))}
              </div>
              <button className="mini" onClick={sinFicha}>¿No aparece? Sin ficha</button>
            </>
          )}

          <h2>Tiempo restante en el reloj del pabellón</h2>
          <div className="fila">
            <button className={parte === 1 ? "on" : ""} onClick={() => setParte(1)}>1ª parte</button>
            <button className={parte === 2 ? "on" : ""} onClick={() => setParte(2)}>2ª parte</button>
          </div>
          <div className="fila" style={{ marginTop: 8 }}>
            <select aria-label="Minutos" value={min} onChange={(e) => cambiarMinutos(+e.target.value)}>
              {Array.from({ length: 23 }, (_, i) => <option key={i} value={i}>{i} min</option>)}
            </select>
            <select aria-label="Segundos" value={seg} onChange={(e) => setSeg(+e.target.value)}>
              {segundosDisponibles.map((s) => <option key={s} value={s}>{String(s).padStart(2, "0")} s</option>)}
            </select>
          </div>
          <p className="suave">Quedan {reloj(restante)} · tiempo transcurrido {reloj(tiempoIndicado)}</p>
          {msg && <p className={msg.includes("registrado.") ? "mensaje-ok" : "error"}>{msg}</p>}
          <button className="primario" style={{ width: "100%" }} onClick={() => guardar()}>{golPropio ? "Guardar gol en propia puerta" : `Guardar ${TIPOS[tipo].toLowerCase()}`}</button>
        </>
      ))}

      <h2>Eventos del partido</h2>
      {orden.length === 0 && <p className="suave">Aún no hay eventos.</p>}
      {orden.map((e) => (
        <div key={e.id} className={`evento ${e.anulado ? "anulado" : ""}`}>
          <span className={`tipo-${e.tipo}`}>
            {e.parte}ª · {reloj(e.restante_seg)} · {e.jugador ? `${TIPOS[e.tipo]} · ${e.jugador.nombre}` : "Gol en propia puerta"} · {e.equipo_id === p.local_id ? p.local.nombre : p.visitante.nombre}
          </span>
          {editable && (
            <div className="evento-acciones">
              <button className={`mini ${e.anulado ? "evento-restaurar" : ""}`} onClick={() => anular(e)}>
                {e.anulado ? "Restaurar" : "Anular"}
              </button>
              {e.anulado && <button className="mini evento-borrar" onClick={() => borrarEvento(e)}>Borrar</button>}
            </div>
          )}
        </div>
      ))}
      {msgEvento && (
        <p role={msgEvento.startsWith("No se pudo") ? "alert" : "status"} className={msgEvento.startsWith("No se pudo") ? "error" : "mensaje-ok"}>
          {msgEvento}
        </p>
      )}

      <section className="acta-descripcion-form">
        <h2>Incidencias</h2>
        <label htmlFor="descripcion-acta">Redacta las incidencias del partido</label>
        <textarea
          id="descripcion-acta"
          rows={5}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          disabled={!editable || guardandoDescripcion}
          placeholder="Anota aquí las incidencias del encuentro."
        />
        {editable && (
          <button className="primario" style={{ width: "100%" }} onClick={guardarDescripcion} disabled={guardandoDescripcion}>
            {guardandoDescripcion ? "Guardando…" : "Guardar incidencias"}
          </button>
        )}
        {msgDescripcion && <p aria-live="polite" className={msgDescripcion === "Incidencias guardadas." ? "mensaje-ok" : "error"}>{msgDescripcion}</p>}
      </section>

      <h2>Acta</h2>
      {p.estado === "programado"
        ? <button className="peligro" style={{ width: "100%" }} onClick={cerrar}>Cerrar acta</button>
        : yo.rol === "admin" && <button style={{ width: "100%" }} onClick={reabrir}>Reabrir acta</button>}
    </main>
  );
}
