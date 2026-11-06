"use client";

import { usePathname } from "next/navigation";

const enlaces = [
  { href: "/", texto: "Máximos goleadores" },
  { href: "/clasificacion", texto: "Clasificación" },
  { href: "/estadisticas", texto: "Estadísticas" },
  { href: "/actas", texto: "Ver actas" },
  { href: "/arbitro", texto: "Árbitros" },
];

export default function Navegacion() {
  const ruta = usePathname();

  return (
    <nav className="site-nav" aria-label="Navegación principal">
      {enlaces.map(({ href, texto }) => {
        const activa = href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`);
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
