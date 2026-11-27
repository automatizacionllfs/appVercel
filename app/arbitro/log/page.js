"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import NavegacionArbitro from "../NavegacionArbitro";
import { useFiltroSesion } from "../../lib/filtros-sesion";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const POR_PAGINA = 25;
const ACCIONES = {
  INSERT: "Alta",
  UPDATE: "Modificación",
  DELETE: "Eliminación",
};

function inicioDia(fecha) {
  return new Date(`${fecha}T00:00:00`).toISOString();
}

function inicioDiaSiguiente(fecha) {
  const dia = new Date(`${fecha}T00:00:00`);
  dia.setDate(dia.getDate() + 1);
  return dia.toISOString();
}

function partidoDe(registro) {
  if (registro.tabla === "partidos") return registro.fila_id;
  const datos = registro.datos_despues || registro.datos_antes;
  return datos?.partido_id || null;
}

function accionLegible(registro) {
  if (registro.tabla === "partidos" && registro.accion === "INSERT") return "Creación de partido";
  return ACCIONES[registro.accion] || registro.accion;
}

function fechaLegible(fecha) {
  return new Date(fecha).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function LogArbitros() {
  const [sesion, setSesion] = useState(undefined);
  const [acceso, setAcceso] = useState("comprobando");
  const [usuarios, setUsuarios] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [errorUsuarios, setErrorUsuarios] = useState("");
  const [errorPartidos, setErrorPartidos] = useState("");
  const [desde, setDesde] = useFiltroSesion("log:desde", "");
  const [hasta, setHasta] = useFiltroSesion("log:hasta", "");
  const [filtroUsuario, setFiltroUsuario] = useFiltroSesion("log:usuario", "");
  const [filtroAccion, setFiltroAccion] = useFiltroSesion("log:accion", "");
  const [filtroPartido, setFiltroPartido] = useFiltroSesion("log:partido", "");
  const [pagina, setPagina] = useFiltroSesion("log:pagina", 0);

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(({ data, error: errorSesion }) => {
      if (!activo) return;
      if (errorSesion) setError(`No se pudo consultar la sesión: ${errorSesion.message}`);
      setSesion(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion);
    });
    return () => {
      activo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (sesion === undefined) return undefined;
    if (!sesion?.user?.email) {
      setAcceso("sin-sesion");
      return undefined;
    }

    let activo = true;
    setAcceso("comprobando");
    supabase.from("usuarios")
      .select("id,nombre,rol")
      .ilike("email", sesion.user.email)
      .maybeSingle()
      .then(({ data, error: errorUsuario }) => {
        if (!activo) return;
        if (errorUsuario) {
          setError(`No se pudo comprobar el permiso: ${errorUsuario.message}`);
          setAcceso("error");
        } else if (data?.rol === "admin") {
          setAcceso("admin");
        } else {
          setAcceso("denegado");
        }
      });
    return () => { activo = false; };
  }, [sesion]);

  useEffect(() => {
    if (acceso !== "admin") return undefined;
    let activo = true;
    supabase.from("usuarios")
      .select("id,nombre,email")
      .order("nombre")
      .then(({ data, error: errorUsuarios }) => {
        if (!activo) return;
        if (errorUsuarios) {
          setErrorUsuarios(`No se pudieron cargar los usuarios: ${errorUsuarios.message}`);
        } else {
          setErrorUsuarios("");
          setUsuarios(data || []);
        }
      });
    return () => { activo = false; };
  }, [acceso]);

  useEffect(() => {
    if (acceso !== "admin") return undefined;
    let activo = true;
    supabase.from("partidos")
      .select("id,jornada,fecha,local:equipos!partidos_local_id_fkey(nombre),visitante:equipos!partidos_visitante_id_fkey(nombre)")
      .order("fecha", { ascending: false, nullsFirst: false })
      .then(({ data, error: errorPartidos }) => {
        if (!activo) return;
        if (errorPartidos) {
          setErrorPartidos(`No se pudieron cargar los partidos: ${errorPartidos.message}`);
        } else {
          setErrorPartidos("");
          setPartidos(data || []);
        }
      });
    return () => { activo = false; };
  }, [acceso]);

  useEffect(() => {
    if (acceso !== "admin" || !filtrosListos) return undefined;
    let activo = true;

    if (desde && hasta && desde > hasta) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      setCargando(false);
      setRegistros([]);
      setTotal(0);
      return () => { activo = false; };
    }

    async function cargar() {
      setCargando(true);
      setError("");
      let consulta = supabase.from("auditoria")
        .select("id,tabla,fila_id,accion,datos_antes,datos_despues,usuario_id,creado_en", { count: "exact" })
        .order("creado_en", { ascending: false })
        .order("id", { ascending: false })
        .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1);

      if (desde) consulta = consulta.gte("creado_en", inicioDia(desde));
      if (hasta) consulta = consulta.lt("creado_en", inicioDiaSiguiente(hasta));
      if (filtroUsuario) consulta = consulta.eq("usuario_id", filtroUsuario);
      if (filtroAccion) consulta = consulta.eq("accion", filtroAccion);
      if (filtroPartido) {
        consulta = consulta.or(
          `and(tabla.eq.partidos,fila_id.eq.${filtroPartido}),datos_despues->>partido_id.eq.${filtroPartido},datos_antes->>partido_id.eq.${filtroPartido}`,
        );
      }

      const { data, count, error: errorLog } = await consulta;
      if (!activo) return;
      if (errorLog) {
        setError(`No se pudo cargar el log: ${errorLog.message}`);
        setRegistros([]);
        setTotal(0);
      } else {
        setRegistros(data || []);
        setTotal(count || 0);
      }
      setCargando(false);
    }

    cargar();
    return () => { activo = false; };
  }, [acceso, filtrosListos, desde, hasta, filtroUsuario, filtroAccion, filtroPartido, pagina]);

  async function entrar() {
    const { error: errorAcceso } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/arbitro/log` },
    });
    if (errorAcceso) setError(`No se pudo iniciar sesión: ${errorAcceso.message}`);
  }

  function limpiarFiltros() {
    setDesde("");
    setHasta("");
    setFiltroUsuario("");
    setFiltroAccion("");
    setFiltroPartido("");
    setPagina(0);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const usuarioPorId = new Map(usuarios.map((usuario) => [String(usuario.id), usuario]));

  return (
    <main>
      <NavegacionArbitro />
      <h1>Log de actas</h1>
      <p className="suave">Historial de acciones registradas en actas y eventos. Disponible solo para administradores.</p>

      {acceso === "comprobando" && <p>Comprobando acceso…</p>}
      {acceso === "sin-sesion" && (
        <section>
          <p>Inicia sesión con una cuenta de administrador para consultar el log.</p>
          <button className="primario" type="button" onClick={entrar}>Entrar con Google</button>
        </section>
      )}
      {acceso === "denegado" && <p role="status">No tienes permiso para consultar el log.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {errorUsuarios && <p className="error" role="alert">{errorUsuarios}</p>}

      {acceso === "admin" && (
        <>
          <section className="log-filtros" aria-label="Filtros del log">
            <label>
              Desde
              <input type="date" value={desde} onChange={(evento) => { setDesde(evento.target.value); setPagina(0); }} />
            </label>
            <label>
              Hasta
              <input type="date" value={hasta} onChange={(evento) => { setHasta(evento.target.value); setPagina(0); }} />
            </label>
            <label>
              Usuario
              <select value={filtroUsuario} onChange={(evento) => { setFiltroUsuario(evento.target.value); setPagina(0); }}>
                <option value="">Todos</option>
                {usuarios.map((usuario) => (
                  <option value={usuario.id} key={usuario.id}>{usuario.nombre}{usuario.email ? ` · ${usuario.email}` : ""}</option>
                ))}
              </select>
            </label>
            <label>
              Acción
              <select value={filtroAccion} onChange={(evento) => { setFiltroAccion(evento.target.value); setPagina(0); }}>
                <option value="">Todas</option>
                {Object.entries(ACCIONES).map(([valor, texto]) => <option value={valor} key={valor}>{texto}</option>)}
              </select>
            </label>
            <label>
              Partido / acta
              <select value={filtroPartido} onChange={(evento) => { setFiltroPartido(evento.target.value); setPagina(0); }}>
                <option value="">Todos los partidos</option>
                {partidos.map((partido) => {
                  const fechaPartido = partido.fecha
                    ? new Date(partido.fecha).toLocaleString("es-ES", {
                      timeZone: "Europe/Madrid",
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                    : "Fecha no disponible";
                  return (
                    <option value={partido.id} key={partido.id}>
                      Jornada {partido.jornada || "—"} · {partido.local?.nombre || "Local"}–{partido.visitante?.nombre || "Visitante"} · {fechaPartido}
                    </option>
                  );
                })}
              </select>
            </label>
            <button type="button" className="mini" onClick={limpiarFiltros}>Limpiar filtros</button>
          </section>
          {errorPartidos && <p className="error" role="alert">{errorPartidos}</p>}

          <p className="log-total" aria-live="polite">
            {total} {total === 1 ? "acción registrada" : "acciones registradas"}
          </p>

          <div className="tabla-scroll">
            <table className="tabla-log">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Acta / registro</th>
                  <th>Cambios</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr><td colSpan="5">Cargando acciones…</td></tr>
                ) : registros.length ? registros.map((registro) => {
                  const usuario = usuarioPorId.get(String(registro.usuario_id));
                  const partidoId = partidoDe(registro);
                  return (
                    <tr key={registro.id}>
                      <td>{fechaLegible(registro.creado_en)}</td>
                      <td>{usuario?.nombre || (registro.usuario_id ? `Usuario #${registro.usuario_id}` : "Sin usuario identificado")}</td>
                      <td>{accionLegible(registro)}</td>
                      <td>
                        {partidoId ? (
                          <a href={`/actas/${partidoId}?desde=log`}>Acta #{partidoId}</a>                        ) : (
                          `Registro #${registro.fila_id ?? "—"}`
                        )}
                        <span className="log-tabla">{registro.tabla === "eventos" ? "Evento" : registro.tabla}</span>
                      </td>
                      <td>
                        <details className="log-cambios">
                          <summary>Ver detalle</summary>
                          <div>
                            <strong>Antes</strong>
                            <pre>{registro.datos_antes ? JSON.stringify(registro.datos_antes, null, 2) : "Sin datos anteriores"}</pre>
                            <strong>Después</strong>
                            <pre>{registro.datos_despues ? JSON.stringify(registro.datos_despues, null, 2) : "Sin datos posteriores"}</pre>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="5">{error ? "No se pudieron mostrar los registros." : "No hay acciones para estos filtros."}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <nav className="paginacion-goleadores" aria-label="Paginación del log">
            <button type="button" disabled={pagina === 0 || cargando} onClick={() => setPagina((actual) => actual - 1)}>
              Anterior
            </button>
            <span>Página {pagina + 1} de {totalPaginas}</span>
            <button type="button" disabled={pagina + 1 >= totalPaginas || cargando} onClick={() => setPagina((actual) => actual + 1)}>
              Siguiente
            </button>
          </nav>
        </>
      )}
    </main>
  );
}
