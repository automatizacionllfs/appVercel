export const MVP_VOTING_OPEN_OFFSET_MINUTES = Number(process.env.MVP_VOTING_OPEN_OFFSET_MINUTES ?? 0);
export const MVP_VOTING_CLOSE_AFTER_HOURS = Number(process.env.MVP_VOTING_CLOSE_AFTER_HOURS ?? 168);

export function ventanaMvp(fechaPartido) {
  if (!fechaPartido) return null;
  const fechaMs = new Date(fechaPartido).getTime();
  if (!Number.isFinite(fechaMs) ||
      !Number.isFinite(MVP_VOTING_OPEN_OFFSET_MINUTES) ||
      !Number.isFinite(MVP_VOTING_CLOSE_AFTER_HOURS) ||
      MVP_VOTING_CLOSE_AFTER_HOURS <= 0) {
    throw new Error("La configuración de la ventana MVP no es válida.");
  }
  const abre = fechaMs + MVP_VOTING_OPEN_OFFSET_MINUTES * 60_000;
  return {
    abre: new Date(abre).toISOString(),
    cierra: new Date(abre + MVP_VOTING_CLOSE_AFTER_HOURS * 3_600_000).toISOString(),
  };
}
