"use client";

import { useState } from "react";

const ANCHO = 1920;
const ALTO = 1080;
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
      ctx.arc(1730, 120, 420, 0, Math.PI * 2);
      ctx.fill();

      const logo = await cargarImagen("/logo-llfs.png");
      if (logo) ctx.drawImage(logo, 78, 42, 164, 86);
      ctx.fillStyle = "#d7e8f7";
      ctx.font = "700 26px system-ui, sans-serif";
      ctx.fillText("LIGA LOCAL DE", 274, 77);
      ctx.fillStyle = "#fff";
      ctx.font = "800 33px system-ui, sans-serif";
      ctx.fillText("PUERTO REAL", 274, 119);
      ctx.fillStyle = ROJO;
      ctx.fillRect(78, 158, 1764, 7);

      ctx.fillStyle = "rgba(197,31,50,.18)";
      ctx.beginPath();
      ctx.roundRect(80, 207, 265, 55, 18);
      ctx.fill();
      ctx.fillStyle = "#ffb5bd";
      ctx.font = "800 22px system-ui, sans-serif";
      ctx.fillText("RECONOCIMIENTO", 102, 243);

      ctx.fillStyle = "#fff";
      ctx.font = "900 72px system-ui, sans-serif";
      ctx.fillText("MVP DEL PARTIDO", 80, 353);
      ctx.fillStyle = ROJO;
      ctx.fillRect(82, 376, 112, 9);

      const fechaPartido = partido.fecha
        ? new Date(partido.fecha).toLocaleDateString("es-ES", {
          timeZone: "Europe/Madrid",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        : "Fecha no disponible";
      ctx.fillStyle = "#d7e8f7";
      ctx.font = "600 30px system-ui, sans-serif";
      ctx.fillText(`JORNADA ${partido.jornada || "—"}  ·  ${fechaPartido}`, 82, 432);
      ctx.fillStyle = "#fff";
      ctx.font = "750 39px system-ui, sans-serif";
      texto(ctx, `${partido.local?.nombre || "Local"}   VS   ${partido.visitante?.nombre || "Visitante"}`, 82, 492, 1700);

      const candidatos = [
        { equipo: partido.local, mvp: mvpLocal, x: 80 },
        { equipo: partido.visitante, mvp: mvpVisitante, x: 980 },
      ];
      let escudoNoDisponible = false;
      for (const candidato of candidatos) {
        const x = candidato.x;
        const y = 535;
        const anchoTarjeta = 860;
        ctx.fillStyle = "rgba(255,255,255,.1)";
        ctx.beginPath();
        ctx.roundRect(x, y, anchoTarjeta, 422, 28);
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
        ctx.arc(x + 430, y + 112, 78, 0, Math.PI * 2);
        ctx.fill();
        if (circulo(ctx, escudo, x + 430, y + 112, 70)) {
          ctx.strokeStyle = "rgba(255,255,255,.7)";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(x + 430, y + 112, 73, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#fff";
          ctx.font = "800 49px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(candidato.equipo?.nombre?.slice(0, 1) || "E", x + 430, y + 129);
          ctx.textAlign = "start";
        }

        ctx.fillStyle = "#d7e8f7";
        ctx.font = "700 23px system-ui, sans-serif";
        ctx.textAlign = "center";
        texto(ctx, candidato.equipo?.nombre || "Equipo", x + 430, y + 235, 740);
        ctx.textAlign = "start";

        const jugador = candidato.mvp?.jugador;
        const foto = jugador?.foto ? await cargarImagen(jugador.foto) : null;
        ctx.fillStyle = "rgba(255,255,255,.17)";
        ctx.beginPath();
        ctx.arc(x + 170, y + 326, 57, 0, Math.PI * 2);
        ctx.fill();
        if (!circulo(ctx, foto, x + 170, y + 326, 51)) {
          ctx.fillStyle = "#fff";
          ctx.font = "800 34px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(jugador?.nombre?.slice(0, 1) || "?", x + 170, y + 338);
          ctx.textAlign = "start";
        }
        ctx.fillStyle = ROJO;
        ctx.font = "800 19px system-ui, sans-serif";
        ctx.fillText(jugador ? "MVP ELEGIDO POR EL EQUIPO RIVAL" : "MVP PENDIENTE DE SELECCIÓN", x + 252, y + 307);
        ctx.fillStyle = "#fff";
        ctx.font = "850 33px system-ui, sans-serif";
        texto(ctx, jugador?.nombre || "Aún no seleccionado", x + 252, y + 358, 560);
      }

      ctx.fillStyle = ROJO;
      ctx.fillRect(78, 988, 1764, 5);
      ctx.fillStyle = "#fff";
      ctx.font = "650 22px system-ui, sans-serif";
      ctx.fillText("llfspuertoreal.es", 82, 1037);
      ctx.fillStyle = "#d7e8f7";
      ctx.font = "550 20px system-ui, sans-serif";
      ctx.fillText("Instagram  @dlfsptoreal", 505, 1037);
      ctx.fillText("YouTube  LLFS Puerto Real", 1065, 1037);
      ctx.fillStyle = ROJO;
      ctx.beginPath();
      ctx.arc(470, 1030, 6, 0, Math.PI * 2);
      ctx.arc(1030, 1030, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = "right";
      ctx.fillStyle = "#d7e8f7";
      ctx.font = "650 18px system-ui, sans-serif";
      ctx.fillText("LIGA LOCAL DE FÚTBOL SALA", 1838, 1037);
      ctx.textAlign = "start";

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
        <p>Formato 16:9 con escudos, logo LLFS, jornada, rivales y redes sociales oficiales.</p>
      </div>
      <button type="button" className="primario" disabled={descargando} onClick={descargar}>
        {descargando ? "Creando imagen…" : "Descargar imagen PNG"}
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
