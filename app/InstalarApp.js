"use client";

import { useEffect, useState } from "react";

export default function InstalarApp() {
  const [instalacionDisponible, setInstalacionDisponible] = useState(null);
  const [instalada, setInstalada] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const instaladaComoApp = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    if (instaladaComoApp) {
      setInstalada(true);
      return;
    }

    const gestionarDisponibilidad = (evento) => {
      evento.preventDefault();
      setInstalacionDisponible(evento);
    };
    const gestionarInstalacion = () => {
      setInstalada(true);
      setInstalacionDisponible(null);
    };

    window.addEventListener("beforeinstallprompt", gestionarDisponibilidad);
    window.addEventListener("appinstalled", gestionarInstalacion);
    return () => {
      window.removeEventListener("beforeinstallprompt", gestionarDisponibilidad);
      window.removeEventListener("appinstalled", gestionarInstalacion);
    };
  }, []);

  if (instalada) return null;

  async function instalar() {
    if (instalacionDisponible) {
      try {
        const evento = instalacionDisponible;
        setInstalacionDisponible(null);
        await evento.prompt();
        const { outcome } = await evento.userChoice;
        setMensaje(outcome === "accepted"
          ? "¡Listo! La app se está instalando."
          : "Puedes instalarla más tarde desde el menú del navegador.");
      } catch (error) {
        console.error("No se pudo iniciar la instalación de la app.", error);
        setMensaje("No se pudo iniciar la instalación. Inténtalo desde el menú del navegador.");
      }
      return;
    }

    const dispositivoApple = /iPad|iPhone|iPod/.test(window.navigator.userAgent)
      || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    setMensaje(dispositivoApple
      ? "En Safari, toca Compartir y elige «Añadir a pantalla de inicio»."
      : "Abre el menú del navegador y selecciona «Instalar aplicación» o «Añadir a pantalla de inicio».");
  }

  return (
    <details className="instalar-app">
      <summary>
        <strong>¡Lleva LLFS Puerto Real contigo!</strong>
        <span className="instalar-app-toggle">Más información</span>
      </summary>
      <div className="instalar-app-contenido">
        <p>Descarga e instala la app para acceder más rápido desde tu dispositivo.</p>
        {mensaje && <p className="instalar-app-mensaje" role="status">{mensaje}</p>}
        <button type="button" onClick={instalar}>Instalar app</button>
      </div>
    </details>
  );
}
