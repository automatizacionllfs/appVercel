"use client";

import "../../globals.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import NavegacionArbitro from "../NavegacionArbitro";
import { MADRID_TIME_ZONE, partesEnMadrid } from "../../lib/fecha-madrid";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const hoy = () => {
  const p = partesEnMadrid(new Date());
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};
const fechaDoc = (valor) => valor
  ? new Date(`${valor}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
  : "—";
const fechaCorta = (valor) => valor
  ? new Date(valor).toLocaleString("es-ES", { timeZone: MADRID_TIME_ZONE, dateStyle: "short", timeStyle: "short" })
  : "Fecha no disponible";
const mensajeError = (e) => (e instanceof Error ? e.message : String(e));
const normalizar = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
const etiquetaPartido = (p) =>
  `Jornada ${p.jornada || "—"} · ${p.local?.nombre || "Local"}–${p.visitante?.nombre || "Visitante"} · ${fechaCorta(p.fecha)}`;
const etiquetaPersona = (j) =>
  `${j.entrenador ? "E" : j.dorsal == null ? "–" : `#${j.dorsal}`} ${j.nombre}${j.baja ? " (baja)" : ""}${j.sin_ficha ? " · sin ficha" : ""}`;

function FormSancion({ partido, plantillas, inicial, guardando, onGuardar, onCancelar, onSinFicha }) {
  const [equipoId, setEquipoId] = useState(String(inicial?.equipo_id ?? partido.local_id));
  const [jugadorId, setJugadorId] = useState(inicial?.jugador_id ? String(inicial.jugador_id) : "");
  const [incidencia, setIncidencia] = useState(inicial?.incidencia ?? "");
  const [resolucion, setResolucion] = useState(inicial?.resolucion ?? "");
  const [articulos, setArticulos] = useState(inicial?.articulos ?? "");
  const [errorForm, setErrorForm] = useState("");
  const jugadores = plantillas[equipoId] || [];

  function enviar(evento) {
    evento.preventDefault();
    if (!incidencia.trim()) {
      setErrorForm("La incidencia es obligatoria.");
      return;
    }
    setErrorForm("");
    onGuardar({
      equipo_id: Number(equipoId),
      jugador_id: jugadorId ? Number(jugadorId) : null,
      incidencia: incidencia.trim(),
      resolucion: resolucion.trim() || null,
      articulos: articulos.trim() || null,
    });
  }

  async function sinFicha() {
    const nuevo = await onSinFicha(equipoId);
    if (nuevo) setJugadorId(String(nuevo));
  }

  return (
    <form className="comite-sancion-form" onSubmit={enviar}>
      <div className="comite-sancion-form-fila">
        <label>
          Equipo
          <select value={equipoId} onChange={(e) => { setEquipoId(e.target.value); setJugadorId(""); }}>
            <option value={partido.local_id}>{partido.local?.nombre || "Local"}</option>
            <option value={partido.visitante_id}>{partido.visitante?.nombre || "Visitante"}</option>
          </select>
        </label>
        <label>
          Jugador / entrenador
          <select value={jugadorId} onChange={(e) => setJugadorId(e.target.value)}>
            <option value="">— Sanción al equipo (sin jugador) —</option>
            {jugadores.map((j) => <option key={j.id} value={j.id}>{etiquetaPersona(j)}</option>)}
          </select>
        </label>
      </div>
      <button type="button" className="mini" onClick={sinFicha} style={{ justifySelf: "start" }}>
        ¿No aparece? Sin ficha
      </button>
      <label>
        Incidencia (obligatoria)
        <textarea value={incidencia} onChange={(e) => setIncidencia(e.target.value)} placeholder="Qué sucedió, según el acta arbitral." />
      </label>
      <label>
        Resolución
        <textarea value={resolucion} onChange={(e) => setResolucion(e.target.value)} placeholder="Déjala vacía si está pendiente de resolver." />
      </label>
      <label>
        Artículos aplicados
        <textarea value={articulos} onChange={(e) => setArticulos(e.target.value)} />
      </label>
      {errorForm && <p className="error" role="alert">{errorForm}</p>}
      <div className="comite-sancion-form-acciones">
        <button type="submit" className="primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        <button type="button" className="mini" disabled={guardando} onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

export default function CrearComite() {
  const [sesion, setSesion] = useState(undefined);
  const [acceso, setAcceso] = useState("comprobando");
  const [partidos, setPartidos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [nuevoPartido, setNuevoPartido] = useState("");
  const [nuevaFecha, setNuevaFecha] = useState(hoy);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(null);
  const [plantillas, setPlantillas] = useState({});
  const [anadiendo, setAnadiendo] = useState(false);
  const [editandoSancion, setEditandoSancion] = useState(null);
  const [fechaEdit, setFechaEdit] = useState("");

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(({ data, error: errorSesion }) => {
      if (!activo) return;
      if (errorSesion) setError(`No se pudo consultar la sesión: ${errorSesion.message}`);
      setSesion(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, nueva) => setSesion(nueva));
    return () => { activo = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (sesion === undefined) return undefined;
    if (!sesion?.user?.email) { setAcceso("sin-sesion"); return undefined; }
    let activo = true;
    setAcceso("comprobando");
    supabase.from("usuarios").select("id,rol").ilike("email", sesion.user.email).eq("activo", true).maybeSingle()
      .then(({ data, error: errorUsuario }) => {
        if (!activo) return;
        if (errorUsuario) { setError(`No se pudo comprobar el permiso: ${errorUsuario.message}`); setAcceso("error"); }
        else setAcceso(data?.rol === "admin" ? "admin" : "denegado");
      });
    return () => { activo = false; };
  }, [sesion]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const { data: temp, error: e1 } = await supabase.from("temporadas").select("id").eq("activa", true).maybeSingle();
      if (e1) throw new Error(`No se pudo cargar la temporada: ${e1.message}`);
      if (!temp) { setPartidos([]); setDocumentos([]); return; }
      const [{ data: ps, error: e2 }, { data: ds, error: e3 }] = await Promise.all([
        supabase.from("partidos")
          .select("id,jornada,fecha,local_id,visitante_id,local:equipos!partidos_local_id_fkey(id,nombre),visitante:equipos!partidos_visitante_id_fkey(id,nombre)")
          .eq("temporada_id", temp.id)
          .order("fecha", { ascending: false, nullsFirst: false })
          .limit(1000),
        supabase.from("comite_documentos")
          .select("id,partido_id,fecha,partido:partidos!inner(temporada_id),sanciones:comite_sanciones(id,equipo_id,jugador_id,incidencia,resolucion,articulos,orden,jugador:jugadores(id,nombre))")
          .eq("partido.temporada_id", temp.id)
          .order("fecha", { ascending: false })
          .order("id", { ascending: false }),
      ]);
      if (e2) throw new Error(`No se pudieron cargar los partidos: ${e2.message}`);
      if (e3) throw new Error(`No se pudieron cargar los documentos: ${e3.message}`);
      setPartidos(ps || []);
      setDocumentos((ds || []).map((d) => ({
        ...d,
        sanciones: [...d.sanciones].sort((a, b) => a.orden - b.orden || a.id - b.id),
      })));
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { if (acceso === "admin") cargar(); }, [acceso, cargar]);

  const partidoPorId = useMemo(() => new Map(partidos.map((p) => [p.id, p])), [partidos]);
  const partidosSinDocumento = useMemo(() => {
    const ocupados = new Set(documentos.map((d) => d.partido_id));
    const consulta = normalizar(busqueda.trim());
    return partidos.filter((p) => !ocupados.has(p.id) && (!consulta || normalizar(etiquetaPartido(p)).includes(consulta)));
  }, [partidos, documentos, busqueda]);

  async function cargarPlantillas(partido) {
    const { data, error: e } = await supabase.from("plantilla")
      .select("equipo_id,dorsal,baja,entrenador,jugador:jugadores(id,nombre,sin_ficha)")
      .in("equipo_id", [partido.local_id, partido.visitante_id]);
    if (e) { setError(`No se pudo cargar la plantilla: ${e.message}`); return; }
    const porEquipo = { [partido.local_id]: [], [partido.visitante_id]: [] };
    (data || []).filter((f) => f.jugador).forEach((f) => porEquipo[f.equipo_id]?.push({
      ...f.jugador, dorsal: f.dorsal, baja: f.baja, entrenador: f.entrenador,
    }));
    Object.values(porEquipo).forEach((lista) => lista.sort((a, b) =>
      Number(a.entrenador) - Number(b.entrenador) || a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })));
    setPlantillas(porEquipo);
  }

  async function abrirDocumento(doc) {
    setAnadiendo(false);
    setEditandoSancion(null);
    if (abierto === doc.id) { setAbierto(null); return; }
    setAbierto(doc.id);
    setFechaEdit(doc.fecha);
    const partido = partidoPorId.get(doc.partido_id);
    if (partido) await cargarPlantillas(partido);
  }

  async function crearDocumento(evento) {
    evento.preventDefault();
    if (!nuevoPartido) return;
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const { data, error: e } = await supabase.from("comite_documentos")
        .insert({ partido_id: Number(nuevoPartido), fecha: nuevaFecha })
        .select("id,fecha")
        .single();
      if (e) throw new Error(e.code === "23505" ? "Ese partido ya tiene un documento del Comité." : `No se pudo crear el documento: ${e.message}`);
      const partido = partidoPorId.get(Number(nuevoPartido));
      setNuevoPartido("");
      await cargar();
      setAbierto(data.id);
      setFechaEdit(data.fecha);
      setAnadiendo(false);
      if (partido) await cargarPlantillas(partido);
      setAviso("Documento creado. Ya puedes añadir jugadores.");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarFecha(doc) {
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const { data, error: e } = await supabase.from("comite_documentos").update({ fecha: fechaEdit }).eq("id", doc.id).select("id");
      if (e) throw new Error(`No se pudo guardar la fecha: ${e.message}`);
      if (!data?.length) throw new Error("No se pudo guardar la fecha: sin permiso o documento inexistente.");
      await cargar();
      setAviso("Fecha de publicación guardada.");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarDocumento(doc) {
    const partido = partidoPorId.get(doc.partido_id);
    if (!window.confirm(`¿Borrar definitivamente el documento de «${partido ? etiquetaPartido(partido) : doc.id}» y sus ${doc.sanciones.length} sanciones? No se puede deshacer.`)) return;
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const { data, error: e } = await supabase.from("comite_documentos").delete().eq("id", doc.id).select("id");
      if (e) throw new Error(`No se pudo borrar el documento: ${e.message}`);
      if (!data?.length) throw new Error("No se pudo borrar el documento: sin permiso o ya no existe.");
      if (abierto === doc.id) setAbierto(null);
      await cargar();
      setAviso("Documento borrado.");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarSancion(doc, valores, sancionId) {
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const orden = Math.max(0, ...doc.sanciones.map((s) => s.orden)) + 1;
      const consulta = sancionId
        ? supabase.from("comite_sanciones").update(valores).eq("id", sancionId).select("id")
        : supabase.from("comite_sanciones").insert({ ...valores, documento_id: doc.id, orden }).select("id");
      const { data, error: e } = await consulta;
      if (e) throw new Error(`No se pudo guardar la sanción: ${e.message}`);
      if (!data?.length) throw new Error("No se pudo guardar la sanción: sin permiso.");
      setAnadiendo(false);
      setEditandoSancion(null);
      await cargar();
      setAviso("Sanción guardada.");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function borrarSancion(sancion) {
    if (!window.confirm("¿Borrar definitivamente esta sanción? No se puede deshacer.")) return;
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const { data, error: e } = await supabase.from("comite_sanciones").delete().eq("id", sancion.id).select("id");
      if (e) throw new Error(`No se pudo borrar la sanción: ${e.message}`);
      if (!data?.length) throw new Error("No se pudo borrar la sanción: sin permiso o ya no existe.");
      await cargar();
      setAviso("Sanción borrada.");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function crearSinFicha(partido, equipoId) {
    const nombre = window.prompt("Nombre y apellidos del jugador sin ficha");
    if (!nombre) return null;
    const dorsal = parseInt(window.prompt("Dorsal (opcional)"), 10);
    setError("");
    const { data, error: e } = await supabase.rpc("crear_jugador_sin_ficha", {
      p_partido: partido.id, p_equipo: Number(equipoId), p_nombre: nombre, p_dorsal: Number.isNaN(dorsal) ? null : dorsal,
    });
    if (e) { setError(`No se pudo crear el jugador sin ficha: ${e.message}`); return null; }
    await cargarPlantillas(partido);
    return data;
  }

  async function entrar() {
    const { error: errorAcceso } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/arbitro/comite` },
    });
    if (errorAcceso) setError(`No se pudo iniciar sesión: ${errorAcceso.message}`);
  }

  return (
    <main>
      <NavegacionArbitro />
      <h1>Crear Comité</h1>
      <p className="suave">Herramienta para administradores. Crea, edita y borra los documentos del Comité de Competición.</p>
      {acceso === "comprobando" && <p>Comprobando acceso…</p>}
      {acceso === "sin-sesion" && <button className="primario" type="button" onClick={entrar}>Entrar con Google</button>}
      {acceso === "denegado" && <p role="status">No tienes permiso para gestionar el Comité.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {aviso && <p className="mensaje-ok" role="status">{aviso}</p>}

      {acceso === "admin" && (
        <>
          <form className="clupik-prueba-form" onSubmit={crearDocumento}>
            <label>
              Buscar partido
              <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Equipo, jornada o fecha" />
            </label>
            <label>
              Partido (sin documento)
              <select value={nuevoPartido} onChange={(e) => setNuevoPartido(e.target.value)} required>
                <option value="">Selecciona un partido</option>
                {partidosSinDocumento.map((p) => <option key={p.id} value={p.id}>{etiquetaPartido(p)}</option>)}
              </select>
            </label>
            <label>
              Fecha de publicación
              <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} required />
            </label>
            <button type="submit" className="primario" disabled={guardando || !nuevoPartido}>Crear documento</button>
          </form>

          <h2>Documentos</h2>
          {cargando && !documentos.length ? <p>Cargando…</p> : !documentos.length ? (
            <p className="suave">Todavía no hay documentos del Comité.</p>
          ) : documentos.map((doc) => {
            const partido = partidoPorId.get(doc.partido_id);
            const pendiente = doc.sanciones.some((s) => !s.resolucion?.trim());
            const esAbierto = abierto === doc.id;
            return (
              <article className="comite-admin-doc" key={doc.id}>
                <div className="comite-admin-cabecera">
                  <div>
                    <strong>{partido ? `${partido.local?.nombre || "Local"} – ${partido.visitante?.nombre || "Visitante"}` : `Partido #${doc.partido_id}`}</strong>
                    <span className="suave">
                      {partido ? `Jornada ${partido.jornada || "—"} · ` : ""}Publicado el {fechaDoc(doc.fecha)} · {doc.sanciones.length} {doc.sanciones.length === 1 ? "sanción" : "sanciones"}
                      {pendiente ? " · Pendiente de resolución" : ""}
                    </span>
                  </div>
                  <div className="comite-admin-acciones">
                    <a className="mini boton-inicio comite-boton-acta" href={`/comite/${doc.id}`}>Ver público</a>
                    <button type="button" className="mini" onClick={() => abrirDocumento(doc)}>{esAbierto ? "Cerrar" : "Editar"}</button>
                    <button type="button" className="mini peligro" disabled={guardando} onClick={() => eliminarDocumento(doc)}>Borrar</button>
                  </div>
                </div>

                {esAbierto && partido && (
                  <>
                    <div className="comite-admin-fecha">
                      <label>Fecha de publicación
                        <input type="date" value={fechaEdit} onChange={(e) => setFechaEdit(e.target.value)} />
                      </label>
                      <button type="button" className="mini" disabled={guardando || !fechaEdit || fechaEdit === doc.fecha} onClick={() => guardarFecha(doc)}>
                        Guardar fecha
                      </button>
                    </div>

                    {doc.sanciones.map((sancion) => editandoSancion === sancion.id ? (
                      <FormSancion
                        key={sancion.id}
                        partido={partido}
                        plantillas={plantillas}
                        inicial={sancion}
                        guardando={guardando}
                        onGuardar={(valores) => guardarSancion(doc, valores, sancion.id)}
                        onCancelar={() => setEditandoSancion(null)}
                        onSinFicha={(equipoId) => crearSinFicha(partido, equipoId)}
                      />
                    ) : (
                      <div className="comite-sancion" key={sancion.id}>
                        <div className="comite-sancion-persona">
                          <strong>{sancion.jugador?.nombre || (sancion.equipo_id === partido.local_id ? partido.local?.nombre : partido.visitante?.nombre)}</strong>
                          <span className="suave">
                            {sancion.jugador ? (sancion.equipo_id === partido.local_id ? partido.local?.nombre : partido.visitante?.nombre) : "Sanción al equipo"}
                          </span>
                        </div>
                        <div className="comite-sancion-campo"><span>INCIDENCIA</span><p>{sancion.incidencia}</p></div>
                        <div className={`comite-sancion-campo ${sancion.resolucion ? "" : "pendiente"}`}>
                          <span>RESOLUCIÓN</span><p>{sancion.resolucion || "Pendiente de resolución"}</p>
                        </div>
                        {sancion.articulos && <div className="comite-sancion-campo"><span>ARTÍCULOS APLICADOS</span><p>{sancion.articulos}</p></div>}
                        <div className="comite-admin-acciones">
                          <button type="button" className="mini" onClick={() => { setAnadiendo(false); setEditandoSancion(sancion.id); }}>Editar</button>
                          <button type="button" className="mini peligro" disabled={guardando} onClick={() => borrarSancion(sancion)}>Borrar</button>
                        </div>
                      </div>
                    ))}

                    {anadiendo ? (
                      <FormSancion
                        partido={partido}
                        plantillas={plantillas}
                        guardando={guardando}
                        onGuardar={(valores) => guardarSancion(doc, valores, null)}
                        onCancelar={() => setAnadiendo(false)}
                        onSinFicha={(equipoId) => crearSinFicha(partido, equipoId)}
                      />
                    ) : (
                      <button type="button" className="primario" onClick={() => { setEditandoSancion(null); setAnadiendo(true); }}>
                        Añadir jugador
                      </button>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </>
      )}
    </main>
  );
}
