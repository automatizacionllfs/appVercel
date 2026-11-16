import { createServiceDb, errorRespuesta } from "../../../lib/entrenador";

export const dynamic = "force-dynamic";

async function administrador(request, db) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data: usuario, error } = await db.auth.getUser(token);
  if (error || !usuario.user?.email) return false;
  const { data: administradores, error: errorAdministradores } = await db.from("usuarios")
    .select("email")
    .eq("rol", "admin")
    .eq("activo", true);
  if (errorAdministradores) throw new Error(`No se pudo validar el administrador: ${errorAdministradores.message}`);
  return (administradores || []).some((fila) =>
    fila.email?.toLowerCase() === usuario.user.email.toLowerCase()
  );
}

export async function GET(request) {
  try {
    const db = createServiceDb();
    if (!(await administrador(request, db))) {
      return Response.json({ error: "Se requiere una cuenta de administrador." }, { status: 403 });
    }

    const { data: temporada, error: errorTemporada } = await db.from("temporadas")
      .select("id")
      .eq("activa", true)
      .maybeSingle();
    if (errorTemporada) throw new Error(`No se pudo cargar la temporada activa: ${errorTemporada.message}`);
    if (!temporada) return Response.json({ grupos: [], equipos: [] });

    const [{ data: grupos, error: errorGrupos }, { data: equipos, error: errorEquipos }] = await Promise.all([
      db.from("grupos").select("id,id_clupik,nombre").eq("temporada_id", temporada.id).order("nombre"),
      db.from("equipos").select("id,id_clupik,nombre,grupo_id").eq("temporada_id", temporada.id).order("nombre"),
    ]);
    if (errorGrupos) throw new Error(`No se pudieron cargar los grupos: ${errorGrupos.message}`);
    if (errorEquipos) throw new Error(`No se pudieron cargar los equipos: ${errorEquipos.message}`);
    return Response.json({ grupos: grupos || [], equipos: equipos || [] });
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

  const tokenClupik = typeof body?.tokenClupik === "string" ? body.tokenClupik.trim() : "";
  const grupoId = String(body?.grupoId || "");
  const equipoLocalId = String(body?.equipoLocalId || "");
  const equipoVisitanteId = String(body?.equipoVisitanteId || "");
  const fecha = typeof body?.fecha === "string" ? body.fecha : "";
  const fechaMs = Date.parse(fecha);
  if (!tokenClupik || tokenClupik.length > 8192 || /[\r\n]/.test(tokenClupik)) {
    return Response.json({ error: "Introduce un token de Clupik válido." }, { status: 400 });
  }
  if (![grupoId, equipoLocalId, equipoVisitanteId].every((id) => /^\d+$/.test(id)) ||
      equipoLocalId === equipoVisitanteId) {
    return Response.json({ error: "Selecciona un grupo y dos equipos distintos." }, { status: 400 });
  }
  if (!fecha || !Number.isFinite(fechaMs)) {
    return Response.json({ error: "La fecha del partido no es válida." }, { status: 400 });
  }

  try {
    const db = createServiceDb();
    if (!(await administrador(request, db))) {
      return Response.json({ error: "Se requiere una cuenta de administrador." }, { status: 403 });
    }

    const { CLUB_ID, CLUPIK_ORGANIZATION_ID } = process.env;
    if (!CLUB_ID || !/^\d+$/.test(CLUB_ID) ||
        !CLUPIK_ORGANIZATION_ID || !/^\d+$/.test(CLUPIK_ORGANIZATION_ID)) {
      throw new Error("Falta configurar CLUB_ID o CLUPIK_ORGANIZATION_ID en el servidor.");
    }

    const { data: temporada, error: errorTemporada } = await db.from("temporadas")
      .select("id")
      .eq("activa", true)
      .maybeSingle();
    if (errorTemporada) throw new Error(`No se pudo validar la temporada activa: ${errorTemporada.message}`);
    if (!temporada) return Response.json({ error: "No hay una temporada activa." }, { status: 400 });

    const [{ data: grupo, error: errorGrupo }, { data: equipos, error: errorEquipos }] = await Promise.all([
      db.from("grupos").select("id,id_clupik").eq("id_clupik", grupoId).eq("temporada_id", temporada.id).maybeSingle(),
      db.from("equipos").select("id,id_clupik,grupo_id").in("id_clupik", [equipoLocalId, equipoVisitanteId]).eq("temporada_id", temporada.id),
    ]);
    if (errorGrupo) throw new Error(`No se pudo validar el grupo: ${errorGrupo.message}`);
    if (errorEquipos) throw new Error(`No se pudieron validar los equipos: ${errorEquipos.message}`);
    if (!grupo || equipos?.length !== 2 ||
        equipos.some((equipo) => String(equipo.grupo_id) !== String(grupo.id))) {
      return Response.json({ error: "El grupo y los equipos deben pertenecer a la temporada activa." }, { status: 400 });
    }

    const respuesta = await fetch(`https://api.clupik.com/clubs/${CLUB_ID}/games`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: tokenClupik,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organizationId: CLUPIK_ORGANIZATION_ID,
        groupId: grupo.id_clupik,
        localTeamId: equipoLocalId,
        visitorTeamId: equipoVisitanteId,
        status: "pending",
        date: new Date(fechaMs).toISOString(),
        statistics: null,
      }),
      cache: "no-store",
    });

    const textoRespuesta = await respuesta.text();
    let datosRespuesta;
    try {
      datosRespuesta = textoRespuesta ? JSON.parse(textoRespuesta) : null;
    } catch {
      datosRespuesta = null;
    }
    if (!respuesta.ok) {
      const detalle = typeof datosRespuesta?.message === "string" ? `: ${datosRespuesta.message}` : "";
      return Response.json(
        { error: `Clupik respondió HTTP ${respuesta.status}${detalle}` },
        { status: respuesta.status >= 400 && respuesta.status < 600 ? respuesta.status : 502 },
      );
    }
    if (!datosRespuesta || typeof datosRespuesta !== "object" || !datosRespuesta.id) {
      throw new Error("Clupik aceptó la petición, pero no devolvió el identificador del partido.");
    }

    return Response.json({ partido: datosRespuesta }, { status: 201 });
  } catch (error) {
    return errorRespuesta(error);
  }
}
