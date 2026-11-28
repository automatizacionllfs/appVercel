import { createClient } from "@supabase/supabase-js";
import InfoDatosPublicos from "../InfoDatosPublicos";
import ComiteLista from "./ComiteLista";

export const revalidate = 60;

export default async function Comite() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temporada, error: errorTemporada } = await db.from("temporadas")
    .select("id,nombre")
    .eq("activa", true)
    .maybeSingle();
  if (errorTemporada) throw new Error(`No se pudo cargar la temporada: ${errorTemporada.message}`);

  let documentos = [];
  if (temporada) {
    const [{ data: docs, error: errorDocs }, { data: equipos, error: errorEquipos }] = await Promise.all([
      db.from("comite_documentos")
        .select("id,fecha,partido_id,partido:partidos!inner(id,jornada,temporada_id,local_id,visitante_id,grupo:grupos(nombre)),sanciones:comite_sanciones(id,resolucion)")
        .eq("partido.temporada_id", temporada.id)
        .order("fecha", { ascending: false })
        .order("id", { ascending: false }),
      db.from("equipos").select("id,nombre,escudo_url").eq("temporada_id", temporada.id),
    ]);
    if (errorDocs) throw new Error(`No se pudieron cargar los documentos del Comité: ${errorDocs.message}`);
    if (errorEquipos) throw new Error(`No se pudieron cargar los equipos: ${errorEquipos.message}`);

    const equipoPorId = new Map((equipos || []).map((equipo) => [equipo.id, equipo]));
    documentos = (docs || []).map((doc) => ({
      id: doc.id,
      fecha: doc.fecha,
      partidoId: doc.partido.id,
      jornada: doc.partido.jornada,
      grupo: doc.partido.grupo?.nombre || null,
      local_id: doc.partido.local_id,
      visitante_id: doc.partido.visitante_id,
      local: equipoPorId.get(doc.partido.local_id) || null,
      visitante: equipoPorId.get(doc.partido.visitante_id) || null,
      sanciones: doc.sanciones.length,
      pendiente: doc.sanciones.some((sancion) => !sancion.resolucion?.trim()),
    }));
  }

  return (
    <main>
      <h1>Comité{temporada ? ` · ${temporada.nombre}` : ""}</h1>
      <InfoDatosPublicos />
      <p className="suave">Consulta los acuerdos publicados por el Comité de Competición.</p>
      {!documentos.length ? (
        <section className="actas-vacio">
          <span aria-hidden="true">📋</span>
          <h2>Aún no hay documentos disponibles</h2>
          <p className="suave">Los acuerdos aparecerán aquí cuando el Comité los publique.</p>
        </section>
      ) : (
        <ComiteLista documentos={documentos} />
      )}
      <a className="boton-inicio" href="/">← Volver al inicio</a>
    </main>
  );
}
