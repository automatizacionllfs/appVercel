import { createClient } from "@supabase/supabase-js";
import Estadisticas from "./estadisticas";

export const revalidate = 60;

export default async function PaginaEstadisticas() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temporada, error: errorTemporada } = await db.from("temporadas").select("id,nombre").eq("activa", true).maybeSingle();
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);

  let equipos = [];
  let partidos = [];
  let eventos = [];
  if (temporada) {
    const [resultadoEquipos, resultadoPartidos] = await Promise.all([
      db.from("equipos").select("id,nombre,escudo_url,grupo:grupos(nombre)").eq("temporada_id", temporada.id).order("nombre"),
      db.from("partidos").select("id,jornada,fecha,local_id,visitante_id,goles_local_clupik,goles_visitante_clupik")
        .eq("temporada_id", temporada.id),
    ]);
    if (resultadoEquipos.error) throw new Error(`No se pudieron cargar los equipos: ${resultadoEquipos.error.message}`);
    if (resultadoPartidos.error) throw new Error(`No se pudieron cargar los partidos: ${resultadoPartidos.error.message}`);
    equipos = resultadoEquipos.data || [];
    partidos = resultadoPartidos.data || [];
    if (partidos.length) {
      for (let desde = 0; ; desde += 1000) {
        const { data: pagina, error } = await db.from("eventos")
          .select("partido_id,equipo_id,jugador_id,tipo,parte,restante_seg,jugador:jugadores(id,nombre)")
          .eq("anulado", false)
          .in("partido_id", partidos.map((partido) => partido.id))
          .range(desde, desde + 999);
        if (error) throw new Error(`No se pudieron cargar los eventos: ${error.message}`);
        eventos.push(...(pagina || []));
        if (!pagina || pagina.length < 1000) break;
      }
    }
  }

  return (
    <main>
      <h1>Estadísticas{temporada ? ` ${temporada.nombre}` : ""}</h1>
      <Estadisticas equipos={equipos} partidos={partidos} eventos={eventos} />
    </main>
  );
}
