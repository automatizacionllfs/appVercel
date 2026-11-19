import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("No se pudo comprobar la conexión con la base de datos: faltan variables de configuración.");
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { error } = await db.from("temporadas").select("id").limit(1);
    if (error) {
      console.error("No se pudo comprobar la conexión con la base de datos.", error);
      return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("No se pudo comprobar la conexión con la base de datos.", error);
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
