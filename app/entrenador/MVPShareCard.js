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

function panel(ctx, x, y, ancho, alto) {
  const relleno = ctx.createLinearGradient(0, y, 0, y + alto);
  relleno.addColorStop(0, "rgba(23, 58, 106, 0.9)");
  relleno.addColorStop(1, "rgba(16, 42, 82, 0.9)");

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, 28);
  ctx.shadowColor = "rgba(0, 5, 18, 0.55)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = relleno;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.save();
  ctx.clip();
  ctx.fillStyle = ROJO;
  ctx.fillRect(x, y, ancho, 10);
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, ancho - 2, alto - 2, 27);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(155, 191, 235, 0.38)";
  ctx.stroke();
  ctx.restore();
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

      const fondo = ctx.createLinearGradient(0, 0, 0, ALTO);
      fondo.addColorStop(0, "#0B1F3F");
      fondo.addColorStop(1, "#06122A");
      ctx.fillStyle = fondo;
      ctx.fillRect(0, 0, ANCHO, ALTO);

      const resplandorSuperior = ctx.createRadialGradient(540, 300, 0, 540, 300, 650);
      resplandorSuperior.addColorStop(0, "rgba(42, 110, 190, 0.16)");
      resplandorSuperior.addColorStop(1, "rgba(42, 110, 190, 0)");
      ctx.fillStyle = resplandorSuperior;
      ctx.fillRect(0, 0, ANCHO, ALTO);

      const resplandorMvp = ctx.createRadialGradient(540, 1325, 0, 540, 1325, 680);
      resplandorMvp.addColorStop(0, "rgba(42, 110, 190, 0.4)");
      resplandorMvp.addColorStop(1, "rgba(42, 110, 190, 0)");
      ctx.fillStyle = resplandorMvp;
      ctx.fillRect(0, 0, ANCHO, ALTO);

      const grano = document.createElement("canvas");
      grano.width = 360;
      grano.height = 640;
      const granoCtx = grano.getContext("2d");
      if (granoCtx) {
        const textura = granoCtx.createImageData(grano.width, grano.height);
        for (let i = 0; i < textura.data.length; i += 4) {
          const tono = Math.random() < 0.5 ? 255 : 0;
          textura.data[i] = tono;
          textura.data[i + 1] = tono;
          textura.data[i + 2] = tono;
          textura.data[i + 3] = 8;
        }
        granoCtx.putImageData(textura, 0, 0);
        ctx.drawImage(grano, 0, 0, ANCHO, ALTO);
      }

      const logo = await cargarImagen("/logo-llfs.png");
      if (logo) ctx.drawImage(logo, 74, 52, 150, 78);
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "700 24px Inter, system-ui, sans-serif";
      ctx.fillText("LIGA LOCAL DE", 246, 78);
      ctx.fillStyle = "#fff";
      ctx.font = "800 31px Inter, system-ui, sans-serif";
      ctx.fillText("PUERTO REAL", 246, 117);
      linea(ctx, 64, 158, 952, ROJO, 7);

      ctx.fillStyle = "rgba(201, 216, 238, 0.1)";
      ctx.beginPath();
      ctx.roundRect(66, 196, 265, 55, 18);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(201, 216, 238, 0.24)";
      ctx.stroke();
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "800 22px Inter, system-ui, sans-serif";
      ctx.fillText("RECONOCIMIENTO", 88, 232);

      ctx.fillStyle = "#fff";
      ctx.font = "900 61px Inter, system-ui, sans-serif";
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
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "600 26px Inter, system-ui, sans-serif";
      ctx.fillText(`JORNADA ${partido.jornada || "—"}  ·  ${fechaPartido}`, 68, 418);
      ctx.fillStyle = "#fff";
      ctx.font = "750 32px Inter, system-ui, sans-serif";
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
        panel(ctx, x, y, anchoTarjeta, 510);
        linea(ctx, x + 224, y + 112, 126, ROJO, 6);

        const escudo = candidato.equipo?.id
          ? await cargarImagen(`/api/mvp/escudo?equipo=${encodeURIComponent(candidato.equipo.id)}`)
          : null;
        if (candidato.equipo?.escudo_url && !escudo) escudoNoDisponible = true;
        if (escudo) {
          const ratio = Math.min(118 / escudo.width, 120 / escudo.height);
          const anchoEscudo = escudo.width * ratio;
          const altoEscudo = escudo.height * ratio;
          const xEscudo = x + 76;
          const yEscudo = y + 35 + (120 - altoEscudo) / 2;
          ctx.save();
          ctx.shadowColor = "rgba(0, 8, 24, 0.38)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
          ctx.drawImage(escudo, xEscudo, yEscudo, anchoEscudo, altoEscudo);
          ctx.restore();
        }

        ctx.fillStyle = "#C9D8EE";
        ctx.font = "700 23px Inter, system-ui, sans-serif";
        texto(ctx, candidato.equipo?.nombre || "Equipo", x + 234, y + 94, 660);

        const jugador = candidato.mvp?.jugador;
        const foto = jugador?.foto ? await cargarImagen(jugador.foto) : null;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + 165, y + 350, 92, 0, Math.PI * 2);
        ctx.shadowColor = "rgba(42, 110, 190, 0.78)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = "rgba(42, 110, 190, 0.2)";
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.beginPath();
        ctx.arc(x + 165, y + 350, 94, 0, Math.PI * 2);
        ctx.fill();
        if (circulo(ctx, foto, x + 165, y + 350, 86)) {
          ctx.strokeStyle = "#DCEAFF";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x + 165, y + 350, 87.5, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          if (jugador) {
            dibujarAvatar(ctx, x + 165, y + 350, 70);
          } else {
            ctx.fillStyle = "#fff";
            ctx.font = "800 48px Inter, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("?", x + 165, y + 367);
            ctx.textAlign = "start";
          }
        }
        ctx.fillStyle = "#FFC940";
        ctx.font = "800 20px Inter, system-ui, sans-serif";
        ctx.fillText(jugador ? "MVP ELEGIDO POR EL EQUIPO RIVAL" : "MVP PENDIENTE DE SELECCIÓN", x + 300, y + 332);
        ctx.fillStyle = "#ffffff";
        ctx.font = "850 40px Inter, system-ui, sans-serif";
        texto(ctx, jugador?.nombre || "Aún no seleccionado", x + 300, y + 391, 600);
      }

      linea(ctx, 64, 1650, 952, ROJO, 5);
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "650 23px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LIGA LOCAL DE FÚTBOL SALA", ANCHO / 2, 1742);
      ctx.fillStyle = ROJO;
      ctx.fillRect(64, 1770, 952, 4);
      ctx.fillStyle = "#fff";
      ctx.font = "650 19px Inter, system-ui, sans-serif";
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
