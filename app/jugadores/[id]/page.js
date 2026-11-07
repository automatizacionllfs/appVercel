import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { createServiceDb } from "../../lib/entrenador";

export const revalidate = 60;

export default async function HistorialJugador({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(String(query?.equipo || ""))) notFound();

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const [{ data: temporada, error: errorTemporada }, { data: jugador, error: errorJugador }] = await Promise.all([
    db.from("temporadas").select("id,nombre").eq("activa", true).maybeSingle(),
    db.from("jugadores").select("id,nombre,apodo,id_clupik,image_id").eq("id", id).maybeSingle(),
  ]);
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);
  if (errorJugador) throw new Error(`No se pudo cargar el jugador: ${errorJugador.message}`);
  if (!temporada || !jugador) notFound();

  const equipoId = String(query.equipo);
  const [{ data: equipo, error: errorEquipo }, { data: plantilla, error: errorPlantilla }] = await Promise.all([
    db.from("equipos").select("id,id_clupik,nombre,escudo_url")
      .eq("id", equipoId).eq("temporada_id", temporada.id).maybeSingle(),
    db.from("plantilla").select("dorsal").eq("equipo_id", equipoId).eq("jugador_id", id).maybeSingle(),
  ]);
  if (errorEquipo) throw new Error(`No se pudo cargar el equipo: ${errorEquipo.message}`);
  if (errorPlantilla) throw new Error(`No se pudo cargar el dorsal del jugador: ${errorPlantilla.message}`);
  if (!equipo) notFound();

  const [{ data: eventos, error: errorEventos }, { data: votosMvp, error: errorMvp }] = await Promise.all([
    db.from("eventos")
      .select("partido_id")
      .eq("jugador_id", id)
      .eq("equipo_id", equipo.id)
      .eq("tipo", "gol")
      .eq("anulado", false),
    createServiceDb().from("mvp")
      .select("partido_id")
      .eq("jugador_id", id),
  ]);
  if (errorEventos) throw new Error(`No se pudo cargar el historial de goles: ${errorEventos.message}`);
  if (errorMvp) throw new Error(`No se pudo cargar el historial de MVP: ${errorMvp.message}`);

  const golesPorPartido = new Map();
  (eventos || []).forEach((evento) => {
    golesPorPartido.set(evento.partido_id, (golesPorPartido.get(evento.partido_id) || 0) + 1);
  });
  const premiosPorPartido = new Map();
  (votosMvp || []).forEach((voto) => {
    premiosPorPartido.set(voto.partido_id, (premiosPorPartido.get(voto.partido_id) || 0) + 1);
  });
  const partidosConHistorial = new Set([...golesPorPartido.keys(), ...premiosPorPartido.keys()]);

  let historial = [];
  if (partidosConHistorial.size) {
    const { data: partidos, error: errorPartidos } = await db.from("partidos")
      .select("id,jornada,fecha,local_id,visitante_id,local:equipos!partidos_local_id_fkey(nombre),visitante:equipos!partidos_visitante_id_fkey(nombre)")
      .eq("temporada_id", temporada.id)
      .in("id", [...partidosConHistorial]);
    if (errorPartidos) throw new Error(`No se pudieron cargar los partidos del historial: ${errorPartidos.message}`);
    historial = (partidos || []).map((partido) => ({
      ...partido,
      rival: partido.local_id === equipo.id ? partido.visitante?.nombre : partido.local?.nombre,
      goles: golesPorPartido.get(partido.id) || 0,
      premiosMvp: premiosPorPartido.get(partido.id) || 0,
    })).sort((a, b) =>
      (a.jornada ?? Number.MAX_SAFE_INTEGER) - (b.jornada ?? Number.MAX_SAFE_INTEGER) ||
      new Date(a.fecha || 0) - new Date(b.fecha || 0),
    );
  }

  const foto = process.env.CLUB_ID && equipo.id_clupik && jugador.id_clupik && jugador.image_id
    ? `https://api.clupik.com/clubs/${process.env.CLUB_ID}/teams/${equipo.id_clupik}/players/${jugador.id_clupik}/picture/${jugador.image_id}.medium.jpg`
    : null;
  const totalGoles = historial.reduce((total, partido) => total + partido.goles, 0);
  const totalMvp = historial.reduce((total, partido) => total + partido.premiosMvp, 0);
  const jornadasConGol = historial.filter((partido) => partido.goles > 0).length;
  const partidosMvp = historial.filter((partido) => partido.premiosMvp > 0).length;

  return (
    <main>
      <h1>Historial del jugador</h1>
      <section className="historial-jugador-cabecera">
        {foto && <img className="historial-jugador-foto" src={foto} alt={`Foto de ${jugador.nombre}`} />}
        {equipo.escudo_url && <img className="historial-jugador-escudo" src={equipo.escudo_url} alt="" />}
        <div className="historial-jugador-identidad">
          <span className="suave">{equipo.nombre} · {temporada.nombre}</span>
          <h2>{jugador.nombre}</h2>
          {jugador.apodo && <span className="suave">{jugador.apodo}</span>}
          <span className="historial-jugador-dorsal">Dorsal {plantilla?.dorsal ?? "—"}</span>
        </div>
        <dl className="historial-jugador-resumen">
          <div><dt>Goles</dt><dd>{totalGoles}</dd></div>
          <div><dt>Jornadas con gol</dt><dd>{jornadasConGol}</dd></div>
          <div><dt>Premios MVP</dt><dd>{totalMvp}</dd></div>
          <div><dt>Jornadas como MVP</dt><dd>{partidosMvp}</dd></div>
        </dl>
      </section>
      <section className="historial-premios">
        <h2>Historial de MVP</h2>
        {!partidosMvp ? <p className="suave">Este jugador todavía no tiene premios MVP registrados en esta temporada.</p> : (
          <ol>
            {historial.filter((partido) => partido.premiosMvp > 0).map((partido) => (
              <li key={partido.id}>
                <strong>Jornada {partido.jornada || "—"}</strong>
                <span>{partido.rival || "Rival no disponible"}</span>
                <strong>{partido.premiosMvp} {partido.premiosMvp === 1 ? "premio" : "premios"}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="historial-goles">
        <h2>Historial de goles</h2>
        {!jornadasConGol ? <p className="suave">Este jugador todavía no tiene goles registrados en esta temporada.</p> : (
          <ol>
            {historial.filter((partido) => partido.goles > 0).map((partido) => (
              <li key={partido.id}>
                <strong>Jornada {partido.jornada || "—"}</strong>
                <span>{partido.rival || "Rival no disponible"}</span>
                <strong>{partido.goles} {partido.goles === 1 ? "gol" : "goles"}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>
      <a className="boton-inicio" href="/">← Volver a máximos goleadores</a>
    </main>
  );
}
