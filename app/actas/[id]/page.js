import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import DetalleActa from "../DetalleActa";

export const revalidate = 60;

export default async function PaginaDetalleActa({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  if (!/^\d+$/.test(id)) notFound();

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: partido, error: errorPartido } = await db.from("partidos")
    .select("id,jornada,fecha,estado,descripcion,goles_local_clupik,goles_visitante_clupik,local_id,visitante_id,temporada_id")
    .eq("id", id)
    .maybeSingle();
  if (errorPartido) throw new Error(`No se pudo cargar el partido: ${errorPartido.message}`);
  if (!partido) notFound();

  const [resultadoEquipos, resultadoEventos] = await Promise.all([
    db.from("equipos")
      .select("id,nombre,escudo_url")
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

  const equipoPorId = new Map((resultadoEquipos.data || []).map((equipo) => [equipo.id, equipo]));
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
        actaDigitalizada={partido.estado === "cerrado" || (resultadoEventos.data || []).length > 0}
        volver={origenEstadisticas}
      />
    </main>
  );
}
