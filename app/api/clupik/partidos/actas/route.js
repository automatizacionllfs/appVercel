import JSZip from "jszip";
import { createServiceDb, errorRespuesta } from "../../../../lib/entrenador";
import { generarActaPdf, nombreArchivoActa } from "../../../../lib/acta-pdf";
import { nombrePersonalActa } from "../../../../lib/personal-acta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Solicitud no válida." }, { status: 400 });
  }

  const partidoIds = [...new Set((Array.isArray(body?.partidoIds) ? body.partidoIds : []).map(String))];
  const asignacion = {
    arbitro1Id: String(body?.arbitro1Id || ""),
    arbitro2Id: String(body?.arbitro2Id || ""),
    cronoId: String(body?.cronoId || ""),
  };
  if (!partidoIds.length || partidoIds.length > 12 || !partidoIds.every((id) => /^\d+$/.test(id))) {
    return Response.json({ error: "Selecciona entre 1 y 12 partidos válidos." }, { status: 400 });
  }
  const nombresAsignados = Object.fromEntries(
    Object.entries(asignacion).map(([rol, nombre]) => [rol, nombrePersonalActa(nombre)]),
  );
  const nombresCanonicos = Object.values(nombresAsignados);
  if (!nombresCanonicos.every(Boolean) || new Set(nombresCanonicos).size !== 3) {
    return Response.json({ error: "Selecciona dos árbitros y un crono distintos." }, { status: 400 });
  }

  try {
    const db = createServiceDb();
    if (!(await administrador(request, db))) {
      return Response.json({ error: "Se requiere una cuenta de administrador." }, { status: 403 });
    }

    const [{ data: temporada, error: errorTemporada }, { data: partidos, error: errorPartidos }] = await Promise.all([
      db.from("temporadas").select("id,nombre").eq("activa", true).maybeSingle(),
      db.from("partidos")
        .select("id,id_clupik,temporada_id,jornada,fecha,pabellon,local_id,visitante_id,grupo_id,local:equipos!partidos_local_id_fkey(id,nombre,escudo_url),visitante:equipos!partidos_visitante_id_fkey(id,nombre,escudo_url),grupo:grupos(nombre)")
        .in("id", partidoIds)
        .order("fecha", { ascending: true, nullsFirst: false }),
    ]);
    if (errorTemporada) throw new Error(`No se pudo cargar la temporada activa: ${errorTemporada.message}`);
    if (errorPartidos) throw new Error(`No se pudieron cargar los partidos: ${errorPartidos.message}`);
    if (!temporada) return Response.json({ error: "No hay una temporada activa." }, { status: 400 });
    if (partidos?.length !== partidoIds.length ||
        partidos.some((partido) => String(partido.temporada_id) !== String(temporada.id)) ||
        partidos.some((partido) => !partido.local || !partido.visitante)) {
      return Response.json({ error: "Algún partido no existe o no tiene los dos equipos asociados." }, { status: 400 });
    }

    const asignacionPdf = {
      arbitro1: nombresAsignados.arbitro1Id,
      arbitro2: nombresAsignados.arbitro2Id,
      crono: nombresAsignados.cronoId,
    };
    const equiposIds = [...new Set(partidos.flatMap((partido) => [partido.local_id, partido.visitante_id]))];
    const { data: plantilla, error: errorPlantilla } = await db.from("plantilla")
      .select("equipo_id,dorsal,baja,jugador:jugadores(nombre)")
      .in("equipo_id", equiposIds)
      .eq("baja", false);
    if (errorPlantilla) throw new Error(`No se pudieron cargar las plantillas: ${errorPlantilla.message}`);

    const filasPorEquipo = new Map();
    (plantilla || []).forEach((fila) => {
      if (!fila.jugador?.nombre) return;
      const lista = filasPorEquipo.get(String(fila.equipo_id)) || [];
      lista.push({ nombre: fila.jugador.nombre, dorsal: fila.dorsal });
      filasPorEquipo.set(String(fila.equipo_id), lista);
    });
    filasPorEquipo.forEach((filas) => filas.sort((a, b) =>
      (a.dorsal ?? 999) - (b.dorsal ?? 999) || a.nombre.localeCompare(b.nombre, "es")
    ));

    const zip = new JSZip();
    for (const partido of partidos) {
      partido.asignacion = asignacionPdf;
      partido.plantillaLocal = filasPorEquipo.get(String(partido.local_id)) || [];
      partido.plantillaVisitante = filasPorEquipo.get(String(partido.visitante_id)) || [];
      const contenido = await generarActaPdf(partido, temporada.nombre);
      const base = nombreArchivoActa(partido).replace(/\.pdf$/i, "");
      zip.file(`${base}_${partido.id_clupik}.pdf`, contenido);
    }

    const archivo = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    return new Response(archivo, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="Actas_seleccionadas.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorRespuesta(error);
  }
}
