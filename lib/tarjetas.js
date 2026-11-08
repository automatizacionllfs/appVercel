export function marcarSegundasAmarillas(eventos) {
  const ordenadas = eventos
    .map((evento, indice) => ({ evento, indice }))
    .filter(({ evento }) => evento.tipo === "amarilla" && evento.jugador_id != null)
    .sort((a, b) => {
      const segundoA = (Number(a.evento.parte) - 1) * 1320 + (1320 - Number(a.evento.restante_seg));
      const segundoB = (Number(b.evento.parte) - 1) * 1320 + (1320 - Number(b.evento.restante_seg));
      return segundoA - segundoB || Number(a.evento.id) - Number(b.evento.id);
    });
  const amarillasPorPartido = new Map();
  const segundasAmarillas = new Set();

  ordenadas.forEach(({ evento, indice }) => {
    let amarillasPorJugador = amarillasPorPartido.get(evento.partido_id);
    if (!amarillasPorJugador) {
      amarillasPorJugador = new Map();
      amarillasPorPartido.set(evento.partido_id, amarillasPorJugador);
    }
    const anteriores = amarillasPorJugador.get(evento.jugador_id) || 0;
    if (anteriores === 1) segundasAmarillas.add(indice);
    amarillasPorJugador.set(evento.jugador_id, anteriores + 1);
  });

  return eventos.map((evento, indice) => ({
    ...evento,
    segundaAmarilla: segundasAmarillas.has(indice),
  }));
}
