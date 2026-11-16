import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const WIDTH = 842;
const HEIGHT = 595;
const INK = rgb(0.13, 0.13, 0.13);
const LIGHT = rgb(0.91, 0.91, 0.91);
const PALE = rgb(0.96, 0.96, 0.96);
const MONTHS = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

function textoPdf(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[^\x20-\xFF€]/g, "");
}

function fechaMadrid(value) {
  if (!value) return { linea: "FECHA NO DISPONIBLE", hora: "—", dia: "—", mes: "—", anio: "—" };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { linea: "FECHA NO DISPONIBLE", hora: "—", dia: "—", mes: "—", anio: "—" };
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const data = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const mes = MONTHS[Number(data.month) - 1];
  return {
    linea: `EN PUERTO REAL, EL DIA ${data.day} DE ${mes} DE ${data.year}`,
    hora: `${data.hour}:${data.minute}`,
    dia: data.day,
    mes,
    anio: data.year,
  };
}

function dibujarTexto(page, text, x, top, size, font, options = {}) {
  const value = textoPdf(text);
  if (!value) return;
  const maxWidth = options.maxWidth;
  let fontSize = size;
  while (maxWidth && font.widthOfTextAtSize(value, fontSize) > maxWidth && fontSize > 5) fontSize -= 0.25;
  const width = font.widthOfTextAtSize(value, fontSize);
  const drawX = options.align === "center" ? x - width / 2 : options.align === "right" ? x - width : x;
  page.drawText(value, {
    x: drawX,
    y: HEIGHT - top - fontSize,
    size: fontSize,
    font,
    color: options.color || INK,
  });
}

function rect(page, x, top, width, height, options = {}) {
  page.drawRectangle({
    x,
    y: HEIGHT - top - height,
    width,
    height,
    borderWidth: options.borderWidth ?? 0.55,
    borderColor: options.borderColor || INK,
    color: options.color,
  });
}

function linea(page, x1, top1, x2, top2, color = INK, thickness = 0.55) {
  page.drawLine({
    start: { x: x1, y: HEIGHT - top1 },
    end: { x: x2, y: HEIGHT - top2 },
    color,
    thickness,
  });
}

function celda(page, text, x, top, width, height, font, size = 7, options = {}) {
  if (options.fill) rect(page, x, top, width, height, { color: options.fill, borderWidth: 0.45 });
  else rect(page, x, top, width, height, { borderWidth: 0.45 });
  dibujarTexto(page, text, options.align === "center" ? x + width / 2 : x + (options.padding ?? 3), top + Math.max(2, (height - size) / 2 - 0.5), size, font, {
    align: options.align,
    maxWidth: width - 2 * (options.padding ?? 3),
    color: options.textColor,
  });
}

