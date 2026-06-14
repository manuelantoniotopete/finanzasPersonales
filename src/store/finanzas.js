/* Store central de finanzas (Pinia).
   Sustituye al objeto DATA + persistencia localStorage del app.js vanilla.
   - Estado reactivo + autosave (watch -> localStorage).
   - Agregaciones del dashboard y resolvers de sub-colecciones anidadas.
   - CRUD genérico usado por el modal (global y anidado). */

import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { LS_DATA, LS_THEME, SCHEMA_VERSION, mesIdx } from "../data/constants.js";
import { emptyData, migrate, recalcAhorrado } from "../data/model.js";
import { cotizMetrics } from "../utils/cotiz.js";
import { SAMPLE } from "../data/sample.js";
import {
  uid, num, sum, todayMonth, shiftMonth, isoToday, setCurrency,
} from "../utils/format.js";

export const useFinanzas = defineStore("finanzas", () => {
  // ---------- Estado ----------
  const data = ref(emptyData());
  const currentMonth = ref(todayMonth());
  const theme = ref("light");
  const saveState = ref({ cls: "", text: "Sin datos" });

  // Selección activa (espejo de las globales CURRENT_*/OPEN_* del app.js).
  const currentProyecto = ref(null);   // id del proyecto abierto (detalle) o null
  const currentCotizacion = ref(null); // id de la cotización abierta o null
  const openAhorro = ref(null);        // id de la meta abierta (detalle) o null
  const currentAhorro = ref(null);     // meta destino de un abono (transitorio, para el modal)

  const moneda = computed(() => data.value.moneda || "MXN");

  // ---------- Persistencia ----------
  let saveTimer = null;
  function save() {
    try {
      localStorage.setItem(LS_DATA, JSON.stringify(data.value));
      saveState.value = { cls: "saved", text: "Guardado local" };
    } catch (e) {
      saveState.value = { cls: "dirty", text: "Error al guardar" };
      console.error(e);
    }
  }
  function scheduleSave() {
    saveState.value = { cls: "dirty", text: "Guardando…" };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }

  function setData(obj) {
    data.value = migrate(obj);
    setCurrency(data.value.moneda);
  }

  function load() {
    theme.value = localStorage.getItem(LS_THEME) || "light";
    const raw = localStorage.getItem(LS_DATA);
    let had = false;
    if (raw) {
      try { setData(JSON.parse(raw)); had = true; }
      catch (e) { console.error("localStorage corrupto", e); }
    }
    setCurrency(data.value.moneda);
    saveState.value = had ? { cls: "saved", text: "Guardado local" } : { cls: "", text: "Sin datos" };
  }

  // Autosave: cualquier mutación profunda del modelo agenda un guardado.
  watch(data, () => { setCurrency(data.value.moneda); scheduleSave(); }, { deep: true });

  // ---------- Resolvers de sub-colecciones ----------
  const proyectoActual = () => data.value.proyectos.find((p) => p.id === currentProyecto.value) || null;
  const cotizacionActual = () => data.value.cotizaciones.find((c) => c.id === currentCotizacion.value) || null;
  const ahorroActual = () => data.value.ahorros.find((a) => a.id === currentAhorro.value) || null;
  const proyectoById = (id) => (id ? data.value.proyectos.find((p) => p.id === id) || null : null);
  const proyectoNombre = (id) => proyectoById(id)?.nombre || "";

  // mod anidado -> { coll, parent() }
  const NESTED_COLL = {
    movimiento: { coll: "movimientos", parent: proyectoActual },
    etapa:      { coll: "etapas",      parent: proyectoActual },
    proveedor:  { coll: "proveedores", parent: proyectoActual },
    fondo:      { coll: "fondos",      parent: proyectoActual },
    opcion:     { coll: "opciones",    parent: cotizacionActual },
    abono:      { coll: "abonos",      parent: ahorroActual },
  };

  // ---------- Agregaciones ----------
  const pagosDelMes = (ym) => data.value.pagos.filter((p) => p.mes === ym);
  const ingresosDelMes = (ym) => data.value.ingresos.filter((i) => (i.fecha || "").slice(0, 7) === ym);

  function gastoMesTotal(ym) {
    const pagos = sum(pagosDelMes(ym), "monto");
    const rec = sum(data.value.recurrentes.filter((r) => r.activo !== false), "monto");
    return { pagos, rec, total: pagos + rec };
  }

  function sueldoVigente(ym) {
    const s = data.value.sueldo;
    if (!s || !s.activo) return false;
    if (s.vigenteDesde && ym < s.vigenteDesde) return false;
    return true;
  }

  function ingresoSueldoMes(ym) {
    if (!sueldoVigente(ym)) return { neto: 0, aguinaldo: 0, bonos: 0, total: 0, bonosList: [] };
    const s = data.value.sueldo;
    const mesNum = Number(ym.split("-")[1]);
    const neto = num(s.netoMensual);
    const aguinaldo = mesIdx(s.aguinaldoMes) === mesNum ? num(s.aguinaldoMonto) : 0;
    const bonosList = (data.value.bonos || []).filter((b) => mesIdx(b.mes) === mesNum);
    const bonos = sum(bonosList, "monto");
    return { neto, aguinaldo, bonos, total: neto + aguinaldo + bonos, bonosList };
  }

  const ingresoTotalMes = (ym) => sum(ingresosDelMes(ym), "monto") + ingresoSueldoMes(ym).total;

  function diasHasta(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((new Date(y, m - 1, d) - t) / 86400000);
  }

  function viajesProximos() {
    return data.value.viajes
      .filter((v) => v.fecha && v.estado !== "Realizado" && diasHasta(v.fecha) >= 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  // ---------- Navegación de mes ----------
  function setMonth(ym) { currentMonth.value = ym || todayMonth(); }
  function shiftMonthBy(delta) { currentMonth.value = shiftMonth(currentMonth.value, delta); }

  // ---------- Tema ----------
  function applyTheme(t) {
    theme.value = t;
    document.documentElement.setAttribute("data-theme", t);
    const meta = document.getElementById("metaTheme");
    if (meta) meta.setAttribute("content", t === "dark" ? "#161b24" : "#ffffff");
    localStorage.setItem(LS_THEME, t);
  }
  function toggleTheme() { applyTheme(theme.value === "dark" ? "light" : "dark"); }

  // ---------- Import / Export / Demo ----------
  function importFromText(text) {
    const parsed = JSON.parse(text); // el caller maneja el error de parseo
    setData(parsed);
    save();
    return true;
  }
  function exportJSON() {
    data.value.version = SCHEMA_VERSION;
    return JSON.stringify(data.value, null, 2);
  }
  function hasData() {
    const d = data.value;
    return d.pagos.length || d.ingresos.length || d.ahorros.length || d.recurrentes.length;
  }
  function loadSample() {
    setData(SAMPLE());
    save();
  }

  // ---------- CRUD genérico (usado por el modal) ----------
  function resolveList(mod) {
    const meta = NESTED_COLL[mod];
    if (meta) {
      const parent = meta.parent();
      if (!parent) return null;
      return parent[meta.coll] || (parent[meta.coll] = []);
    }
    return data.value[mod];
  }

  // Crea o actualiza un registro. Devuelve true si fue edición.
  function commitRecord(mod, rec, id) {
    const list = resolveList(mod);
    if (!list) return false;
    const idx = list.findIndex((r) => r.id === id);
    const isEdit = idx >= 0;
    if (isEdit) {
      // Al editar proyecto/cotización/meta, conserva sus sub-colecciones (no están en el form).
      list[idx] = (mod === "proyectos" || mod === "cotizaciones" || mod === "ahorros")
        ? { ...list[idx], ...rec } : rec;
    } else {
      if (mod === "proyectos") { rec.movimientos = []; rec.etapas = []; rec.proveedores = []; rec.fondos = []; rec.presupuestoCat = {}; }
      if (mod === "cotizaciones") { rec.opciones = []; rec.elegidaId = ""; rec.movimientoId = ""; rec.fecha = isoToday(); }
      if (mod === "ahorros") { rec.abonos = []; rec.ahorrado = 0; }
      list.push(rec);
    }
    if (mod === "abono") recalcAhorrado(NESTED_COLL.abono.parent());
    return isEdit;
  }

  function deleteRecord(mod, id) {
    const meta = NESTED_COLL[mod];
    if (meta) {
      const parent = meta.parent();
      if (parent) parent[meta.coll] = parent[meta.coll].filter((r) => r.id !== id);
      if (mod === "abono") recalcAhorrado(parent);
    } else {
      data.value[mod] = data.value[mod].filter((r) => r.id !== id);
      if (mod === "proyectos" && currentProyecto.value === id) currentProyecto.value = null;
      if (mod === "cotizaciones" && currentCotizacion.value === id) currentCotizacion.value = null;
      if (mod === "ahorros" && openAhorro.value === id) openAhorro.value = null;
    }
  }

  function getRecord(mod, id) {
    const list = resolveList(mod);
    return list ? list.find((r) => r.id === id) || null : null;
  }

  // ---------- Cotizaciones (elegir opción / registrar gasto) ----------
  function elegirOpcion(cot, opId) {
    cot.elegidaId = opId;
    if (opId && (cot.estado === "Comparando" || !cot.estado)) cot.estado = "Decidido";
    if (!opId && cot.estado === "Decidido") cot.estado = "Comparando";
  }

  // Crea (o actualiza) el movimiento de gasto en el proyecto vinculado a partir de la opción elegida.
  function registrarGastoCotizacion(cot) {
    const proy = proyectoById(cot.proyectoId);
    const mt = cotizMetrics(cot);
    if (!proy || !mt.elegida) return null;
    const o = mt.elegida;
    const cant = num(cot.cantidad) || 1;
    proy.movimientos = proy.movimientos || [];
    const existente = cot.movimientoId ? proy.movimientos.find((m) => m.id === cot.movimientoId) : null;
    const datos = {
      tipo: "Salida",
      categoria: cot.categoria || "",
      concepto: `${cot.titulo} (${cant} ${cot.unidad || "u"}) — ${o.proveedor}`,
      monto: o._total,
      fecha: o.fecha || isoToday(),
      proveedor: o.proveedor || "",
      etapa: existente?.etapa || "",
      metodo: existente?.metodo || "",
      recibo: o.url || "",
      notas: `Desde cotización: ${cot.titulo}`,
    };
    let creado;
    if (existente) { Object.assign(existente, datos); creado = false; }
    else {
      const mov = { id: uid(), ...datos };
      proy.movimientos.push(mov);
      cot.movimientoId = mov.id;
      creado = true;
    }
    // Registra al proveedor en el proyecto si aún no existe.
    if (o.proveedor && !(proy.proveedores || []).some((v) => v.nombre === o.proveedor)) {
      proy.proveedores = proy.proveedores || [];
      proy.proveedores.push({ id: uid(), nombre: o.proveedor, oficio: "Proveedor", contacto: o.contacto || "", notas: "" });
    }
    cot.estado = "Comprado";
    return { creado, proyecto: proy.nombre };
  }

  // ---------- Extra: copiar los pagos del mes anterior al mes actual ----------
  // Clona los pagos del mes previo como NO pagados, sin duplicar conceptos ya
  // presentes en el mes actual. Pensado para el alta mensual recurrente.
  function copiarPagosMesAnterior() {
    const prev = shiftMonth(currentMonth.value, -1);
    const previos = data.value.pagos.filter((p) => p.mes === prev);
    const existentes = new Set(
      data.value.pagos.filter((p) => p.mes === currentMonth.value)
        .map((p) => (p.concepto || "").trim().toLowerCase()));
    let copiados = 0;
    previos.forEach((p) => {
      const key = (p.concepto || "").trim().toLowerCase();
      if (existentes.has(key)) return;
      data.value.pagos.push({ ...p, id: uid(), mes: currentMonth.value, pagado: false });
      existentes.add(key);
      copiados++;
    });
    return { copiados, mesPrev: prev, disponibles: previos.length };
  }

  return {
    // estado
    data, currentMonth, theme, saveState, moneda,
    currentProyecto, currentCotizacion, openAhorro, currentAhorro,
    // resolvers
    proyectoActual, cotizacionActual, ahorroActual, proyectoById, proyectoNombre, NESTED_COLL,
    // agregaciones
    pagosDelMes, ingresosDelMes, gastoMesTotal, sueldoVigente,
    ingresoSueldoMes, ingresoTotalMes, diasHasta, viajesProximos,
    // acciones
    load, setMonth, shiftMonthBy, applyTheme, toggleTheme,
    importFromText, exportJSON, hasData, loadSample, scheduleSave,
    commitRecord, deleteRecord, getRecord, resolveList, recalc: recalcAhorrado, uid,
    elegirOpcion, registrarGastoCotizacion, copiarPagosMesAnterior,
  };
});
