export const NOMBRES_PERSONAL_ACTA = [
  "José Manuel Áspera García",
  "-",
  "Carmen",
  "Joaquín López Calderón",
  "Jonathan Márquez Monis",
  "Jose Manuel",
  "Manuel López Calderón",
  "Manuel Salvador Castaño",
  "Miguel",
  "Daniel Tambora Constantino",
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
