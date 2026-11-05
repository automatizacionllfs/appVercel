import "./globals.css";

export const metadata = { title: "LLFS Puerto Real", description: "Goleadores y actas de la liga" };
export const viewport = { width: "device-width", initialScale: 1 };
const VERSION = "1.0.0";
const FECHA_ACTUALIZACION = "05/11/2026";

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
        <footer className="pie">Versión {VERSION} · Actualizado el {FECHA_ACTUALIZACION}</footer>
      </body>
    </html>
  );
}
