/* Modal de registros (singleton reactivo).
   Reemplaza openModal/openModalWith/submitModal del app.js.
   La vista llama a openModal(mod, record); AppModal.vue renderiza `state.fields`
   ligados a `state.model` y al guardar invoca submit(). */

import { reactive } from "vue";
import { useFinanzas } from "../store/finanzas.js";
import { createSchemas } from "../schemas.js";
import { num, isoToday } from "../utils/format.js";
import { toast } from "./useToast.js";

const state = reactive({
  open: false,
  title: "",
  mod: null,
  id: null,
  fields: [],   // campos resueltos (con opciones materializadas)
  model: {},    // valores del formulario
});

let store = null;
let schemas = null;
function ensure() {
  if (!store) {
    store = useFinanzas();
    schemas = createSchemas(store);
  }
}

// Materializa un campo: resuelve options/datalist (pueden ser funciones) y el valor inicial.
function buildField(f, record) {
  const out = { ...f };
  if (typeof f.options === "function") out.options = f.options();
  if (typeof f.datalist === "function") out.datalist = f.datalist();
  let val;
  if (f.type === "checkbox") {
    val = record ? !!record[f.k] : (typeof f.default === "function" ? f.default() : false);
  } else {
    val = record ? record[f.k] : (typeof f.default === "function" ? f.default() : "");
    if (val == null) val = "";
  }
  return { field: out, value: val };
}

function loadSchema(schema, record) {
  state.fields = [];
  state.model = {};
  for (const f of schema.fields) {
    const { field, value } = buildField(f, record);
    state.fields.push(field);
    state.model[f.k] = value;
  }
}

export function openModal(mod, record) {
  ensure();

  // Editor de presupuesto por categoría (esquema dinámico, registro precargado).
  if (mod === "presupuestoCat") {
    const p = store.proyectoActual();
    const schema = schemas.presupuestoCatSchema();
    const pre = {}; const pc = (p && p.presupuestoCat) || {};
    schema.fields.forEach((f) => { pre[f.k] = pc[f._cat] != null ? pc[f._cat] : ""; });
    state.mod = "presupuestoCat";
    state.id = null;
    state.title = "Presupuesto por categoría";
    state._schema = schema;
    loadSchema(schema, pre);
    state.open = true;
    return;
  }

  // Perfil de sueldo (objeto singleton).
  if (mod === "sueldo") {
    const schema = schemas.sueldoSchema();
    state.mod = "sueldo";
    state.id = null;
    state.title = "Configurar sueldo";
    state._schema = schema;
    loadSchema(schema, store.data.sueldo || {});
    state.open = true;
    return;
  }

  const schema = schemas.SCHEMAS[mod];
  if (!schema) return;
  state.mod = mod;
  state.id = record?.id || null;
  state.title = (record ? "Editar " : "Nuevo ") + schema.title;
  state._schema = schema;
  loadSchema(schema, record || null);
  state.open = true;
}

export function closeModal() {
  state.open = false;
  state.mod = null;
  state.id = null;
}

export function submitModal() {
  ensure();
  const { mod, id } = state;
  const schema = state._schema;
  if (!schema) return;

  // Presupuesto por categoría → objeto {categoria: monto}.
  if (mod === "presupuestoCat") {
    const p = store.proyectoActual();
    if (p) {
      const pc = {};
      schema.fields.forEach((f) => { const v = num(state.model[f.k]); if (v) pc[f._cat] = v; });
      p.presupuestoCat = pc;
      store.scheduleSave(); closeModal(); toast("Presupuestos guardados");
    } else closeModal();
    return;
  }

  // Perfil de sueldo → escribe sobre el objeto singleton.
  if (mod === "sueldo") {
    const s = store.data.sueldo || (store.data.sueldo = {});
    for (const f of schema.fields) {
      if (f.type === "checkbox") s[f.k] = !!state.model[f.k];
      else if (f.type === "number") s[f.k] = num(state.model[f.k]);
      else s[f.k] = String(state.model[f.k] ?? "").trim();
    }
    store.scheduleSave(); closeModal(); toast("Sueldo guardado");
    return;
  }

  const rec = { id: id || store.uid() };
  for (const f of schema.fields) {
    if (f.type === "checkbox") rec[f.k] = !!state.model[f.k];
    else if (f.type === "number") rec[f.k] = num(state.model[f.k]);
    else rec[f.k] = String(state.model[f.k] ?? "").trim();
  }

  const isEdit = store.commitRecord(mod, rec, id);
  store.scheduleSave();
  closeModal();
  toast(isEdit ? "Cambios guardados" : "Registro agregado");
}

export function useModal() {
  return { state, openModal, closeModal, submitModal };
}
