"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { fechaMadridAISO, fechaMadridInput, MADRID_TIME_ZONE, partesEnMadrid } from "../../lib/fecha-madrid";
import NavegacionArbitro from "../NavegacionArbitro";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function fechaInicial() {
  const ahora = partesEnMadrid(new Date());
  return new Date(Date.UTC(ahora.year, ahora.month - 1, ahora.day + 7, ahora.hour, ahora.minute))
    .toISOString()
    .slice(0, 16);
}

function fechaLegible(valor) {
  if (!valor) return "Fecha no disponible";
  return new Date(valor).toLocaleString("es-ES", {
    timeZone: MADRID_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function PruebaCrearPartido() {
  const [sesion, setSesion] = useState(undefined);
  const [grupos, setGrupos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [estadios, setEstadios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [grupoId, setGrupoId] = useState("");
  const [equipoLocalId, setEquipoLocalId] = useState("");
  const [equipoVisitanteId, setEquipoVisitanteId] = useState("");
  const [estadioId, setEstadioId] = useState("");
  const [jornada, setJornada] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [partidosSeleccionados, setPartidosSeleccionados] = useState([]);
  const [modalAsignacion, setModalAsignacion] = useState(false);
  const [asignacion, setAsignacion] = useState({ arbitro1Id: "", arbitro2Id: "", cronoId: "" });
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [progresoDescarga, setProgresoDescarga] = useState({ actual: 0, total: 0 });
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

  const cargarDatos = useCallback(async () => {
    const respuesta = await fetch("/api/clupik/partidos", {
      headers: { Authorization: `Bearer ${sesion.access_token}` },
      cache: "no-store",
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error || "No se pudo cargar la información de Clupik.");
    setGrupos(datos.grupos || []);
    setEquipos(datos.equipos || []);
    setEstadios(datos.estadios || []);
    setUsuarios(datos.usuarios || []);
    setPartidos(datos.partidos || []);
    setGrupoId((actual) => actual || datos.grupos?.[0]?.id_clupik || "");
    setEstadioId((actual) => actual || datos.estadios?.[0]?.id || "");
    setError("");
  }, [sesion]);

  useEffect(() => {
    if (sesion === undefined) return;
    if (!sesion) {
      setCargando(false);
      return;
    }
    let activo = true;
    setCargando(true);
    cargarDatos().catch((fallo) => {
      if (activo) setError(fallo.message);
    }).finally(() => {
      if (activo) setCargando(false);
    });
    return () => { activo = false; };
  }, [sesion, cargarDatos]);

  const equiposGrupo = useMemo(() => {
    const grupo = grupos.find((item) => String(item.id_clupik) === String(grupoId));
    return equipos.filter((equipo) => String(equipo.grupo_id) === String(grupo?.id));
  }, [equipos, grupos, grupoId]);

  const partidosFiltrados = useMemo(() => partidos.filter((partido) => {
    const dia = fechaMadridInput(partido.fecha);
    return (!desde || (dia && dia >= desde)) && (!hasta || (dia && dia <= hasta));
  }), [partidos, desde, hasta]);

  useEffect(() => {
    setPartidosSeleccionados((actuales) =>
      actuales.filter((id) => partidosFiltrados.some((partido) => String(partido.id) === String(id)))
    );
  }, [partidosFiltrados]);

  useEffect(() => {
    const persona = usuarios[0]?.id || "";
    setAsignacion((actual) => ({
      arbitro1Id: actual.arbitro1Id || persona,
      arbitro2Id: actual.arbitro2Id || usuarios.find((usuario) => String(usuario.id) !== String(persona))?.id || "",
      cronoId: actual.cronoId || usuarios.find((usuario) =>
        String(usuario.id) !== String(persona) &&
        String(usuario.id) !== String(actual.arbitro2Id || usuarios.find((item) => String(item.id) !== String(persona))?.id || "")
      )?.id || "",
    }));
  }, [usuarios]);

  const asignacionCompleta = [asignacion.arbitro1Id, asignacion.arbitro2Id, asignacion.cronoId]
    .every(Boolean) && new Set([asignacion.arbitro1Id, asignacion.arbitro2Id, asignacion.cronoId]).size === 3;

  function cambiarAsignacion(campo, valor) {
    setAsignacion((actual) => {
      const siguiente = { ...actual, [campo]: valor };
      if (new Set(Object.values(siguiente).filter(Boolean)).size === 3) return siguiente;
      const ocupados = new Set([siguiente.arbitro1Id, siguiente.arbitro2Id].filter(Boolean));
      siguiente.cronoId = usuarios.find((usuario) => !ocupados.has(String(usuario.id)))?.id || "";
      return siguiente;
    });
  }

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
      const fechaISO = fechaMadridAISO(fecha);
      const respuesta = await fetch("/api/clupik/partidos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sesion.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ grupoId, equipoLocalId, equipoVisitanteId, estadioId, jornada, fecha: fechaISO }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        if (datos.partidoCreado) setPartidoCreado({ id: datos.idClupik, warning: datos.error });
        throw new Error(datos.error || `Clupik devolvió HTTP ${respuesta.status}.`);
      }
      setPartidoCreado(datos.partido);
      try {
        await cargarDatos();
      } catch (fallo) {
        setError(`El partido ${datos.partido.id} se creó, pero no se pudo actualizar la lista: ${fallo.message}`);
      }
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setEnviando(false);
    }
  }

  function alternarSeleccion(id) {
    setPartidosSeleccionados((actuales) => actuales.includes(id)
      ? actuales.filter((seleccionado) => seleccionado !== id)
      : actuales.length < 12 ? [...actuales, id] : actuales);
  }

  async function descargarActas(evento) {
    evento.preventDefault();
    if (!asignacionCompleta || !partidosSeleccionados.length) return;
    setError("");
    setDescargando(true);
    setProgresoDescarga({ actual: 0, total: partidosSeleccionados.length });
    const seleccion = [...partidosSeleccionados];
    let descargadas = 0;
    try {
      for (let index = 0; index < seleccion.length; index += 1) {
        const respuesta = await fetch("/api/clupik/partidos/actas", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sesion.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            partidoIds: [seleccion[index]],
            ...asignacion,
          }),
        });
        if (!respuesta.ok) {
          const datos = await respuesta.json();
          throw new Error(datos.error || `No se pudo generar el acta (HTTP ${respuesta.status}).`);
        }
        const archivo = await respuesta.blob();
        const nombre = respuesta.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/i)?.[1]
          || `Acta_${seleccion[index]}.pdf`;
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombre;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        descargadas += 1;
        setProgresoDescarga({ actual: descargadas, total: seleccion.length });
        if (index + 1 < seleccion.length) {
          await new Promise((resolve) => window.setTimeout(resolve, 700));
        }
      }
      setModalAsignacion(false);
    } catch (fallo) {
      const mensaje = fallo instanceof Error ? fallo.message : "No se pudieron descargar las actas.";
      setError(descargadas
        ? `Se descargaron ${descargadas} de ${seleccion.length} actas. ${mensaje}`
        : mensaje);
    } finally {
      setDescargando(false);
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
      <h1>Crear partidos y descargar actas</h1>
      <p className="suave">Herramienta para administradores. Los partidos se crean directamente en Clupik.</p>
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
            El servidor iniciará sesión con las credenciales privadas configuradas; no introduzcas ni compartas tokens aquí.
          </div>
          <form className="clupik-prueba-form" onSubmit={crearPartido}>
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
              Pabellón
              <select value={estadioId} onChange={(evento) => setEstadioId(evento.target.value)} required>
                {estadios.map((estadio) => <option key={estadio.id} value={estadio.id}>{estadio.nombre}</option>)}
              </select>
            </label>
            <label>
              Jornada (opcional)
              <input type="number" min="1" max="99" value={jornada} onChange={(evento) => setJornada(evento.target.value)} />
            </label>
            <label>
              Fecha y hora (hora peninsular)
              <input type="datetime-local" value={fecha} onChange={(evento) => setFecha(evento.target.value)} required />
            </label>
            <button type="submit" className="primario" disabled={enviando || equiposGrupo.length < 2 || !estadios.length}>
              {enviando ? "Creando en Clupik…" : "Crear partido en Clupik"}
            </button>
          </form>
          {partidoCreado && (
            <section className="clupik-prueba-resultado" aria-live="polite">
              <h2>{partidoCreado.warning ? "Partido creado en Clupik" : "Partido creado correctamente"}</h2>
              <p>Identificador de Clupik: <strong>{partidoCreado.id}</strong></p>
              {partidoCreado.warning
                ? <p className="error">{partidoCreado.warning}</p>
                : <details><summary>Ver respuesta de Clupik</summary><pre>{JSON.stringify(partidoCreado, null, 2)}</pre></details>}
            </section>
          )}

          <section className="clupik-partidos" aria-labelledby="clupik-partidos-titulo">
            <h2 id="clupik-partidos-titulo">Partidos disponibles para acta</h2>
            <div className="clupik-partidos-filtros">
              <label>Desde
                <input type="date" value={desde} onChange={(evento) => setDesde(evento.target.value)} />
              </label>
              <label>Hasta
                <input type="date" value={hasta} onChange={(evento) => setHasta(evento.target.value)} />
              </label>
              <button type="button" className="mini" onClick={() => { setDesde(""); setHasta(""); }}>Ver todas las fechas</button>
            </div>
            {desde && hasta && desde > hasta && <p className="error">La fecha inicial no puede ser posterior a la fecha final.</p>}
            <p className="suave">{partidosFiltrados.length} partidos · Selecciona hasta 12 para generar actas.</p>
            {!partidosFiltrados.length ? (
              <p className="suave">No hay partidos en este rango de fechas.</p>
            ) : (
              <div className="clupik-partidos-lista">
                {partidosFiltrados.map((partido) => {
                  const seleccionado = partidosSeleccionados.includes(partido.id);
                  return (
                    <label className="clupik-partido-fila" key={partido.id}>
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        disabled={!seleccionado && partidosSeleccionados.length >= 12}
                        onChange={() => alternarSeleccion(partido.id)}
                      />
                      <span>
                        <strong>{partido.local?.nombre || "Local"} – {partido.visitante?.nombre || "Visitante"}</strong>
                        <span>{partido.grupo?.nombre || "Grupo —"} · Jornada {partido.jornada || "—"} · {fechaLegible(partido.fecha)}</span>
                        <span>{partido.pabellon || "Pabellón no disponible"}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {partidosSeleccionados.length > 0 && (
              <div className="clupik-partidos-acciones">
                <span>{partidosSeleccionados.length} seleccionados</span>
                <button type="button" className="primario" onClick={() => setModalAsignacion(true)}>
                  Asignar árbitros
                </button>
              </div>
            )}
          </section>
        </>
      )}
      {modalAsignacion && (
        <div className="clupik-modal-fondo" role="presentation" onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget && !descargando) setModalAsignacion(false);
        }}>
          <section className="clupik-modal" role="dialog" aria-modal="true" aria-labelledby="clupik-modal-titulo">
            <h2 id="clupik-modal-titulo">Asignar árbitros y crono</h2>
            <p className="suave">
              La asignación se aplicará a los {partidosSeleccionados.length} PDF y no se guardará en Clupik.
              Se descargarán como archivos separados; permite las descargas múltiples si el navegador lo solicita.
            </p>
            {[
              ["arbitro1Id", "Árbitro 1"],
              ["arbitro2Id", "Árbitro 2"],
              ["cronoId", "Crono"],
            ].map(([campo, etiqueta]) => (
              <label key={campo}>
                {etiqueta}
                <select value={asignacion[campo]} onChange={(evento) => cambiarAsignacion(campo, evento.target.value)} required>
                  <option value="">Seleccionar</option>
                  {usuarios.map((usuario) => {
                    const ocupado = Object.entries(asignacion).some(([otroCampo, id]) => otroCampo !== campo && String(id) === String(usuario.id));
                    return <option key={usuario.id} value={usuario.id} disabled={ocupado}>{usuario.nombre}</option>;
                  })}
                </select>
              </label>
            ))}
            {error && <p className="error" role="alert">{error}</p>}
            {descargando && (
              <p className="suave" role="status">
                Descargando acta {Math.min(progresoDescarga.actual + 1, progresoDescarga.total)} de {progresoDescarga.total}…
              </p>
            )}
            <div className="clupik-modal-acciones">
              <button type="button" className="mini" disabled={descargando} onClick={() => setModalAsignacion(false)}>Cancelar</button>
              <button type="button" className="primario" disabled={!asignacionCompleta || descargando} onClick={descargarActas}>
                {descargando ? "Descargando actas…" : "Descargar Actas"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
