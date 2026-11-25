export const dynamic = "force-dynamic";

const ID_VALIDO = /^[a-zA-Z0-9_-]{1,100}$/;
// Segmentos candidatos de Clupik para la foto de un entrenador (se prueban en orden).
const RUTAS = (process.env.CLUPIK_COACH_PICTURE_PATHS || "coaches,coach")
  .split(",").map((s) => s.trim()).filter((s) => ID_VALIDO.test(s));

export async function GET(request) {
  const { CLUB_ID } = process.env;
  const params = new URL(request.url).searchParams;
  const equipo = params.get("equipo") || "";
  const persona = params.get("persona") || "";
  const imagen = params.get("imagen") || "";
  if (!CLUB_ID || !ID_VALIDO.test(CLUB_ID) ||
      !ID_VALIDO.test(equipo) || !ID_VALIDO.test(persona) || !ID_VALIDO.test(imagen)) {
    return Response.json({ error: "Identificador de foto no válido." }, { status: 400 });
  }

  try {
    for (const segmento of RUTAS) {
      const url = `https://api.clupik.com/clubs/${CLUB_ID}/teams/${equipo}/${segmento}/${persona}/picture/${imagen}.medium.jpg`;
      const response = await fetch(url, { cache: "force-cache", next: { revalidate: 3600 } });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) continue;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 3_000_000) return new Response(null, { status: 413 });
      return new Response(bytes, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }
    return new Response(null, { status: 404 });
  } catch (error) {
    console.error("No se pudo obtener la foto del entrenador.", error);
    return Response.json({ error: "No se pudo obtener la foto del entrenador." }, { status: 502 });
  }
}
