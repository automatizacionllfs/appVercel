"use client";

import { useState } from "react";

const ANCHO = 1080;
const ALTO = 1920;
const ROJO = "#c51f32";

function cargarImagen(src) {
  return new Promise((resolve) => {
    const imagen = new Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => resolve(null);
    imagen.src = src;
  });
}

function texto(contexto, valor, x, y, maximo) {
  let salida = valor || "";
  while (salida && contexto.measureText(salida).width > maximo) salida = `${salida.slice(0, -2)}…`;
  contexto.fillText(salida, x, y);
}

function circulo(contexto, imagen, x, y, radio) {
  if (!imagen) return false;
  contexto.save();
  contexto.beginPath();
  contexto.arc(x, y, radio, 0, Math.PI * 2);
  contexto.clip();
  contexto.drawImage(imagen, x - radio, y - radio, radio * 2, radio * 2);
  contexto.restore();
  return true;
}

export default function MVPShareCard({ partido, mvpLocal, mvpVisitante }) {
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState(false);
  const hayMvp = mvpLocal || mvpVisitante;
  if (!hayMvp) return null;

  async function descargar() {
    setDescargando(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = ANCHO;
      canvas.height = ALTO;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Este navegador no permite crear la imagen.");

      const fondo = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
      fondo.addColorStop(0, "#00264a");
      fondo.addColorStop(1, "#124f83");
      ctx.fillStyle = fondo;
      ctx.fillRect(0, 0, ANCHO, ALTO);
      ctx.fillStyle = "rgba(255,255,255,.035)";
      ctx.beginPath();
      ctx.arc(950, 100, 360, 0, Math.PI * 2);
      ctx.fill();

      const logo = await cargarImagen("/logo-llfs.png");
      if (logo) ctx.drawImage(logo, 74, 52, 150, 78);
      ctx.fillStyle = "#d7e8f7";
      ctx.font = "700 24px system-ui, sans-serif";
      ctx.fillText("LIGA LOCAL DE", 246, 78);
      ctx.fillStyle = "#fff";
      ctx.font = "800 31px system-ui, sans-serif";
      ctx.fillText("PUERTO REAL", 246, 117);
      ctx.fillStyle = ROJO;
      ctx.fillRect(64, 158, 952, 7);

      ctx.fillStyle = "rgba(197,31,50,.18)";
      ctx.beginPath();
      ctx.roundRect(66, 196, 265, 55, 18);
      ctx.fill();
      ctx.fillStyle = "#ffb5bd";
      ctx.font = "800 22px system-ui, sans-serif";
      ctx.fillText("RECONOCIMIENTO", 88, 232);

      ctx.fillStyle = "#fff";
      ctx.font = "900 61px system-ui, sans-serif";
      ctx.fillText("MVP DEL PARTIDO", 66, 337);
      ctx.fillStyle = ROJO;
      ctx.fillRect(68, 362, 112, 9);

      const fechaPartido = partido.fecha
        ? new Date(partido.fecha).toLocaleDateString("es-ES", {
          timeZone: "Europe/Madrid",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        : "Fecha no disponible";
      ctx.fillStyle = "#d7e8f7";
      ctx.font = "600 26px system-ui, sans-serif";
      ctx.fillText(`JORNADA ${partido.jornada || "—"}  ·  ${fechaPartido}`, 68, 418);
      ctx.fillStyle = "#fff";
      ctx.font = "750 32px system-ui, sans-serif";
      texto(ctx, `${partido.local?.nombre || "Local"}   VS   ${partido.visitante?.nombre || "Visitante"}`, 68, 476, 944);

      const candidatos = [
        { equipo: partido.local, mvp: mvpLocal, y: 520 },
        { equipo: partido.visitante, mvp: mvpVisitante, y: 1070 },
      ];
      let escudoNoDisponible = false;
      for (const candidato of candidatos) {
        const x = 64;
        const y = candidato.y;
        const anchoTarjeta = 952;
        ctx.fillStyle = "rgba(255,255,255,.1)";
        ctx.beginPath();
        ctx.roundRect(x, y, anchoTarjeta, 510, 28);
        ctx.fill();
        ctx.fillStyle = ROJO;
        ctx.beginPath();
        ctx.roundRect(x, y, anchoTarjeta, 12, 6);
        ctx.fill();

        const escudo = candidato.equipo?.id
          ? await cargarImagen(`/api/mvp/escudo?equipo=${encodeURIComponent(candidato.equipo.id)}`)
          : null;
        if (candidato.equipo?.escudo_url && !escudo) escudoNoDisponible = true;
        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.beginPath();
        ctx.arc(x + 165, y + 155, 94, 0, Math.PI * 2);
        ctx.fill();
        if (circulo(ctx, escudo, x + 165, y + 155, 86)) {
          ctx.strokeStyle = "rgba(255,255,255,.7)";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(x + 165, y + 155, 90, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#fff";
          ctx.font = "800 56px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(candidato.equipo?.nombre?.slice(0, 1) || "E", x + 165, y + 174);
          ctx.textAlign = "start";
        }

        ctx.fillStyle = "#d7e8f7";
        ctx.font = "700 23px system-ui, sans-serif";
        texto(ctx, candidato.equipo?.nombre || "Equipo", x + 300, y + 140, 600);

        const jugador = candidato.mvp?.jugador;
        const foto = jugador?.foto ? await cargarImagen(jugador.foto) : null;
        ctx.fillStyle = "rgba(255,255,255,.17)";
        ctx.beginPath();
        ctx.arc(x + 165, y + 366, 82, 0, Math.PI * 2);
        ctx.fill();
        if (!circulo(ctx, foto, x + 165, y + 366, 74)) {
          ctx.fillStyle = "#fff";
          ctx.font = "800 48px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(jugador?.nombre?.slice(0, 1) || "?", x + 165, y + 383);
          ctx.textAlign = "start";
        }
        ctx.font = "800 20px system-ui, sans-serif";
        ctx.fillText(jugador ? "MVP ELEGIDO POR EL EQUIPO RIVAL" : "MVP PENDIENTE DE SELECCIÓN", x + 300, y + 342);
        ctx.fillStyle = "#000000";
        ctx.font = "850 40px system-ui, sans-serif";
        texto(ctx, jugador?.nombre || "Aún no seleccionado", x + 300, y + 405, 600);
      }

      ctx.fillStyle = ROJO;
      ctx.fillRect(64, 1650, 952, 5);
      ctx.fillStyle = "#fff";
      ctx.font = "650 25px system-ui, sans-serif";
      ctx.fillText("llfspuertoreal.es", 68, 1710);
      ctx.fillStyle = "#d7e8f7";
      ctx.font = "550 23px system-ui, sans-serif";
      ctx.fillText("Instagram  @dlfsptoreal", 68, 1765);
      ctx.fillText("YouTube  LLFS Puerto Real", 68, 1820);
      ctx.fillStyle = ROJO;
      ctx.beginPath();
      ctx.arc(46, 1757, 6, 0, Math.PI * 2);
      ctx.arc(46, 1812, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d7e8f7";
      ctx.font = "650 20px system-ui, sans-serif";
      ctx.fillText("LIGA LOCAL DE FÚTBOL SALA", 68, 1870);

      if (escudoNoDisponible) {
        setError("No se pudo cargar algún escudo. Comprueba CLUPIK_IMAGE_HOSTS en la configuración del servidor.");
      }
      const imagen = await new Promise((resolve, reject) => canvas.toBlob((blob) =>
        blob ? resolve(blob) : reject(new Error("No se pudo generar el archivo de imagen.")), "image/png"));
      const url = URL.createObjectURL(imagen);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `mvp-jornada-${partido.jornada || "partido"}-${partido.id}.png`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || "No se pudo descargar la imagen.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <section className="mvp-compartir">
      <div>
        <h2>Tarjeta para compartir</h2>
        <p>Formato vertical 9:16 con escudos, logo LLFS, jornada, rivales y redes sociales oficiales.</p>
      </div>
      <button type="button" className="primario" disabled={descargando} onClick={descargar}>
        {descargando ? "Creando imagen…" : "Descargar imagen PNG"}
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
