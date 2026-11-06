import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const API = "https://api.clupik.com";
const { CLUB_ID, SEASON_ID, SECTIONS = "", FECHA_DESDE, FECHA_HASTA } = process.env;
const PARTICULAS = ["de", "del", "la", "las", "los", "el", "y", "e", "da", "di", "do", "van", "von"];

const limpiar = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
function normalizar(s) {
  const l = limpiar(s).toLowerCase();
  if (!l) return "";
  return l.split(" ").map((w, i) =>
    i > 0 && PARTICULAS.includes(w) ? w : w.replace(/(^|[-'])([a-zà-ÿ])/g, (m, sep, c) => sep + c.toUpperCase())
  ).join(" ");
}
async function getJson(url, intentos = 3) {
  let ultimo = "";
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (r.ok) return await r.json();
      ultimo = `HTTP ${r.status}`;
    } catch (e) { ultimo = e.message; }
    await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
  }
  throw new Error(`${url} -> ${ultimo}`);
}
const ok = (res) => { if (res.error) throw new Error(res.error.message); return res.data; };
async function upsertTrozos(db, tabla, filas, conflicto, columnas) {
  const out = [];
  for (let i = 0; i < filas.length; i += 500) {
    const q = db.from(tabla).upsert(filas.slice(i, i + 500), { onConflict: conflicto });
    out.push(...(ok(columnas ? await q.select(columnas) : await q) || []));
  }
  return out;
}

async function autorizado(req, db) {
  const auth = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const token = auth.replace(/^Bearer /, "");
  if (!token) return false;
  const { data } = await db.auth.getUser(token);
  const email = data?.user?.email;
  if (!email) return false;
  const { data: u } = await db.from("usuarios").select("id").eq("rol", "admin").eq("activo", true).ilike("email", email).maybeSingle();
  return !!u;
}

async function obtenerPartidos(desdeValor, hastaValor) {
  const fechaMs = (valor, respaldo, final) => {
    const entrada = String(valor || respaldo);
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(entrada)
      ? `${entrada}T${final ? "23:59:59.999" : "00:00:00.000"}Z`
      : entrada;
    const timestamp = Date.parse(fecha);
    if (!Number.isFinite(timestamp)) throw new Error("El rango de fechas no es válido");
    return timestamp;
  };
  const desde = fechaMs(desdeValor, FECHA_DESDE || "2026-09-01T00:00:00.000Z", false);
  const hasta = fechaMs(hastaValor, FECHA_HASTA || "2027-06-30T23:59:59.999Z", true);
  if (desde > hasta) throw new Error("La fecha desde debe ser anterior a la fecha hasta");

  const semana = 7 * 24 * 3600 * 1000;
  const tramos = [];
  for (let t = desde; t <= hasta; t += semana) {
    tramos.push([new Date(t).toISOString(), new Date(Math.min(t + semana - 1, hasta)).toISOString()]);
  }
  const mapa = new Map();
  for (let i = 0; i < tramos.length; i += 10) {
    const lote = await Promise.all(tramos.slice(i, i + 10).map(([d, h]) => {
      const url = new URL(`${API}/clubs/${CLUB_ID}/stats/organizer`);
      url.search = new URLSearchParams({ firstLoad: "true", exactDates: "true", from: d, to: h });
      return getJson(url.toString());
    }));
    lote.forEach((r) => (r.games || []).forEach((g) => mapa.set(String(g.id), g)));
  }
  return [...mapa.values()];
}

async function sincronizar(db, fechas) {
  const equiposApi = await getJson(`${API}/clubs/${CLUB_ID}/teamsForTableBySections?seasonId=${SEASON_ID}&visibility=true&sections=${SECTIONS}`);
  if (!Array.isArray(equiposApi) || !equiposApi.length) throw new Error("La API no devolvió equipos");
  const partidosApi = await obtenerPartidos(fechas.desde, fechas.hasta);
  // Temporada
  const titulo = equiposApi[0]?.team?.season?.title || SEASON_ID;
  const temp = ok(await db.from("temporadas").upsert({ id_clupik: SEASON_ID, nombre: titulo, activa: true }, { onConflict: "id_clupik" }).select("id").single());
  ok(await db.from("temporadas").update({ activa: false }).neq("id", temp.id));

  // Grupos (vienen de los partidos)
  const grupos = new Map();
  partidosApi.forEach((g) => g.group && grupos.set(String(g.group.id), g.group.title));
  const gruposDb = grupos.size
    ? await upsertTrozos(db, "grupos", [...grupos].map(([id, nombre]) => ({ temporada_id: temp.id, id_clupik: id, nombre })), "temporada_id,id_clupik", "id,id_clupik,nombre")
    : [];
  const grupoPorId = (id) => gruposDb.find((g) => g.id_clupik === String(id))?.id ?? null;
  const grupoPorNombre = (n) => gruposDb.find((g) => g.nombre === n)?.id ?? null;

  // Equipos
  const filasEq = new Map();
  const addEquipo = (t, grupo) => {
    if (!t) return;
    const k = String(t.id);
    filasEq.set(k, {
      temporada_id: temp.id, id_clupik: k, nombre: limpiar(t.editableName || t.name),
      escudo_url: t.shieldUrl || null, grupo_id: grupo ?? filasEq.get(k)?.grupo_id ?? null,
    });
  };
  equiposApi.forEach((it) => addEquipo(it.team, grupoPorNombre(it.section?.name)));
  partidosApi.forEach((g) => { addEquipo(g.localTeam, grupoPorId(g.groupId)); addEquipo(g.visitorTeam, grupoPorId(g.groupId)); });
  const equiposDb = await upsertTrozos(db, "equipos", [...filasEq.values()], "temporada_id,id_clupik", "id,id_clupik");
  const eqId = new Map(equiposDb.map((e) => [e.id_clupik, e.id]));

  // Jugadores y plantillas
  const teamIds = equiposApi.map((it) => String(it.team?.id ?? it.teamId));
  const listas = await Promise.all(teamIds.map(async (id) => [id, await getJson(`${API}/clubs/${CLUB_ID}/teams/${id}/player`)]));
  const personas = new Map();
  const plantillas = [];
  for (const [teamId, lista] of listas) {
    if (!Array.isArray(lista)) continue;
    for (const p of lista) {
      const nombre = [normalizar(p.firstName), normalizar(p.lastName), normalizar(p.secondSurname)].filter(Boolean).join(" ");
      if (!p.id || !nombre) continue;
      personas.set(String(p.id), {
        id_clupik: String(p.id),
        nombre,
        apodo: limpiar(p.playerOne?.sportsName) || null,
        image_id: p.playerOne?.imageId || null,
      });
      const d = parseInt(p.playerOne?.number, 10);
      plantillas.push({ teamId, jug: String(p.id), dorsal: Number.isNaN(d) ? null : d });
    }
  }
  const jugDb = await upsertTrozos(db, "jugadores", [...personas.values()], "id_clupik", "id,id_clupik,image_id");
  const jugId = new Map(jugDb.map((j) => [j.id_clupik, j.id]));
  const filasPl = new Map();
  plantillas.forEach((x) => {
    const equipo_id = eqId.get(x.teamId), jugador_id = jugId.get(x.jug);
    if (equipo_id && jugador_id) filasPl.set(`${equipo_id}-${jugador_id}`, { equipo_id, jugador_id, dorsal: x.dorsal === -1 ? null : x.dorsal, baja: x.dorsal === -1 });
  });
  await upsertTrozos(db, "plantilla", [...filasPl.values()], "equipo_id,jugador_id");

  // Partidos (no se tocan arbitro_id ni estado)
  const filasP = partidosApi.map((g) => ({
    id_clupik: String(g.id), temporada_id: temp.id, grupo_id: grupoPorId(g.groupId), jornada: g.round, fecha: g.date,
    local_id: eqId.get(String(g.localTeamId)), visitante_id: eqId.get(String(g.visitorTeamId)),
    goles_local_clupik: g.localScore, goles_visitante_clupik: g.visitorScore,
  })).filter((p) => p.local_id && p.visitante_id);
  await upsertTrozos(db, "partidos", filasP, "id_clupik");

  return {
    equipos: filasEq.size,
    jugadores: personas.size,
    jugadoresConFotoRecibida: [...personas.values()].filter((jugador) => jugador.image_id).length,
    jugadoresConFotoGuardada: jugDb.filter((jugador) => jugador.image_id).length,
    plantillas: filasPl.size,
    partidos: filasP.length,
  };
}

async function ejecutarSync(req) {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  if (!(await autorizado(req, db))) return Response.json({ error: "No autorizado" }, { status: 401 });
  try {
    const body = req.method === "POST" ? await req.json() : {};
    return Response.json({ ok: true, ...(await sincronizar(db, body)) });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req) {
  return ejecutarSync(req);
}

export async function POST(req) {
  return ejecutarSync(req);
}
