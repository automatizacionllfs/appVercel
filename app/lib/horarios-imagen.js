import ayuntamiento from "../assets/AYTO.-PUERTO-REAL_Blanco.png";
import cesport from "../assets/CeSport_Blanco.png";
import alcomar from "../assets/Grupo Alcomar.png";
import gen from "../assets/Logo-Gen-Grupo-Energetico1_Blanco.png";
import meycagesal from "../assets/Meycagesal.png";
import llfs from "../assets/llfs.png";
import { MADRID_TIME_ZONE, partesEnMadrid } from "./fecha-madrid";

const ANCHO = 1600;
const ALTO = 900;
const BLANCO = "#fff";

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(new Error("No se pudo cargar uno de los logos del cartel."));
    imagen.src = typeof src === "string" ? src : src.src;
  });
}

function dibujarTextoAjustado(contexto, texto, x, y, ancho, tamano, minimo = 12) {
  let actual = tamano;
  while (actual > minimo) {
    contexto.font = `700 ${actual}px Arial, sans-serif`;
    if (contexto.measureText(texto).width <= ancho) break;
    actual -= 1;
  }
  contexto.fillText(texto, x, y, ancho);
}

function fechaPartido(fecha) {
  if (!fecha) return { dia: "—", hora: "—", fecha: null };
  const instante = new Date(fecha);
  if (!Number.isFinite(instante.getTime())) return { dia: "—", hora: "—", fecha: null };
  const partes = partesEnMadrid(instante);
  if (!partes.year) return { dia: "—", hora: "—", fecha: null };
  return {
    dia: `${String(partes.day).padStart(2, "0")}.${String(partes.month).padStart(2, "0")}.${String(partes.year).slice(-2)}`,
    hora: `${String(partes.hour).padStart(2, "0")}:${String(partes.minute).padStart(2, "0")}H`,
    fecha: new Date(Date.UTC(partes.year, partes.month - 1, partes.day)),
  };
}

function dibujarLogo(contexto, imagen, x, y, ancho, alto) {
  const mascara = document.createElement("canvas");
  mascara.width = Math.ceil(ancho);
  mascara.height = Math.ceil(alto);
  const contextoMascara = mascara.getContext("2d");
  if (!contextoMascara) throw new Error("No se pudo preparar uno de los logos del cartel.");
  const escala = Math.min(ancho / imagen.width, alto / imagen.height);
  const dibujadoAncho = imagen.width * escala;
  const dibujadoAlto = imagen.height * escala;
  const izquierda = (ancho - dibujadoAncho) / 2;
  const arriba = (alto - dibujadoAlto) / 2;
  contextoMascara.drawImage(imagen, izquierda, arriba, dibujadoAncho, dibujadoAlto);
  contextoMascara.globalCompositeOperation = "source-in";
  contextoMascara.fillStyle = BLANCO;
  contextoMascara.fillRect(0, 0, mascara.width, mascara.height);
  contexto.drawImage(mascara, x, y, ancho, alto);
}

function dibujarTemporada(contexto, x, y) {
  contexto.fillStyle = "rgba(255,255,255,.82)";
  contexto.beginPath();
  contexto.roundRect(x, y, 250, 76, 38);
  contexto.fill();
  contexto.textAlign = "center";
  contexto.fillStyle = "#123c72";
  contexto.font = "700 24px Arial, sans-serif";
  contexto.fillText("PUERTO REAL", x + 125, y + 32);
  contexto.font = "700 23px Arial, sans-serif";
  contexto.fillText("TEMPORADA", x + 125, y + 59);
  contexto.textAlign = "left";
}

function textoPeriodo(fechas) {
  const validas = fechas.filter(Boolean).sort((a, b) => a - b);
  if (!validas.length) return "HORARIOS DE LOS PARTIDOS";
  const opcionesMes = { timeZone: MADRID_TIME_ZONE, month: "long" };
  const primera = validas[0];
  const ultima = validas[validas.length - 1];
  const mesPrimero = new Intl.DateTimeFormat("es-ES", opcionesMes).format(primera).toLocaleUpperCase("es");
  const mesUltimo = new Intl.DateTimeFormat("es-ES", opcionesMes).format(ultima).toLocaleUpperCase("es");
  if (primera.getFullYear() === ultima.getFullYear() && primera.getMonth() === ultima.getMonth()) {
    return `DEL ${primera.getDate()} AL ${ultima.getDate()} DE ${mesUltimo} DE ${ultima.getFullYear()}`;
  }
  const primeraParte = `${primera.getDate()} DE ${mesPrimero} DE ${primera.getFullYear()}`;
  const ultimaParte = `${ultima.getDate()} DE ${mesUltimo} DE ${ultima.getFullYear()}`;
  return `DEL ${primeraParte} AL ${ultimaParte}`;
}

