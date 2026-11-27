"use client";

import { useEffect, useState } from "react";

const PREFIJO = "llfs_filtro:";

// Como useState, pero recuerda el valor en sessionStorage (por pestaña).
// Devuelve [valor, setValor, listo].
export function useFiltroSesion(clave, inicial, { restaurar = true } = {}) {
  const [valor, setValor] = useState(inicial);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (restaurar) {
      try {
        const guardado = window.sessionStorage.getItem(PREFIJO + clave);
        if (guardado !== null) setValor(JSON.parse(guardado));
      } catch {
        /* almacenamiento bloqueado o dato corrupto */
      }
    }
    setListo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  useEffect(() => {
    if (!listo) return;
    try {
      window.sessionStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
    } catch {
      /* ignorado */
    }
  }, [clave, valor, listo]);

  return [valor, setValor, listo];
}