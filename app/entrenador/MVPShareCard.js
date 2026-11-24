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

function lineasAjustadas(ctx, valor, maximo, maxLineas = 3) {
  const palabras = String(valor || "").split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && ctx.measureText(prueba).width > maximo) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    lineas.length = maxLineas;
    lineas[maxLineas - 1] = `${lineas[maxLineas - 1].slice(0, -1)}…`;
  }
  return lineas;
}

function fotoMitadDerecha(ctx, foto, x, y, ancho, alto) {
  // x, y, ancho, alto = recuadro completo del equipo
  const mitad = ancho / 2;
  const fx = x + mitad;
  const fy = y + 10; // debajo de la franja roja superior
  const fw = mitad;
  const fh = alto - 10;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, 28);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();

  if (foto) {
    // "cover": rellena toda la mitad recortando lo que sobre
    const escala = Math.max(fw / foto.width, fh / foto.height);
    const dw = foto.width * escala;
    const dh = foto.height * escala;
    ctx.drawImage(foto, fx + (fw - dw) / 2, fy + (fh - dh) / 2, dw, dh);

    // Degradado suave en el borde izquierdo para fundir con el panel
    const fundido = ctx.createLinearGradient(fx, 0, fx + 90, 0);
    fundido.addColorStop(0, "rgba(16, 42, 82, 0.9)");
    fundido.addColorStop(1, "rgba(16, 42, 82, 0)");
    ctx.fillStyle = fundido;
    ctx.fillRect(fx, fy, 90, fh);
  } else {
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(fx, fy, fw, fh);
  }
  ctx.restore();
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
        const altoTarjeta = 510;
        const izq = x + 50;      // margen izquierdo de la mitad izquierda
        const anchoIzq = 380;    // ancho útil de la mitad izquierda
        panel(ctx, x, y, anchoTarjeta, altoTarjeta);

        const jugador = candidato.mvp?.jugador;
        const foto = jugador?.foto ? await cargarImagen(jugador.foto) : null;

        // --- Mitad derecha: foto a toda la altura ---
        fotoMitadDerecha(ctx, foto, x, y, anchoTarjeta, altoTarjeta);
        if (!foto) {
          const cx = x + anchoTarjeta * 0.75;
          const cy = y + altoTarjeta / 2 + 5;
          if (jugador) {
            dibujarAvatar(ctx, cx, cy, 150);
          } else {
            ctx.fillStyle = "#fff";
            ctx.font = "800 120px Inter, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("?", cx, cy + 40);
            ctx.textAlign = "start";
          }
        }
        // Línea vertical separadora
        ctx.fillStyle = "rgba(155, 191, 235, 0.38)";
        ctx.fillRect(x + anchoTarjeta / 2 - 1, y + 10, 2, altoTarjeta - 10);

        // --- Mitad izquierda: escudo + textos ---
        const escudo = candidato.equipo?.id
          ? await cargarImagen(`/api/mvp/escudo?equipo=${encodeURIComponent(candidato.equipo.id)}`)
          : null;
        if (candidato.equipo?.escudo_url && !escudo) escudoNoDisponible = true;
        if (escudo) {
          const ratio = Math.min(120 / escudo.width, 120 / escudo.height);
          const anchoEscudo = escudo.width * ratio;
          const altoEscudo = escudo.height * ratio;
          ctx.save();
          ctx.shadowColor = "rgba(0, 8, 24, 0.38)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
          ctx.drawImage(escudo, izq, y + 40 + (120 - altoEscudo) / 2, anchoEscudo, altoEscudo);
          ctx.restore();
        }

        ctx.fillStyle = "#C9D8EE";
        ctx.font = "700 26px Inter, system-ui, sans-serif";
        texto(ctx, candidato.equipo?.nombre || "Equipo", izq, y + 205, anchoIzq);
        linea(ctx, izq, y + 222, 126, ROJO, 6);

        ctx.fillStyle = "#FFC940";
        ctx.font = "800 20px Inter, system-ui, sans-serif";
        texto(ctx, jugador ? "MVP ELEGIDO POR EL EQUIPO RIVAL" : "MVP PENDIENTE DE SELECCIÓN", izq, y + 330, anchoIzq);

        ctx.fillStyle = "#ffffff";
        ctx.font = "850 44px Inter, system-ui, sans-serif";
        const lineasNombre = lineasAjustadas(ctx, jugador?.nombre || "Aún no seleccionado", anchoIzq, 3);
        lineasNombre.forEach((l, i) => ctx.fillText(l, izq, y + 385 + i * 50));
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
    <div className="acta-mvp-descarga">
      <button type="button" className="primario" disabled={descargando} onClick={descargar}>
        {descargando ? "Creando imagen…" : "Descargar MVPs"}
      </button>
      {error && <p className="error" role="status">{error}</p>}
    </div>
  );
}
