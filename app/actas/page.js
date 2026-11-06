import { createClient } from "@supabase/supabase-js";
import InfoDatosPublicos from "../InfoDatosPublicos";

export const revalidate = 60;

const fecha = (valor) => valor
  ? new Date(valor).toLocaleDateString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  : "Fecha no disponible";

export default async function ActasDigitales() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temporada, error: errorTemporada } = await db.from("temporadas")
    .select("id,nombre")
    .eq("activa", true)
    .maybeSingle();
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);

  let partidosConActa = [];
  if (temporada) {
    const [{ data: partidos, error: errorPartidos }, { data: equipos, error: errorEquipos }] = await Promise.all([
      db.from("partidos")
        .select("id,jornada,fecha,estado,goles_local_clupik,goles_visitante_clupik,local_id,visitante_id")
        .eq("temporada_id", temporada.id)
        .order("fecha", { ascending: false }),
      db.from("equipos")
        .select("id,nombre,escudo_url")
        .eq("temporada_id", temporada.id),
    ]);
    if (errorPartidos) throw new Error(`No se pudieron cargar los partidos: ${errorPartidos.message}`);
    if (errorEquipos) throw new Error(`No se pudieron cargar los equipos: ${errorEquipos.message}`);

    const ids = (partidos || []).map((partido) => partido.id);
    const eventos = [];
    if (ids.length) {
      for (let desde = 0; ; desde += 1000) {
        const { data: pagina, error } = await db.from("eventos")
          .select("partido_id,tipo")
          .eq("anulado", false)
          .in("partido_id", ids)
          .range(desde, desde + 999);
        if (error) throw new Error(`No se pudieron cargar las actas digitales: ${error.message}`);
        eventos.push(...(pagina || []));
        if (!pagina || pagina.length < 1000) break;
      }
    }

    const equipoPorId = new Map((equipos || []).map((equipo) => [equipo.id, equipo]));
    const resumenEventos = new Map();
    eventos.forEach((evento) => {
      const resumen = resumenEventos.get(evento.partido_id) || { goles: 0, tarjetas: 0, eventos: 0 };
      resumen.eventos += 1;
      if (evento.tipo === "gol") resumen.goles += 1;
      else resumen.tarjetas += 1;
      resumenEventos.set(evento.partido_id, resumen);
    });

    partidosConActa = (partidos || [])
      .map((partido) => ({
        ...partido,
        local: equipoPorId.get(partido.local_id),
        visitante: equipoPorId.get(partido.visitante_id),
        resumen: resumenEventos.get(partido.id) || { goles: 0, tarjetas: 0, eventos: 0 },
        actaDigitalizada: partido.estado === "cerrado" || resumenEventos.has(partido.id),
      }));
  }

  return (
    <main>
      <h1>Actas digitales{temporada ? ` · ${temporada.nombre}` : ""}</h1>
      <InfoDatosPublicos />
      <p className="suave">Consulta todos los partidos y repasa en orden cronológico los eventos de las actas digitalizadas.</p>
      {!partidosConActa.length ? (
        <section className="actas-vacio">
          <span aria-hidden="true">📋</span>
          <h2>Aún no hay partidos disponibles</h2>
          <p className="suave">Los partidos aparecerán aquí cuando se sincronicen.</p>
        </section>
      ) : (
        <section className="actas-lista" aria-label="Todos los partidos">
          {partidosConActa.map((partido) => {
            const contenido = (
              <>
                <span className="acta-partido-meta">
                  Jornada {partido.jornada || "—"} <span aria-hidden="true">·</span> {fecha(partido.fecha)}
                  <span className={`acta-estado ${partido.estado === "cerrado" ? "cerrada" : ""} ${!partido.actaDigitalizada ? "pendiente" : ""}`}>
                    {partido.estado === "cerrado" ? "Acta cerrada" : partido.actaDigitalizada ? "Acta en curso" : "Sin acta digital"}
                  </span>
                </span>
                <span className="acta-cruce">
                  <span className="acta-equipo">
                    {partido.local?.escudo_url && <img src={partido.local.escudo_url} alt="" width="34" height="34" />}
                    <strong>{partido.local?.nombre || "Equipo local"}</strong>
                  </span>
                  <span className="acta-marcador" aria-label="Marcador sincronizado">
                    {partido.goles_local_clupik ?? "—"} : {partido.goles_visitante_clupik ?? "—"}
                  </span>
                  <span className="acta-equipo visitante">
                    {partido.visitante?.escudo_url && <img src={partido.visitante.escudo_url} alt="" width="34" height="34" />}
                    <strong>{partido.visitante?.nombre || "Equipo visitante"}</strong>
                  </span>
                </span>
                <span className="acta-partido-pie">
                  <span>{partido.actaDigitalizada ? `${partido.resumen.eventos} eventos registrados` : "Acta pendiente de digitalizar"}</span>
                  {partido.actaDigitalizada && (
                    <span className="acta-ver-cronologia">Ver cronología <span aria-hidden="true">→</span></span>
                  )}
                </span>
              </>
            );
            return partido.actaDigitalizada
              ? <a className="acta-partido" href={`/actas/${partido.id}`} key={partido.id}>{contenido}</a>
              : <article className="acta-partido" key={partido.id}>{contenido}</article>;
          })}
        </section>
      )}
      <a className="boton-inicio" href="/">← Volver al inicio</a>
    </main>
  );
}
