import "./globals.css";
import Image from "next/image";
import Navegacion from "./Navegacion";

export const metadata = {
  title: "LLFS Puerto Real",
  description: "Goleadores y actas de la liga",
  icons: {
    icon: "/logo-llfs.png",
    apple: "/logo-llfs.png",
  },
};
export const viewport = { width: "device-width", initialScale: 1 };
const VERSION = "1.1.3";
const FECHA_ACTUALIZACION = "06/11/2026";

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <a className="site-brand" href="/" aria-label="LLFS Puerto Real, inicio">
            <Image src="/logo-llfs.png" alt="LLFS Puerto Real" width={216} height={113} priority />
          </a>
          <Navegacion />
        </header>
        {children}
        <footer className="pie">Versión {VERSION} · Actualizado el {FECHA_ACTUALIZACION}</footer>
      </body>
    </html>
  );
}
