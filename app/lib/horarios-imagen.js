import ayuntamiento from "../assets/AYTO.-PUERTO-REAL_Blanco.png";
import alcomarMeycagesal from "../assets/Alcomar_Meycagesal.png";
import cesportGen from "../assets/CeSport_Gen.png";
import llfs from "../assets/llfs.png";
import { MADRID_TIME_ZONE, partesEnMadrid } from "./fecha-madrid";

const ANCHO = 1600;
const ALTO = 900;
const ESCALA_EXPORTACION = 2;
const BLANCO = "#fff";
const limitesVisibles = new WeakMap();

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
    contexto.font = `800 ${actual}px Arial, sans-serif`;
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

function dibujarImagenAjustada(contexto, imagen, x, y, ancho, alto) {
  let limites = limitesVisibles.get(imagen);
  if (!limites) {
    const lienzo = document.createElement("canvas");
    lienzo.width = imagen.naturalWidth;
    lienzo.height = imagen.naturalHeight;
    const lienzoContexto = lienzo.getContext("2d", { willReadFrequently: true });
    if (!lienzoContexto) throw new Error("No se pudo preparar uno de los logos.");
    lienzoContexto.drawImage(imagen, 0, 0);
    const pixeles = lienzoContexto.getImageData(0, 0, lienzo.width, lienzo.height).data;
    let izquierda = lienzo.width;
    let arriba = lienzo.height;
    let derecha = -1;
    let abajo = -1;
    for (let py = 0; py < lienzo.height; py += 1) {
      for (let px = 0; px < lienzo.width; px += 1) {
        if (pixeles[(py * lienzo.width + px) * 4 + 3] > 16) {
          izquierda = Math.min(izquierda, px);
          arriba = Math.min(arriba, py);
          derecha = Math.max(derecha, px);
          abajo = Math.max(abajo, py);
        }
      }
    }
    limites = derecha < izquierda || abajo < arriba
      ? { izquierda: 0, arriba: 0, ancho: imagen.naturalWidth, alto: imagen.naturalHeight }
      : { izquierda, arriba, ancho: derecha - izquierda + 1, alto: abajo - arriba + 1 };
    limitesVisibles.set(imagen, limites);
  }
  const escala = Math.min(ancho / limites.ancho, alto / limites.alto);
  const dibujadoAncho = limites.ancho * escala;
  const dibujadoAlto = limites.alto * escala;
  contexto.drawImage(
    imagen,
    limites.izquierda,
    limites.arriba,
    limites.ancho,
    limites.alto,
    x + (ancho - dibujadoAncho) / 2,
    y + (alto - dibujadoAlto) / 2,
    dibujadoAncho,
    dibujadoAlto,
  );
}

