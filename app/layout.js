import "./globals.css";
import Cabecera from "./Cabecera";
import InstalarApp from "./InstalarApp";
import AvisoBaseDatos from "./AvisoBaseDatos";
import { createClient } from "@supabase/supabase-js";
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
const VERSION = "4.8.1";
const FECHA_ACTUALIZACION = "26/11/2026";

export default async function RootLayout({ children }) {
  const equipos = await cargarEquipos();
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

async function cargarEquipos() {
  try {
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data: temporada } = await db.from("temporadas").select("id").eq("activa", true).maybeSingle();
    if (!temporada) return [];
    const { data } = await db.from("equipos")
      .select("id,nombre,escudo_url").eq("temporada_id", temporada.id).order("nombre");
    return data || [];
  } catch {
    return []; // si falla, el layout no debe romper la web
  }
}

