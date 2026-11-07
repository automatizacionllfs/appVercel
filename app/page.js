import { createClient } from "@supabase/supabase-js";
import Goleadores from "./Goleadores";
import InfoDatosPublicos from "./InfoDatosPublicos";
import { urlFotoMvp } from "./lib/foto-mvp";

export const revalidate = 60;

export default async function Inicio() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temp, error: errorTemporada } = await db.from("temporadas").select("id,nombre").eq("activa", true).maybeSingle();
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);
  let filas = [];
  let equipos = [];
  if (temp) {
    const [resultadoGoleadores, resultadoEquipos] = await Promise.all([
      db.from("v_goleadores").select("*").eq("temporada_id", temp.id).order("goles", { ascending: false }).order("jugador").limit(100),
      db.from("equipos").select("id,id_clupik,nombre,grupo_id,escudo_url,grupo:grupos(nombre)").eq("temporada_id", temp.id).order("nombre"),
    ]);
    for (const resultado of [resultadoGoleadores, resultadoEquipos]) {
      if (resultado.error) throw new Error(`No se pudo cargar la clasificación: ${resultado.error.message}`);
    }
    filas = resultadoGoleadores.data || [];
    equipos = resultadoEquipos.data || [];

    if (filas.length) {
      const { data: plantilla, error: errorPlantilla } = await db.from("plantilla")
        .select("equipo_id,jugador:jugadores(id,id_clupik,image_id)")
        .in("equipo_id", equipos.map((equipo) => equipo.id))
        .in("jugador_id", [...new Set(filas.map((fila) => fila.jugador_id))]);
      if (errorPlantilla) throw new Error(`No se pudieron cargar las fotos de los goleadores: ${errorPlantilla.message}`);

      const equipoPorId = new Map(equipos.map((equipo) => [equipo.id, equipo]));
      const fotoPorJugadorEquipo = new Map((plantilla || []).map((fila) => {
        const equipo = equipoPorId.get(fila.equipo_id);
        const jugador = fila.jugador;
        return [
          `${jugador?.id}:${fila.equipo_id}`,
          urlFotoMvp(equipo?.id_clupik, jugador),
        ];
      }));
      filas = filas.map((fila) => ({
        ...fila,
        foto: fotoPorJugadorEquipo.get(`${fila.jugador_id}:${fila.equipo_id}`) || null,
      }));
    }
  }

  return (
    <main>
      <h1>Máximos goleadores{temp ? ` ${temp.nombre}` : ""}</h1>
      <InfoDatosPublicos />
      <Goleadores goleadores={filas} equipos={equipos} />
    </main>
  );
}
