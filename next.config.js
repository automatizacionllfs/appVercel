// Estas dos variables son públicas por diseño (URL del proyecto y clave "publishable"):
// se incrustan al compilar para que la pantalla /arbitro, que corre en el navegador, pueda leerlas.
module.exports = {
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
};
