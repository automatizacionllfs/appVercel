"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Navegacion from "./Navegacion";

const UMBRAL_COMPACTAR = 80;
const UMBRAL_EXPANDIR = 20;

export default function Cabecera() {
  const [compacta, setCompacta] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [altura, setAltura] = useState(200);
  const cabeceraRef = useRef(null);
  const compactaRef = useRef(false);

  // Mide la cabecera expandida para reservar su espacio (solo en estado expandido).
  useEffect(() => {
    const medir = () => {
      if (!compactaRef.current && cabeceraRef.current) setAltura(cabeceraRef.current.offsetHeight);
    };
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("load", medir);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("load", medir);
    };
  }, []);

  useEffect(() => {
    let pendiente = false;
    const actualizar = () => {
      pendiente = false;
      const y = window.scrollY;
      const siguiente = compactaRef.current ? y > UMBRAL_EXPANDIR : y > UMBRAL_COMPACTAR;
      if (siguiente !== compactaRef.current) {
        compactaRef.current = siguiente;
        setCompacta(siguiente);
        if (!siguiente) setMenuAbierto(false);
      }
    };
    const alScroll = () => {
      if (pendiente) return;
      pendiente = true;
      window.requestAnimationFrame(actualizar);
    };
    actualizar();
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

  useEffect(() => {
    if (!menuAbierto) return undefined;
    const cerrarEscape = (evento) => {
      if (evento.key === "Escape") setMenuAbierto(false);
    };
    const cerrarFuera = (evento) => {
      if (!cabeceraRef.current?.contains(evento.target)) setMenuAbierto(false);
    };
    document.addEventListener("keydown", cerrarEscape);
    document.addEventListener("pointerdown", cerrarFuera);
    return () => {
      document.removeEventListener("keydown", cerrarEscape);
      document.removeEventListener("pointerdown", cerrarFuera);
    };
  }, [menuAbierto]);

  return (
    <>
      <header
        ref={cabeceraRef}
        className={`site-header ${compacta ? "compacta" : ""} ${menuAbierto ? "menu-abierto" : ""}`}
      >
        <div className="site-header-barra">
          <div className="site-brand-caja">
            <a className="site-brand" href="/" aria-label="LLFS Puerto Real, inicio">
              <Image src="/logo-llfs.png" alt="LLFS Puerto Real" width={216} height={113} priority />
            </a>
          </div>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuAbierto}
            aria-controls="menu-principal"
            aria-hidden={!compacta}
            tabIndex={compacta ? 0 : -1}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          >
            <span className="menu-icono" aria-hidden="true"><i /><i /><i /></span>
            Menú
          </button>
        </div>

        <div className="site-header-cuerpo" id="menu-principal" inert={compacta && !menuAbierto}>
          <div className="site-header-cuerpo-interno">
            <div className="site-header-contenido">
              <div className="header-enlaces" aria-label="Enlaces oficiales">
                <a href="https://llfspuertoreal.es" target="_blank" rel="noreferrer">llfspuertoreal.es</a>
                <a href="https://www.instagram.com/dlfsptoreal/?hl=es" target="_blank" rel="noreferrer" aria-label="Instagram de LLFS Puerto Real">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="17.5" cy="6.8" r="1.2" fill="currentColor" />
                  </svg>
                </a>
                <a href="https://www.youtube.com/channel/UC04DaqgqFXya5fLXsqBvIaA" target="_blank" rel="noreferrer" aria-label="Canal de YouTube de LLFS Puerto Real">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M23 7.1a3 3 0 0 0-2.1-2.1C19 4.5 12 4.5 12 4.5s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.9A3 3 0 0 0 3.1 19c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.9 31 31 0 0 0-.5-4.9ZM9.8 15.3V8.7l5.8 3.3-5.8 3.3Z" fill="currentColor" />
                  </svg>
                </a>
              </div>
              <Navegacion />
            </div>
          </div>
        </div>
      </header>
      <div className="site-header-espacio" style={{ height: altura }} aria-hidden="true" />
    </>
  );
}