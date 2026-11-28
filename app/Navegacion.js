"use client";

import { usePathname } from "next/navigation";

const enlaces = [
  { href: "/", texto: "Máximos goleadores" },
  { href: "/clasificacion", texto: "Clasificación" },
  { href: "/mvps", texto: "MVPs" },
  { href: "/estadisticas", texto: "Estadísticas" },
];

const documentos = [
  { href: "/actas", texto: "Actas" },
  { href: "/comite", texto: "Comite" },
];

const enlacesPersonal = [
  { href: "/arbitro", texto: "Árbitros" },
  { href: "/entrenador", texto: "Entrenadores" },
  { href: "/jugador", texto: "Jugadores" },
];

export default function Navegacion() {
  const ruta = usePathname()?.replace(/\/+$/, "") || "/" || "";
  const personalActivo = ruta === "/arbitro"
    || ruta.startsWith("/arbitro/")
    || ruta === "/entrenador"
    || ruta.startsWith("/entrenador/")
    || ruta === "/jugador";

  return (
    <nav className="site-nav" aria-label="Navegación principal">
      {enlaces.map(({ href, texto }) => {
        const activa = ruta === href
          || (href !== "/" && ruta.startsWith(`${href}/`))
          || (href === "/entrenador" && ruta === "/entrenador/login");
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
      <details className={`site-nav-menu ${documentos.some(({ href }) => ruta === href || ruta.startsWith(`${href}/`)) ? "activa" : ""}`}>
        <summary aria-current={documentos.some(({ href }) => ruta === href || ruta.startsWith(`${href}/`)) ? "page" : undefined}>Documentos</summary>
        <div className="site-nav-submenu">
          {documentos.map(({ href, texto }) => {
            const activa = ruta === href || ruta.startsWith(`${href}/`);
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
      <details className={`site-nav-menu ${personalActivo ? "activa" : ""}`}>
        <summary aria-current={personalActivo ? "page" : undefined}>Acceso Personal</summary>
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
