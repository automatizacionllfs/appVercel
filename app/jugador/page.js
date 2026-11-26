import { createClient } from "@supabase/supabase-js";
import MiJugador from "./MiJugador";
import { urlFotoMvp } from "../lib/foto-mvp";

export const revalidate = 60;
export const metadata = { title: "Mi perfil de jugador · LLFS Puerto Real" };

export default async function PaginaJugador() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temporada, error: errorTemporada } = await db.from("temporadas")
    .select("id,nombre").eq("activa", true).maybeSingle();
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);

  let equipos = [];
  let plantilla = [];
  if (temporada) {
    const { data, error } = await db.from("equipos")
      .select("id,id_clupik,nombre,escudo_url").eq("temporada_id", temporada.id).order("nombre");
    if (error) throw new Error(`No se pudieron cargar los equipos: ${error.message}`);
    equipos = data || [];

    if (equipos.length) {
      const { data: filas, error: errorPlantilla } = await db.from("plantilla")
        .select("equipo_id,dorsal,jugador:jugadores(id,id_clupik,nombre,image_id)")
        .eq("entrenador", false)
        .eq("baja", false)
        .in("equipo_id", equipos.map((e) => e.id));
      if (errorPlantilla) throw new Error(`No se pudo cargar la plantilla: ${errorPlantilla.message}`);
      const clupikPorEquipo = new Map(equipos.map((e) => [e.id, e.id_clupik]));
      plantilla = (filas || [])
        .filter((fila) => fila.jugador)
        .map((fila) => ({
          equipoId: fila.equipo_id,
          dorsal: fila.dorsal,
          id: fila.jugador.id,
          nombre: fila.jugador.nombre,
          foto: urlFotoMvp(clupikPorEquipo.get(fila.equipo_id), fila.jugador),
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }
  }

  return (
    <main>
      <h1>Mi perfil de jugador{temporada ? ` ${temporada.nombre}` : ""}</h1>
      <MiJugador equipos={equipos} plantilla={plantilla} />
    </main>
  );
}