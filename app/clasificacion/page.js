import { createClient } from "@supabase/supabase-js";
import ClasificacionLiga from "../ClasificacionLiga";

export const revalidate = 60;

export default async function PaginaClasificacion() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temporada, error: errorTemporada } = await db.from("temporadas")
    .select("id,nombre").eq("activa", true).maybeSingle();
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);

  let equipos = [];
  let partidos = [];
  if (temporada) {
    const [resultadoEquipos, resultadoPartidos] = await Promise.all([
      db.from("equipos").select("id,nombre,grupo_id,escudo_url,grupo:grupos(nombre)")
        .eq("temporada_id", temporada.id).order("nombre"),
      db.from("partidos").select("id,grupo_id,jornada,local_id,visitante_id,goles_local_clupik,goles_visitante_clupik")
        .eq("temporada_id", temporada.id),
    ]);
    if (resultadoEquipos.error) throw new Error(`No se pudieron cargar los equipos: ${resultadoEquipos.error.message}`);
    if (resultadoPartidos.error) throw new Error(`No se pudieron cargar los partidos: ${resultadoPartidos.error.message}`);
    equipos = resultadoEquipos.data || [];
    partidos = resultadoPartidos.data || [];
  }

  return (
    <main>
      <h1>Clasificación{temporada ? ` ${temporada.nombre}` : ""}</h1>
      <ClasificacionLiga equipos={equipos} partidos={partidos} />
    </main>
  );
}
