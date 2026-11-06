"use client";

import { useState } from "react";

function cargarImagen(src) {
  return new Promise((resolve) => {
    const imagen = new Image();
    if (!src.startsWith(window.location.origin)) imagen.crossOrigin = "anonymous";
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
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Este navegador no permite crear la imagen.");
      const fondo = ctx.createLinearGradient(0, 0, 1200, 630);
      fondo.addColorStop(0, "#00264a");
      fondo.addColorStop(1, "#124f83");
      ctx.fillStyle = fondo;
      ctx.fillRect(0, 0, 1200, 630);
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.beginPath();
      ctx.arc(1100, 20, 220, 0, Math.PI * 2);
      ctx.fill();

      const logo = await cargarImagen(`${window.location.origin}/logo-llfs.png`);
      if (logo) ctx.drawImage(logo, 60, 42, 130, 68);
      ctx.fillStyle = "#d7e8f7";
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.fillText("LIGA LOCAL DE PUERTO REAL", 220, 76);
      ctx.fillStyle = "#fff";
      ctx.font = "800 40px system-ui, sans-serif";
      ctx.fillText("MVP DEL PARTIDO", 60, 166);
      ctx.font = "600 24px system-ui, sans-serif";
      const fechaPartido = partido.fecha
        ? new Date(partido.fecha).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long", year: "numeric" })
        : "Fecha no disponible";
      ctx.fillText(`Jornada ${partido.jornada || "—"} · ${fechaPartido}`, 60, 208);
      ctx.font = "750 28px system-ui, sans-serif";
      texto(ctx, `${partido.local?.nombre || "Local"}  vs  ${partido.visitante?.nombre || "Visitante"}`, 60, 264, 1080);

      const candidatos = [
        { equipo: partido.local, mvp: mvpLocal, x: 60 },
        { equipo: partido.visitante, mvp: mvpVisitante, x: 620 },
      ];
      for (const candidato of candidatos) {
        const x = candidato.x;
        const y = 310;
        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.beginPath();
        ctx.roundRect(x, y, 520, 250, 22);
        ctx.fill();
        const jugador = candidato.mvp?.jugador;
        if (jugador?.foto) {
          const foto = await cargarImagen(jugador.foto);
          if (foto) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + 92, y + 100, 58, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(foto, x + 34, y + 42, 116, 116);
            ctx.restore();
          }
        }
        ctx.fillStyle = "#d7e8f7";
        ctx.font = "700 17px system-ui, sans-serif";
        texto(ctx, candidato.equipo?.nombre || "Equipo", x + 180, y + 78, 310);
        ctx.fillStyle = "#fff";
        ctx.font = "800 27px system-ui, sans-serif";
        texto(ctx, jugador?.nombre || "MVP aún no seleccionado", x + 180, y + 126, 310);
        ctx.fillStyle = "#d7e8f7";
        ctx.font = "600 17px system-ui, sans-serif";
        ctx.fillText(jugador ? "MVP elegido por el equipo rival" : "Pendiente de selección", x + 180, y + 164);
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
        <p>Descarga una imagen conjunta con el logo LLFS, la jornada, los rivales y los MVP seleccionados.</p>
      </div>
      <button type="button" className="primario" disabled={descargando} onClick={descargar}>
        {descargando ? "Creando imagen…" : "Descargar imagen PNG"}
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
