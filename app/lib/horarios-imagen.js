import ayuntamiento from "../assets/AYTO.-PUERTO-REAL_Blanco.png";
import cesport from "../assets/CeSport_Bicolor.png";
import alcomar from "../assets/Grupo Alcomar_Bicolor.png";
import gen from "../assets/Gen_Bicolor.png";
import meycagesal from "../assets/Meycagesal_Bicolor.png";
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

function dibujarLogo(contexto, imagen, x, y, ancho, alto, estiloColor = null) {
  const fuente = document.createElement("canvas");
  fuente.width = imagen.naturalWidth;
  fuente.height = imagen.naturalHeight;
  const fuenteContexto = fuente.getContext("2d", { willReadFrequently: true });
  if (!fuenteContexto) throw new Error("No se pudo preparar uno de los logos del cartel.");
  fuenteContexto.drawImage(imagen, 0, 0);
  const pixeles = fuenteContexto.getImageData(0, 0, fuente.width, fuente.height).data;
  let izquierdaVisible = fuente.width;
  let arribaVisible = fuente.height;
  let derechaVisible = -1;
  let abajoVisible = -1;
  for (let py = 0; py < fuente.height; py += 1) {
    for (let px = 0; px < fuente.width; px += 1) {
      if (pixeles[(py * fuente.width + px) * 4 + 3] > 16) {
        izquierdaVisible = Math.min(izquierdaVisible, px);
        arribaVisible = Math.min(arribaVisible, py);
        derechaVisible = Math.max(derechaVisible, px);
        abajoVisible = Math.max(abajoVisible, py);
      }
    }
  }
  if (derechaVisible < izquierdaVisible || abajoVisible < arribaVisible) return;
  const anchoVisible = derechaVisible - izquierdaVisible + 1;
  const altoVisible = abajoVisible - arribaVisible + 1;
  const mascara = document.createElement("canvas");
  mascara.width = Math.ceil(ancho);
  mascara.height = Math.ceil(alto);
  const contextoMascara = mascara.getContext("2d");
  if (!contextoMascara) throw new Error("No se pudo preparar uno de los logos del cartel.");
  const escala = Math.min(ancho / anchoVisible, alto / altoVisible);
  const dibujadoAncho = anchoVisible * escala;
  const dibujadoAlto = altoVisible * escala;
  const izquierda = (ancho - dibujadoAncho) / 2;
  const arriba = (alto - dibujadoAlto) / 2;
  contextoMascara.drawImage(
    fuente,
    izquierdaVisible,
    arribaVisible,
    anchoVisible,
    altoVisible,
    izquierda,
    arriba,
    dibujadoAncho,
    dibujadoAlto,
  );
  const pixelesLogo = contextoMascara.getImageData(0, 0, mascara.width, mascara.height);
  for (let indice = 0; indice < pixelesLogo.data.length; indice += 4) {
    if (pixelesLogo.data[indice + 3] === 0) continue;
    if (estiloColor === "original") continue;
    let color = BLANCO;
    const pixelX = (indice / 4) % mascara.width;
    const pixelY = Math.floor(indice / 4 / mascara.width);
    if (typeof estiloColor === "function") {
      color = estiloColor(
        (pixelX + 0.5 - izquierda) / dibujadoAncho,
        (pixelY + 0.5 - arriba) / dibujadoAlto,
      );
    } else if (estiloColor) {
      const maximo = Math.max(pixelesLogo.data[indice], pixelesLogo.data[indice + 1], pixelesLogo.data[indice + 2]);
      const minimo = Math.min(pixelesLogo.data[indice], pixelesLogo.data[indice + 1], pixelesLogo.data[indice + 2]);
      if (maximo - minimo > 38) color = estiloColor;
    }
    pixelesLogo.data[indice] = parseInt(color.slice(1, 3), 16);
    pixelesLogo.data[indice + 1] = parseInt(color.slice(3, 5), 16);
    pixelesLogo.data[indice + 2] = parseInt(color.slice(5, 7), 16);
  }
  contextoMascara.putImageData(pixelesLogo, 0, 0);
  contexto.drawImage(mascara, x, y, ancho, alto);
}

