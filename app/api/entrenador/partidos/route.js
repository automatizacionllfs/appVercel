import { createServiceDb, errorRespuesta, leerSesionEntrenador } from "../../../lib/entrenador";
import { ventanaMvp } from "../../../lib/mvp-window";

export const dynamic = "force-dynamic";

export async function GET(request) {
  let sesion;
  try {
    sesion = leerSesionEntrenador(request);
  } catch (error) {
    return errorRespuesta(error);
  }
  if (!sesion) return Response.json({ error: "La sesión ha caducado. Vuelve a iniciar sesión." }, { status: 401 });

  try {
    const db = createServiceDb();
    const { data: partidos, error: errorPartidos } = await db.from("partidos")
      .select("id,jornada,fecha,local_id,visitante_id,local:equipos!partidos_local_id_fkey(id,nombre,escudo_url),visitante:equipos!partidos_visitante_id_fkey(id,nombre,escudo_url)")
      .or(`local_id.eq.${sesion.equipoId},visitante_id.eq.${sesion.equipoId}`)
      .order("fecha", { ascending: false });
    if (errorPartidos) throw new Error(`No se pudieron cargar los partidos: ${errorPartidos.message}`);

    const ids = (partidos || []).map((partido) => partido.id);
    const { data: votos, error: errorVotos } = ids.length
      ? await db.from("mvp").select("partido_id,jugador_id,jugador:jugadores(id,nombre)")
        .eq("equipo_votante_id", sesion.equipoId).in("partido_id", ids)
      : { data: [], error: null };
    if (errorVotos) throw new Error(`No se pudo cargar el voto del equipo: ${errorVotos.message}`);

    const { data: filas, error: errorPlantilla } = ids.length
      ? await db.from("plantilla").select("equipo_id,dorsal,baja,jugador:jugadores(id,nombre)")
        .in("equipo_id", [...new Set((partidos || []).map((partido) =>
          String(partido.local_id) === sesion.equipoId ? partido.visitante_id : partido.local_id,
        ))])
      : { data: [], error: null };
    if (errorPlantilla) throw new Error(`No se pudo cargar la plantilla rival: ${errorPlantilla.message}`);

    const votoPorPartido = new Map((votos || []).map((voto) => [String(voto.partido_id), voto]));
    const plantillaPorEquipo = new Map();
    (filas || []).forEach((fila) => {
      const actual = plantillaPorEquipo.get(String(fila.equipo_id)) || [];
      if (fila.jugador) actual.push({ ...fila.jugador, dorsal: fila.dorsal, baja: fila.baja });
      plantillaPorEquipo.set(String(fila.equipo_id), actual);
    });
    const ahora = Date.now();
    return Response.json({
      equipoId: sesion.equipoId,
      partidos: (partidos || []).map((partido) => {
        const esLocal = String(partido.local_id) === sesion.equipoId;
        const rival = esLocal ? partido.visitante : partido.local;
        const ventana = ventanaMvp(partido.fecha);
        const abre = ventana?.abre || null;
        const cierra = ventana?.cierra || null;
        const empieza = Date.parse(abre);
        const termina = Date.parse(cierra);
        const voto = votoPorPartido.get(String(partido.id));
        const estado = !ventana || ahora < empieza ? "pendiente" : ahora >= termina ? "cerrada" : voto ? "votada" : "abierta";
        return {
          ...partido,
          rival,
          rivalId: String(rival.id),
          jugadoresRival: plantillaPorEquipo.get(String(rival.id)) || [],
          voto: voto ? { jugadorId: voto.jugador_id, jugador: voto.jugador } : null,
          estado,
          abre,
          cierra,
        };
      }),
    });
  } catch (error) {
    return errorRespuesta(error);
  }
}
