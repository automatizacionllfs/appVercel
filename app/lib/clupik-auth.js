import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";

const API = "https://api.clupik.com";

function cifrarPassword(password, userKey) {
  const salt = randomBytes(256);
  const iv = randomBytes(16);
  const key = pbkdf2Sync(userKey, salt, 999, 32, "sha512");
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);

  return {
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export async function obtenerTokenClupik() {
  const { CLUB_ID, CLUPIK_USERNAME, CLUPIK_PASSWORD, CLUPIK_CRYPTO_USER_KEY } = process.env;
  if (!CLUB_ID || !/^\d+$/.test(CLUB_ID) ||
      !CLUPIK_USERNAME || !CLUPIK_PASSWORD || !CLUPIK_CRYPTO_USER_KEY) {
    throw new Error("Falta configurar CLUB_ID, CLUPIK_USERNAME, CLUPIK_PASSWORD o CLUPIK_CRYPTO_USER_KEY en el servidor.");
  }

  const credentials = {
    [CLUPIK_USERNAME.includes("@") ? "email" : "username"]: CLUPIK_USERNAME,
    password: cifrarPassword(CLUPIK_PASSWORD, CLUPIK_CRYPTO_USER_KEY),
  };
  const respuesta = await fetch(`${API}/auth/local/token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ clubId: CLUB_ID, credentials }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!respuesta.ok) {
    throw new Error(`No se pudo iniciar sesión en Clupik (HTTP ${respuesta.status}).`);
  }

  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    throw new Error("Clupik devolvió una respuesta de autenticación no válida.");
  }
  if (typeof datos?.token !== "string" || !datos.token) {
    throw new Error("Clupik no devolvió un token de autenticación válido.");
  }

  return datos.token;
}
