"use client";

import { useEffect, useState } from "react";

export default function AvisoBaseDatos() {
  const [sinConexion, setSinConexion] = useState(false);

  useEffect(() => {
    let activo = true;
    let comprobando = false;

    const comprobarConexion = async () => {
      if (comprobando) return;
      comprobando = true;
      try {
        const respuesta = await fetch("/api/estado-base-datos", { cache: "no-store" });
        if (activo) setSinConexion(!respuesta.ok);
      } catch {
        if (activo) setSinConexion(true);
      } finally {
        comprobando = false;
      }
    };

    void comprobarConexion();
    const intervalo = window.setInterval(comprobarConexion, 30_000);

    return () => {
      activo = false;
      window.clearInterval(intervalo);
    };
  }, []);

  if (!sinConexion) return null;

  return (
    <div className="aviso-base-datos" role="alert">
      No se puede cargar la información en este momento. Inténtalo de nuevo más tarde.
    </div>
  );
}
