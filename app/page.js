import { createClient } from "@supabase/supabase-js";
import Goleadores from "./Goleadores";
import InfoDatosPublicos from "./InfoDatosPublicos";

export const revalidate = 60;

export default async function Inicio() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temp, error: errorTemporada } = await db.from("temporadas").select("id,nombre").eq("activa", true).maybeSingle();
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);
  let filas = [];
  let equipos = [];
  if (temp) {
    const [resultadoGoleadores, resultadoEquipos] = await Promise.all([
      db.from("v_goleadores").select("*").eq("temporada_id", temp.id).order("goles", { ascending: false }).order("jugador").limit(100),
      db.from("equipos").select("id,nombre,grupo_id,escudo_url,grupo:grupos(nombre)").eq("temporada_id", temp.id).order("nombre"),
    ]);
    for (const resultado of [resultadoGoleadores, resultadoEquipos]) {
      if (resultado.error) throw new Error(`No se pudo cargar la clasificación: ${resultado.error.message}`);
    }
    filas = resultadoGoleadores.data || [];
    equipos = resultadoEquipos.data || [];
  }

  return (
    <main>
      <h1>Máximos goleadores{temp ? ` ${temp.nombre}` : ""}</h1>
      <InfoDatosPublicos />
      <Goleadores goleadores={filas} equipos={equipos} />
    </main>
  );
}