async function imagenEscudo(pdf, url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const allowedHosts = (process.env.CLUPIK_IMAGE_HOSTS || "api.clupik.com")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (parsed.protocol !== "https:" || !allowedHosts.includes(parsed.hostname.toLowerCase())) return null;

  const response = await fetch(parsed, {
    cache: "force-cache",
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`No se pudo cargar un escudo: Clupik respondió HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") || "";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 2_000_000) throw new Error("Un escudo supera el tamaño máximo permitido.");
  if (contentType.includes("png")) return pdf.embedPng(bytes);
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return pdf.embedJpg(bytes);
  throw new Error("Clupik devolvió un formato de imagen no compatible para un escudo.");
}

async function cargarLogo(pdf) {
  const bytes = await readFile(join(process.cwd(), "public", "logo-llfs.png"));
  return pdf.embedPng(bytes);
}

function dibujarCabecera(page, partido, temporada, logo, regular, bold) {
  const fecha = fechaMadrid(partido.fecha);
  const nombreLocal = partido.local?.nombre || "Equipo local";
  const nombreVisitante = partido.visitante?.nombre || "Equipo visitante";
  celda(page, "ACTA OFICIAL", 22, 35, 83, 16, bold, 8, { fill: LIGHT, align: "center" });
  celda(
    page,
    `DELEGACION LOCAL FUTBOL SALA DE PUERTO REAL - TEMPORADA ${temporada || "2026/27"}`,
    105,
    35,
    566,
    16,
    bold,
    8,
    { align: "center" },
  );
  rect(page, 671, 35, 136, 50, { borderWidth: 0.55 });
  page.drawImage(logo, { x: 690, y: HEIGHT - 75, width: 98, height: 32 });

  celda(page, fecha.linea, 22, 51, 310, 18, bold, 7.5);
  celda(page, `HORA: ${fecha.hora}`, 332, 51, 77, 18, bold, 7.2, { align: "center" });
  celda(page, `PABELLON: ${partido.pabellon || "—"}`, 409, 51, 262, 18, bold, 7.2);
  celda(page, "ARBITROS:", 22, 69, 58, 16, bold, 7);
  celda(page, `1º: ${partido.asignacion?.arbitro1 || "—"}   2º: ${partido.asignacion?.arbitro2 || "—"}   Crono: ${partido.asignacion?.crono || "—"}`, 80, 69, 329, 16, regular, 7);
  celda(page, partido.grupo?.nombre || "Grupo —", 409, 69, 176, 16, bold, 7, { align: "center" });
  celda(page, `Jornada ${partido.jornada || "—"}`, 585, 69, 86, 16, bold, 7, { align: "center" });
  return { fecha, nombreLocal, nombreVisitante };
}

function dibujarPlantilla(page, equipo, filas, etiqueta, x, top, width, regular, bold) {
  const equipoWidth = 77;
  const dorsalWidth = 30;
  const checkWidth = 19;
  const nombreWidth = width - dorsalWidth - checkWidth;
  celda(page, etiqueta, x, top, equipoWidth, 16, bold, 7, { fill: LIGHT, align: "center" });
  celda(page, equipo, x + equipoWidth, top, width - equipoWidth, 16, bold, 7, { fill: LIGHT, align: "center" });
  celda(page, "NOMBRE Y APELLIDOS", x, top + 16, nombreWidth, 16, bold, 6.5, { fill: PALE, align: "center" });
  celda(page, "Nº", x + nombreWidth, top + 16, dorsalWidth, 16, bold, 6.5, { fill: PALE, align: "center" });
  celda(page, "✓", x + nombreWidth + dorsalWidth, top + 16, checkWidth, 16, bold, 7, { fill: PALE, align: "center" });

  const rowHeight = 14.2;
  for (let index = 0; index < 23; index += 1) {
    const fila = filas[index];
    const y = top + 32 + index * rowHeight;
    const fill = index % 2 ? PALE : undefined;
    celda(page, fila?.nombre || "", x, y, nombreWidth, rowHeight, regular, 6.7, { fill, padding: 3 });
    celda(page, fila?.dorsal ?? "", x + nombreWidth, y, dorsalWidth, rowHeight, regular, 6.6, { fill, align: "center" });
    celda(page, "", x + nombreWidth + dorsalWidth, y, checkWidth, rowHeight, regular, 6, { fill });
  }
  const footerTop = top + 32 + 23 * rowHeight;
  celda(page, "Pagado", x, footerTop, width / 2, 24, regular, 7, { align: "center" });
  celda(page, "Saca", x + width / 2, footerTop, width / 2, 24, regular, 7, { align: "center" });
}

function dibujarParte(page, x, top, width, titulo, regular, bold) {
  const cols = [44, 37, 39, width - 120];
  celda(page, titulo, x, top, width, 16, bold, 7.2, { fill: LIGHT, align: "center" });
  ["Minutos", "Dorsal", "Equipo", "Accion"].forEach((header, index) => {
    const left = x + cols.slice(0, index).reduce((sum, size) => sum + size, 0);
    celda(page, header, left, top + 16, cols[index], 16, bold, 6.2, { fill: PALE, align: "center" });
  });
  for (let index = 0; index < 23; index += 1) {
    let left = x;
    const y = top + 32 + index * 14.2;
    cols.forEach((columnWidth) => {
      celda(page, "", left, y, columnWidth, 14.2, regular, 6, { fill: index % 2 ? PALE : undefined });
      left += columnWidth;
    });
  }
  const foulTop = top + 32 + 23 * 14.2;
  celda(page, "Faltas L:  1  2  3  4 [5] 6  7  8  9", x, foulTop, width, 18, regular, 6.4);
  celda(page, "Faltas V:  1  2  3  4 [5] 6  7  8  9", x, foulTop + 18, width, 18, regular, 6.4);
}

function dibujarPrimera(page, partido, logo, escudoLocal, escudoVisitante, regular, bold, temporada) {
  const header = dibujarCabecera(page, partido, temporada, logo, regular, bold);
  const top = 96;
  const localX = 22;
  const localWidth = 222;
  const medioX = 255;
  const medioWidth = 329;
  const visitanteX = 595;
  const visitanteWidth = 212;
  dibujarPlantilla(page, header.nombreLocal, partido.plantillaLocal, "EQUIPO LOC.", localX, top, localWidth, regular, bold);
  dibujarParte(page, medioX, top, medioWidth / 2 - 3, "PRIMERA PARTE", regular, bold);
  dibujarParte(page, medioX + medioWidth / 2 + 3, top, medioWidth / 2 - 3, "SEGUNDA PARTE", regular, bold);
  dibujarPlantilla(page, header.nombreVisitante, partido.plantillaVisitante, "EQUIPO VISIT.", visitanteX, top, visitanteWidth, regular, bold);

  const escudoTop = 530;
  if (escudoLocal) page.drawImage(escudoLocal, { x: 265, y: HEIGHT - escudoTop - 34, width: 34, height: 34 });
  if (escudoVisitante) page.drawImage(escudoVisitante, { x: 543, y: HEIGHT - escudoTop - 34, width: 34, height: 34 });
  rect(page, 323, escudoTop, 81, 28);
  rect(page, 435, escudoTop, 81, 28);
  dibujarTexto(page, "RESULTADO FINAL", 420, 562, 7, bold, { align: "center" });
  linea(page, 404, 544, 435, 544, INK, 0.7);
  page.drawText(":", { x: 416, y: HEIGHT - 552, size: 12, font: bold, color: INK });
}

function dibujarSegunda(page, partido, logo, escudoLocal, escudoVisitante, regular, bold, temporada) {
  const header = dibujarCabecera(page, partido, temporada, logo, regular, bold);
  celda(page, `${header.nombreLocal} VS ${header.nombreVisitante}`, 22, 96, 384, 17, bold, 7.5, { fill: LIGHT, align: "center" });
  const tablaX = 22;
  const tablaTop = 113;
  const tablaWidth = 384;
  celda(page, "PUNTOS / SANCION ECONOMICA", tablaX, tablaTop, tablaWidth, 17, bold, 7, { fill: LIGHT, align: "center" });
  const conceptos = [
    "FALTA DE DELEGADO (2 puntos) (1.50€)",
    "TARJETAS AMARILLAS (2 puntos) (1€) [Por tarjeta]",
    "ROJA DIRECTA (10 puntos) (10€) [Por tarjeta]",
    "CALZONA DE DIF. COLOR (1 punto) (1€) [Por unidad]",
    "PERDIDA DE BOT. DE AGUA (3 puntos) (5€) [Por unidad]",
  ];
  const leftWidth = 240;
  celda(page, "", tablaX, tablaTop + 17, leftWidth, 17, regular, 7, { fill: LIGHT });
  celda(page, "LOCAL", tablaX + leftWidth, tablaTop + 17, (tablaWidth - leftWidth) / 2, 17, regular, 7, { fill: LIGHT, align: "center" });
  celda(page, "VISITANTE", tablaX + leftWidth + (tablaWidth - leftWidth) / 2, tablaTop + 17, (tablaWidth - leftWidth) / 2, 17, regular, 7, { fill: LIGHT, align: "center" });
  conceptos.forEach((concepto, index) => {
    const y = tablaTop + 34 + index * 16;
    celda(page, concepto, tablaX, y, leftWidth, 16, regular, 6.3, { fill: index % 2 ? PALE : undefined });
    celda(page, "", tablaX + leftWidth, y, (tablaWidth - leftWidth) / 2, 16, regular, 6);
    celda(page, "", tablaX + leftWidth + (tablaWidth - leftWidth) / 2, y, (tablaWidth - leftWidth) / 2, 16, regular, 6);
  });
  celda(page, "TOTALES", tablaX, tablaTop + 114, tablaWidth, 16, bold, 7, { fill: LIGHT, align: "center" });

  const leyendaX = 535;
  const leyendaWidth = 272;
  celda(page, "LEYENDA", leyendaX, 96, leyendaWidth, 17, bold, 7, { fill: LIGHT, align: "center" });
  rect(page, leyendaX, 113, leyendaWidth, 108, { color: PALE });
  dibujarTexto(page, "Acronimos: (G) Gol - (A) Amarilla - (R) Roja - (TM1/TM2)", leyendaX + 8, 122, 7, regular);
  dibujarTexto(page, "Tiempo Muerto - (P) Penalti - (E1/E2) Entrenadores", leyendaX + 8, 136, 7, regular);
  ["Minutos", "Dorsal", "Equipo", "Accion"].forEach((label, index) =>
    celda(page, label, leyendaX + 8 + index * 64, 154, 64, 16, regular, 5.6, { fill: LIGHT, align: "center" })
  );
  dibujarTexto(page, "Explicacion", leyendaX + 8, 179, 7, regular);
  dibujarTexto(page, "Describa aqui cualquier incidencia del partido.", leyendaX + 8, 195, 6.6, regular, { maxWidth: leyendaWidth - 16 });

  dibujarTexto(page, "INCIDENCIA:", 22, 254, 8, bold);
  for (let index = 0; index < 6; index += 1) linea(page, 22, 281 + index * 29, 807, 281 + index * 29, rgb(0.55, 0.55, 0.55), 0.4);

  const penaltiesTop = 463;
  celda(page, "EQUIPOS", 22, penaltiesTop, 175, 17, bold, 6.8, { fill: LIGHT, align: "center" });
  celda(page, "Empieza", 197, penaltiesTop, 58, 17, regular, 6.5, { fill: LIGHT, align: "center" });
  for (let index = 1; index <= 9; index += 1) {
    celda(page, String(index), 255 + (index - 1) * 31, penaltiesTop, 31, 17, regular, 6.5, { fill: LIGHT, align: "center" });
  }
  [header.nombreLocal, header.nombreVisitante].forEach((nombre, row) => {
    const y = penaltiesTop + 17 + row * 17;
    celda(page, nombre, 22, y, 175, 17, regular, 6.4, { fill: row ? PALE : undefined });
    celda(page, "", 197, y, 58, 17, regular, 6, { fill: row ? PALE : undefined });
    for (let index = 0; index < 9; index += 1) celda(page, "", 255 + index * 31, y, 31, 17, regular, 6, { fill: row ? PALE : undefined });
  });
  celda(page, "GANADOR RONDA PENALTIS", 632, penaltiesTop, 175, 17, bold, 6.5, { fill: LIGHT, align: "center" });
  rect(page, 632, penaltiesTop + 17, 175, 34);

  const escudoTop = 543;
  if (escudoLocal) page.drawImage(escudoLocal, { x: 267, y: HEIGHT - escudoTop - 29, width: 29, height: 29 });
  if (escudoVisitante) page.drawImage(escudoVisitante, { x: 546, y: HEIGHT - escudoTop - 29, width: 29, height: 29 });
  rect(page, 323, escudoTop, 81, 27);
  rect(page, 435, escudoTop, 81, 27);
  page.drawText(":", { x: 416, y: HEIGHT - escudoTop - 20, size: 12, font: bold, color: INK });
  dibujarTexto(page, "RESULTADO FINAL", 420, 572, 6.5, bold, { align: "center" });
}

export async function generarActaPdf(partido, temporada) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await cargarLogo(pdf);
  const [escudoLocal, escudoVisitante] = await Promise.all([
    imagenEscudo(pdf, partido.local?.escudo_url),
    imagenEscudo(pdf, partido.visitante?.escudo_url),
  ]);
  const primera = pdf.addPage([WIDTH, HEIGHT]);
  const segunda = pdf.addPage([WIDTH, HEIGHT]);
  dibujarPrimera(primera, partido, logo, escudoLocal, escudoVisitante, regular, bold, temporada);
  dibujarSegunda(segunda, partido, logo, escudoLocal, escudoVisitante, regular, bold, temporada);
  return pdf.save();
}

export function nombreArchivoActa(partido) {
  const { anio, mes, dia } = fechaMadrid(partido.fecha);
  const hora = fechaMadrid(partido.fecha).hora.replace(":", "_");
  const jornada = partido.jornada ? `J${partido.jornada}` : "Sin_jornada";
  const grupo = partido.grupo?.nombre || "Grupo";
  const limpio = (value) => textoPdf(value).replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");
  return `Actas_${anio}_${mes}_${dia}_${hora}_${limpio(jornada)}_${limpio(grupo)}.pdf`;
}
