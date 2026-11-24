"use client";

import { useState } from "react";
import { marcarSegundasAmarillas } from "../../lib/tarjetas";

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

function textoAjustado(ctx, valor, x, y, maximo) {
  let salida = valor || "";
  while (salida && ctx.measureText(salida).width > maximo) salida = `${salida.slice(0, -2)}…`;
  ctx.fillText(salida, x, y);
}

function linea(ctx, x, y, ancho, grosor = 5) {
  ctx.fillStyle = ROJO;
  ctx.fillRect(x, y, ancho, grosor);
}

export default function ResumenActaCard({ partido, local, visitante, eventos, mvpLocal = null, mvpVisitante = null, children }) { 
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

      const resplandor = ctx.createRadialGradient(540, 860, 0, 540, 860, 850);
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
      linea(ctx, 64, 158, 952, 7);

      ctx.fillStyle = "#C9D8EE";
      ctx.font = "800 23px Inter, system-ui, sans-serif";
      ctx.fillText(`ACTA DIGITAL  ·  JORNADA ${partido.jornada || "—"}  ·  ${partido.grupo?.nombre || "—"}`, 68, 232);
      ctx.fillStyle = "#fff";
      ctx.font = "900 55px Inter, system-ui, sans-serif";
      textoAjustado(ctx, "RESUMEN DEL ENCUENTRO", 68, 322, 944);

      const fechaPartido = partido.fecha
        ? new Date(partido.fecha).toLocaleDateString("es-ES", {
          timeZone: "Europe/Madrid",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        : "Fecha no disponible";
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "600 28px Inter, system-ui, sans-serif";
      ctx.fillText(fechaPartido, 68, 378);
      linea(ctx, 68, 408, 112, 8);

      const [escudoLocal, escudoVisitante] = await Promise.all([
        local?.id ? cargarImagen(`/api/mvp/escudo?equipo=${encodeURIComponent(local.id)}`) : null,
        visitante?.id ? cargarImagen(`/api/mvp/escudo?equipo=${encodeURIComponent(visitante.id)}`) : null,
      ]);
      const escudoNoDisponible = (local?.escudo_url && !escudoLocal) || (visitante?.escudo_url && !escudoVisitante);
      for (const [equipo, escudo, x] of [
        [local, escudoLocal, 300],
        [visitante, escudoVisitante, 780],
      ]) {
        if (escudo) {
          const ratio = Math.min(150 / escudo.width, 150 / escudo.height);
          const anchoEscudo = escudo.width * ratio;
          const altoEscudo = escudo.height * ratio;
          ctx.drawImage(escudo, x - anchoEscudo / 2, 570 - altoEscudo / 2, anchoEscudo, altoEscudo);
        }
        ctx.fillStyle = "#fff";
        ctx.font = "750 30px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        textoAjustado(ctx, equipo?.nombre || "Equipo", x, 690, 390);
      }
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "850 34px Inter, system-ui, sans-serif";
      ctx.fillText("VS", ANCHO / 2, 580);

      const golesLocal = eventos.filter((evento) => evento.tipo === "gol" && evento.equipo_id === partido.local_id).length;
      const golesVisitante = eventos.filter((evento) => evento.tipo === "gol" && evento.equipo_id === partido.visitante_id).length;
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.beginPath();
      ctx.roundRect(120, 790, 840, 300, 30);
      ctx.fill();
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "800 23px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("RESULTADO", ANCHO / 2, 860);
      ctx.fillStyle = "#fff";
      ctx.font = "900 126px Inter, system-ui, sans-serif";
      ctx.fillText(`${golesLocal}  :  ${golesVisitante}`, ANCHO / 2, 1010);
      ctx.textAlign = "start";

      const eventosMarcados = marcarSegundasAmarillas(eventos);
      const amarillas = eventosMarcados.filter((evento) => evento.tipo === "amarilla").length;
      const rojas = eventosMarcados.filter((evento) => evento.tipo === "roja" || evento.segundaAmarilla).length;
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "800 24px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("TARJETAS REGISTRADAS", ANCHO / 2, 1230);

      for (const tarjeta of [
        { x: 120, etiqueta: "AMARILLAS", total: amarillas, color: "#FFC940" },
        { x: 560, etiqueta: "ROJAS", total: rojas, color: "#FF6B6B" },
      ]) {
        ctx.fillStyle = "rgba(255,255,255,.08)";
        ctx.beginPath();
        ctx.roundRect(tarjeta.x, 1280, 400, 245, 24);
        ctx.fill();
        ctx.fillStyle = tarjeta.color;
        ctx.font = "900 96px Inter, system-ui, sans-serif";
        ctx.fillText(String(tarjeta.total), tarjeta.x + 200, 1400);
        ctx.fillStyle = "#fff";
        ctx.font = "750 22px Inter, system-ui, sans-serif";
        ctx.fillText(tarjeta.etiqueta, tarjeta.x + 200, 1470);
      }
      ctx.textAlign = "start";

      ctx.fillStyle = "#C9D8EE";
      ctx.font = "800 24px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("MVP DEL PARTIDO", ANCHO / 2, 1575);
      for (const mvp of [
        { equipo: local, jugador: mvpLocal, x: 64 },
        { equipo: visitante, jugador: mvpVisitante, x: 556 },
      ]) {
        ctx.fillStyle = "rgba(255,255,255,.08)";
        ctx.beginPath();
        ctx.roundRect(mvp.x, 1600, 460, 125, 20);
        ctx.fill();
        ctx.fillStyle = "#C9D8EE";
        ctx.font = "650 18px Inter, system-ui, sans-serif";
        textoAjustado(ctx, `MVP de ${mvp.equipo?.nombre || "equipo"}`, mvp.x + 230, 1640, 420);
        ctx.fillStyle = "#fff";
        ctx.font = "800 26px Inter, system-ui, sans-serif";
        textoAjustado(ctx, mvp.jugador?.nombre || "Aún no seleccionado", mvp.x + 230, 1685, 420);
      }

      linea(ctx, 64, 1750, 952);
      ctx.fillStyle = "#C9D8EE";
      ctx.font = "650 25px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LIGA LOCAL DE FÚTBOL SALA · PUERTO REAL", ANCHO / 2, 1810);
      ctx.fillStyle = "#fff";
      ctx.font = "600 18px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("llfspuertoreal.es", 78, 1860);
      ctx.textAlign = "center";
      ctx.fillText("Instagram  @dlfsptoreal", ANCHO / 2, 1860);
      ctx.textAlign = "right";
      ctx.fillText("YouTube  LLFS Puerto Real", 1002, 1860);
      ctx.textAlign = "start";

      if (escudoNoDisponible) {
        setError("No se pudo cargar algún escudo. Comprueba CLUPIK_IMAGE_HOSTS en la configuración del servidor.");
      }
      const imagen = await new Promise((resolve, reject) => canvas.toBlob((blob) =>
        blob ? resolve(blob) : reject(new Error("No se pudo generar el archivo de imagen.")), "image/png"));
      const url = URL.createObjectURL(imagen);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `resumen-acta-jornada-${partido.jornada || "partido"}-${partido.id}.png`;
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
        <h2>Resumen del encuentro</h2>
        <p>Imagen vertical 9:16 con el resultado del acta y el resumen de tarjetas.</p>
      </div>
      <div className="acta-resumen-acciones">
        <button type="button" className="acta-descargar-resumen" disabled={descargando} onClick={descargar}>
          {descargando ? "Creando imagen…" : "Descargar resumen"}
        </button>
        {children}
      </div>
      {error && <p className="error" role="status">{error}</p>}
    </section>
  );
}