function dibujarLogoBicolor(contexto, imagen, x, y, ancho, alto) {
  const fuente = document.createElement("canvas");
  fuente.width = imagen.naturalWidth;
  fuente.height = imagen.naturalHeight;
  const fuenteContexto = fuente.getContext("2d", { willReadFrequently: true });
  if (!fuenteContexto) throw new Error("No se pudo preparar uno de los logos bicolor.");
  fuenteContexto.drawImage(imagen, 0, 0);
  const pixeles = fuenteContexto.getImageData(0, 0, fuente.width, fuente.height);
  const { data } = pixeles;
  const pendientes = new Uint32Array(fuente.width * fuente.height);
  let finalPendientes = 0;
  let siguientePendiente = 0;

  function esFondoBlanco(indice) {
    const rojo = data[indice * 4];
    const verde = data[indice * 4 + 1];
    const azul = data[indice * 4 + 2];
    return data[indice * 4 + 3] > 0 &&
      Math.min(rojo, verde, azul) >= 238 &&
      Math.max(rojo, verde, azul) - Math.min(rojo, verde, azul) <= 20;
  }

  function agregarFondo(indice) {
    if (!esFondoBlanco(indice)) return;
    data[indice * 4 + 3] = 0;
    pendientes[finalPendientes] = indice;
    finalPendientes += 1;
  }

  for (let x = 0; x < fuente.width; x += 1) {
    agregarFondo(x);
    agregarFondo((fuente.height - 1) * fuente.width + x);
  }
  for (let y = 1; y < fuente.height - 1; y += 1) {
    agregarFondo(y * fuente.width);
    agregarFondo(y * fuente.width + fuente.width - 1);
  }

  while (siguientePendiente < finalPendientes) {
    const indice = pendientes[siguientePendiente];
    siguientePendiente += 1;
    const x = indice % fuente.width;
    if (x > 0) agregarFondo(indice - 1);
    if (x < fuente.width - 1) agregarFondo(indice + 1);
    if (indice >= fuente.width) agregarFondo(indice - fuente.width);
    if (indice < fuente.width * (fuente.height - 1)) agregarFondo(indice + fuente.width);
  }

  fuenteContexto.putImageData(pixeles, 0, 0);
  contexto.drawImage(fuente, x, y, ancho, alto);
}

function dibujarTemporada(contexto, x, y, anio) {
  contexto.fillStyle = "rgba(255,255,255,.82)";
  contexto.beginPath();
  contexto.moveTo(x + 18, y);
  contexto.lineTo(x + 250, y);
  contexto.lineTo(x + 232, y + 76);
  contexto.lineTo(x, y + 76);
  contexto.closePath();
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

  const imagenes = await Promise.all([ayuntamiento, llfs, alcomar, meycagesal, cesport, gen].map(cargarImagen));
  const filas = partidos.map((partido) => ({ ...partido, ...fechaPartido(partido.fecha) }))
    .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("No se pudo preparar la imagen de horarios.");

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

  const [logoAyuntamiento, logoLlfs, logoAlcomar, logoMeycagesal, logoCesport, logoGen] = imagenes;
  dibujarLogo(contexto, logoAyuntamiento, 42, 24, 94, 122);
  dibujarLogo(contexto, logoLlfs, 1390, 35, 162, 58);

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
  dibujarLogoBicolor(contexto, logoAlcomar, 70, pieY - 18, 220, 124);
  dibujarLogoBicolor(contexto, logoMeycagesal, 320, pieY - 18, 220, 124);
  dibujarTemporada(contexto, 675, pieY - 2, new Date().getFullYear());
  dibujarLogoBicolor(contexto, logoCesport, 985, pieY - 18, 220, 124);
  dibujarLogoBicolor(contexto, logoGen, 1310, pieY - 18, 220, 124);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((resultado) => resultado ? resolve(resultado) : reject(new Error("No se pudo generar el archivo de horarios.")), "image/png");
  });
  return blob;
}
