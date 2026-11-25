"use client";

import { useSyncExternalStore } from "react";

const CLAVE = "llfs_mi_equipo";
const EVENTO = "llfs-mi-equipo";

function leer() {
  try {
    return window.localStorage.getItem(CLAVE) || "";
  } catch {
    return "";
  }
}

export function guardarMiEquipo(id) {
  try {
    if (id) window.localStorage.setItem(CLAVE, String(id));
    else window.localStorage.removeItem(CLAVE);
  } catch {
    /* almacenamiento bloqueado: se ignora */
  }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(aviso) {
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", aviso); // sincroniza otras pestañas
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", aviso);
  };
}

export function useMiEquipo() {
  return useSyncExternalStore(suscribir, leer, () => "");
}