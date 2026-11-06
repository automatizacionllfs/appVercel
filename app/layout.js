import "./globals.css";
import Image from "next/image";

export const metadata = {
  title: "LLFS Puerto Real",
  description: "Goleadores y actas de la liga",
  icons: {
    icon: "/logo-llfs.png",
    apple: "/logo-llfs.png",
  },
};
export const viewport = { width: "device-width", initialScale: 1 };
const VERSION = "1.0.0";
const FECHA_ACTUALIZACION = "05/11/2026";

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <a className="site-brand" href="/" aria-label="LLFS Puerto Real, inicio">
            <Image src="/logo-llfs.png" alt="LLFS Puerto Real" width={216} height={113} priority />
          </a>
          <nav className="site-nav" aria-label="Navegación principal">
            <a href="/">Máximos goleadores</a>
            <a href="/clasificacion">Clasificación</a>
            <a href="/estadisticas">Estadísticas</a>
            <a href="/arbitro">Árbitros</a>
          </nav>
        </header>
        {children}
        <footer className="pie">Versión {VERSION} · Actualizado el {FECHA_ACTUALIZACION}</footer>
      </body>
    </html>
  );
}