function dibujarTemporada(contexto, x, y, anio) {
  contexto.fillStyle = "rgba(255,255,255,.82)";
  contexto.beginPath();
  contexto.roundRect(x, y, 250, 76, 10);
  contexto.fill();
  contexto.textAlign = "center";
  contexto.fillStyle = "#123c72";
  contexto.font = "700 23px 'Trebuchet MS', Arial, sans-serif";
  contexto.fillText("Puerto Real", x + 125, y + 30);
  contexto.strokeStyle = "rgba(18,60,114,.3)";
  contexto.lineWidth = 1;
  contexto.beginPath();
  contexto.moveTo(x + 77, y + 40);
  contexto.lineTo(x + 173, y + 40);
  contexto.stroke();
  contexto.font = "800 25px 'Trebuchet MS', Arial, sans-serif";
  contexto.fillText(`${anio}/${String(anio + 1).slice(-2)}`, x + 125, y + 64);
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

  const imagenes = await Promise.all([ayuntamiento, llfs, alcomarMeycagesal, cesportGen].map(cargarImagen));
  const filas = partidos.map((partido) => ({ ...partido, ...fechaPartido(partido.fecha) }))
    .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO * ESCALA_EXPORTACION;
  canvas.height = ALTO * ESCALA_EXPORTACION;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("No se pudo preparar la imagen de horarios.");
  contexto.scale(ESCALA_EXPORTACION, ESCALA_EXPORTACION);
  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = "high";

  const fondo = contexto.createLinearGradient(0, 0, ANCHO, ALTO);
  fondo.addColorStop(0, "#04183f");
  fondo.addColorStop(0.48, "#0755a1");
  fondo.addColorStop(1, "#03163c");
  contexto.fillStyle = fondo;
  contexto.fillRect(0, 0, ANCHO, ALTO);

  const resplandor = contexto.createRadialGradient(ANCHO / 2, 440, 80, ANCHO / 2, 440, 760);
  resplandor.addColorStop(0, "rgba(42,163,255,.34)");
  resplandor.addColorStop(1, "rgba(3,22,60,0)");
  contexto.fillStyle = resplandor;
  contexto.fillRect(0, 0, ANCHO, ALTO);

  contexto.save();
  contexto.translate(ANCHO / 2, ALTO / 2);
  contexto.rotate(-0.2);
  for (let banda = 0; banda < 7; banda += 1) {
    contexto.fillStyle = banda % 2 ? "rgba(48,177,255,.035)" : "rgba(72,202,255,.065)";
    contexto.fillRect(-ANCHO, -430 + banda * 132, ANCHO * 2, 38);
  }
  contexto.restore();

  contexto.strokeStyle = "rgba(174,231,255,.2)";
  contexto.lineWidth = 3;
  contexto.beginPath();
  contexto.moveTo(0, 790);
  contexto.bezierCurveTo(420, 685, 870, 855, ANCHO, 695);
  contexto.stroke();
  contexto.strokeStyle = "rgba(31,157,255,.38)";
  contexto.lineWidth = 15;
  contexto.beginPath();
  contexto.moveTo(0, 808);
  contexto.bezierCurveTo(430, 703, 850, 873, ANCHO, 713);
  contexto.stroke();
  contexto.fillStyle = "rgba(12,101,186,.25)";
  contexto.beginPath();
  contexto.moveTo(0, 660);
  contexto.lineTo(ANCHO, 575);
  contexto.lineTo(ANCHO, 690);
  contexto.lineTo(0, 790);
  contexto.closePath();
  contexto.fill();

  const [logoAyuntamiento, logoLlfs, logoAlcomarMeycagesal, logoCesportGen] = imagenes;
  dibujarImagenAjustada(contexto, logoAyuntamiento, 42, 24, 94, 122);
  dibujarImagenAjustada(contexto, logoLlfs, 1390, 35, 162, 58);

  contexto.textAlign = "center";
  contexto.font = "900 60px Arial, sans-serif";
  contexto.lineWidth = 3;
  contexto.strokeStyle = "#fff";
  contexto.fillStyle = "#ed3039";
  contexto.strokeText("PARTIDOS DE LA SEMANA", ANCHO / 2, 88);
  contexto.fillText("PARTIDOS DE LA SEMANA", ANCHO / 2, 88);
  contexto.fillStyle = "#ffda50";
  contexto.font = "900 40px Arial, sans-serif";
  contexto.fillText(textoPeriodo(filas.map((partido) => partido.fecha)), ANCHO / 2, 139, 1280);

  const tablaX = 135;
  const tablaW = 1330;
  const headerH = 56;
  const rowH = Math.min(82, (520 - headerH) / filas.length);
  const tablaH = headerH + rowH * filas.length;
  const tablaY = 190 + (520 - tablaH) / 2;

  contexto.fillStyle = "rgba(225,237,251,.46)";
  contexto.beginPath();
  contexto.roundRect(tablaX - 22, tablaY - 18, tablaW + 44, tablaH + 38, 36);
  contexto.fill();
  contexto.fillStyle = "#bc5415";
  contexto.fillRect(tablaX, tablaY, tablaW, headerH);

  const columnas = [
    { titulo: "DÍA", ancho: 145, valor: (partido) => partido.dia },
    { titulo: "PARTIDO", ancho: 485, valor: (partido) => `${partido.local?.nombre || "Local"} – ${partido.visitante?.nombre || "Visitante"}`.toLocaleUpperCase("es") },
    { titulo: "GRUP", ancho: 92, valor: (partido) => (partido.grupo?.nombre || "—").replace(/^grupo\s*/i, "") },
    { titulo: "JORN", ancho: 88, valor: (partido) => partido.jornada || "—" },
    { titulo: "ARB", ancho: 82, valor: (partido) => partido.numeroArbitros ?? 1 },
    { titulo: "HORA", ancho: 118, valor: (partido) => partido.hora },
    { titulo: "INSTALACIÓN", ancho: 320, valor: (partido) => (partido.pabellon || "—").replace(/\s*[-–]\s*Puerto Real\s*$/i, "").trim() || "—" },
  ];
  let columnaX = tablaX;
  contexto.textAlign = "center";
  contexto.textBaseline = "middle";
  contexto.fillStyle = BLANCO;
  contexto.font = "800 21px Arial, sans-serif";
  for (const columna of columnas) {
    contexto.fillText(columna.titulo, columnaX + columna.ancho / 2, tablaY + headerH / 2);
    columnaX += columna.ancho;
  }
  filas.forEach((partido, indice) => {
    const y = tablaY + headerH + indice * rowH;
    contexto.fillStyle = indice % 2 ? "#fff1c8" : "#ffe49a";
    contexto.fillRect(tablaX, y, tablaW, rowH);
    columnaX = tablaX;
    columnas.forEach((columna, columnaIndice) => {
      const texto = String(columna.valor(partido));
      contexto.fillStyle = columnaIndice === 0 ? "#bc5415" : indice % 2 ? "#fff1c8" : "#ffe49a";
      contexto.fillRect(columnaX, y, columna.ancho, rowH);
      contexto.fillStyle = columnaIndice === 0 ? BLANCO : "#171717";
      const tamanoTexto = Math.min(23, rowH * 0.48);
      contexto.font = `800 ${tamanoTexto}px Arial, sans-serif`;
      dibujarTextoAjustado(contexto, texto, columnaX + columna.ancho / 2, y + rowH / 2, columna.ancho - 16, tamanoTexto, 13);
      contexto.strokeStyle = "rgba(255,255,255,.8)";
      contexto.lineWidth = 1.5;
      contexto.strokeRect(columnaX, y, columna.ancho, rowH);
      columnaX += columna.ancho;
    });
  });
  contexto.strokeStyle = "rgba(255,255,255,.85)";
  contexto.lineWidth = 1.5;
  contexto.strokeRect(tablaX, tablaY, tablaW, headerH);
  columnaX = tablaX;
  for (const columna of columnas.slice(0, -1)) {
    columnaX += columna.ancho;
    contexto.beginPath();
    contexto.moveTo(columnaX, tablaY);
    contexto.lineTo(columnaX, tablaY + headerH);
    contexto.stroke();
  }
  contexto.textBaseline = "alphabetic";
  contexto.textAlign = "left";

  const pieY = 790;
  dibujarImagenAjustada(contexto, logoAlcomarMeycagesal, 45, pieY - 18, 530, 110);
  dibujarTemporada(contexto, 675, pieY - 2, new Date().getFullYear());
  dibujarImagenAjustada(contexto, logoCesportGen, 1025, pieY - 18, 530, 110);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((resultado) => resultado ? resolve(resultado) : reject(new Error("No se pudo generar el archivo de horarios.")), "image/png");
  });
  return blob;
}
