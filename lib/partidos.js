export function tieneResultado(partido) {
  return partido.goles_local_clupik != null && partido.goles_visitante_clupik != null;
}

export function resultadoPendiente(partido, ahora = Date.now()) {
  const fechaPartido = Date.parse(partido.fecha);
  return !tieneResultado(partido) && Number.isFinite(fechaPartido) && fechaPartido < ahora;
}
