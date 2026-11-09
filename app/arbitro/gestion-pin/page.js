import AdminPins from "../../entrenador/admin/AdminPins";

export const metadata = { title: "Gestión de PIN · LLFS Puerto Real" };

export default function GestionPinesArbitros() {
  return <AdminPins redirectPath="/arbitro/gestion-pin" />;
}
