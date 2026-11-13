import "./globals.css";
import Image from "next/image";
import Navegacion from "./Navegacion";
import InstalarApp from "./InstalarApp";

export const metadata = {
  title: "LLFS Puerto Real",
  description: "Goleadores y actas de la liga",
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "LLFS Puerto Real",
    statusBarStyle: "default",
  },
};
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };
const VERSION = "3.5.1";
const FECHA_ACTUALIZACION = "09/11/2026";

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <a className="site-brand" href="/" aria-label="LLFS Puerto Real, inicio">
            <Image src="/logo-llfs.png" alt="LLFS Puerto Real" width={216} height={113} priority />
          </a>
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
        </header>
        <InstalarApp />
        {children}
        <footer className="pie">Versión {VERSION} · Actualizado el {FECHA_ACTUALIZACION}</footer>
      </body>
    </html>
  );
}
