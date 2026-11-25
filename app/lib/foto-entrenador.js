export function urlFotoEntrenador(equipoClupikId, persona) {
  if (!process.env.CLUB_ID || !equipoClupikId || !persona?.id_clupik || !persona?.image_id) return null;
  const params = new URLSearchParams({
    equipo: String(equipoClupikId),
    persona: String(persona.id_clupik),
    imagen: String(persona.image_id),
  });
  return `/api/foto-entrenador?${params}`;
}
