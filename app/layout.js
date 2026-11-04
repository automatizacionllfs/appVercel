import "./globals.css";

export const metadata = { title: "LLFS Puerto Real", description: "Goleadores y actas de la liga" };
export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
