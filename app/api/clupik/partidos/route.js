import { createServiceDb, errorRespuesta } from "../../../lib/entrenador";
import { nombrePersonalActa, NOMBRES_PERSONAL_ACTA } from "../../../lib/personal-acta";
import { obtenerTokenClupik } from "../../../lib/clupik-auth";

export const dynamic = "force-dynamic";
const API = "https://api.clupik.com";

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

async function cargarEstadios(clubId) {
  const respuesta = await fetch(`${API}/clubs/${clubId}/stadiums?from=0&limit=1800`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!respuesta.ok) throw new Error(`No se pudieron cargar los pabellones de Clupik: HTTP ${respuesta.status}.`);
  const datos = await respuesta.json();
  if (!Array.isArray(datos)) throw new Error("Clupik devolvió un listado de pabellones no válido.");
  return datos.filter((estadio) => estadio?.id && estadio?.name && !estadio.deletedAt)
    .map((estadio) => ({ id: String(estadio.id), nombre: String(estadio.name) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function GET(request) {
  try {
    const db = createServiceDb();
    if (!(await administrador(request, db))) {
      return Response.json({ error: "Se requiere una cuenta de administrador." }, { status: 403 });
    }

    const { CLUB_ID } = process.env;
    if (!CLUB_ID || !/^\d+$/.test(CLUB_ID)) {
      throw new Error("Falta configurar CLUB_ID en el servidor.");
    }

    const { data: temporada, error: errorTemporada } = await db.from("temporadas")
      .select("id,id_clupik,nombre")
      .eq("activa", true)
      .maybeSingle();
    if (errorTemporada) throw new Error(`No se pudo cargar la temporada activa: ${errorTemporada.message}`);
    if (!temporada) {
      return Response.json({
        grupos: [],
        equipos: [],
        estadios: [],
        usuarios: NOMBRES_PERSONAL_ACTA.map((nombre) => ({ id: nombre, nombre })),
        partidos: [],
      });
    }

    const [{ data: grupos, error: errorGrupos }, { data: equipos, error: errorEquipos },
      { data: partidos, error: errorPartidos }, estadios] = await Promise.all([
      db.from("grupos").select("id,id_clupik,nombre").eq("temporada_id", temporada.id).order("nombre"),
      db.from("equipos").select("id,id_clupik,nombre,grupo_id,escudo_url").eq("temporada_id", temporada.id).order("nombre"),
      db.from("partidos")
        .select("id,id_clupik,jornada,fecha,pabellon,local_id,visitante_id,grupo_id,local:equipos!partidos_local_id_fkey(id,id_clupik,nombre,escudo_url),visitante:equipos!partidos_visitante_id_fkey(id,id_clupik,nombre,escudo_url),grupo:grupos(nombre)")
        .eq("temporada_id", temporada.id)
        .order("fecha", { ascending: true, nullsFirst: false })
        .limit(1000),
      cargarEstadios(CLUB_ID),
    ]);
    if (errorGrupos) throw new Error(`No se pudieron cargar los grupos: ${errorGrupos.message}`);
    if (errorEquipos) throw new Error(`No se pudieron cargar los equipos: ${errorEquipos.message}`);
    if (errorPartidos) throw new Error(`No se pudieron cargar los partidos: ${errorPartidos.message}`);
    return Response.json({
      temporada,
      grupos: grupos || [],
      equipos: equipos || [],
      estadios,
      usuarios: NOMBRES_PERSONAL_ACTA.map((nombre) => ({ id: nombre, nombre })),
      partidos: partidos || [],
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

  const grupoId = String(body?.grupoId || "");
  const equipoLocalId = String(body?.equipoLocalId || "");
  const equipoVisitanteId = String(body?.equipoVisitanteId || "");
  const estadioId = String(body?.estadioId || "");
  const jornada = body?.jornada == null || body.jornada === "" ? null : Number(body.jornada);
  const fecha = typeof body?.fecha === "string" ? body.fecha : "";
  const fechaConZona = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(fecha);
  const fechaMs = Date.parse(fecha);
  if (![grupoId, equipoLocalId, equipoVisitanteId, estadioId].every((id) => /^\d+$/.test(id)) ||
      equipoLocalId === equipoVisitanteId) {
    return Response.json({ error: "Selecciona un grupo, un pabellón y dos equipos distintos." }, { status: 400 });
  }
  if (jornada !== null && (!Number.isInteger(jornada) || jornada < 1 || jornada > 99)) {
    return Response.json({ error: "La jornada debe ser un número entre 1 y 99." }, { status: 400 });
  }
  if (!fechaConZona || !Number.isFinite(fechaMs)) {
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

    const estadios = await cargarEstadios(CLUB_ID);
    const estadio = estadios.find((item) => item.id === estadioId);
    if (!estadio) return Response.json({ error: "El pabellón seleccionado no existe en Clupik." }, { status: 400 });

    const tokenClupik = await obtenerTokenClupik();
    const respuesta = await fetch(`${API}/clubs/${CLUB_ID}/games`, {
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
        stadiumId: Number(estadioId),
        ...(jornada ? { round: jornada } : {}),
        status: "pending",
        date: new Date(fechaMs).toISOString(),
        statistics: null,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
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

    const equipoLocal = equipos.find((equipo) => String(equipo.id_clupik) === equipoLocalId);
    const equipoVisitante = equipos.find((equipo) => String(equipo.id_clupik) === equipoVisitanteId);
    const { error: errorGuardarPartido } = await db.from("partidos").upsert({
      id_clupik: String(datosRespuesta.id),
      temporada_id: temporada.id,
      grupo_id: grupo.id,
      jornada: datosRespuesta.round ?? jornada,
      fecha: datosRespuesta.date || new Date(fechaMs).toISOString(),
      local_id: equipoLocal.id,
      visitante_id: equipoVisitante.id,
      goles_local_clupik: datosRespuesta.localScore ?? null,
      goles_visitante_clupik: datosRespuesta.visitorScore ?? null,
      pabellon: estadio.nombre,
    }, { onConflict: "id_clupik" });
    if (errorGuardarPartido) {
      return Response.json({
        error: `Clupik creó el partido ${datosRespuesta.id}, pero no se pudo guardar en la app: ${errorGuardarPartido.message}. Sincroniza los partidos para recuperarlo.`,
        partidoCreado: true,
        idClupik: String(datosRespuesta.id),
      }, { status: 502 });
    }

    return Response.json({ partido: { ...datosRespuesta, stadiumId: estadioId, stadium: { name: estadio.nombre } } }, { status: 201 });
  } catch (error) {
    return errorRespuesta(error);
  }
}
