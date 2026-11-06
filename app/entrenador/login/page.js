import { createClient } from "@supabase/supabase-js";
import EntrenadorLogin from "./EntrenadorLogin";

export const dynamic = "force-dynamic";

export default async function PaginaLoginEntrenador() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temporada, error: errorTemporada } = await db.from("temporadas")
    .select("id").eq("activa", true).maybeSingle();
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);
  const { data: equipos, error: errorEquipos } = temporada
    ? await db.from("equipos").select("id,nombre").eq("temporada_id", temporada.id).order("nombre")
    : { data: [], error: null };
  if (errorEquipos) throw new Error(`No se pudieron cargar los equipos: ${errorEquipos.message}`);
  return <EntrenadorLogin equipos={equipos || []} />;
}
