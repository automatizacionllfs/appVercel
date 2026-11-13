import { createClient } from "@supabase/supabase-js";
import Goleadores from "./Goleadores";
import GoleadoresJornada from "./GoleadoresJornada";
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
  let partidos = [];
  let eventos = [];
  if (temp) {
    const [goleadoresCargados, resultadoEquipos, resultadoPartidos] = await Promise.all([
      (async () => {
        const todosLosGoleadores = [];
        for (let desde = 0; ; desde += 1000) {
          const { data, error } = await db.from("v_goleadores")
            .select("*")
            .eq("temporada_id", temp.id)
            .order("goles", { ascending: false })
            .order("jugador")
            .order("equipo")
            .range(desde, desde + 999);
          if (error) throw new Error(`No se pudo cargar la clasificación: ${error.message}`);
          todosLosGoleadores.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        return todosLosGoleadores;
      })(),
      db.from("equipos").select("id,id_clupik,nombre,grupo_id,escudo_url,grupo:grupos(nombre)").eq("temporada_id", temp.id).order("nombre"),
      db.from("partidos").select("id,jornada,goles_local_clupik,goles_visitante_clupik").eq("temporada_id", temp.id),
    ]);
    if (resultadoEquipos.error) throw new Error(`No se pudo cargar la clasificación: ${resultadoEquipos.error.message}`);
    if (resultadoPartidos.error) throw new Error(`No se pudieron cargar los partidos: ${resultadoPartidos.error.message}`);
    filas = goleadoresCargados;
    equipos = resultadoEquipos.data || [];
    partidos = resultadoPartidos.data || [];

    if (partidos.length) {
      for (let desde = 0; ; desde += 1000) {
        const { data: pagina, error } = await db.from("eventos")
          .select("id,partido_id,equipo_id,jugador_id,tipo,parte,restante_seg,jugador:jugadores(id,id_clupik,nombre,image_id)")
          .eq("anulado", false)
          .in("partido_id", partidos.map((partido) => partido.id))
          .range(desde, desde + 999);
        if (error) throw new Error(`No se pudieron cargar los eventos de las jornadas: ${error.message}`);
        eventos.push(...(pagina || []));
        if (!pagina || pagina.length < 1000) break;
      }
      const equipoPorId = new Map(equipos.map((equipo) => [equipo.id, equipo]));
      eventos = eventos.map((evento) => ({
        ...evento,
        jugador: evento.jugador
          ? { ...evento.jugador, foto: urlFotoMvp(equipoPorId.get(evento.equipo_id)?.id_clupik, evento.jugador) }
          : null,
      }));
    }

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
      <GoleadoresJornada equipos={equipos} partidos={partidos} eventos={eventos} />
      <Goleadores goleadores={filas} equipos={equipos} />
    </main>
  );
}
