"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import NavegacionArbitro from "../../arbitro/NavegacionArbitro";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: true },
});

export default function AdminPins({ redirectPath = "/entrenador/admin" }) {
  const [sesion, setSesion] = useState(undefined);
  const [equipos, setEquipos] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [generando, setGenerando] = useState("");
  const [pinNuevo, setPinNuevo] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: errorSesion }) => {
      if (errorSesion) setError(`No se pudo consultar la sesión: ${errorSesion.message}`);
      setSesion(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => setSesion(nuevaSesion));
    return () => data.subscription.unsubscribe();
  }, []);

  const cargar = useCallback(async () => {
    if (!sesion?.access_token) return;
    setCargando(true);
    setError("");
    try {
      const response = await fetch("/api/entrenador/admin/pins", {
        headers: { Authorization: `Bearer ${sesion.access_token}` },
        cache: "no-store",
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.error || "No se pudo cargar la lista de PIN.");
      setEquipos(resultado.equipos || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [sesion]);

  useEffect(() => { cargar(); }, [cargar]);

  async function generar(equipo) {
    setGenerando(String(equipo.id));
    setPinNuevo(null);
    setError("");
    try {
      const response = await fetch("/api/entrenador/admin/pins", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sesion.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ equipoId: equipo.id }),
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.error || "No se pudo generar el PIN.");
      setPinNuevo({ equipo: equipo.nombre, pin: resultado.pin });
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerando("");
    }
  }

  async function entrar() {
    const { error: errorAcceso } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${redirectPath}` },
    });
    if (errorAcceso) setError(`No se pudo iniciar sesión: ${errorAcceso.message}`);
  }

  if (sesion === undefined) return <main><p>Comprobando acceso…</p></main>;
  if (!sesion) return (
    <main>
      <h1>Gestión de PIN de entrenadores</h1>
      <p>Esta herramienta está reservada a las cuentas de administrador autorizadas.</p>
      {error && <p className="error">{error}</p>}
      <button className="primario" type="button" onClick={entrar}>Entrar con Google</button>
    </main>
  );

  return (
    <main>
      <NavegacionArbitro />
      <h1>Gestión de PIN de entrenadores</h1>
      <p>Genera o regenera las claves de los equipos de la temporada activa. Cada PIN se muestra una sola vez.</p>
      {error && <p className="error">{error}</p>}
      {pinNuevo && (
        <aside className="pin-generado" role="status">
          <strong>PIN nuevo para {pinNuevo.equipo}</strong>
          <code>{pinNuevo.pin}</code>
          <p>Entrégalo al entrenador ahora; no se volverá a mostrar.</p>
          <button type="button" className="mini" onClick={() => setPinNuevo(null)}>Ocultar PIN</button>
        </aside>
      )}
      {cargando && !equipos.length ? <p>Cargando equipos…</p> : !equipos.length ? (
        <p className="suave">No hay equipos en la temporada activa.</p>
      ) : (
        <div className="admin-pins-lista">
          {equipos.map((equipo) => (
            <article className="admin-pin-equipo" key={equipo.id}>
              <strong>{equipo.nombre}</strong>
              <span className={equipo.pinActivo ? "pin-activo" : "pin-inactivo"}>
                {equipo.pinActivo ? "PIN activo" : "Sin PIN"}
              </span>
              <button
                type="button"
                className="mini"
                disabled={generando === String(equipo.id)}
                onClick={() => generar(equipo)}
              >
                {generando === String(equipo.id) ? "Generando…" : equipo.pinActivo ? "Regenerar PIN" : "Generar PIN"}
              </button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
