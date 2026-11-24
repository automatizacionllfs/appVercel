"use client";

import { useState } from "react";
import { dibujarAvatar } from "../lib/avatar-canvas";

const ANCHO = 1080;
const ALTO = 1920;
const ROJO = "#C8202F";

function cargarImagen(src) {
  return new Promise((resolve) => {
    const imagen = new Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => resolve(null);
    imagen.src = src;
  });
}

function texto(ctx, valor, x, y, maximo) {
  let salida = valor || "";
  while (salida && ctx.measureText(salida).width > maximo) salida = `${salida.slice(0, -2)}…`;
  ctx.fillText(salida, x, y);
}

function fotoSuperior(ctx, foto, x, y, ancho, alto) {
  // x, y, ancho, alto = recuadro completo
  const fy = y + 9;            // debajo de la franja roja
  const fh = 640;              // alto de la zona de foto
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, 30);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(x, fy, ancho, fh);
  ctx.clip();

  if (foto) {
    // "cover" con el recorte desplazado hacia arriba para no cortar la cara
    const escala = Math.max(ancho / foto.width, fh / foto.height);
    const dw = foto.width * escala;
    const dh = foto.height * escala;
    const sobrante = dh - fh;
    ctx.drawImage(foto, x + (ancho - dw) / 2, fy - sobrante * 0.2, dw, dh);
  } else {
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(x, fy, ancho, fh);
  }

  // Fundido inferior hacia el color del panel
  const fundido = ctx.createLinearGradient(0, fy + fh - 300, 0, fy + fh);
  fundido.addColorStop(0, "rgba(19, 49, 94, 0)");
  fundido.addColorStop(1, "rgba(19, 49, 94, 1)");
  ctx.fillStyle = fundido;
  ctx.fillRect(x, fy + fh - 300, ancho, 300);
  ctx.restore();
}

function panel(ctx, x, y, ancho, alto) {
  const relleno = ctx.createLinearGradient(0, y, 0, y + alto);
  relleno.addColorStop(0, "rgba(23, 58, 106, 0.9)");
  relleno.addColorStop(1, "rgba(16, 42, 82, 0.9)");
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, 30);
  ctx.shadowColor = "rgba(0, 5, 18, 0.55)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = relleno;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, 30);
  ctx.clip();
  ctx.fillStyle = ROJO;
  ctx.fillRect(x, y, ancho, 9);
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, ancho - 2, alto - 2, 29);
  ctx.strokeStyle = "rgba(155, 191, 235, 0.38)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function linea(ctx, x, y, ancho, color = ROJO, grosor = 5) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, ancho, grosor);
}

