"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default function EditarActa({ partidoId }) {
  const [sesion, setSesion] = useState(undefined);
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    supabase.auth.getSession().then(({ data, error: errorSesion }) => {
      if (!vigente) return;
      if (errorSesion) {
        setError(`No se pudo consultar la sesión: ${errorSesion.message}`);
        return;
      }
      setSesion(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => setSesion(nuevaSesion));
    return () => {
      vigente = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    setMostrar(false);
    setError("");
    if (!sesion?.user?.email) return () => { vigente = false; };

    supabase.from("usuarios")
      .select("id")
      .ilike("email", sesion.user.email)
      .in("rol", ["arbitro", "admin"])
      .eq("activo", true)
      .maybeSingle()
      .then(({ data: usuario, error: errorUsuario }) => {
        if (!vigente) return;
        if (errorUsuario) {
          setError(`No se pudo comprobar el acceso de árbitro: ${errorUsuario.message}`);
          return;
        }
        setMostrar(Boolean(usuario));
      });

    return () => { vigente = false; };
  }, [sesion]);

  if (error) return <p className="editar-acta-error" role="status">{error}</p>;
  if (!mostrar) return null;

  return (
    <a className="boton-editar-acta" href={`/arbitro?partido=${encodeURIComponent(partidoId)}`}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
        <path d="m14 5 5 5M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Editar
    </a>
  );
}
