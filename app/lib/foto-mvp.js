export function urlFotoMvp(equipoClupikId, jugador) {
  if (!process.env.CLUB_ID || !equipoClupikId || !jugador?.id_clupik || !jugador?.image_id) return null;
  const params = new URLSearchParams({
    equipo: String(equipoClupikId),
    jugador: String(jugador.id_clupik),
    imagen: String(jugador.image_id),
  });
  return `/api/mvp/foto?${params}`;
}
