import "../globals.css";

const fechaDoc = (valor) => valor
  ? new Date(`${valor}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
  : "—";
const fechaPartido = (valor) => valor
  ? new Date(valor).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
  : "Fecha no disponible";
const persona = (nombre) => {
  const limpio = String(nombre ?? "").trim();
  return limpio && limpio !== "-" ? limpio : null;
};

export default function DetalleComite({ documento, partido, local, visitante, sanciones }) {
  const arbitros = [persona(partido.arbitro1), persona(partido.arbitro2)].filter(Boolean).join(" y ") || "—";
  const equipoPorId = new Map([[partido.local_id, local], [partido.visitante_id, visitante]]);

  return (
    <>
      <a className="boton-inicio acta-volver" href="/comite">← Volver</a>
      <header className="acta-cabecera">
        <div className="acta-cabecera-superior">
          <div className="acta-cabecera-acciones">
            <a className="acta-enlace-clupik" href={`/actas/${partido.id}`}>Ver acta del partido <span aria-hidden="true">→</span></a>
          </div>
          <span className="acta-kicker">COMITÉ DE COMPETICIÓN · JORNADA {partido.jornada || "—"}</span>
        </div>
        <p className="acta-fecha">Acuerdos publicados el {fechaDoc(documento.fecha)}</p>
        <div className="acta-marcador-grande">
          <div className="acta-equipo-grande">
            {local?.escudo_url && <img src={local.escudo_url} alt="" width="58" height="58" />}
            <strong>{local?.nombre || "Equipo local"}</strong>
          </div>
          <div className="acta-resultados"><span className="acta-resultado-oficial pendiente">VS</span></div>
          <div className="acta-equipo-grande">
            {visitante?.escudo_url && <img src={visitante.escudo_url} alt="" width="58" height="58" />}
            <strong>{visitante?.nombre || "Equipo visitante"}</strong>
          </div>
        </div>
      </header>

      <dl className="comite-datos">
        <div class="comite-datos-superiores">
          <div class="datos"><dt>Temporada</dt><dd>{partido.temporada?.nombre || "—"}</dd></div>
          <div class="datos"><dt>Grupo</dt><dd>{partido.grupo?.nombre || "—"}</dd></div>
          <div class="datos"><dt>Jornada</dt><dd>{partido.jornada || "—"}</dd></div>
        </div>
        <div><dt>Fecha del partido</dt><dd>{fechaPartido(partido.fecha)}</dd></div>
        <div><dt>Árbitros</dt><dd>{arbitros}</dd></div>
        <div><dt>Cronometrador</dt><dd>{persona(partido.crono) || "—"}</dd></div>
      </dl>

      <section aria-label="Acuerdos">
        <h2>Acuerdos</h2>
        {!sanciones.length ? (
          <p className="actas-sin-resultados">Este documento todavía no incluye sanciones.</p>
        ) : (
          <div className="comite-lista-sanciones">
            {sanciones.map((sancion) => {
              const equipo = equipoPorId.get(sancion.equipo_id);
              const detalle = !sancion.jugador
                ? "Sanción al equipo"
                : sancion.entrenador
                  ? "Entrenador"
                  : `Dorsal ${sancion.dorsal ?? "—"}`;
              return (
                <article className="comite-sancion" key={sancion.id}>
                  <div className="comite-sancion-persona">
                    <strong>{sancion.jugador?.nombre || equipo?.nombre || "Equipo"}</strong>
                    <span className="suave">{sancion.jugador ? `${equipo?.nombre || "Equipo"} · ` : ""}{detalle}</span>
                  </div>
                  <div className="comite-sancion-campo">
                    <span>INCIDENCIA</span>
                    <p>{sancion.incidencia}</p>
                  </div>
                  <div className={`comite-sancion-campo ${sancion.resolucion ? "" : "pendiente"}`}>
                    <span>RESOLUCIÓN</span>
                    <p>{sancion.resolucion || "Pendiente de resolución"}</p>
                  </div>
                  {sancion.articulos && (
                    <div className="comite-sancion-campo">
                      <span>ARTÍCULOS APLICADOS</span>
                      <p>{sancion.articulos}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
      <a className="boton-inicio acta-volver-final" href="/comite">← Volver</a>
    </>
  );
}
