import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const COOKIE_NAME = "llfs_entrenador";
export const SESSION_SECONDS = 12 * 60 * 60;

export function createServiceDb() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sessionSecret() {
  const secret = process.env.ENTRENADOR_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ENTRENADOR_SESSION_SECRET debe tener al menos 32 caracteres.");
  }
  return secret;
}

function firmar(payload) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function crearSesionEntrenador(equipoId) {
  const payload = Buffer.from(JSON.stringify({
    equipoId: String(equipoId),
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  })).toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

export function leerSesionEntrenador(request) {
  const cookie = (request.headers.get("cookie") || "")
    .split(";")
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return null;

  const token = cookie.slice(COOKIE_NAME.length + 1);
  const [payload, firma, extra] = token.split(".");
  if (!payload || !firma || extra) return null;
  const firmaEsperada = Buffer.from(firmar(payload));
  const firmaRecibida = Buffer.from(firma);
  if (firmaEsperada.length !== firmaRecibida.length ||
      !timingSafeEqual(firmaEsperada, firmaRecibida)) return null;

  try {
    const sesion = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!/^\d+$/.test(sesion.equipoId) || !Number.isInteger(sesion.exp) ||
        sesion.exp <= Math.floor(Date.now() / 1000)) return null;
    return { equipoId: sesion.equipoId };
  } catch {
    return null;
  }
}

export function origenValido(request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export function errorRespuesta(error, status = 500) {
  console.error(error);
  return Response.json({ error: error instanceof Error ? error.message : "Error interno." }, { status });
}

export function cookieSesion(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_SECONDS}; SameSite=Lax${secure}`;
}
