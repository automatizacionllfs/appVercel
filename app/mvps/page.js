import { createClient } from "@supabase/supabase-js";
import MVPs from "./MVPs";
import InfoDatosPublicos from "../InfoDatosPublicos";
import { createServiceDb } from "../lib/entrenador";
import { urlFotoMvp } from "../lib/foto-mvp";

export const revalidate = 0;

export default async function PaginaMVPs() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temporada, error: errorTemporada } = await db.from("temporadas")
    .select("id,nombre").eq("activa", true).maybeSingle();
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);

  let ranking = [];
  if (temporada) {
    const [{ data: equipos, error: errorEquipos }, { data: partidos, error: errorPartidos }] = await Promise.all([
      db.from("equipos").select("id,id_clupik,nombre").eq("temporada_id", temporada.id),
      db.from("partidos").select("id,local_id,visitante_id").eq("temporada_id", temporada.id),
    ]);
    if (errorEquipos) throw new Error(`No se pudieron cargar los equipos: ${errorEquipos.message}`);
    if (errorPartidos) throw new Error(`No se pudieron cargar los partidos: ${errorPartidos.message}`);

    if (partidos.length) {
      const { data: votos, error: errorMvp } = await createServiceDb().from("mvp")
        .select("partido_id,equipo_votante_id,jugador_id,jugador:jugadores(id,id_clupik,nombre,image_id)")
        .in("partido_id", partidos.map((partido) => partido.id));
      if (errorMvp) throw new Error(`No se pudieron cargar los MVP: ${errorMvp.message}`);

      const equipoPorId = new Map(equipos.map((equipo) => [equipo.id, equipo]));
      const partidoPorId = new Map(partidos.map((partido) => [partido.id, partido]));
      const premios = new Map();
      (votos || []).forEach((voto) => {
        const partido = partidoPorId.get(voto.partido_id);
        const equipoId = voto.equipo_votante_id === partido?.local_id ? partido.visitante_id : partido?.local_id;
        const equipo = equipoPorId.get(equipoId);
        if (!equipo || !voto.jugador) return;
        const clave = `${voto.jugador_id}:${equipo.id}`;
        const actual = premios.get(clave) || {
          jugadorId: voto.jugador_id,
          jugador: voto.jugador.nombre,
          equipoId: equipo.id,
          equipo: equipo.nombre,
          premios: 0,
          foto: urlFotoMvp(equipo.id_clupik, voto.jugador),
        };
        actual.premios += 1;
        premios.set(clave, actual);
      });
      ranking = [...premios.values()].sort((a, b) =>
        b.premios - a.premios || a.jugador.localeCompare(b.jugador, "es"),
      );
    }
  }

  return (
    <main>
      <h1>MVPs{temporada ? ` ${temporada.nombre}` : ""}</h1>
      <InfoDatosPublicos />
      <MVPs ranking={ranking} />
    </main>
  );
}
