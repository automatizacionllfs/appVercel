import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

export default async function Inicio() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: temp } = await db.from("temporadas").select("id,nombre").eq("activa", true).maybeSingle();
  let filas = [];
  if (temp) {
    const { data } = await db.from("v_goleadores").select("*").eq("temporada_id", temp.id)
      .order("goles", { ascending: false }).order("jugador").limit(100);
    filas = data || [];
  }
  // Posición con empates (1, 2, 2, 4...)
  const pos = filas.map((f, i) => (i > 0 && f.goles === filas[i - 1].goles ? null : i + 1));
  for (let i = 0; i < pos.length; i++) if (pos[i] === null) pos[i] = pos[i - 1];

  return (
    <main>
      <h1>Máximos goleadores{temp ? ` ${temp.nombre}` : ""}</h1>
      {filas.length === 0 ? (
        <p className="suave">Todavía no hay goles registrados.</p>
      ) : (
        <table>
          <thead><tr><th className="num">#</th><th>Jugador</th><th className="num">Goles</th></tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={`${f.jugador_id}-${f.equipo_id}`}>
                <td className="num">{pos[i]}</td>
                <td>{f.jugador}<div className="suave">{f.equipo}</div></td>
                <td className="num"><strong>{f.goles}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p><a className="acceso-arbitro" href="/arbitro">Acceso de árbitros <span aria-hidden="true">→</span></a></p>
    </main>
  );
}
