/* CRUD genérico para las vistas: abre el modal para alta/edición y
   borra con confirmación + toast. Centraliza la lógica que en el app.js
   vanilla vivía en onContentClick. */
import { useFinanzas } from "../store/finanzas.js";
import { openModal } from "./useModal.js";
import { toast } from "./useToast.js";

export function useCrud() {
  const store = useFinanzas();

  const add = (mod) => openModal(mod);
  const edit = (mod, rec) => openModal(mod, rec);

  function remove(mod, rec) {
    const name = rec?.concepto || rec?.nombre || rec?.titulo || rec?.proveedor || "este registro";
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    store.deleteRecord(mod, rec.id);
    toast("Registro eliminado");
  }

  return { add, edit, remove };
}
