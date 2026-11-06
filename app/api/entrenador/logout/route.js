import { COOKIE_NAME, origenValido } from "../../../lib/entrenador";

export async function POST(request) {
  if (!origenValido(request)) return Response.json({ error: "Solicitud no válida." }, { status: 403 });
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    },
  });
}
