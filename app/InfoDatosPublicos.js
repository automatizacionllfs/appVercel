export default function InfoDatosPublicos() {
  return (
    <aside className="info-datos-publicos" aria-label="Cómo interpretar los datos de la web">
      <div className="info-datos-cabecera">
        <span className="info-datos-icono" aria-hidden="true">i</span>
        <div>
          <strong>¿Cómo se actualizan estos datos?</strong>
          <p>La web reúne información de Clupik y de las actas digitales.</p>
        </div>
      </div>
      <div className="info-datos-detalles">
        <p><span className="info-datos-punto clupik" aria-hidden="true" /><span><strong>Resultados y clasificación</strong> se sincronizan desde Clupik.</span></p>
        <p><span className="info-datos-punto acta" aria-hidden="true" /><span><strong>Goles, tarjetas y cronologías</strong> reflejan los eventos anotados en las actas digitales.</span></p>
        <p><span className="info-datos-punto revision" aria-hidden="true" /><span>No todas las actas están necesariamente informatizadas; si hay diferencias, el marcador y el acta pueden mostrarse por separado mientras se actualizan.</span></p>
      </div>
      <a className="boton-ver-actas" href="/actas">Ver actas <span aria-hidden="true">→</span></a>
    </aside>
  );
}
