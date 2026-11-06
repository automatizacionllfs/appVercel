const duracionParte = 22 * 60;
const reloj = (segundos) => `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
const fecha = (valor) => valor
  ? new Date(valor).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  : "Fecha no disponible";

function iconoEvento(tipo) {
  if (tipo === "gol") return <span className="evento-icono gol" aria-hidden="true">⚽</span>;
  if (tipo === "amarilla") return <span className="evento-tarjeta amarilla" role="img" aria-label="Tarjeta amarilla" />;
  return <span className="evento-tarjeta roja" role="img" aria-label="Tarjeta roja" />;
}

function IconoSilbato() {
  return (
    <svg viewBox="0 0 32 32" width="21" height="21" fill="none" aria-hidden="true">
      <path d="M5 13h8l10-6v18l-10-6H5a3 3 0 0 1-3-3v-1a2 2 0 0 1 3-2Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="10" cy="16" r="2" fill="currentColor" />
      <path d="M24 11c2 1 3 2.7 3 5s-1 4-3 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function DetalleActa({ partido, local, visitante, eventos, volver }) {
  const golesLocal = eventos.filter((evento) => evento.tipo === "gol" && evento.equipo_id === partido.local_id).length;
  const golesVisitante = eventos.filter((evento) => evento.tipo === "gol" && evento.equipo_id === partido.visitante_id).length;
  const resultadoSincronizado = partido.goles_local_clupik !== null && partido.goles_visitante_clupik !== null;
  const hayDesajuste = resultadoSincronizado &&
    (Number(partido.goles_local_clupik) !== golesLocal || Number(partido.goles_visitante_clupik) !== golesVisitante);
  const localPorId = new Map([[partido.local_id, local], [partido.visitante_id, visitante]]);

  const cronologia = [
    ...eventos.map((evento) => ({
      tipo: "evento",
      evento,
      segundo: (Number(evento.parte) - 1) * duracionParte + (duracionParte - Number(evento.restante_seg)),
      orden: evento.parte === 1 ? 0 : 2,
    })),
    { tipo: "silbato", titulo: "Descanso", texto: "Final de la primera parte", segundo: duracionParte, orden: 1 },
    { tipo: "silbato", titulo: "Final del partido", texto: "Encuentro finalizado", segundo: duracionParte * 2, orden: 3 },
  ].sort((a, b) => a.segundo - b.segundo || a.orden - b.orden || (a.evento?.id || 0) - (b.evento?.id || 0));

  return (
    <>
      <a className="boton-inicio acta-volver" href={volver}>← Volver</a>
      <header className="acta-cabecera">
        <span className="acta-kicker">ACTA DIGITAL · JORNADA {partido.jornada || "—"}</span>
        <p className="acta-fecha">{fecha(partido.fecha)}</p>
        <div className="acta-marcador-grande">
          <div className="acta-equipo-grande">
            {local?.escudo_url && <img src={local.escudo_url} alt="" width="58" height="58" />}
            <strong>{local?.nombre || "Equipo local"}</strong>
          </div>
          <div className="acta-resultados">
            <span className="acta-resultado-oficial">
              {partido.goles_local_clupik ?? "—"} <i>:</i> {partido.goles_visitante_clupik ?? "—"}
            </span>
            <span className="acta-resultados-etiqueta">Marcador sincronizado</span>
            <span className="acta-resultado-acta">Acta: {golesLocal} – {golesVisitante}</span>
          </div>
          <div className="acta-equipo-grande">
            {visitante?.escudo_url && <img src={visitante.escudo_url} alt="" width="58" height="58" />}
            <strong>{visitante?.nombre || "Equipo visitante"}</strong>
          </div>
        </div>
        <div className="acta-metricas">
          <span>⚽ <strong>{eventos.filter((evento) => evento.tipo === "gol").length}</strong> goles</span>
          <span>🟨 <strong>{eventos.filter((evento) => evento.tipo === "amarilla").length}</strong> amarillas</span>
          <span>🟥 <strong>{eventos.filter((evento) => evento.tipo === "roja").length}</strong> rojas</span>
        </div>
      </header>

      <aside className={`acta-aviso ${hayDesajuste ? "desajuste" : ""}`}>
        <span className="acta-aviso-icono" aria-hidden="true">{hayDesajuste ? "ⓘ" : "✓"}</span>
        <div>
          <strong>{hayDesajuste ? "Diferencia entre el acta y el marcador sincronizado" : "Información sobre los datos del partido"}</strong>
          <p>
            {hayDesajuste
              ? "El acta digital y el marcador procedente de Clupik no coinciden. Se muestran ambos datos para facilitar su revisión; la información puede estar pendiente de sincronización."
              : "La cronología recoge los eventos anotados en el acta digital. El marcador se sincroniza desde Clupik y ambos registros pueden actualizarse en momentos distintos."}
          </p>
        </div>
      </aside>

      <section className="acta-cronologia">
        <div className="acta-cronologia-titulo">
          <div>
            <span className="acta-kicker">PARTIDO, DE PRINCIPIO A FIN</span>
            <h2>Cronología del encuentro</h2>
          </div>
          <span className="acta-total-eventos">{eventos.length} {eventos.length === 1 ? "evento" : "eventos"}</span>
        </div>
        {!eventos.length && (
          <p className="acta-sin-eventos">Todavía no hay goles ni tarjetas registrados en el acta de este partido.</p>
        )}
        <ol className="acta-timeline">
          {cronologia.map((item, indice) => item.tipo === "silbato" ? (
            <li className="acta-hito" key={item.titulo}>
              <span className="acta-hito-icono"><IconoSilbato /></span>
              <div><strong>{item.titulo}</strong><span>{item.texto} · {reloj(item.segundo)}</span></div>
            </li>
          ) : (
            <li className={`acta-evento acta-evento-${item.evento.tipo}`} key={item.evento.id}>
              <span className="acta-tiempo">
                {item.evento.parte === 1 ? "1ª" : "2ª"} PARTE
                <strong>{reloj(duracionParte - Number(item.evento.restante_seg))}'</strong>
              </span>
              {iconoEvento(item.evento.tipo)}
              <div className="acta-evento-detalle">
                <strong>
                  {item.evento.tipo === "gol" ? "Gol" : item.evento.tipo === "amarilla" ? "Tarjeta amarilla" : "Tarjeta roja"}
                </strong>
                <span>
                  {item.evento.jugador?.nombre || (item.evento.tipo === "gol" ? "Gol en propia puerta" : "Jugador no disponible")}
                  {" · "}
                  {localPorId.get(item.evento.equipo_id)?.nombre || "Equipo"}
                </span>
              </div>
              {item.evento.tipo === "gol" && <span className="acta-evento-equipo">{localPorId.get(item.evento.equipo_id)?.nombre || "Gol"}</span>}
              <span className="sr-only">Evento {indice + 1}</span>
            </li>
          ))}
        </ol>
      </section>
      <a className="boton-inicio acta-volver-final" href={volver}>← Volver</a>
    </>
  );
}
