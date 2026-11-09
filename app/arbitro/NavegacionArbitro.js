"use client";

import { usePathname } from "next/navigation";

const enlaces = [
  { href: "/arbitro", texto: "Actas" },
  { href: "/arbitro/gestion-pin", texto: "Gestión de PIN" },
  { href: "/arbitro/sin-ficha", texto: "Sin Ficha" },
];

export default function NavegacionArbitro() {
  const ruta = usePathname()?.replace(/\/+$/, "") || "/";

  return (
    <nav className="site-nav navegacion-arbitro" aria-label="Navegación de árbitros">
      {enlaces.map(({ href, texto }) => {
        const activa = ruta === href;
        return (
          <a
            className={activa ? "activa" : ""}
            href={href}
            aria-current={activa ? "page" : undefined}
            key={href}
          >
            {texto}
          </a>
        );
      })}
    </nav>
  );
}
