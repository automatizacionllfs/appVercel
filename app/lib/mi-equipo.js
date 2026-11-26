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
const CLAVE_JUGADOR = "llfs_mi_jugador";

export function guardarMiEquipo(id) {
  try {
    const nuevo = id ? String(id) : "";
    // Si cambia de equipo, el jugador elegido ya no es válido
    if (nuevo !== leer()) window.localStorage.removeItem(CLAVE_JUGADOR);
    if (nuevo) window.localStorage.setItem(CLAVE, nuevo);
    else window.localStorage.removeItem(CLAVE);
  } catch {
    /* almacenamiento bloqueado: se ignora */
  }
  window.dispatchEvent(new Event(EVENTO));
}

function leerJugador() {
  try {
    return window.localStorage.getItem(CLAVE_JUGADOR) || "";
  } catch {
    return "";
  }
}

export function guardarMiJugador(id) {
  try {
    if (id) window.localStorage.setItem(CLAVE_JUGADOR, String(id));
    else window.localStorage.removeItem(CLAVE_JUGADOR);
  } catch {
    /* ignorado */
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function useMiJugador() {
  return useSyncExternalStore(suscribir, leerJugador, () => "");
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