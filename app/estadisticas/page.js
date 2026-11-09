import { createClient } from "@supabase/supabase-js";
import Estadisticas from "./estadisticas";
import InfoDatosPublicos from "../InfoDatosPublicos";
import { urlFotoMvp } from "../lib/foto-mvp";

export const revalidate = 0;

export default async function PaginaEstadisticas({ searchParams }) {
  const query = await searchParams;
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temporada, error: errorTemporada } = await db.from("temporadas").select("id,nombre").eq("activa", true).maybeSingle();
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);

  let equipos = [];
  let partidos = [];
  let eventos = [];
  let plantilla = [];
  if (temporada) {
    const [resultadoEquipos, resultadoPartidos] = await Promise.all([
      db.from("equipos").select("id,id_clupik,nombre,escudo_url,grupo:grupos(nombre)").eq("temporada_id", temporada.id).order("nombre"),
      db.from("partidos").select("id,jornada,fecha,estado,local_id,visitante_id,goles_local_clupik,goles_visitante_clupik")
        .eq("temporada_id", temporada.id),
    ]);
    if (resultadoEquipos.error) throw new Error(`No se pudieron cargar los equipos: ${resultadoEquipos.error.message}`);
    if (resultadoPartidos.error) throw new Error(`No se pudieron cargar los partidos: ${resultadoPartidos.error.message}`);
    equipos = resultadoEquipos.data || [];
    partidos = resultadoPartidos.data || [];
    if (equipos.length) {
      const { data, error } = await db.from("plantilla")
        .select("equipo_id,dorsal,baja,jugador:jugadores(id,id_clupik,nombre,image_id)")
        .in("equipo_id", equipos.map((equipo) => equipo.id))
        .not("jugador.id_clupik", "is", null);
      if (error) throw new Error(`No se pudo cargar la plantilla de jugadores: ${error.message}`);
      const equipoClupikPorId = new Map(equipos.map((equipo) => [equipo.id, equipo.id_clupik]));
      plantilla = (data || []).map((fila) => {
        const teamId = equipoClupikPorId.get(fila.equipo_id);
        const { jugador } = fila;
        const foto = process.env.CLUB_ID && teamId && jugador?.image_id
          ? `https://api.clupik.com/clubs/${process.env.CLUB_ID}/teams/${teamId}/players/${jugador.id_clupik}/picture/${jugador.image_id}.medium.jpg`
          : null;
        return { ...fila, jugador: jugador ? { ...jugador, foto } : null };
      });
    }
    if (partidos.length) {
      for (let desde = 0; ; desde += 1000) {
        const { data: pagina, error } = await db.from("eventos")
          .select("id,partido_id,equipo_id,jugador_id,tipo,parte,restante_seg,jugador:jugadores(id,id_clupik,nombre,image_id)")
          .eq("anulado", false)
          .in("partido_id", partidos.map((partido) => partido.id))
          .range(desde, desde + 999);
        if (error) throw new Error(`No se pudieron cargar los eventos: ${error.message}`);
        eventos.push(...(pagina || []));
        if (!pagina || pagina.length < 1000) break;
      }
      const equipoPorId = new Map(equipos.map((equipo) => [equipo.id, equipo]));
      eventos = eventos.map((evento) => {
        const equipo = equipoPorId.get(evento.equipo_id);
        return {
          ...evento,
          jugador: evento.jugador
            ? { ...evento.jugador, foto: urlFotoMvp(equipo?.id_clupik, evento.jugador) }
            : null,
        };
      });
    }
  }

  return (
    <main>
      <h1>Estadísticas{temporada ? ` ${temporada.nombre}` : ""}</h1>
      <InfoDatosPublicos />
      <Estadisticas equipos={equipos} partidos={partidos} eventos={eventos} plantilla={plantilla} equipoInicial={query?.equipo || ""} />
    </main>
  );
}
