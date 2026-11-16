export const NOMBRES_PERSONAL_ACTA = [
  "Aspe",
  "Carmen",
  "Joaquin",
  "Joni",
  "Manuel",
  "Mawito",
  "Miguel",
  "Tambora",
  "Jose Manuel",
];

function normalizarNombre(nombre) {
  return String(nombre || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

const nombreCanonicoPorClave = new Map(
  NOMBRES_PERSONAL_ACTA.map((nombre) => [normalizarNombre(nombre), nombre]),
);

export function nombrePersonalActa(nombre) {
  return nombreCanonicoPorClave.get(normalizarNombre(nombre)) || null;
}
