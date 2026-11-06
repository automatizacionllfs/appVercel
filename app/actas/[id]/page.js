import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import DetalleActa from "../DetalleActa";
import { createServiceDb } from "../../lib/entrenador";
import { urlFotoMvp } from "../../lib/foto-mvp";

export const revalidate = 0;

const camposPartido = "id,jornada,fecha,estado,descripcion,goles_local_clupik,goles_visitante_clupik,local_id,visitante_id,temporada_id";
const camposPartidoSinDescripcion = "id,jornada,fecha,estado,goles_local_clupik,goles_visitante_clupik,local_id,visitante_id,temporada_id";

function columnaDescripcionNoDisponible(error) {
  return ["42703", "PGRST204"].includes(error.code) && /descripcion/i.test(error.message || "");
}

export default async function PaginaDetalleActa({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  if (!/^\d+$/.test(id)) notFound();

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  let resultadoPartido = await db.from("partidos")
    .select(camposPartido)
    .eq("id", id)
    .maybeSingle();
  if (resultadoPartido.error && columnaDescripcionNoDisponible(resultadoPartido.error)) {
    console.error("Falta aplicar la migración de descripcion del acta en Supabase.", resultadoPartido.error);
    resultadoPartido = await db.from("partidos")
      .select(camposPartidoSinDescripcion)
      .eq("id", id)
      .maybeSingle();
  }
  const { data: partido, error: errorPartido } = resultadoPartido;
  if (errorPartido) throw new Error(`No se pudo cargar el partido: ${errorPartido.message}`);
  if (!partido) notFound();

  const [resultadoEquipos, resultadoEventos] = await Promise.all([
    db.from("equipos")
      .select("id,id_clupik,nombre,escudo_url")
      .in("id", [partido.local_id, partido.visitante_id]),
    db.from("eventos")
      .select("id,tipo,parte,restante_seg,equipo_id,jugador_id,jugador:jugadores(nombre)")
      .eq("partido_id", partido.id)
      .eq("anulado", false)
      .order("seg_juego", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  if (resultadoEquipos.error) throw new Error(`No se pudieron cargar los equipos: ${resultadoEquipos.error.message}`);
  if (resultadoEventos.error) throw new Error(`No se pudieron cargar los eventos del acta: ${resultadoEventos.error.message}`);

  const { data: votosMvp, error: errorMvp } = await createServiceDb().from("mvp")
    .select("equipo_votante_id,jugador:jugadores(id,id_clupik,nombre,image_id)")
    .eq("partido_id", partido.id);
  if (errorMvp) throw new Error(`No se pudieron cargar los MVP del partido: ${errorMvp.message}`);

  const equipoPorId = new Map((resultadoEquipos.data || []).map((equipo) => [equipo.id, equipo]));
  const mvpPorEquipo = new Map();
  (votosMvp || []).forEach((voto) => {
    const equipoId = voto.equipo_votante_id === partido.local_id ? partido.visitante_id : partido.local_id;
    const equipo = equipoPorId.get(equipoId);
    const jugador = voto.jugador;
    const foto = urlFotoMvp(equipo?.id_clupik, jugador);
    mvpPorEquipo.set(equipoId, jugador ? { ...jugador, foto } : null);
  });
  const origenEstadisticas = query?.desde === "estadisticas" && /^\d+$/.test(String(query?.equipo || ""))
    ? `/estadisticas?equipo=${encodeURIComponent(query.equipo)}`
    : "/actas";

  return (
    <main>
      <DetalleActa
        partido={partido}
        local={equipoPorId.get(partido.local_id)}
        visitante={equipoPorId.get(partido.visitante_id)}
        eventos={resultadoEventos.data || []}
        mvpLocal={mvpPorEquipo.get(partido.local_id) || null}
        mvpVisitante={mvpPorEquipo.get(partido.visitante_id) || null}
        actaDigitalizada={partido.estado === "cerrado" || (resultadoEventos.data || []).length > 0}
        volver={origenEstadisticas}
      />
    </main>
  );
}