export default function GoleadorJornadaCard({ jornada, jugador }) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState("");

  async function descargar() {
    setDescargando(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = ANCHO;
      canvas.height = ALTO;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Este navegador no permite crear la imagen.");

      const fondo = ctx.createLinearGradient(0, 0, 0, ALTO);
      fondo.addColorStop(0, "#0B1F3F");
      fondo.addColorStop(1, "#06122A");
      ctx.fillStyle = fondo;
      ctx.fillRect(0, 0, ANCHO, ALTO);

      const resplandor = ctx.createRadialGradient(540, 900, 0, 540, 900, 800);
      resplandor.addColorStop(0, "rgba(42, 110, 190, 0.34)");
      resplandor.addColorStop(1, "rgba(42, 110, 190, 0)");
      ctx.fillStyle = resplandor;
      ctx.fillRect(0, 0, ANCHO, ALTO);

      const logo = await cargarImagen("/logo-llfs.png");
      if (logo) ctx.drawImage(logo, 74, 52, 150, 78);
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "700 24px Inter, system-ui, sans-serif";
      ctx.fillText("LIGA LOCAL DE", 246, 78);
      ctx.fillStyle = "#fff";
      ctx.font = "800 31px Inter, system-ui, sans-serif";
      ctx.fillText("PUERTO REAL", 246, 117);
      linea(ctx, 64, 158, 952, ROJO, 7);

      ctx.fillStyle = "#fff";
      ctx.font = "900 58px Inter, system-ui, sans-serif";
      ctx.fillText("GOLEADOR DE LA JORNADA", 64, 285);
      linea(ctx, 68, 308, 112, ROJO, 9);
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "700 30px Inter, system-ui, sans-serif";
      ctx.fillText(`JORNADA ${jornada}`, 68, 342);

            const px = 64;
      const py = 410;
      const pAncho = 952;
      const pAlto = 1200;

      panel(ctx, px, py, pAncho, pAlto);

      const foto = jugador.foto ? await cargarImagen(jugador.foto) : null;
      const escudo = jugador.equipoId
        ? await cargarImagen(`/api/mvp/escudo?equipo=${encodeURIComponent(jugador.equipoId)}`)
        : null;
      if (jugador.escudoUrl && !escudo) {
        setError("No se pudo cargar el escudo del equipo. Comprueba CLUPIK_IMAGE_HOSTS en la configuración del servidor.");
      }

      // Foto a todo el ancho
      fotoSuperior(ctx, foto, px, py, pAncho, pAlto);
      if (!foto) dibujarAvatar(ctx, 540, py + 330, 220);

      // Nombre
      ctx.fillStyle = "#fff";
      ctx.font = "850 54px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      texto(ctx, jugador.nombre, 540, 1085, 880);
      ctx.textAlign = "start";

      // Escudo + equipo, centrados como grupo
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "650 30px Inter, system-ui, sans-serif";
      const nombreEquipo = jugador.equipo || "";
      const anchoNombre = Math.min(ctx.measureText(nombreEquipo).width, 520);
      const tamEscudo = 72;
      const anchoGrupo = (escudo ? tamEscudo + 20 : 0) + anchoNombre;
      let gx = 540 - anchoGrupo / 2;
      if (escudo) {
        const ratio = Math.min(tamEscudo / escudo.width, tamEscudo / escudo.height);
        const aw = escudo.width * ratio;
        const ah = escudo.height * ratio;
        ctx.drawImage(escudo, gx + (tamEscudo - aw) / 2, 1130 + (tamEscudo - ah) / 2, aw, ah);
        gx += tamEscudo + 20;
      }
      texto(ctx, nombreEquipo, gx, 1180, 520);

      // Caja de goles
      ctx.fillStyle = "rgba(255,255,255,.09)";
      ctx.beginPath();
      ctx.roundRect(100, 1290, 880, 210, 26);
      ctx.fill();
      ctx.fillStyle = "#FFC940";
      ctx.font = "900 112px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(jugador.goles), 330, 1430);
      ctx.fillStyle = "#fff";
      ctx.font = "750 30px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(jugador.goles === 1 ? "GOL EN LA JORNADA" : "GOLES EN LA JORNADA", 460, 1420);
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "650 25px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LIGA LOCAL DE FÚTBOL SALA · PUERTO REAL", ANCHO / 2, 1800);
      ctx.fillStyle = "#fff";
      ctx.font = "600 19px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("llfspuertoreal.es", 78, 1850);
      ctx.textAlign = "center";
      ctx.fillText("Instagram  @dlfsptoreal", ANCHO / 2, 1850);
      ctx.textAlign = "right";
      ctx.fillText("YouTube  LLFS Puerto Real", 1002, 1850);
      ctx.textAlign = "start";

      const imagen = await new Promise((resolve, reject) => canvas.toBlob((blob) =>
        blob ? resolve(blob) : reject(new Error("No se pudo generar el archivo de imagen.")), "image/png"));
      const url = URL.createObjectURL(imagen);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `goleador-jornada-${jornada}-${jugador.jugadorId}.png`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || "No se pudo descargar la imagen.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="goleador-jornada-descarga">
      <button type="button" className="primario" disabled={descargando} onClick={descargar}>
        {descargando ? "Descargando…" : "Descargar Imagen"}
      </button>
      {error && <p className="error" role="status">{error}</p>}
    </div>
  );
}
