import bcrypt from "bcryptjs";
import {
  cookieSesion,
  crearSesionEntrenador,
  createServiceDb,
  errorRespuesta,
  origenValido,
} from "../../../lib/entrenador";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!origenValido(request)) return Response.json({ error: "Solicitud no válida." }, { status: 403 });
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Solicitud no válida." }, { status: 400 });
  }
  const equipoId = String(cuerpo?.equipoId || "");
  const pin = String(cuerpo?.pin || "");
  if (!/^\d+$/.test(equipoId) || !/^\d{6}$/.test(pin)) {
    return Response.json({ error: "Selecciona un equipo e introduce un PIN de 6 dígitos." }, { status: 400 });
  }

  try {
    const db = createServiceDb();
    const { data: pinEquipo, error: errorPin } = await db.from("entrenador_pins")
      .select("pin_hash,activo")
      .eq("equipo_id", equipoId)
      .maybeSingle();
    if (errorPin) throw new Error(`No se pudo validar el acceso: ${errorPin.message}`);

    const { data: bloqueo, error: errorBloqueo } = await db.from("entrenador_pin_intentos")
      .select("bloqueado_hasta")
      .eq("equipo_id", equipoId)
      .maybeSingle();
    if (errorBloqueo) throw new Error(`No se pudo validar el acceso: ${errorBloqueo.message}`);
    if (bloqueo?.bloqueado_hasta && new Date(bloqueo.bloqueado_hasta).getTime() > Date.now()) {
      return Response.json({ error: "Acceso temporalmente bloqueado. Inténtalo más tarde." }, { status: 429 });
    }

    const valido = pinEquipo?.activo && await bcrypt.compare(pin, pinEquipo.pin_hash);
    if (!valido) {
      const { error: errorIntento } = await db.rpc("registrar_fallo_pin_entrenador", { p_equipo_id: equipoId });
      if (errorIntento) throw new Error(`No se pudo registrar el intento de acceso: ${errorIntento.message}`);
      return Response.json({ error: "Equipo o PIN incorrecto." }, { status: 401 });
    }

    const { error: errorReset } = await db.from("entrenador_pin_intentos")
      .upsert({ equipo_id: equipoId, intentos: 0, bloqueado_hasta: null }, { onConflict: "equipo_id" });
    if (errorReset) throw new Error(`No se pudo iniciar la sesión: ${errorReset.message}`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Set-Cookie": cookieSesion(crearSesionEntrenador(equipoId)) },
    });
  } catch (error) {
    return errorRespuesta(error);
  }
}
