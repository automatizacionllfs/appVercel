"use client";

import { useState } from "react";

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

function panel(ctx, x, y, ancho, alto) {
  const relleno = ctx.createLinearGradient(0, y, 0, y + alto);
  relleno.addColorStop(0, "rgba(23, 58, 106, 0.94)");
  relleno.addColorStop(1, "rgba(16, 42, 82, 0.94)");
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, 30);
  ctx.fillStyle = relleno;
  ctx.fill();
  ctx.fillStyle = ROJO;
  ctx.fillRect(x, y, ancho, 9);
  ctx.strokeStyle = "rgba(155, 191, 235, 0.38)";
  ctx.lineWidth = 2;
  ctx.stroke();
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
      ctx.fillStyle = ROJO;
      ctx.fillRect(64, 158, 952, 7);

      ctx.fillStyle = "#fff";
      ctx.font = "900 58px Inter, system-ui, sans-serif";
      ctx.fillText("GOLEADOR DE LA JORNADA", 64, 285);
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "700 30px Inter, system-ui, sans-serif";
      ctx.fillText(`JORNADA ${jornada}`, 68, 342);

      panel(ctx, 64, 410, 952, 1200);
      const foto = jugador.foto ? await cargarImagen(jugador.foto) : null;
      const escudo = jugador.equipoId
        ? await cargarImagen(`/api/mvp/escudo?equipo=${encodeURIComponent(jugador.equipoId)}`)
        : null;
      if (jugador.escudoUrl && !escudo) {
        setError("No se pudo cargar el escudo del equipo. Comprueba CLUPIK_IMAGE_HOSTS en la configuración del servidor.");
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(540, 760, 170, 0, Math.PI * 2);
      ctx.clip();
      if (foto) {
        ctx.drawImage(foto, 370, 590, 340, 340);
      } else {
        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "800 120px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(jugador.nombre.slice(0, 1) || "?", 540, 802);
        ctx.textAlign = "start";
      }
      ctx.restore();

      ctx.fillStyle = "#fff";
      ctx.font = "850 52px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      texto(ctx, jugador.nombre, 540, 1050, 880);
      ctx.textAlign = "start";

      if (escudo) {
        const ratio = Math.min(72 / escudo.width, 72 / escudo.height);
        const anchoEscudo = escudo.width * ratio;
        const altoEscudo = escudo.height * ratio;
        ctx.drawImage(escudo, 310, 1100 + (72 - altoEscudo) / 2, anchoEscudo, altoEscudo);
      }
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "650 30px Inter, system-ui, sans-serif";
      texto(ctx, jugador.equipo, 410, 1145, 550);

      ctx.fillStyle = "rgba(255,255,255,.09)";
      ctx.beginPath();
      ctx.roundRect(100, 1270, 880, 210, 26);
      ctx.fill();
      ctx.fillStyle = "#FFC940";
      ctx.font = "900 112px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(jugador.goles), 330, 1410);
      ctx.fillStyle = "#fff";
      ctx.font = "750 30px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(jugador.goles === 1 ? "GOL EN LA JORNADA" : "GOLES EN LA JORNADA", 460, 1400);

      ctx.fillStyle = ROJO;
      ctx.fillRect(64, 1720, 952, 4);
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "650 25px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LIGA LOCAL DE FÚTBOL SALA · PUERTO REAL", ANCHO / 2, 1800);
      ctx.fillStyle = "#fff";
      ctx.font = "600 21px Inter, system-ui, sans-serif";
      ctx.fillText("llfspuertoreal.es  ·  Instagram @dlfsptoreal", ANCHO / 2, 1850);
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
        {descargando ? "Creando tarjeta…" : "Descargar Card"}
      </button>
      {error && <p className="error" role="status">{error}</p>}
    </div>
  );
}
