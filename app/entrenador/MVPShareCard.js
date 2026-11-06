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

function panel(ctx, x, y, ancho, alto, radio = 28, relleno = "rgba(15, 47, 78, 0.82)", borde = "rgba(233, 51, 70, 0.9)", grosor = 4) {
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, radio);
  ctx.fillStyle = relleno;
  ctx.fill();
  ctx.lineWidth = grosor;
  ctx.strokeStyle = borde;
  ctx.stroke();
}

function linea(ctx, x, y, ancho, color = ROJO, grosor = 5) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, ancho, grosor);
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
      fondo.addColorStop(0, "#07152e");
      fondo.addColorStop(0.48, "#123b68");
      fondo.addColorStop(1, "#071a37");
      ctx.fillStyle = fondo;
      ctx.fillRect(0, 0, ANCHO, ALTO);

      const luz = ctx.createRadialGradient(550, 630, 30, 550, 630, 800);
      luz.addColorStop(0, "rgba(40,132,205,.27)");
      luz.addColorStop(1, "rgba(5,20,45,0)");
      ctx.fillStyle = luz;
      ctx.fillRect(0, 0, ANCHO, ALTO);
      ctx.fillStyle = "rgba(255,255,255,.035)";
      for (let i = -700; i < 1800; i += 190) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 65, 0);
        ctx.lineTo(i + 780, ALTO);
        ctx.lineTo(i + 715, ALTO);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "rgba(197,31,50,.34)";
      ctx.beginPath();
      ctx.moveTo(0, 460);
      ctx.lineTo(22, 440);
      ctx.lineTo(700, ALTO);
      ctx.lineTo(620, ALTO);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(132,202,255,.16)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(540, 940, 470, 730, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(540, 940, 380, 640, 0, 0, Math.PI * 2);
      ctx.stroke();

      const logo = await cargarImagen("/logo-llfs.png");
      if (logo) ctx.drawImage(logo, 74, 52, 150, 78);
      ctx.fillStyle = "#d7e8f7";
      ctx.font = "700 24px system-ui, sans-serif";
      ctx.fillText("LIGA LOCAL DE", 246, 78);
      ctx.fillStyle = "#fff";
      ctx.font = "800 31px system-ui, sans-serif";
      ctx.fillText("PUERTO REAL", 246, 117);
      linea(ctx, 64, 158, 952, ROJO, 7);

      ctx.fillStyle = "rgba(197,31,50,.18)";
      ctx.beginPath();
      ctx.roundRect(66, 196, 265, 55, 18);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(240, 70, 88, 0.95)";
      ctx.stroke();
      ctx.fillStyle = "#ffb5bd";
      ctx.font = "800 22px system-ui, sans-serif";
      ctx.fillText("RECONOCIMIENTO", 88, 232);

      ctx.fillStyle = "#fff";
      ctx.font = "900 61px system-ui, sans-serif";
      ctx.fillText("MVP DEL PARTIDO", 66, 337);
      linea(ctx, 68, 362, 112, ROJO, 9);

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
        panel(ctx, x, y, anchoTarjeta, 510, 30, "rgba(14, 48, 78, 0.76)", "rgba(233, 51, 70, 0.92)", 4);
        linea(ctx, x + 224, y + 86, 126, ROJO, 6);

        const escudo = candidato.equipo?.id
          ? await cargarImagen(`/api/mvp/escudo?equipo=${encodeURIComponent(candidato.equipo.id)}`)
          : null;
        if (candidato.equipo?.escudo_url && !escudo) escudoNoDisponible = true;
        if (escudo) {
          const ratio = Math.min(150 / escudo.width, 112 / escudo.height);
          const anchoEscudo = escudo.width * ratio;
          const altoEscudo = escudo.height * ratio;
          const xEscudo = x + 46;
          const yEscudo = y + (150 - altoEscudo) / 2 + 16;
          ctx.beginPath();
          ctx.arc(x + 160, y + 95, 86, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(255,255,255,.75)";
          ctx.stroke();
          ctx.save();
          ctx.beginPath();
          ctx.arc(x + 160, y + 95, 72, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(escudo, xEscudo, yEscudo, anchoEscudo, altoEscudo);
          ctx.restore();
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath();
          ctx.arc(x + 160, y + 95, 82, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = ROJO;
          ctx.beginPath();
          ctx.roundRect(x + 152, y + 53, 16, 86, 8);
          ctx.fill();
        }

        ctx.fillStyle = "#d7e8f7";
        ctx.font = "700 23px system-ui, sans-serif";
        texto(ctx, candidato.equipo?.nombre || "Equipo", x + 234, y + 94, 660);

        const jugador = candidato.mvp?.jugador;
        const foto = jugador?.foto ? await cargarImagen(jugador.foto) : null;
        ctx.fillStyle = "rgba(255,255,255,.17)";
        ctx.beginPath();
        ctx.arc(x + 165, y + 350, 94, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.75)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x + 165, y + 350, 94, 0, Math.PI * 2);
        ctx.stroke();
        if (circulo(ctx, foto, x + 165, y + 350, 86)) {
          ctx.strokeStyle = "rgba(255,255,255,.8)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(x + 165, y + 350, 90, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#fff";
          ctx.font = "800 48px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(jugador?.nombre?.slice(0, 1) || "?", x + 165, y + 367);
          ctx.textAlign = "start";
        }
        ctx.fillStyle = "#ffd166";
        ctx.font = "800 20px system-ui, sans-serif";
        ctx.fillText(jugador ? "MVP ELEGIDO POR EL EQUIPO RIVAL" : "MVP PENDIENTE DE SELECCIÓN", x + 300, y + 332);
        ctx.fillStyle = "#ffffff";
        ctx.font = "850 40px system-ui, sans-serif";
        texto(ctx, jugador?.nombre || "Aún no seleccionado", x + 300, y + 391, 600);
      }

      linea(ctx, 64, 1650, 952, ROJO, 5);
      ctx.fillStyle = "#d7e8f7";
      ctx.font = "650 23px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LIGA LOCAL DE FÚTBOL SALA", ANCHO / 2, 1742);
      ctx.fillStyle = ROJO;
      ctx.fillRect(64, 1770, 952, 4);
      ctx.fillStyle = "#fff";
      ctx.font = "650 19px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("llfspuertoreal.es", 78, 1828);
      ctx.textAlign = "center";
      ctx.fillText("Instagram  @dlfsptoreal", ANCHO / 2, 1828);
      ctx.textAlign = "right";
      ctx.fillText("YouTube  LLFS Puerto Real", 1002, 1828);
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
        <p>Formato vertical 9:16 con escudos, logo LLFS, jornada, rivales y redes sociales oficiales.</p>
      </div>
      <button type="button" className="primario" disabled={descargando} onClick={descargar}>
        {descargando ? "Creando imagen…" : "Descargar imagen PNG"}
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
