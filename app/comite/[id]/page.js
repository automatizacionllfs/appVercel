import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import DetalleComite from "../DetalleComite";

export const revalidate = 0;

export default async function PaginaDetalleComite({ params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: documento, error: errorDocumento } = await db.from("comite_documentos")
    .select("id,fecha,partido_id,partido:partidos(id,jornada,fecha,temporada_id,local_id,visitante_id,arbitro1,arbitro2,crono,grupo:grupos(nombre),temporada:temporadas(nombre))")
    .eq("id", id)
    .maybeSingle();
  if (errorDocumento) throw new Error(`No se pudo cargar el documento: ${errorDocumento.message}`);
  if (!documento?.partido) notFound();
  const partido = documento.partido;

  const [resultadoEquipos, resultadoSanciones] = await Promise.all([
    db.from("equipos").select("id,nombre,escudo_url").in("id", [partido.local_id, partido.visitante_id]),
    db.from("comite_sanciones")
      .select("id,equipo_id,jugador_id,incidencia,resolucion,articulos,orden,jugador:jugadores(id,nombre)")
      .eq("documento_id", documento.id)
      .order("orden", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  if (resultadoEquipos.error) throw new Error(`No se pudieron cargar los equipos: ${resultadoEquipos.error.message}`);
  if (resultadoSanciones.error) throw new Error(`No se pudieron cargar las sanciones: ${resultadoSanciones.error.message}`);

  const sanciones = resultadoSanciones.data || [];
  const jugadorIds = [...new Set(sanciones.map((s) => s.jugador_id).filter(Boolean))];
  let plantilla = [];
  if (jugadorIds.length) {
    const { data, error } = await db.from("alineacion_acta")
      .select("equipo_id,jugador_id,dorsal,entrenador")
      .in("equipo_id", [partido.local_id, partido.visitante_id])
      .in("jugador_id", jugadorIds);
    if (error) throw new Error(`No se pudieron cargar los dorsales: ${error.message}`);
    plantilla = data || [];
  }
  const plantillaPorClave = new Map(plantilla.map((fila) => [`${fila.equipo_id}:${fila.jugador_id}`, fila]));
  const equipoPorId = new Map((resultadoEquipos.data || []).map((equipo) => [equipo.id, equipo]));

  return (
    <main>
      <DetalleComite
        documento={documento}
        partido={partido}
        local={equipoPorId.get(partido.local_id)}
        visitante={equipoPorId.get(partido.visitante_id)}
        sanciones={sanciones.map((sancion) => {
          const fila = plantillaPorClave.get(`${sancion.equipo_id}:${sancion.jugador_id}`);
          return { ...sancion, dorsal: fila?.dorsal ?? null, entrenador: Boolean(fila?.entrenador) };
        })}
      />
    </main>
  );
}
