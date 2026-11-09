"use client";

import { useState } from "react";

const ANCHO = 1080;
const ALTO = 1350;
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

      const resplandor = ctx.createRadialGradient(540, 720, 0, 540, 720, 650);
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

      panel(ctx, 64, 410, 952, 700);
      const foto = jugador.foto ? await cargarImagen(jugador.foto) : null;
      ctx.save();
      ctx.beginPath();
      ctx.arc(540, 620, 150, 0, Math.PI * 2);
      ctx.clip();
      if (foto) {
        ctx.drawImage(foto, 390, 470, 300, 300);
      } else {
        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "800 120px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(jugador.nombre.slice(0, 1) || "?", 540, 662);
        ctx.textAlign = "start";
      }
      ctx.restore();

      ctx.fillStyle = "#fff";
      ctx.font = "850 48px Inter, system-ui, sans-serif";
      texto(ctx, jugador.nombre, 100, 835, 880);
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "650 29px Inter, system-ui, sans-serif";
      texto(ctx, jugador.equipo, 100, 887, 880);

      ctx.fillStyle = "rgba(255,255,255,.09)";
      ctx.beginPath();
      ctx.roundRect(100, 940, 880, 120, 22);
      ctx.fill();
      ctx.fillStyle = "#FFC940";
      ctx.font = "900 68px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(jugador.goles), 340, 1024);
      ctx.fillStyle = "#fff";
      ctx.font = "750 28px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(jugador.goles === 1 ? "GOL EN LA JORNADA" : "GOLES EN LA JORNADA", 430, 1018);

      ctx.fillStyle = ROJO;
      ctx.fillRect(64, 1190, 952, 4);
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "650 23px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LIGA LOCAL DE FÚTBOL SALA · PUERTO REAL", ANCHO / 2, 1250);
      ctx.fillStyle = "#fff";
      ctx.font = "600 19px Inter, system-ui, sans-serif";
      ctx.fillText("llfspuertoreal.es  ·  Instagram @dlfsptoreal", ANCHO / 2, 1290);
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
