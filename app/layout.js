import "./globals.css";
import Cabecera from "./Cabecera";
import InstalarApp from "./InstalarApp";
import AvisoBaseDatos from "./AvisoBaseDatos";
// ...metadata, viewport, VERSION, FECHA_ACTUALIZACION sin cambios...


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
const VERSION = "6.0.12";
const FECHA_ACTUALIZACION = "28/11/2026";

export default async function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Cabecera />
        <AvisoBaseDatos />
        <InstalarApp />
        {children}
        <footer className="pie">Versión {VERSION} · Actualizado el {FECHA_ACTUALIZACION}</footer>
      </body>
    </html>
  );
}

