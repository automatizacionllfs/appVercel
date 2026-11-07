"use client";

import { usePathname } from "next/navigation";

const enlaces = [
  { href: "/", texto: "Máximos goleadores" },
  { href: "/clasificacion", texto: "Clasificación" },
  { href: "/mvps", texto: "MVPs" },
  { href: "/estadisticas", texto: "Estadísticas" },
  { href: "/actas", texto: "Ver actas" },
];

const enlacesPersonal = [
  { href: "/arbitro", texto: "Árbitros" },
  { href: "/entrenador", texto: "Entrenadores" },
  { href: "/entrenador/admin", texto: "Gestión de PIN" },
];

export default function Navegacion() {
  const ruta = usePathname();
  const personalActivo = ruta === "/arbitro"
    || ruta.startsWith("/arbitro/")
    || ruta === "/entrenador"
    || ruta.startsWith("/entrenador/");

  return (
    <nav className="site-nav" aria-label="Navegación principal">
      {enlaces.map(({ href, texto }) => {
        const activa = href === "/"
          ? ruta === "/"
          : href === "/entrenador"
            ? ruta === href || ruta === "/entrenador/login"
            : ruta === href || ruta.startsWith(`${href}/`);
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
      <details className={`site-nav-menu ${personalActivo ? "activa" : ""}`} open={personalActivo}>
        <summary aria-current={personalActivo ? "page" : undefined}>Acceso personal</summary>
        <div className="site-nav-submenu">
          {enlacesPersonal.map(({ href, texto }) => {
            const activa = href === "/entrenador"
              ? ruta === href || ruta === "/entrenador/login"
              : ruta === href || ruta.startsWith(`${href}/`);
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
        </div>
      </details>
    </nav>
  );
}
