import { createServiceDb } from "../../../lib/entrenador";

export const dynamic = "force-dynamic";

const hostsPermitidos = () => new Set(
  (process.env.CLUPIK_IMAGE_HOSTS || "api.clupik.com")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

export async function GET(request) {
  const id = new URL(request.url).searchParams.get("equipo") || "";
  if (!/^\d+$/.test(id)) return new Response(null, { status: 400 });

  try {
    const db = createServiceDb();
    const { data: equipo, error } = await db.from("equipos")
      .select("escudo_url")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`No se pudo cargar el escudo: ${error.message}`);
    if (!equipo?.escudo_url) return new Response(null, { status: 404 });

    const origen = new URL(equipo.escudo_url);
    if (origen.protocol !== "https:" || !hostsPermitidos().has(origen.hostname.toLowerCase()) ||
        origen.username || origen.password || origen.port) {
      console.error("La URL del escudo usa un host no permitido.", origen.hostname);
      return new Response(null, { status: 404 });
    }

    const respuesta = await fetch(origen, {
      cache: "force-cache",
      next: { revalidate: 3600 },
      redirect: "error",
    });
    const tipo = respuesta.headers.get("content-type") || "";
    if (!respuesta.ok || !["image/png", "image/jpeg", "image/webp"].includes(tipo.split(";")[0])) {
      return new Response(null, { status: 404 });
    }
    const bytes = await respuesta.arrayBuffer();
    if (bytes.byteLength > 3_000_000) return new Response(null, { status: 413 });
    return new Response(bytes, {
      headers: {
        "Content-Type": tipo,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("No se pudo obtener el escudo del equipo.", error);
    return new Response(null, { status: 502 });
  }
}
