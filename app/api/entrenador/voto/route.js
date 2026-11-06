import {
  createServiceDb,
  errorRespuesta,
  leerSesionEntrenador,
  origenValido,
} from "../../../lib/entrenador";
import { ventanaMvp } from "../../../lib/mvp-window";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!origenValido(request)) return Response.json({ error: "Solicitud no válida." }, { status: 403 });
  let sesion;
  try {
    sesion = leerSesionEntrenador(request);
  } catch (error) {
    return errorRespuesta(error);
  }
  if (!sesion) return Response.json({ error: "La sesión ha caducado. Vuelve a iniciar sesión." }, { status: 401 });

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Solicitud no válida." }, { status: 400 });
  }
  const partidoId = String(cuerpo?.partidoId || "");
  const jugadorId = String(cuerpo?.jugadorId || "");
  if (!/^\d+$/.test(partidoId) || !/^\d+$/.test(jugadorId)) {
    return Response.json({ error: "Selecciona un jugador válido." }, { status: 400 });
  }

  try {
    const db = createServiceDb();
    const { data: partido, error: errorPartido } = await db.from("partidos")
      .select("id,fecha,local_id,visitante_id")
      .eq("id", partidoId)
      .maybeSingle();
    if (errorPartido) throw new Error(`No se pudo validar el partido: ${errorPartido.message}`);
    if (!partido || ![String(partido.local_id), String(partido.visitante_id)].includes(sesion.equipoId)) {
      return Response.json({ error: "Ese partido no pertenece a tu equipo." }, { status: 403 });
    }
    if (!partido.fecha) return Response.json({ error: "El partido no tiene fecha y hora programadas." }, { status: 409 });

    const ventana = ventanaMvp(partido.fecha);
    if (!ventana) return Response.json({ error: "El partido no tiene fecha y hora programadas." }, { status: 409 });
    const abre = Date.parse(ventana.abre);
    const cierra = Date.parse(ventana.cierra);
    const ahora = Date.now();
    if (!Number.isFinite(abre) || !Number.isFinite(cierra)) {
      throw new Error("La configuración de la ventana MVP no es válida.");
    }
    if (ahora < abre) return Response.json({ error: "La votación todavía no está abierta." }, { status: 409 });
    if (ahora >= cierra) return Response.json({ error: "El plazo de votación ha terminado." }, { status: 409 });

    const rivalId = String(partido.local_id) === sesion.equipoId ? partido.visitante_id : partido.local_id;
    const { data: plantilla, error: errorPlantilla } = await db.from("plantilla")
      .select("jugador_id")
      .eq("equipo_id", rivalId)
      .eq("jugador_id", jugadorId)
      .maybeSingle();
    if (errorPlantilla) throw new Error(`No se pudo validar el jugador: ${errorPlantilla.message}`);
    if (!plantilla) return Response.json({ error: "El jugador no pertenece a la plantilla rival." }, { status: 400 });

    const { error: errorVoto } = await db.from("mvp").upsert({
      partido_id: partidoId,
      equipo_votante_id: sesion.equipoId,
      jugador_id: jugadorId,
    }, { onConflict: "partido_id,equipo_votante_id" });
    if (errorVoto) throw new Error(`No se pudo guardar el voto: ${errorVoto.message}`);
    return Response.json({ ok: true });
  } catch (error) {
    return errorRespuesta(error);
  }
}
