export const MADRID_TIME_ZONE = "Europe/Madrid";

export function partesEnMadrid(fecha) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: MADRID_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(fecha)
      .filter((parte) => parte.type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
}

export function fechaMadridAISO(valor) {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valor);
  if (!coincidencia) throw new Error("La fecha y hora no tienen un formato válido.");
  const [year, month, day, hour, minute] = coincidencia.slice(1).map(Number);
  const objetivoMs = Date.UTC(year, month - 1, day, hour, minute);
  const objetivo = new Date(objetivoMs);
  if (objetivo.getUTCFullYear() !== year || objetivo.getUTCMonth() !== month - 1 ||
      objetivo.getUTCDate() !== day || hour > 23 || minute > 59) {
    throw new Error("La fecha y hora no tienen un formato válido.");
  }

  const offsets = new Set();
  for (let horas = -36; horas <= 36; horas += 6) {
    const muestra = objetivoMs + horas * 60 * 60 * 1000;
    const local = partesEnMadrid(new Date(muestra));
    offsets.add(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - muestra);
  }

  const instantes = [...offsets]
    .map((offset) => objetivoMs - offset)
    .filter((instante) => {
      const local = partesEnMadrid(new Date(instante));
      return local.year === year && local.month === month && local.day === day &&
        local.hour === hour && local.minute === minute && local.second === 0;
    });

  if (!instantes.length) {
    throw new Error("Esa hora local no existe en España por el cambio horario. Elige otra hora.");
  }
  return new Date(Math.min(...instantes)).toISOString();
}

export function fechaMadridInput(valor) {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (!Number.isFinite(fecha.getTime())) return "";
  const partes = partesEnMadrid(fecha);
  return `${partes.year}-${String(partes.month).padStart(2, "0")}-${String(partes.day).padStart(2, "0")}`;
}
