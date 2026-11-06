import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { createServiceDb, errorRespuesta } from "../../../../lib/entrenador";

export const dynamic = "force-dynamic";

async function administrador(request, db) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data: usuario, error } = await db.auth.getUser(token);
  if (error || !usuario.user?.email) return false;
  const { data: filas, error: errorFila } = await db.from("usuarios")
    .select("id,email")
    .eq("rol", "admin")
    .eq("activo", true);
  if (errorFila) throw new Error(`No se pudo validar el administrador: ${errorFila.message}`);
  return (filas || []).some((fila) => fila.email?.toLowerCase() === usuario.user.email.toLowerCase());
}

export async function GET(request) {
  try {
    const db = createServiceDb();
    if (!(await administrador(request, db))) {
      return Response.json({ error: "Se requiere una cuenta de administrador." }, { status: 403 });
    }
    const { data: temporada, error: errorTemporada } = await db.from("temporadas")
      .select("id").eq("activa", true).maybeSingle();
    if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);
    if (!temporada) return Response.json({ equipos: [] });

    const { data: equipos, error: errorEquipos } = await db.from("equipos")
      .select("id,nombre")
      .eq("temporada_id", temporada.id)
      .order("nombre");
    if (errorEquipos) throw new Error(`No se pudieron cargar los equipos: ${errorEquipos.message}`);
    const ids = (equipos || []).map((equipo) => equipo.id);
    const { data: pins, error: errorPins } = ids.length
      ? await db.from("entrenador_pins").select("equipo_id,activo").in("equipo_id", ids)
      : { data: [], error: null };
    if (errorPins) throw new Error(`No se pudo cargar el estado de los PIN: ${errorPins.message}`);
    const activos = new Set((pins || []).filter((pin) => pin.activo).map((pin) => String(pin.equipo_id)));
    return Response.json({
      equipos: (equipos || []).map((equipo) => ({
        id: equipo.id,
        nombre: equipo.nombre,
        pinActivo: activos.has(String(equipo.id)),
      })),
    });
  } catch (error) {
    return errorRespuesta(error);
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Solicitud no válida." }, { status: 400 });
  }
  const equipoId = String(body?.equipoId || "");
  if (!/^\d+$/.test(equipoId)) return Response.json({ error: "Equipo no válido." }, { status: 400 });

  try {
    const db = createServiceDb();
    if (!(await administrador(request, db))) {
      return Response.json({ error: "Se requiere una cuenta de administrador." }, { status: 403 });
    }
    const { data: temporada, error: errorTemporada } = await db.from("temporadas")
      .select("id").eq("activa", true).maybeSingle();
    if (errorTemporada) throw new Error(`No se pudo validar la temporada: ${errorTemporada.message}`);
    const { data: equipo, error: errorEquipo } = temporada
      ? await db.from("equipos").select("id").eq("id", equipoId).eq("temporada_id", temporada.id).maybeSingle()
      : { data: null, error: null };
    if (errorEquipo) throw new Error(`No se pudo validar el equipo: ${errorEquipo.message}`);
    if (!equipo) return Response.json({ error: "El equipo no pertenece a la temporada activa." }, { status: 400 });

    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const pin_hash = await bcrypt.hash(pin, 12);
    const { error: errorReset } = await db.from("entrenador_pin_intentos")
      .upsert({ equipo_id: equipoId, intentos: 0, bloqueado_hasta: null }, { onConflict: "equipo_id" });
    if (errorReset) throw new Error(`No se pudo restablecer el bloqueo anterior: ${errorReset.message}`);
    const { error: errorGuardar } = await db.from("entrenador_pins").upsert({
      equipo_id: equipoId,
      pin_hash,
      activo: true,
      creado_en: new Date().toISOString(),
    }, { onConflict: "equipo_id" });
    if (errorGuardar) throw new Error(`No se pudo guardar el PIN: ${errorGuardar.message}`);
    return Response.json({ pin });
  } catch (error) {
    return errorRespuesta(error);
  }
}
