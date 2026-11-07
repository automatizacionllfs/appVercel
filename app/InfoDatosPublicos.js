export default function InfoDatosPublicos() {
  return (
    <aside className="info-datos-publicos" aria-label="Cómo interpretar los datos de la web">
      <details className="info-datos-acordeon">
        <summary className="info-datos-cabecera">
          <span className="info-datos-icono" aria-hidden="true">i</span>
          <strong>¿Cómo se actualizan estos datos?</strong>
          <span className="info-datos-flecha" aria-hidden="true">⌄</span>
        </summary>
        <div className="info-datos-contenido">
          <p>La web reúne información de Clupik y de las actas digitales.</p>
          <div className="info-datos-detalles">
            <p><span className="info-datos-punto clupik" aria-hidden="true" /><span><strong>Resultados y clasificación</strong> se sincronizan desde Clupik.</span></p>
            <p><span className="info-datos-punto acta" aria-hidden="true" /><span><strong>Goles, tarjetas y cronologías</strong> reflejan los eventos anotados en las actas digitales.</span></p>
            <p><span className="info-datos-punto revision" aria-hidden="true" /><span>No todas las actas están necesariamente informatizadas; si hay diferencias, el marcador y el acta pueden mostrarse por separado mientras se actualizan.</span></p>
          </div>
          <a className="boton-ver-actas" href="/actas">Ver actas <span aria-hidden="true">→</span></a>
        </div>
      </details>
    </aside>
  );
}
