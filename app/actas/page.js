import { createClient } from "@supabase/supabase-js";
import InfoDatosPublicos from "../InfoDatosPublicos";
import ActasLista from "./ActasLista";

export const revalidate = 60;

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
        <ActasLista partidos={partidosConActa} />
      )}
      <a className="boton-inicio" href="/">← Volver al inicio</a>
    </main>
  );
}
