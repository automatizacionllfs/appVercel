"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import NavegacionArbitro from "../NavegacionArbitro";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const tipoEvento = { gol: "Gol", amarilla: "Tarjeta amarilla", roja: "Tarjeta roja" };

function fechaPartido(fecha) {
  if (!fecha) return "Fecha no disponible";
  return new Date(fecha).toLocaleDateString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function horaEvento(evento) {
  if (evento.parte == null || evento.restante_seg == null) return "";
  const segundos = (Number(evento.parte) - 1) * 1320 + 1320 - Number(evento.restante_seg);
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

export default function SinFicha() {
  const [sesion, setSesion] = useState(undefined);
  const [usuario, setUsuario] = useState(undefined);
  const [jugadores, setJugadores] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [selecciones, setSelecciones] = useState({});
  const [fusionando, setFusionando] = useState(null);

  useEffect(() => {
    let vigente = true;
    supabase.auth.getSession().then(({ data, error: errorSesion }) => {
      if (!vigente) return;
      if (errorSesion) setError(`No se pudo consultar la sesión: ${errorSesion.message}`);
      setSesion(data?.session || null);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion);
      setUsuario(undefined);
      setJugadores([]);
    });
    return () => {
      vigente = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    async function cargarUsuario() {
      if (!sesion?.user?.email) {
        setUsuario(null);
        return;
      }
      const { data, error: errorUsuario } = await supabase.from("usuarios")
        .select("id,nombre,rol")
        .ilike("email", sesion.user.email)
        .eq("activo", true)
        .in("rol", ["admin", "arbitro"])
        .maybeSingle();
      if (!vigente) return;
      if (errorUsuario) {
        setError(`No se pudo validar el acceso: ${errorUsuario.message}`);
        setUsuario(null);
        return;
      }
      if (!data) {
        setUsuario(null);
        return;
      }
      setUsuario(data);
    }
    cargarUsuario();
    return () => { vigente = false; };
  }, [sesion]);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      if (!usuario || !sesion) return;
      setCargando(true);
      setError("");
      try {
        const { data: temporada, error: errorTemporada } = await supabase.from("temporadas")
          .select("id,nombre")
          .eq("activa", true)
          .maybeSingle();
        if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);
        if (!temporada) {
          setJugadores([]);
          return;
        }

        const { data: equipos, error: errorEquipos } = await supabase.from("equipos")
          .select("id,nombre")
          .eq("temporada_id", temporada.id)
          .order("nombre");
        if (errorEquipos) throw new Error(`No se pudieron cargar los equipos: ${errorEquipos.message}`);
        const equipoIds = (equipos || []).map((equipo) => equipo.id);
        if (!equipoIds.length) {
          setJugadores([]);
          return;
        }

        const [{ data: plantilla, error: errorPlantilla }, { data: partidosTemporada, error: errorPartidos }] = await Promise.all([
          supabase.from("plantilla")
            .select("equipo_id,dorsal,jugador:jugadores(id,nombre,sin_ficha,id_clupik)")
            .in("equipo_id", equipoIds),
          supabase.from("partidos")
            .select("id,jornada,fecha,local_id,visitante_id,local:equipos!partidos_local_id_fkey(nombre),visitante:equipos!partidos_visitante_id_fkey(nombre)")
            .eq("temporada_id", temporada.id)
            .order("fecha"),
        ]);
        if (errorPlantilla) throw new Error(`No se pudo cargar la plantilla: ${errorPlantilla.message}`);
        if (errorPartidos) throw new Error(`No se pudieron cargar los partidos: ${errorPartidos.message}`);

        const filas = (plantilla || []).filter((fila) => fila.jugador?.sin_ficha);
        const jugadorIds = [...new Set(filas.map((fila) => fila.jugador.id))];
        const partidoIds = (partidosTemporada || []).map((partido) => partido.id);
        const [{ data: inscripciones, error: errorInscripciones }, { data: eventos, error: errorEventos }] = partidoIds.length && jugadorIds.length
          ? await Promise.all([
            supabase.from("inscripciones_acta")
              .select("partido_id,equipo_id,jugador_id")
              .in("partido_id", partidoIds)
              .in("jugador_id", jugadorIds),
            supabase.from("eventos")
              .select("partido_id,equipo_id,jugador_id,tipo,parte,restante_seg")
              .eq("anulado", false)
              .in("partido_id", partidoIds)
              .in("jugador_id", jugadorIds),
          ])
          : [{ data: [], error: null }, { data: [], error: null }];
        if (errorInscripciones) throw new Error(`No se pudieron cargar los registros en actas: ${errorInscripciones.message}`);
        if (errorEventos) throw new Error(`No se pudieron cargar los eventos de los jugadores: ${errorEventos.message}`);

        const equipoPorId = new Map((equipos || []).map((equipo) => [equipo.id, equipo]));
        const partidoPorId = new Map((partidosTemporada || []).map((partido) => [partido.id, partido]));
        const partidosPorJugador = new Map(jugadorIds.map((id) => [id, new Map()]));
        (inscripciones || []).forEach((inscripcion) => {
          const partido = partidoPorId.get(inscripcion.partido_id);
          const equipo = equipoPorId.get(inscripcion.equipo_id);
          if (!partido || !equipo) return;
          partidosPorJugador.get(inscripcion.jugador_id)?.set(partido.id, {
            ...partido,
            equipo: equipo.nombre,
            eventos: [],
          });
        });
        (eventos || []).forEach((evento) => {
          const partido = partidoPorId.get(evento.partido_id);
          const equipo = equipoPorId.get(evento.equipo_id);
          if (!partido || !equipo) return;
          const partidosJugador = partidosPorJugador.get(evento.jugador_id);
          if (!partidosJugador) return;
          const entrada = partidosJugador.get(partido.id) || {
            ...partido,
            equipo: equipo.nombre,
            eventos: [],
          };
          entrada.eventos.push(evento);
          partidosJugador.set(partido.id, entrada);
        });

        if (!vigente) return;
        setJugadores(filas.map((fila) => ({
          id: fila.jugador.id,
          nombre: fila.jugador.nombre,
          equipo: equipoPorId.get(fila.equipo_id)?.nombre || "Equipo desconocido",
          dorsal: fila.dorsal,
          candidatos: (plantilla || [])
            .filter((candidata) =>
              candidata.equipo_id === fila.equipo_id &&
              candidata.jugador?.id_clupik &&
              !candidata.jugador.sin_ficha,
            )
            .map((candidata) => ({
              id: candidata.jugador.id,
              nombre: candidata.jugador.nombre,
              dorsal: candidata.dorsal,
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
          partidos: [...(partidosPorJugador.get(fila.jugador.id)?.values() || [])]
            .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0)),
        })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
      } catch (errorCarga) {
        if (vigente) setError(errorCarga instanceof Error ? errorCarga.message : String(errorCarga));
      } finally {
        if (vigente) setCargando(false);
      }
    }
    cargar();
    return () => { vigente = false; };
  }, [usuario, sesion, recarga]);

  async function asociar(jugador) {
    const candidatoId = selecciones[jugador.id];
    const candidato = jugador.candidatos.find((fila) => String(fila.id) === candidatoId);
    if (!candidato) {
      setError("Selecciona un jugador de Clupik del mismo equipo.");
      return;
    }
    if (!window.confirm(`¿Asociar «${jugador.nombre}» con «${candidato.nombre}»? Sus eventos y premios MVP pasarán a la ficha de Clupik y el registro sin ficha se eliminará.`)) return;

    setFusionando(jugador.id);
    setError("");
    try {
      const { error: errorFusion } = await supabase.rpc("fusionar_jugador", {
        p_origen: jugador.id,
        p_destino: candidato.id,
      });
      if (errorFusion) throw new Error(errorFusion.message);
      setSelecciones((actuales) => {
        const siguientes = { ...actuales };
        delete siguientes[jugador.id];
        return siguientes;
      });
      setRecarga((actual) => actual + 1);
    } catch (errorFusion) {
      setError(`No se pudo asociar el jugador: ${errorFusion instanceof Error ? errorFusion.message : String(errorFusion)}`);
    } finally {
      setFusionando(null);
    }
  }

  async function entrar() {
    const { error: errorAcceso } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/arbitro/sin-ficha` },
    });
    if (errorAcceso) setError(`No se pudo iniciar sesión: ${errorAcceso.message}`);
  }

  if (sesion === undefined) return <main><p>Comprobando acceso…</p></main>;
  if (!sesion) return (
    <main>
      <h1>Jugadores sin ficha</h1>
      {error && <p className="error">{error}</p>}
      <button className="primario" type="button" onClick={entrar}>Entrar con Google</button>
    </main>
  );
  if (usuario === undefined) return <main><p>Comprobando acceso…</p></main>;
  if (!usuario) return (
    <main>
      <h1>Sin acceso</h1>
      <p>Esta sección está reservada a las cuentas de árbitro autorizadas.</p>
      {error && <p className="error">{error}</p>}
    </main>
  );

  return (
    <main>
      <NavegacionArbitro />
      <h1>Jugadores sin ficha</h1>
      <p className="suave">Control interno de jugadores añadidos al acta sin ficha de Clupik.</p>
      {error && <p className="error">{error}</p>}
      {cargando ? <p>Cargando jugadores…</p> : !jugadores.length ? (
        <p className="suave">No hay jugadores sin ficha en la plantilla de la temporada activa.</p>
      ) : (
        <section className="sin-ficha-lista" aria-label="Jugadores sin ficha">
          {jugadores.map((jugador) => (
            <article className="sin-ficha-jugador" key={`${jugador.id}-${jugador.equipo}`}>
              <header>
                <div>
                  <span className="suave">{jugador.equipo}</span>
                  <h2>{jugador.nombre}</h2>
                </div>
                <strong className="sin-ficha-dorsal">#{jugador.dorsal ?? "–"}</strong>
              </header>
              <div className="sin-ficha-asociar">
                <label htmlFor={`ficha-clupik-${jugador.id}`}>Asociar con ficha de Clupik</label>
                <select
                  id={`ficha-clupik-${jugador.id}`}
                  value={selecciones[jugador.id] || ""}
                  disabled={!jugador.candidatos.length || fusionando === jugador.id}
                  onChange={(event) => setSelecciones((actuales) => ({
                    ...actuales,
                    [jugador.id]: event.target.value,
                  }))}
                >
                  <option value="">Selecciona un jugador del equipo</option>
                  {jugador.candidatos.map((candidato) => (
                    <option key={candidato.id} value={candidato.id}>
                      {candidato.dorsal == null ? "–" : `#${candidato.dorsal}`} {candidato.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="mini"
                  disabled={!jugador.candidatos.length || !selecciones[jugador.id] || fusionando === jugador.id}
                  onClick={() => asociar(jugador)}
                >
                  {fusionando === jugador.id ? "Asociando…" : "Asociar"}
                </button>
                {!jugador.candidatos.length && <span className="suave">No hay otras fichas de Clupik en la plantilla de este equipo.</span>}
              </div>
              <h3>Actas en las que figura</h3>
              {!jugador.partidos.length ? (
                <p className="suave">No se encontró el acta de registro. Los registros anteriores a esta mejora pueden no tener el partido asociado.</p>
              ) : (
                <ul>
                  {jugador.partidos.map((partido) => (
                    <li key={partido.id}>
                      <a href={`/actas/${partido.id}`}>
                        Jornada {partido.jornada || "—"} · {partido.local?.nombre || "Local"}–{partido.visitante?.nombre || "Visitante"} · {fechaPartido(partido.fecha)}
                      </a>
                      <span>
                        {partido.eventos.length
                          ? partido.eventos.map((evento) => `${tipoEvento[evento.tipo] || evento.tipo}${horaEvento(evento) ? ` · ${horaEvento(evento)}` : ""}`).join(", ")
                          : `Inscrito para ${partido.equipo}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
