export const dynamic = "force-dynamic";

const ID_VALIDO = /^[a-zA-Z0-9_-]{1,100}$/;

export async function GET(request) {
  const { CLUB_ID } = process.env;
  const params = new URL(request.url).searchParams;
  const equipo = params.get("equipo") || "";
  const jugador = params.get("jugador") || "";
  const imagen = params.get("imagen") || "";
  if (!CLUB_ID || !ID_VALIDO.test(CLUB_ID) ||
      !ID_VALIDO.test(equipo) || !ID_VALIDO.test(jugador) || !ID_VALIDO.test(imagen)) {
    return Response.json({ error: "Identificador de foto no válido." }, { status: 400 });
  }

  const url = `https://api.clupik.com/clubs/${CLUB_ID}/teams/${equipo}/players/${jugador}/picture/${imagen}.medium.jpg`;
  try {
    const response = await fetch(url, { cache: "force-cache", next: { revalidate: 3600 } });
    if (!response.ok) return new Response(null, { status: 404 });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return new Response(null, { status: 502 });
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 3_000_000) return new Response(null, { status: 413 });
    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("No se pudo obtener la foto del MVP.", error);
    return Response.json({ error: "No se pudo obtener la foto del jugador." }, { status: 502 });
  }
}
