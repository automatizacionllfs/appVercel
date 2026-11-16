"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import NavegacionArbitro from "../NavegacionArbitro";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function fechaInicial() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 7);
  fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset());
  return fecha.toISOString().slice(0, 16);
}

export default function PruebaCrearPartido() {
  const [sesion, setSesion] = useState(undefined);
  const [grupos, setGrupos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [grupoId, setGrupoId] = useState("");
  const [equipoLocalId, setEquipoLocalId] = useState("");
  const [equipoVisitanteId, setEquipoVisitanteId] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [tokenClupik, setTokenClupik] = useState("");
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [partidoCreado, setPartidoCreado] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: errorSesion }) => {
      if (errorSesion) setError(`No se pudo consultar la sesión: ${errorSesion.message}`);
      setSesion(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => setSesion(nuevaSesion));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (sesion === undefined) return;
    if (!sesion) {
      setCargando(false);
      return;
    }
    let activo = true;
    fetch("/api/clupik/partidos", {
      headers: { Authorization: `Bearer ${sesion.access_token}` },
      cache: "no-store",
    }).then(async (respuesta) => {
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo comprobar el acceso.");
      if (!activo) return;
      setGrupos(datos.grupos || []);
      setEquipos(datos.equipos || []);
      setGrupoId(datos.grupos?.[0]?.id_clupik || "");
      setError("");
    }).catch((fallo) => {
      if (activo) setError(fallo.message);
    }).finally(() => {
      if (activo) setCargando(false);
    });
    return () => { activo = false; };
  }, [sesion]);

  const equiposGrupo = useMemo(() => {
    const grupo = grupos.find((item) => String(item.id_clupik) === String(grupoId));
    return equipos.filter((equipo) => String(equipo.grupo_id) === String(grupo?.id));
  }, [equipos, grupos, grupoId]);

  useEffect(() => {
    if (!equiposGrupo.some((equipo) => String(equipo.id_clupik) === String(equipoLocalId))) {
      setEquipoLocalId(equiposGrupo[0]?.id_clupik || "");
    }
    if (!equiposGrupo.some((equipo) => String(equipo.id_clupik) === String(equipoVisitanteId)) ||
        String(equipoVisitanteId) === String(equipoLocalId)) {
      setEquipoVisitanteId(equiposGrupo.find((equipo) => String(equipo.id_clupik) !== String(equipoLocalId))?.id_clupik || "");
    }
  }, [equiposGrupo, equipoLocalId, equipoVisitanteId]);

  async function crearPartido(evento) {
    evento.preventDefault();
    setError("");
    setPartidoCreado(null);
    if (!window.confirm("Esto creará un partido real en Clupik, visible para la organización. ¿Continuar?")) return;
    setEnviando(true);
    try {
      const respuesta = await fetch("/api/clupik/partidos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sesion.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tokenClupik, grupoId, equipoLocalId, equipoVisitanteId, fecha }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || `Clupik devolvió HTTP ${respuesta.status}.`);
      setPartidoCreado(datos.partido);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setTokenClupik("");
      setEnviando(false);
    }
  }

  async function entrar() {
    const { error: errorAcceso } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/arbitro/prueba-partido` },
    });
    if (errorAcceso) setError(`No se pudo iniciar sesión: ${errorAcceso.message}`);
  }

  return (
    <main>
      <NavegacionArbitro />
      <h1>Prueba de creación de partido</h1>
      <p className="suave">Herramienta de prueba para administradores. El partido se crea directamente en Clupik.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {sesion === undefined || cargando ? <p>Cargando…</p> : !sesion ? (
        <button className="primario" type="button" onClick={entrar}>Entrar con Google</button>
      ) : error && !grupos.length ? (
        <p role="status">No se ha podido cargar la herramienta. Comprueba que has iniciado sesión como administrador.</p>
      ) : !grupos.length ? (
        <p className="suave">No hay grupos cargados en la temporada activa.</p>
      ) : (
        <>
          <div className="clupik-prueba-aviso" role="note">
            Esto no es un entorno sandbox: al enviar el formulario se creará un registro real en Clupik.
            Usa un token recién obtenido; se enviará solo para esta petición y no se guardará.
          </div>
          <form className="clupik-prueba-form" onSubmit={crearPartido}>
            <label>
              Token de Clupik
              <input
                type="password"
                value={tokenClupik}
                onChange={(evento) => setTokenClupik(evento.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <label>
              Grupo
              <select value={grupoId} onChange={(evento) => setGrupoId(evento.target.value)} required>
                {grupos.map((grupo) => <option key={grupo.id} value={grupo.id_clupik}>{grupo.nombre}</option>)}
              </select>
            </label>
            <label>
              Equipo local
              <select value={equipoLocalId} onChange={(evento) => setEquipoLocalId(evento.target.value)} required>
                {equiposGrupo.map((equipo) => <option key={equipo.id} value={equipo.id_clupik}>{equipo.nombre}</option>)}
              </select>
            </label>
            <label>
              Equipo visitante
              <select value={equipoVisitanteId} onChange={(evento) => setEquipoVisitanteId(evento.target.value)} required>
                {equiposGrupo.map((equipo) => <option key={equipo.id} value={equipo.id_clupik}>{equipo.nombre}</option>)}
              </select>
            </label>
            <label>
              Fecha y hora
              <input type="datetime-local" value={fecha} onChange={(evento) => setFecha(evento.target.value)} required />
            </label>
            <button type="submit" className="primario" disabled={enviando || equiposGrupo.length < 2}>
              {enviando ? "Creando en Clupik…" : "Crear partido de prueba"}
            </button>
          </form>
          {partidoCreado && (
            <section className="clupik-prueba-resultado" aria-live="polite">
              <h2>Partido creado correctamente</h2>
              <p>Identificador de Clupik: <strong>{partidoCreado.id}</strong></p>
              <details>
                <summary>Ver respuesta de Clupik</summary>
                <pre>{JSON.stringify(partidoCreado, null, 2)}</pre>
              </details>
            </section>
          )}
        </>
      )}
    </main>
  );
}
