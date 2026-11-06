import { createClient } from "@supabase/supabase-js";
import Clasificacion from "./Clasificacion";

export const revalidate = 60;

export default async function Inicio() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temp, error: errorTemporada } = await db.from("temporadas").select("id,nombre").eq("activa", true).maybeSingle();
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);
  let filas = [];
  let equipos = [];
  let partidos = [];
  if (temp) {
    const [resultadoGoleadores, resultadoEquipos, resultadoPartidos] = await Promise.all([
      db.from("v_goleadores").select("*").eq("temporada_id", temp.id)
      .order("goles", { ascending: false }).order("jugador").limit(100),
      db.from("equipos").select("id,nombre,grupo_id,escudo_url,grupo:grupos(nombre)").eq("temporada_id", temp.id).order("nombre"),
      db.from("partidos").select("id,grupo_id,jornada,local_id,visitante_id,goles_local_clupik,goles_visitante_clupik")
        .eq("temporada_id", temp.id).not("goles_local_clupik", "is", null).not("goles_visitante_clupik", "is", null),
    ]);
    for (const resultado of [resultadoGoleadores, resultadoEquipos, resultadoPartidos]) {
      if (resultado.error) throw new Error(`No se pudo cargar la clasificación: ${resultado.error.message}`);
    }
    filas = resultadoGoleadores.data || [];
    equipos = resultadoEquipos.data || [];
    partidos = resultadoPartidos.data || [];
  }

  return (
    <main>
      <h1>Clasificación{temp ? ` ${temp.nombre}` : ""}</h1>
      <Clasificacion goleadores={filas} equipos={equipos} partidos={partidos} />
      <p><a className="acceso-arbitro" href="/arbitro">Acceso de árbitros <span aria-hidden="true">→</span></a></p>
      <p><a className="acceso-arbitro" href="/estadisticas">Estadísticas de equipos y jugadores <span aria-hidden="true">→</span></a></p>
    </main>
  );
}