export async function generarImagenHorarios(partidos) {
  if (!partidos.length) throw new Error("Selecciona al menos un partido para descargar los horarios.");

  const imagenes = await Promise.all([ayuntamiento, llfs, alcomar, meycagesal, cesport, gen].map(cargarImagen));
  const filas = partidos.map((partido) => ({ ...partido, ...fechaPartido(partido.fecha) }))
    .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("No se pudo preparar la imagen de horarios.");

  const fondo = contexto.createLinearGradient(0, 0, ANCHO, ALTO);
  fondo.addColorStop(0, "#06285f");
  fondo.addColorStop(0.52, "#0755a1");
  fondo.addColorStop(1, "#031d50");
  contexto.fillStyle = fondo;
  contexto.fillRect(0, 0, ANCHO, ALTO);

  contexto.strokeStyle = "rgba(84,190,255,.18)";
  contexto.lineWidth = 1;
  for (let x = 0; x < ANCHO; x += 54) {
    contexto.beginPath();
    contexto.moveTo(x, 0);
    contexto.lineTo(x, ALTO);
    contexto.stroke();
  }
  for (let y = 0; y < ALTO; y += 54) {
    contexto.beginPath();
    contexto.moveTo(0, y);
    contexto.lineTo(ANCHO, y);
    contexto.stroke();
  }
  contexto.fillStyle = "rgba(38,168,240,.12)";
  contexto.beginPath();
  contexto.moveTo(0, 770);
  contexto.lineTo(ANCHO, 620);
  contexto.lineTo(ANCHO, 720);
  contexto.lineTo(0, 860);
  contexto.closePath();
  contexto.fill();

  const [logoAyuntamiento, logoLlfs, logoAlcomar, logoMeycagesal, logoCesport, logoGen] = imagenes;
  dibujarLogo(contexto, logoAyuntamiento, 48, 28, 115, 145);
  dibujarLogo(contexto, logoLlfs, 1390, 45, 165, 70);

  contexto.textAlign = "center";
  contexto.font = "900 58px Arial, sans-serif";
  contexto.lineWidth = 3;
  contexto.strokeStyle = "#fff";
  contexto.fillStyle = "#ed3039";
  contexto.strokeText("PARTIDOS DE LA SEMANA", ANCHO / 2, 88);
  contexto.fillText("PARTIDOS DE LA SEMANA", ANCHO / 2, 88);
  contexto.fillStyle = "#ffda50";
  contexto.font = "900 38px Arial, sans-serif";
  contexto.fillText(textoPeriodo(filas.map((partido) => partido.fecha)), ANCHO / 2, 137, 1260);

  const tablaX = 240;
  const tablaY = 176;
  const tablaW = 1120;
  const headerH = 48;
  const rowH = Math.min(43, Math.max(31, 470 / filas.length));
  const tablaH = headerH + rowH * filas.length;

  contexto.fillStyle = "rgba(225,237,251,.46)";
  contexto.beginPath();
  contexto.roundRect(tablaX - 18, tablaY - 16, tablaW + 36, tablaH + 34, 34);
  contexto.fill();
  contexto.fillStyle = "#bc5415";
  contexto.fillRect(tablaX, tablaY, tablaW, headerH);

  const columnas = [
    { titulo: "DÍA", ancho: 150, valor: (partido) => partido.dia },
    { titulo: "PARTIDO", ancho: 405, valor: (partido) => `${partido.local?.nombre || "Local"} – ${partido.visitante?.nombre || "Visitante"}`.toLocaleUpperCase("es") },
    { titulo: "GRUP", ancho: 86, valor: (partido) => (partido.grupo?.nombre || "—").replace(/^grupo\s*/i, "") },
    { titulo: "JORN", ancho: 90, valor: (partido) => partido.jornada || "—" },
    { titulo: "ARB", ancho: 75, valor: (partido) => partido.numeroArbitros ?? 1 },
    { titulo: "HORA", ancho: 110, valor: (partido) => partido.hora },
    { titulo: "INSTALACIÓN", ancho: 204, valor: (partido) => partido.pabellon || "—" },
  ];
  let columnaX = tablaX;
  contexto.textAlign = "center";
  contexto.textBaseline = "middle";
  contexto.fillStyle = BLANCO;
  contexto.font = "700 19px Arial, sans-serif";
  for (const columna of columnas) {
    contexto.fillText(columna.titulo, columnaX + columna.ancho / 2, tablaY + headerH / 2);
    columnaX += columna.ancho;
  }
  filas.forEach((partido, indice) => {
    const y = tablaY + headerH + indice * rowH;
    contexto.fillStyle = indice % 2 ? "#fff0c2" : "#ffe49a";
    contexto.fillRect(tablaX, y, tablaW, rowH);
    columnaX = tablaX;
    columnas.forEach((columna, columnaIndice) => {
      const texto = String(columna.valor(partido));
      contexto.fillStyle = columnaIndice === 0 ? "#bc5415" : "#171717";
      contexto.fillRect(columnaX, y, columna.ancho, rowH);
      if (columnaIndice !== 0) {
        contexto.fillStyle = indice % 2 ? "#fff0c2" : "#ffe49a";
        contexto.fillRect(columnaX + 1, y + 1, columna.ancho - 2, rowH - 2);
      }
      contexto.fillStyle = columnaIndice === 0 ? BLANCO : "#171717";
      contexto.font = `700 ${Math.min(18, rowH * 0.45)}px Arial, sans-serif`;
      dibujarTextoAjustado(contexto, texto, columnaX + columna.ancho / 2, y + rowH / 2, columna.ancho - 12, Math.min(18, rowH * 0.45), 10);
      columnaX += columna.ancho;
    });
  });
  contexto.textBaseline = "alphabetic";
  contexto.textAlign = "left";

  const pieY = 765;
  dibujarLogo(contexto, logoAlcomar, 95, pieY, 190, 90);
  dibujarLogo(contexto, logoMeycagesal, 340, pieY + 10, 245, 70);
  dibujarTemporada(contexto, 675, pieY + 8);
  dibujarLogo(contexto, logoCesport, 1000, pieY + 18, 245, 55);
  dibujarLogo(contexto, logoGen, 1320, pieY + 2, 115, 105);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((resultado) => resultado ? resolve(resultado) : reject(new Error("No se pudo generar el archivo de horarios.")), "image/png");
  });
  return blob;
}
