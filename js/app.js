/* ============================================================
   Mis Finanzas — app.js  (vanilla JS, sin framework)
   Persistencia: localStorage (autosave) + import/export JSON.
   ============================================================ */

(() => {
  "use strict";

  // ---------- Constantes ----------
  const LS_DATA = "finanzas:data";
  const LS_THEME = "finanzas:theme";
  const SCHEMA_VERSION = 1;

  const CATEGORIAS = [
    "Vivienda", "Servicios", "Tarjeta de crédito", "Préstamo", "Transporte",
    "Alimentación", "Salud", "Educación", "Suscripciones", "Entretenimiento",
    "Seguros", "Impuestos", "Otros",
  ];

  // Categorías de gasto para proyectos (construcción, remodelación, etc.)
  const CAT_PROYECTO = [
    "Mano de obra", "Material", "Herramienta", "Permisos/Trámites",
    "Transporte/Flete", "Renta de maquinaria", "Otros",
  ];
  const TIPOS_PROYECTO = ["Construcción", "Remodelación", "Negocio", "Vehículo", "Mudanza", "Evento", "Otro"];
  const ESTADOS_PROYECTO = ["Planeado", "En curso", "Pausado", "Terminado"];

  // Cotizaciones (comparador de precios por insumo)
  const ESTADOS_COTIZACION = ["Comparando", "Decidido", "Comprado"];
  const UNIDADES = ["pieza", "bulto", "saco", "kg", "ton", "m", "m²", "m³", "litro", "millar", "rollo", "lote", "servicio"];
  const DISPONIBILIDAD = ["En existencia", "Sobre pedido", "Agotado"];

  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const mesIdx = (nombre) => MESES.indexOf(nombre) + 1; // 1..12, 0 si no aplica

  // ---------- Estado ----------
  const emptyData = () => ({
    version: SCHEMA_VERSION,
    moneda: "MXN",
    pagos: [],        // {id, mes, banco, concepto, categoria, monto, fechaLimite, pagado, notas}
    recurrentes: [],  // {id, concepto, categoria, banco, monto, diaCobro, activo, notas}
    ingresos: [],     // {id, fecha, concepto, fuente, tipo, monto, notas}
    // Perfil de sueldo (ingreso fijo virtual, espejo de los recurrentes de gasto).
    sueldo: {
      activo: true, netoMensual: 0, brutoMensual: 0,
      frecuencia: "Quincenal", diasPago: "15, 30", vigenteDesde: "",
      aguinaldoMonto: 0, aguinaldoMes: "Diciembre", notas: "",
    },
    bonos: [],        // {id, nombre, monto, mes}  ← caen en su mes real (cada año)
    ahorros: [],      // {id, nombre, tipo, objetivo, ahorrado, fechaMeta, notas}
    viajes: [],       // {id, destino, fecha, dias, presupuesto, gastado, estado, notas}
    proyectos: [],    // {id, nombre, tipo, estado, presupuesto, fechaInicio, fechaMeta, ubicacion, notas,
                      //   movimientos:[{id,tipo,categoria,concepto,monto,fecha,proveedor,metodo,recibo,notas}],
                      //   etapas:[{id,nombre,presupuesto,avance,notas}],
                      //   presupuestoCat:{categoria:monto}, proveedores:[{id,nombre,oficio,contacto,notas}]}
    cotizaciones: [], // {id, titulo, proyectoId, categoria, cantidad, unidad, estado, notas, fecha,
                      //   elegidaId, movimientoId,
                      //   opciones:[{id,proveedor,precioUnitario,costoEnvio,contacto,disponibilidad,url,fecha,notas}]}
  });

  let DATA = emptyData();
  let VIEW = "dashboard";
  let CURRENT_PROYECTO = null;        // id del proyecto abierto (vista detalle) o null (lista)
  let CURRENT_COTIZACION = null;      // id de la cotización abierta (vista detalle) o null (lista)
  let CURRENT_AHORRO = null;          // id de la meta sobre la que se agrega/edita un abono (transitorio, para el modal)
  let OPEN_AHORRO = null;             // id de la meta abierta en vista detalle, o null (lista)
  let COTIZ_FILTER = { proyectoId: "" }; // filtro de la lista de cotizaciones (por proyecto)
  // Filtro de la tabla de movimientos del proyecto abierto. Se reinicia al abrir/cerrar proyecto.
  let MOV_FILTER = { q: "", tipo: "", categoria: "", proveedor: "", etapa: "", fondo: "", mes: "" };
  const emptyMovFilter = () => ({ q: "", tipo: "", categoria: "", proveedor: "", etapa: "", fondo: "", mes: "" });
  let CURRENT_MONTH = todayMonth();   // "YYYY-MM"
  const charts = {};                  // instancias Chart.js activas

  // ---------- Utilidades ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const fmtMoney = (n) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: DATA.moneda || "MXN" })
      .format(Number(n) || 0);

  const fmtNum = (n) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(Number(n) || 0);

  function todayMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function monthLabel(ym) {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }
  function shiftMonth(ym, delta) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Persistencia ----------
  let saveTimer = null;
  function save() {
    try {
      localStorage.setItem(LS_DATA, JSON.stringify(DATA));
      setSaveState("saved", "Guardado local");
    } catch (e) {
      setSaveState("dirty", "Error al guardar");
      console.error(e);
    }
  }
  function scheduleSave() {
    setSaveState("dirty", "Guardando…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }
  function loadLocal() {
    const raw = localStorage.getItem(LS_DATA);
    if (!raw) return false;
    try {
      DATA = migrate(JSON.parse(raw));
      return true;
    } catch (e) { console.error("localStorage corrupto", e); return false; }
  }
  function setSaveState(cls, text) {
    const el = $("#saveState");
    el.className = "save-state " + cls;
    $("#saveStateText").textContent = text;
  }

  // Normaliza/migra un objeto importado para que nunca falten arrays.
  function migrate(obj) {
    const base = emptyData();
    if (!obj || typeof obj !== "object") return base;
    base.moneda = obj.moneda || "MXN";
    for (const k of ["pagos", "recurrentes", "ingresos", "viajes", "bonos"]) {
      base[k] = Array.isArray(obj[k]) ? obj[k].map((r) => ({ id: r.id || uid(), ...r })) : [];
    }
    // ahorros: cada meta lleva su historial de abonos; el total "ahorrado" se calcula de ahí.
    base.ahorros = Array.isArray(obj.ahorros) ? obj.ahorros.map((a) => {
      const rec = { id: a.id || uid(), ...a };
      if (Array.isArray(a.abonos)) {
        rec.abonos = a.abonos.map((x) => ({ id: x.id || uid(), ...x }));
      } else {
        // Migración: lo que ya tenías ahorrado se vuelve un primer abono "Saldo inicial" (fechado hoy).
        const ini = num(a.ahorrado);
        rec.abonos = ini ? [{ id: uid(), tipo: "Abono", monto: ini, fecha: isoToday(), notas: "Saldo inicial" }] : [];
      }
      recalcAhorrado(rec);
      return rec;
    }) : [];
    // Perfil de sueldo: mezcla con los defaults para no perder llaves nuevas.
    base.sueldo = (obj.sueldo && typeof obj.sueldo === "object")
      ? { ...base.sueldo, ...obj.sueldo } : base.sueldo;
    // proyectos: normaliza también sus sub-colecciones
    base.proyectos = Array.isArray(obj.proyectos) ? obj.proyectos.map((p) => ({
      id: p.id || uid(),
      ...p,
      movimientos: Array.isArray(p.movimientos) ? p.movimientos.map((m) => ({ id: m.id || uid(), ...m })) : [],
      etapas: Array.isArray(p.etapas) ? p.etapas.map((e) => ({ id: e.id || uid(), ...e })) : [],
      proveedores: Array.isArray(p.proveedores) ? p.proveedores.map((v) => ({ id: v.id || uid(), ...v })) : [],
      fondos: Array.isArray(p.fondos) ? p.fondos.map((f) => ({ id: f.id || uid(), ...f })) : [],
      presupuestoCat: (p.presupuestoCat && typeof p.presupuestoCat === "object") ? p.presupuestoCat : {},
    })) : [];
    // cotizaciones: normaliza su sub-colección de opciones
    base.cotizaciones = Array.isArray(obj.cotizaciones) ? obj.cotizaciones.map((c) => ({
      id: c.id || uid(),
      ...c,
      opciones: Array.isArray(c.opciones) ? c.opciones.map((o) => ({ id: o.id || uid(), ...o })) : [],
    })) : [];
    return base;
  }

  // ---------- Esquemas de campos (modal + tabla) ----------
  const SCHEMAS = {
    pagos: {
      title: "pago",
      fields: [
        { k: "concepto", label: "Concepto", type: "text", required: true, span: 2 },
        { k: "banco", label: "Banco", type: "text" },
        { k: "categoria", label: "Categoría", type: "select", options: CATEGORIAS },
        { k: "monto", label: "Monto", type: "number", required: true },
        { k: "fechaLimite", label: "Fecha límite", type: "date" },
        { k: "mes", label: "Mes", type: "month", default: () => CURRENT_MONTH },
        { k: "pagado", label: "¿Ya está pagado?", type: "checkbox" },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    recurrentes: {
      title: "gasto recurrente",
      fields: [
        { k: "concepto", label: "Concepto", type: "text", required: true, span: 2 },
        { k: "categoria", label: "Categoría", type: "select", options: CATEGORIAS },
        { k: "banco", label: "Banco / método", type: "text" },
        { k: "monto", label: "Monto mensual", type: "number", required: true },
        { k: "diaCobro", label: "Día de cobro", type: "number", min: 1, max: 31 },
        { k: "activo", label: "Activo", type: "checkbox", default: () => true },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    ingresos: {
      title: "ingreso",
      fields: [
        { k: "concepto", label: "Concepto", type: "text", required: true, span: 2 },
        { k: "fuente", label: "Fuente / empresa", type: "text" },
        { k: "tipo", label: "Tipo", type: "select", options: ["Salario", "Extra", "Bono", "Inversión", "Otro"] },
        { k: "monto", label: "Monto", type: "number", required: true },
        { k: "fecha", label: "Fecha", type: "date", default: () => isoToday() },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    ahorros: {
      title: "meta / proyecto",
      fields: [
        { k: "nombre", label: "Nombre", type: "text", required: true, span: 2 },
        { k: "tipo", label: "Tipo", type: "select", options: ["Meta", "Proyecto", "Viaje", "Fondo emergencia"] },
        { k: "objetivo", label: "Objetivo", type: "number", required: true },
        { k: "fechaMeta", label: "Fecha meta", type: "date" },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    abono: {
      title: "abono",
      fields: [
        { k: "tipo", label: "Tipo", type: "select", options: ["Abono", "Retiro"], required: true, default: () => "Abono" },
        { k: "monto", label: "Monto", type: "number", required: true },
        { k: "fecha", label: "Fecha", type: "date", default: () => isoToday() },
        { k: "notas", label: "Nota (ej. quincena, aguinaldo…)", type: "text", span: 2 },
      ],
    },
    viajes: {
      title: "viaje",
      fields: [
        { k: "destino", label: "Destino", type: "text", required: true, span: 2 },
        { k: "estado", label: "Estado", type: "select", options: ["Planeado", "Reservado", "En curso", "Realizado"] },
        { k: "fecha", label: "Fecha de salida", type: "date" },
        { k: "dias", label: "Días", type: "number", min: 1 },
        { k: "presupuesto", label: "Presupuesto", type: "number", required: true },
        { k: "gastado", label: "Gastado", type: "number" },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    // ---- Proyectos y sus sub-registros ----
    proyectos: {
      title: "proyecto",
      fields: [
        { k: "nombre", label: "Nombre del proyecto", type: "text", required: true, span: 2 },
        { k: "tipo", label: "Tipo", type: "select", options: TIPOS_PROYECTO, default: () => "Construcción" },
        { k: "estado", label: "Estado", type: "select", options: ESTADOS_PROYECTO, default: () => "En curso" },
        { k: "presupuesto", label: "Presupuesto estimado", type: "number" },
        { k: "fechaInicio", label: "Fecha de inicio", type: "date", default: () => isoToday() },
        { k: "fechaMeta", label: "Fecha meta", type: "date" },
        { k: "ubicacion", label: "Ubicación", type: "text", span: 2 },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    movimiento: {
      title: "movimiento",
      fields: [
        { k: "tipo", label: "Tipo", type: "select", options: ["Salida", "Entrada", "Traspaso"], required: true, default: () => "Salida" },
        { k: "categoria", label: "Categoría", type: "select", options: CAT_PROYECTO },
        { k: "concepto", label: "Concepto", type: "text", required: true, span: 2 },
        { k: "monto", label: "Monto", type: "number", required: true },
        { k: "fecha", label: "Fecha", type: "date", default: () => isoToday() },
        { k: "proveedor", label: "Proveedor / quién", type: "text", datalist: () => proveedoresOpts() },
        { k: "etapa", label: "Etapa (opcional)", type: "select", options: () => etapasOpts() },
        { k: "metodo", label: "Método de pago", type: "select", options: ["Efectivo", "Transferencia", "Tarjeta", "Crédito", "Otro"] },
        { k: "fondo", label: "Fondo (de dónde sale el dinero)", type: "select", options: () => fondosOpts() },
        { k: "fondoDestino", label: "Fondo destino (solo para traspasos)", type: "select", options: () => fondosOpts() },
        { k: "recibo", label: "Recibo / referencia (nota o URL)", type: "text", span: 2 },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    fondo: {
      title: "fondo / bolsa de dinero",
      fields: [
        { k: "nombre", label: "Nombre (BBVA, Efectivo, Tarjeta…)", type: "text", required: true, span: 2 },
        { k: "saldoInicial", label: "Saldo disponible al iniciar", type: "number", default: () => 0 },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    etapa: {
      title: "etapa",
      fields: [
        { k: "nombre", label: "Nombre de la etapa", type: "text", required: true, span: 2 },
        { k: "presupuesto", label: "Presupuesto de la etapa", type: "number" },
        { k: "avance", label: "Avance %", type: "number", min: 0, max: 100, default: () => 0 },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    proveedor: {
      title: "proveedor / trabajador",
      fields: [
        { k: "nombre", label: "Nombre", type: "text", required: true, span: 2 },
        { k: "oficio", label: "Oficio / rol", type: "text" },
        { k: "contacto", label: "Teléfono / contacto", type: "text" },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    // ---- Cotizaciones (comparador) y sus opciones ----
    cotizaciones: {
      title: "cotización",
      fields: [
        { k: "titulo", label: "¿Qué vas a comprar? (insumo)", type: "text", required: true, span: 2 },
        { k: "proyectoId", label: "Proyecto vinculado", type: "select", options: () => proyectoOpts() },
        { k: "categoria", label: "Categoría", type: "select", options: CAT_PROYECTO },
        { k: "cantidad", label: "Cantidad", type: "number", min: 0, default: () => 1 },
        { k: "unidad", label: "Unidad", type: "text", datalist: () => UNIDADES, default: () => "pieza" },
        { k: "estado", label: "Estado", type: "select", options: ESTADOS_COTIZACION, default: () => "Comparando" },
        { k: "notas", label: "Notas / especificaciones", type: "textarea", span: 2 },
      ],
    },
    opcion: {
      title: "opción de proveedor",
      fields: [
        { k: "proveedor", label: "Proveedor / tienda", type: "text", required: true, span: 2, datalist: () => cotizProveedorOpts() },
        { k: "precioUnitario", label: "Precio por unidad", type: "number", required: true, min: 0 },
        { k: "costoEnvio", label: "Costo de envío / flete (opcional)", type: "number", min: 0 },
        { k: "disponibilidad", label: "Disponibilidad", type: "select", options: DISPONIBILIDAD },
        { k: "contacto", label: "Contacto (tel / vendedor)", type: "text" },
        { k: "fecha", label: "Fecha de la cotización", type: "date", default: () => isoToday() },
        { k: "url", label: "Liga / referencia (URL o nota)", type: "text", span: 2 },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    // Bonos / pagos extra que caen en un mes específico del año.
    bonos: {
      title: "bono",
      fields: [
        { k: "nombre", label: "Nombre del bono (PTU, puntualidad, vales…)", type: "text", required: true, span: 2 },
        { k: "monto", label: "Monto neto", type: "number", required: true },
        { k: "mes", label: "Mes en que cae", type: "select", options: MESES, required: true, default: () => "Diciembre" },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
  };

  // Esquema dinámico del perfil de sueldo (objeto singleton, no array).
  function sueldoSchema() {
    return {
      title: "sueldo",
      fields: [
        { k: "netoMensual", label: "Sueldo NETO mensual (lo que te cae)", type: "number", required: true, span: 2 },
        { k: "brutoMensual", label: "Sueldo bruto mensual (informativo)", type: "number" },
        { k: "frecuencia", label: "Frecuencia de pago", type: "select", options: ["Mensual", "Quincenal", "Semanal"], default: () => "Quincenal" },
        { k: "diasPago", label: "Días de pago (ej. 15, 30)", type: "text" },
        { k: "vigenteDesde", label: "Vigente desde (mes)", type: "month", default: () => CURRENT_MONTH },
        { k: "aguinaldoMonto", label: "Aguinaldo neto", type: "number" },
        { k: "aguinaldoMes", label: "Mes del aguinaldo", type: "select", options: MESES, default: () => "Diciembre" },
        { k: "activo", label: "Activo — cuéntalo en mis ingresos cada mes", type: "checkbox", default: () => true },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    };
  }

  // Opciones de proveedores del proyecto actual (para el select de movimientos)
  function proveedoresOpts() {
    const p = proyectoActual();
    return p && Array.isArray(p.proveedores) ? p.proveedores.map((v) => v.nombre).filter(Boolean) : [];
  }

  // Opciones de etapas del proyecto actual (para vincular cada movimiento a una etapa)
  function etapasOpts() {
    const p = proyectoActual();
    return p && Array.isArray(p.etapas) ? p.etapas.map((e) => e.nombre).filter(Boolean) : [];
  }

  // Opciones de fondos/bolsas de dinero del proyecto actual (de dónde sale/entra el dinero)
  function fondosOpts() {
    const p = proyectoActual();
    return p && Array.isArray(p.fondos) ? p.fondos.map((f) => f.nombre).filter(Boolean) : [];
  }

  // Meta de ahorro sobre la que se está agregando/editando un abono.
  function ahorroActual() {
    return DATA.ahorros.find((a) => a.id === CURRENT_AHORRO) || null;
  }

  // Recalcula el total ahorrado de una meta a partir de sus abonos (abonos − retiros).
  function recalcAhorrado(a) {
    if (!a) return 0;
    const abs = a.abonos || [];
    a.ahorrado = sum(abs.filter((x) => x.tipo !== "Retiro"), "monto") - sum(abs.filter((x) => x.tipo === "Retiro"), "monto");
    return a.ahorrado;
  }

  // Mapea un sub-esquema a la colección anidada y a su registro padre (proyecto, cotización o meta).
  const NESTED_COLL = {
    movimiento: { coll: "movimientos", parent: proyectoActual },
    etapa:      { coll: "etapas",      parent: proyectoActual },
    proveedor:  { coll: "proveedores", parent: proyectoActual },
    fondo:      { coll: "fondos",      parent: proyectoActual },
    opcion:     { coll: "opciones",    parent: cotizacionActual },
    abono:      { coll: "abonos",      parent: ahorroActual },
  };

  // Opciones de proyecto para el select de cotizaciones ({value:id, label:nombre}).
  function proyectoOpts() {
    return DATA.proyectos.map((p) => ({ value: p.id, label: p.nombre }));
  }
  // Sugerencias de proveedor al capturar una opción: los del proyecto vinculado + los ya capturados.
  function cotizProveedorOpts() {
    const c = cotizacionActual();
    const set = new Set();
    if (c) {
      const proy = proyectoById(c.proyectoId);
      if (proy) (proy.proveedores || []).forEach((v) => v.nombre && set.add(v.nombre));
      (c.opciones || []).forEach((o) => o.proveedor && set.add(o.proveedor));
    }
    return [...set];
  }

  function isoToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // ============================================================
  //  RENDER
  // ============================================================
  function render() {
    // marca nav activa
    $$(".nav-item").forEach((b) => b.classList.toggle("is-active", b.dataset.view === VIEW));
    destroyCharts();
    const c = $("#content");
    if (VIEW === "dashboard")        c.innerHTML = viewDashboard();
    else if (VIEW === "pagos")       c.innerHTML = viewPagos();
    else if (VIEW === "recurrentes") c.innerHTML = viewRecurrentes();
    else if (VIEW === "ingresos")    c.innerHTML = viewIngresos();
    else if (VIEW === "sueldo")      c.innerHTML = viewSueldo();
    else if (VIEW === "ahorros")     c.innerHTML = OPEN_AHORRO ? viewAhorroDetalle() : viewAhorros();
    else if (VIEW === "viajes")      c.innerHTML = viewViajes();
    else if (VIEW === "proyectos")   c.innerHTML = CURRENT_PROYECTO ? viewProyectoDetalle() : viewProyectos();
    else if (VIEW === "cotizaciones") c.innerHTML = CURRENT_COTIZACION ? viewCotizacionDetalle() : viewCotizaciones();
    // charts después de inyectar el HTML
    if (VIEW === "dashboard") renderDashboardCharts();
    else if (VIEW === "sueldo") renderSueldoChart();
    else if (VIEW === "viajes") renderViajesChart();
    else if (VIEW === "proyectos" && CURRENT_PROYECTO) renderProyectoCharts();
    else if (VIEW === "ahorros" && OPEN_AHORRO) renderAhorroCharts();
    else if (VIEW === "cotizaciones" && CURRENT_COTIZACION) renderCotizacionChart();
    c.scrollTop = 0;
  }

  // ---------- Agregaciones ----------
  const pagosDelMes = (ym) => DATA.pagos.filter((p) => p.mes === ym);
  const ingresosDelMes = (ym) => DATA.ingresos.filter((i) => (i.fecha || "").slice(0, 7) === ym);
  const sum = (arr, key) => arr.reduce((a, r) => a + num(r[key]), 0);

  function gastoMesTotal(ym) {
    const pagos = sum(pagosDelMes(ym), "monto");
    const rec = sum(DATA.recurrentes.filter((r) => r.activo !== false), "monto");
    return { pagos, rec, total: pagos + rec };
  }

  // ¿El sueldo aplica a este mes? (activo y mes >= vigenteDesde)
  function sueldoVigente(ym) {
    const s = DATA.sueldo;
    if (!s || !s.activo) return false;
    if (s.vigenteDesde && ym < s.vigenteDesde) return false;
    return true;
  }
  // Ingreso fijo (virtual) del sueldo para un mes: neto + aguinaldo (si cae) + bonos del mes.
  function ingresoSueldoMes(ym) {
    if (!sueldoVigente(ym)) return { neto: 0, aguinaldo: 0, bonos: 0, total: 0, bonosList: [] };
    const s = DATA.sueldo;
    const mesNum = Number(ym.split("-")[1]);
    const neto = num(s.netoMensual);
    const aguinaldo = mesIdx(s.aguinaldoMes) === mesNum ? num(s.aguinaldoMonto) : 0;
    const bonosList = (DATA.bonos || []).filter((b) => mesIdx(b.mes) === mesNum);
    const bonos = sum(bonosList, "monto");
    return { neto, aguinaldo, bonos, total: neto + aguinaldo + bonos, bonosList };
  }
  // Ingreso total del mes = registros manuales + sueldo virtual.
  function ingresoTotalMes(ym) {
    return sum(ingresosDelMes(ym), "monto") + ingresoSueldoMes(ym).total;
  }

  function diasHasta(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((new Date(y, m - 1, d) - t) / 86400000);
  }
  // Próximos viajes: con fecha futura y que no estén "Realizado", ordenados por fecha.
  function viajesProximos() {
    return DATA.viajes
      .filter((v) => v.fecha && v.estado !== "Realizado" && diasHasta(v.fecha) >= 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  // ---------- Vista: Dashboard ----------
  function viewDashboard() {
    const ym = CURRENT_MONTH;
    const sld = ingresoSueldoMes(ym);
    const ing = sum(ingresosDelMes(ym), "monto") + sld.total;
    const ingFoot = sld.total > 0
      ? `Sueldo ${fmtMoney(sld.neto)}${sld.aguinaldo ? " · 🎁 Aguinaldo " + fmtMoney(sld.aguinaldo) : ""}${sld.bonos ? " · 🎁 Bonos " + fmtMoney(sld.bonos) : ""}${ingresosDelMes(ym).length ? " · +" + ingresosDelMes(ym).length + " extra" : ""}`
      : ingresosDelMes(ym).length + " registro(s)";
    const g = gastoMesTotal(ym);
    const balance = ing - g.total;
    const pendiente = sum(pagosDelMes(ym).filter((p) => !p.pagado), "monto");
    const ahorrado = sum(DATA.ahorros, "ahorrado");
    const objetivo = sum(DATA.ahorros, "objetivo");

    // próximo viaje
    const prox = viajesProximos();
    const pv = prox[0];
    let kpiViaje;
    if (pv) {
      const dd = diasHasta(pv.fecha);
      const cuando = dd === 0 ? "¡Hoy!" : dd === 1 ? "Mañana" : `En ${dd} días`;
      kpiViaje = kpi("Próximo viaje", `🧳 ${esc(pv.destino)}`, "", `${cuando} · ${fmtDate(pv.fecha)} · ${fmtMoney(pv.presupuesto)}`);
    } else {
      kpiViaje = kpi("Próximo viaje", "—", "", DATA.viajes.length ? "Sin viajes próximos" : "Sin viajes aún");
    }

    return `
      <div class="view-head">
        <div>
          <div class="view-title">Dashboard</div>
          <div class="view-sub">Resumen de ${esc(monthLabel(ym))}</div>
        </div>
      </div>

      <div class="kpi-grid">
        ${kpi("Ingresos del mes", fmtMoney(ing), "pos", ingFoot)}
        ${kpi("Gastos del mes", fmtMoney(g.total), "neg", `Pagos ${fmtMoney(g.pagos)} · Fijos ${fmtMoney(g.rec)}`)}
        ${kpi("Balance", fmtMoney(balance), balance >= 0 ? "pos" : "neg", balance >= 0 ? "Te sobra" : "Vas en rojo")}
        ${kpi("Por pagar", fmtMoney(pendiente), pendiente > 0 ? "neg" : "pos", pagosDelMes(ym).filter(p=>!p.pagado).length + " pendiente(s)")}
        ${kpi("Total ahorrado", fmtMoney(ahorrado), "", objetivo ? `de ${fmtMoney(objetivo)} meta` : "Sin metas aún")}
        ${kpiViaje}
      </div>

      ${prox.length ? miniResumenViajes(prox) : ""}

      <div class="chart-grid">
        <div class="card"><div class="card-title">Ingresos vs Gastos (últimos 6 meses)</div><div class="chart-box"><canvas id="chIngGas"></canvas></div></div>
        <div class="card"><div class="card-title">Gastos por categoría — ${esc(monthLabel(ym))}</div><div class="chart-box"><canvas id="chCat"></canvas></div></div>
        <div class="card"><div class="card-title">Estado de pagos del mes</div><div class="chart-box"><canvas id="chPagos"></canvas></div></div>
        <div class="card"><div class="card-title">Progreso de ahorros</div><div class="chart-box"><canvas id="chAhorro"></canvas></div></div>
      </div>
    `;
  }

  function kpi(label, value, cls, foot) {
    return `<div class="kpi">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-value ${cls}">${value}</div>
      <div class="kpi-foot">${esc(foot)}</div>
    </div>`;
  }

  // Mini-resumen de viajes próximos para el dashboard (máx 3)
  function miniResumenViajes(prox) {
    const rows = prox.slice(0, 3).map((v) => {
      const dd = diasHasta(v.fecha);
      const cuando = dd === 0 ? "Hoy" : dd === 1 ? "Mañana" : `En ${dd} d`;
      const pres = num(v.presupuesto), gas = num(v.gastado);
      const pct = pres > 0 ? Math.min(100, Math.round((gas / pres) * 100)) : 0;
      const over = pres > 0 && gas > pres;
      return `<div class="mini-trip">
        <div class="mini-trip-info">
          <span class="mini-trip-dest">🧳 ${esc(v.destino)}</span>
          <span class="muted">${fmtDate(v.fecha)}${v.dias ? " · " + esc(v.dias) + " días" : ""}</span>
        </div>
        <div class="mini-trip-bar">
          <div class="bar ${over ? "" : "done"}"><span style="width:${pct}%;${over ? "background:var(--danger)" : ""}"></span></div>
          <span class="muted">${fmtMoney(gas)} / ${fmtMoney(pres)}</span>
        </div>
        <span class="pill ${dd <= 7 ? "pend" : "muted"}">${cuando}</span>
      </div>`;
    }).join("");
    return `<div class="card" style="margin-bottom:22px">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Próximos viajes</span>
        <button class="btn btn-ghost btn-sm js-goto" data-view="viajes">Ver todos →</button>
      </div>
      ${rows}
    </div>`;
  }

  // ---------- Charts ----------
  function destroyCharts() {
    Object.keys(charts).forEach((k) => { charts[k]?.destroy(); delete charts[k]; });
  }
  function themeColors() {
    const css = getComputedStyle(document.documentElement);
    return {
      text: css.getPropertyValue("--text").trim(),
      soft: css.getPropertyValue("--text-soft").trim(),
      grid: css.getPropertyValue("--border").trim(),
      primary: css.getPropertyValue("--primary").trim(),
      success: css.getPropertyValue("--success").trim(),
      danger: css.getPropertyValue("--danger").trim(),
    };
  }
  const PALETTE = ["#4f6ef7","#16a34a","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16","#f97316","#14b8a6","#6366f1","#a855f7","#64748b"];

  function renderDashboardCharts() {
    if (typeof Chart === "undefined") return;
    const col = themeColors();
    Chart.defaults.color = col.soft;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

    // 1) Ingresos vs gastos, 6 meses
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(shiftMonth(CURRENT_MONTH, -i));
    const ingData = months.map((m) => ingresoTotalMes(m));
    const recFijo = sum(DATA.recurrentes.filter((r) => r.activo !== false), "monto");
    const gasData = months.map((m) => sum(pagosDelMes(m), "monto") + recFijo);
    mkChart("chIngGas", {
      type: "bar",
      data: {
        labels: months.map((m) => monthLabel(m).replace(" de ", " ")),
        datasets: [
          { label: "Ingresos", data: ingData, backgroundColor: col.success, borderRadius: 6 },
          { label: "Gastos", data: gasData, backgroundColor: col.danger, borderRadius: 6 },
        ],
      },
      options: baseOpts(col, true),
    });

    // 2) Gastos por categoría (pagos del mes + recurrentes activos)
    const cat = {};
    pagosDelMes(CURRENT_MONTH).forEach((p) => { const k = p.categoria || "Otros"; cat[k] = (cat[k] || 0) + num(p.monto); });
    DATA.recurrentes.filter((r) => r.activo !== false).forEach((r) => { const k = r.categoria || "Otros"; cat[k] = (cat[k] || 0) + num(r.monto); });
    const catKeys = Object.keys(cat);
    if (catKeys.length) {
      mkChart("chCat", {
        type: "doughnut",
        data: { labels: catKeys, datasets: [{ data: catKeys.map((k) => cat[k]), backgroundColor: PALETTE, borderWidth: 0 }] },
        options: { ...donutOpts(col) },
      });
    } else emptyCanvas("chCat");

    // 3) Estado de pagos del mes
    const ps = pagosDelMes(CURRENT_MONTH);
    const pagado = sum(ps.filter((p) => p.pagado), "monto");
    const pend = sum(ps.filter((p) => !p.pagado), "monto");
    if (pagado + pend > 0) {
      mkChart("chPagos", {
        type: "doughnut",
        data: { labels: ["Pagado", "Pendiente"], datasets: [{ data: [pagado, pend], backgroundColor: [col.success, col.danger], borderWidth: 0 }] },
        options: donutOpts(col),
      });
    } else emptyCanvas("chPagos");

    // 4) Progreso de ahorros (barras horizontales)
    if (DATA.ahorros.length) {
      mkChart("chAhorro", {
        type: "bar",
        data: {
          labels: DATA.ahorros.map((a) => a.nombre),
          datasets: [
            { label: "Ahorrado", data: DATA.ahorros.map((a) => num(a.ahorrado)), backgroundColor: col.primary, borderRadius: 6 },
            { label: "Objetivo", data: DATA.ahorros.map((a) => Math.max(0, num(a.objetivo) - num(a.ahorrado))), backgroundColor: col.grid, borderRadius: 6 },
          ],
        },
        options: { ...baseOpts(col, true), indexAxis: "y", scales: { x: { stacked: true, ticks: { callback: (v) => "$" + fmtNum(v) }, grid: { color: col.grid } }, y: { stacked: true, grid: { display: false } } } },
      });
    } else emptyCanvas("chAhorro");
  }

  function mkChart(id, cfg) {
    const el = document.getElementById(id);
    if (!el) return;
    charts[id] = new Chart(el, cfg);
  }
  function baseOpts(col, money) {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 12, padding: 14 } }, tooltip: { callbacks: money ? { label: (c) => `${c.dataset.label}: ${fmtMoney(c.raw)}` } : {} } },
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => "$" + fmtNum(v) }, grid: { color: col.grid } }, x: { grid: { display: false } } },
    };
  }
  function donutOpts(col) {
    return {
      responsive: true, maintainAspectRatio: false, cutout: "62%",
      plugins: { legend: { position: "right", labels: { boxWidth: 12, padding: 12 } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtMoney(c.raw)}` } } },
    };
  }
  function emptyCanvas(id) {
    const el = document.getElementById(id);
    if (el) el.parentElement.innerHTML = `<div class="empty" style="padding:40px 0"><div class="empty-ico">📭</div><p>Sin datos para mostrar</p></div>`;
  }

  // ---------- Vista: Pagos ----------
  function viewPagos() {
    const ps = pagosDelMes(CURRENT_MONTH).slice().sort((a, b) => (a.fechaLimite || "").localeCompare(b.fechaLimite || ""));
    const total = sum(ps, "monto");
    const pagado = sum(ps.filter((p) => p.pagado), "monto");
    const rows = ps.map((p) => {
      const estado = pagoEstado(p);
      return `<tr data-id="${p.id}">
        <td><input type="checkbox" class="chk js-toggle" ${p.pagado ? "checked" : ""}></td>
        <td><b>${esc(p.concepto)}</b></td>
        <td>${esc(p.banco) || "<span class='muted'>—</span>"}</td>
        <td><span class="pill muted">${esc(p.categoria) || "—"}</span></td>
        <td>${fmtDate(p.fechaLimite)}</td>
        <td>${estado}</td>
        <td class="t-num">${fmtMoney(p.monto)}</td>
        <td class="notes-cell">${esc(p.notas) || ""}</td>
        ${actionsCell()}
      </tr>`;
    }).join("");

    return `
      <div class="view-head">
        <div>
          <div class="view-title">Pagos del mes</div>
          <div class="view-sub">${esc(monthLabel(CURRENT_MONTH))} · ${ps.length} pago(s) · Pagado ${fmtMoney(pagado)} de ${fmtMoney(total)}</div>
        </div>
        <button class="btn btn-primary js-add" data-mod="pagos">＋ Agregar pago</button>
      </div>
      ${ps.length ? `<div class="table-wrap"><div class="table-scroll"><table>
        <thead><tr><th></th><th>Concepto</th><th>Banco</th><th>Categoría</th><th>Fecha límite</th><th>Estado</th><th class="t-num">Monto</th><th>Notas</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>` : emptyState("pagos", "Sin pagos en este mes", "Agrega tus pagos o cámbiate de mes en la barra superior.")}
    `;
  }
  function pagoEstado(p) {
    if (p.pagado) return `<span class="pill ok">✓ Pagado</span>`;
    if (p.fechaLimite && p.fechaLimite < isoToday()) return `<span class="pill late">⚠ Vencido</span>`;
    return `<span class="pill pend">● Pendiente</span>`;
  }

  // ---------- Vista: Recurrentes ----------
  function viewRecurrentes() {
    const rs = DATA.recurrentes.slice().sort((a, b) => num(a.diaCobro) - num(b.diaCobro));
    const totalAct = sum(rs.filter((r) => r.activo !== false), "monto");
    const rows = rs.map((r) => `<tr data-id="${r.id}">
        <td><b>${esc(r.concepto)}</b></td>
        <td><span class="pill muted">${esc(r.categoria) || "—"}</span></td>
        <td>${esc(r.banco) || "<span class='muted'>—</span>"}</td>
        <td>${r.diaCobro ? "Día " + esc(r.diaCobro) : "<span class='muted'>—</span>"}</td>
        <td>${r.activo !== false ? `<span class="pill ok">Activo</span>` : `<span class="pill muted">Pausado</span>`}</td>
        <td class="t-num">${fmtMoney(r.monto)}</td>
        <td class="notes-cell">${esc(r.notas) || ""}</td>
        ${actionsCell()}
      </tr>`).join("");

    return `
      <div class="view-head">
        <div>
          <div class="view-title">Gastos recurrentes</div>
          <div class="view-sub">${rs.length} servicio(s) · Total mensual activo ${fmtMoney(totalAct)} · ${fmtMoney(totalAct * 12)} al año</div>
        </div>
        <button class="btn btn-primary js-add" data-mod="recurrentes">＋ Agregar recurrente</button>
      </div>
      ${rs.length ? `<div class="table-wrap"><div class="table-scroll"><table>
        <thead><tr><th>Concepto</th><th>Categoría</th><th>Método</th><th>Cobro</th><th>Estado</th><th class="t-num">Monto/mes</th><th>Notas</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>` : emptyState("recurrentes", "Sin gastos recurrentes", "Registra tus suscripciones y servicios fijos mensuales.")}
    `;
  }

  // ---------- Vista: Ingresos ----------
  function viewIngresos() {
    const is = DATA.ingresos.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const ym = CURRENT_MONTH;
    const totalMes = sum(ingresosDelMes(ym), "monto");
    const rows = is.map((i) => `<tr data-id="${i.id}">
        <td>${fmtDate(i.fecha)}</td>
        <td><b>${esc(i.concepto)}</b></td>
        <td>${esc(i.fuente) || "<span class='muted'>—</span>"}</td>
        <td><span class="pill muted">${esc(i.tipo) || "—"}</span></td>
        <td class="t-num" style="color:var(--success)">${fmtMoney(i.monto)}</td>
        <td class="notes-cell">${esc(i.notas) || ""}</td>
        ${actionsCell()}
      </tr>`).join("");

    return `
      <div class="view-head">
        <div>
          <div class="view-title">Ingresos</div>
          <div class="view-sub">${is.length} registro(s) · ${esc(monthLabel(ym))}: ${fmtMoney(totalMes)}</div>
        </div>
        <button class="btn btn-primary js-add" data-mod="ingresos">＋ Agregar ingreso</button>
      </div>
      ${sueldoVigente(ym) && ingresoSueldoMes(ym).total > 0 ? `<div class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <span>💼 Tu sueldo (<b>${fmtMoney(ingresoSueldoMes(ym).total)}</b> este mes) ya se cuenta automáticamente. Esta lista es para ingresos <b>extra/eventuales</b>.</span>
        <button class="btn btn-ghost btn-sm js-goto" data-view="sueldo">Configurar sueldo →</button>
      </div>` : ""}
      ${is.length ? `<div class="table-wrap"><div class="table-scroll"><table>
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Fuente</th><th>Tipo</th><th class="t-num">Monto</th><th>Notas</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>` : emptyState("ingresos", "Sin ingresos registrados", "Agrega tus salarios y otros ingresos.")}
    `;
  }

  // ---------- Vista: Sueldo / Nómina ----------
  function viewSueldo() {
    const s = DATA.sueldo || {};
    const bonos = (DATA.bonos || []).slice().sort((a, b) => mesIdx(a.mes) - mesIdx(b.mes));
    const neto = num(s.netoMensual), bruto = num(s.brutoMensual), agui = num(s.aguinaldoMonto);
    const totalBonos = sum(bonos, "monto");
    const anual = neto * 12 + agui + totalBonos;
    const sld = ingresoSueldoMes(CURRENT_MONTH);

    const bonoRows = bonos.map((b) => `<tr data-id="${b.id}" data-mod="bonos">
        <td><b>${esc(b.nombre)}</b></td>
        <td><span class="pill muted">${esc(b.mes) || "—"}</span></td>
        <td class="t-num" style="color:var(--success)">${fmtMoney(b.monto)}</td>
        <td class="notes-cell">${esc(b.notas) || ""}</td>
        ${actionsCell()}
      </tr>`).join("");

    return `
      <div class="view-head">
        <div>
          <div class="view-title">Sueldo / Nómina</div>
          <div class="view-sub">Tu ingreso fijo se cuenta solo cada mes${s.vigenteDesde ? " desde " + esc(monthLabel(s.vigenteDesde)) : ""}${s.activo ? "" : " · ⏸️ inactivo"}.</div>
        </div>
        <button class="btn btn-primary js-add" data-mod="sueldo">✏️ Configurar sueldo</button>
      </div>

      <div class="kpi-grid">
        ${kpi("Sueldo neto mensual", fmtMoney(neto), "pos", s.frecuencia ? esc(s.frecuencia) + (s.diasPago ? " · días " + esc(s.diasPago) : "") : "Sin configurar")}
        ${kpi("Sueldo bruto mensual", fmtMoney(bruto), "", "Informativo (no se cuenta)")}
        ${kpi("Aguinaldo", fmtMoney(agui), "", agui ? "Cae en " + esc(s.aguinaldoMes) : "Sin aguinaldo")}
        ${kpi("Ingreso anual estimado", fmtMoney(anual), "pos", "Neto×12 + aguinaldo + bonos")}
        ${kpi("Cae este mes", fmtMoney(sld.total), sld.total > 0 ? "pos" : "", !sueldoVigente(CURRENT_MONTH) ? "Inactivo este mes" : "Neto" + (sld.aguinaldo ? " + aguinaldo" : "") + (sld.bonos ? " + bonos" : ""))}
        ${kpi("Estado", s.activo ? "Activo ✓" : "Inactivo", s.activo ? "pos" : "neg", s.activo ? "Se suma a tus ingresos" : "No se está contando")}
      </div>

      ${anual > 0 ? `<div class="chart-grid"><div class="card"><div class="card-title">Composición de tu ingreso anual</div><div class="chart-box"><canvas id="chSueldo"></canvas></div></div></div>` : ""}

      <div class="view-head" style="margin-top:8px">
        <div>
          <div class="view-title" style="font-size:18px">🎁 Bonos y pagos extra</div>
          <div class="view-sub">${bonos.length} registro(s) · Total anual ${fmtMoney(totalBonos)} · cada uno cae en el mes que indiques</div>
        </div>
        <button class="btn btn-primary js-add" data-mod="bonos">＋ Agregar bono</button>
      </div>
      ${bonos.length ? `<div class="table-wrap"><div class="table-scroll"><table>
        <thead><tr><th>Nombre</th><th>Mes</th><th class="t-num">Monto</th><th>Notas</th><th></th></tr></thead>
        <tbody>${bonoRows}</tbody>
      </table></div></div>` : emptyState("bonos", "Sin bonos registrados", "Agrega PTU/utilidades, bono de puntualidad, vales, etc. Caen en su mes real.")}
    `;
  }

  function renderSueldoChart() {
    if (typeof Chart === "undefined") return;
    const s = DATA.sueldo || {};
    const neto = num(s.netoMensual) * 12, agui = num(s.aguinaldoMonto), bonos = sum(DATA.bonos || [], "monto");
    if (neto + agui + bonos <= 0) return;
    const col = themeColors();
    Chart.defaults.color = col.soft;
    mkChart("chSueldo", {
      type: "doughnut",
      data: { labels: ["Sueldo (×12)", "Aguinaldo", "Bonos"], datasets: [{ data: [neto, agui, bonos], backgroundColor: [col.primary, "#f59e0b", col.success], borderWidth: 0 }] },
      options: donutOpts(col),
    });
  }

  // ---------- Vista: Ahorros ----------
  // Historial de abonos/retiros de una meta (se muestra al desplegar la tarjeta).
  function abonosHistory(a) {
    const abs = (a.abonos || []).slice().sort((x, y) => (y.fecha || "").localeCompare(x.fecha || ""));
    if (!abs.length) return `<div class="abonos-box"><p class="muted" style="margin:0">Sin abonos aún. Usa “＋ Abono”.</p></div>`;
    const rows = abs.map((x) => {
      const ret = x.tipo === "Retiro";
      return `<div class="abono-row" data-id="${x.id}" data-mod="abono" data-parent="${a.id}">
        <span class="abono-date">${fmtDate(x.fecha)}</span>
        <span class="abono-amt" style="color:${ret ? "var(--danger)" : "var(--success)"}">${ret ? "−" : "+"} ${fmtMoney(x.monto)}</span>
        <span class="abono-note">${esc(x.notas) || (ret ? "Retiro" : "Abono")}</span>
        <span class="abono-acts">
          <button class="icon-btn js-edit" title="Editar">✏️</button>
          <button class="icon-btn js-del" title="Eliminar">🗑️</button>
        </span>
      </div>`;
    }).join("");
    return `<div class="abonos-box">${rows}</div>`;
  }

  function viewAhorros() {
    const as = DATA.ahorros;
    const cards = as.map((a) => {
      const obj = num(a.objetivo), ah = num(a.ahorrado);
      const pct = obj > 0 ? Math.min(100, Math.round((ah / obj) * 100)) : 0;
      const done = obj > 0 && ah >= obj;
      const falta = Math.max(0, obj - ah);
      const nAbonos = (a.abonos || []).length;
      return `<div class="goal" data-id="${a.id}">
        <div class="goal-actions">
          <button class="icon-btn js-edit" title="Editar">✏️</button>
          <button class="icon-btn js-del" title="Eliminar">🗑️</button>
        </div>
        <div class="goal-head">
          <div class="goal-name">${esc(a.nombre)}</div>
        </div>
        <span class="goal-tag">${esc(a.tipo) || "Meta"}${a.fechaMeta ? " · " + fmtDate(a.fechaMeta) : ""}</span>
        <div class="goal-amounts"><b>${fmtMoney(ah)}</b> de <b>${fmtMoney(obj)}</b>${falta > 0 ? ` · faltan ${fmtMoney(falta)}` : ""}</div>
        <div class="bar ${done ? "done" : ""}"><span style="width:${pct}%"></span></div>
        <div class="goal-pct">${pct}%${done ? " 🎉 ¡Completado!" : ""}</div>
        ${a.notas ? `<div class="goal-amounts" style="margin-top:10px">${esc(a.notas)}</div>` : ""}
        <div class="goal-foot">
          <button class="btn btn-ghost btn-sm js-add-abono" data-id="${a.id}">＋ Abono</button>
          <button class="btn btn-primary btn-sm js-open-ahorro" data-id="${a.id}">Abrir${nAbonos ? ` · ${nAbonos} abono(s)` : ""} →</button>
        </div>
      </div>`;
    }).join("");

    return `
      <div class="view-head">
        <div>
          <div class="view-title">Ahorros y proyectos</div>
          <div class="view-sub">${as.length} meta(s) · Ahorrado ${fmtMoney(sum(as, "ahorrado"))} de ${fmtMoney(sum(as, "objetivo"))}</div>
        </div>
        <button class="btn btn-primary js-add" data-mod="ahorros">＋ Nueva meta</button>
      </div>
      ${as.length ? `<div class="goal-grid">${cards}</div>` : emptyState("ahorros", "Sin metas de ahorro", "Crea metas, proyectos o viajes para darles seguimiento.")}
    `;
  }

  // ---------- Detalle de una meta de ahorro ----------
  function ahorroAbierto() {
    return DATA.ahorros.find((a) => a.id === OPEN_AHORRO) || null;
  }

  // Días entre dos fechas ISO ("YYYY-MM-DD"); positivo si b es posterior a a.
  function diasEntre(a, b) {
    const da = Date.parse(a), db = Date.parse(b);
    if (isNaN(da) || isNaN(db)) return 0;
    return (db - da) / 86400000;
  }
  // Suma N meses a hoy y devuelve "YYYY-MM".
  function mesDesdeHoy(nMeses) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + nMeses);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  // Métricas e insights de una meta: ritmo histórico, pronóstico, requerido/mes, hitos y rachas.
  function ahorroInsights(a) {
    const obj = num(a.objetivo), ah = num(a.ahorrado);
    const falta = Math.max(0, obj - ah);
    const pct = obj > 0 ? Math.min(100, Math.round((ah / obj) * 100)) : 0;
    const completed = obj > 0 && ah >= obj;

    const abonos = (a.abonos || []).slice().sort((x, y) => (x.fecha || "").localeCompare(y.fecha || ""));
    const aportes = abonos.filter((x) => x.tipo !== "Retiro");
    const hoy = isoToday();
    const firstDate = abonos.length ? abonos[0].fecha : null;

    // Ritmo histórico mensual (neto): ahorrado / meses transcurridos desde el primer abono.
    let ritmoMensual = 0, mesesTranscurridos = 0;
    if (firstDate) {
      mesesTranscurridos = Math.max(0, diasEntre(firstDate, hoy)) / 30.4375;
      if (mesesTranscurridos >= 0.5 && ah > 0) ritmoMensual = ah / mesesTranscurridos;
    }

    // Pronóstico de fecha al ritmo histórico.
    let pronostico = null;
    if (!completed && ritmoMensual > 0) pronostico = mesDesdeHoy(Math.ceil(falta / ritmoMensual));

    // Cuánto abonar al mes para llegar a la fecha meta.
    let requeridoMensual = null, mesesRestantes = null, metaVencida = false;
    if (!completed && a.fechaMeta) {
      mesesRestantes = diasEntre(hoy, a.fechaMeta) / 30.4375;
      if (mesesRestantes > 0) requeridoMensual = falta / mesesRestantes;
      else metaVencida = true;
    }

    // Hitos 25/50/75/100.
    const HITOS = [25, 50, 75, 100];
    const siguienteHito = HITOS.find((h) => pct < h) || null;
    const montoSiguiente = siguienteHito ? Math.max(0, (obj * siguienteHito) / 100 - ah) : 0;

    // Racha: meses consecutivos con al menos un abono, hasta el mes más reciente con abono.
    const mesesConAbono = [...new Set(aportes.map((x) => (x.fecha || "").slice(0, 7)).filter(Boolean))].sort();
    let racha = 0;
    if (mesesConAbono.length) {
      racha = 1;
      for (let i = mesesConAbono.length - 1; i > 0; i--) {
        if (shiftMonth(mesesConAbono[i], -1) === mesesConAbono[i - 1]) racha++; else break;
      }
    }
    const mejorAbono = aportes.reduce((m, x) => Math.max(m, num(x.monto)), 0);

    return {
      obj, ah, falta, pct, completed, ritmoMensual, pronostico,
      requeridoMensual, mesesRestantes, metaVencida,
      siguienteHito, montoSiguiente, racha, mejorAbono,
      numAbonos: abonos.length, numAportes: aportes.length,
    };
  }

  // Una "píldora" de tip con tono e icono.
  const tipRow = (tono, ico, html) => `<div class="tip-row"><span class="pill ${tono}">${ico}</span><span>${html}</span></div>`;

  function ahorroTips(ins, a) {
    const tips = [];
    // 1) Pronóstico de fecha
    if (ins.completed) {
      tips.push(tipRow("ok", "🎉", `<b>¡Meta completada!</b> Juntaste ${fmtMoney(ins.ah)} de ${fmtMoney(ins.obj)}.`));
    } else if (ins.pronostico) {
      tips.push(tipRow("ok", "📅", `A tu ritmo histórico (~${fmtMoney(ins.ritmoMensual)}/mes) llegas a tu objetivo aprox. en <b>${esc(monthLabel(ins.pronostico))}</b>.`));
    } else {
      tips.push(tipRow("muted", "📅", `Aún no puedo estimar tu fecha de llegada. Registra abonos en distintos meses y aquí verás el pronóstico.`));
    }
    // 2) Cuánto abonar al mes para la fecha meta
    if (!ins.completed) {
      if (!a.fechaMeta) {
        tips.push(tipRow("muted", "🎯", `Define una <b>fecha meta</b> (editando la meta) para calcular cuánto necesitas abonar al mes.`));
      } else if (ins.metaVencida) {
        tips.push(tipRow("late", "⏰", `Tu fecha meta (${fmtDate(a.fechaMeta)}) ya pasó y aún faltan ${fmtMoney(ins.falta)}. ${ins.pronostico ? `A tu ritmo, la alcanzarías en ${esc(monthLabel(ins.pronostico))}.` : ""}`));
      } else {
        const acelera = ins.ritmoMensual > 0 && ins.requeridoMensual > ins.ritmoMensual;
        const buenRitmo = ins.ritmoMensual > 0 && ins.ritmoMensual >= ins.requeridoMensual;
        let extra = "";
        if (buenRitmo) extra = ` Vas con buen ritmo 👍`;
        else if (acelera) extra = ` Te falta ~${fmtMoney(ins.requeridoMensual - ins.ritmoMensual)}/mes más que tu ritmo actual.`;
        tips.push(tipRow(acelera ? "late" : "ok", "🎯", `Para llegar el <b>${fmtDate(a.fechaMeta)}</b> necesitas abonar ~<b>${fmtMoney(ins.requeridoMensual)}/mes</b>.${extra}`));
      }
    }
    // 3) Hitos
    if (!ins.completed && ins.siguienteHito) {
      tips.push(tipRow("pend", "🏁", `Siguiente hito: <b>${ins.siguienteHito}%</b> — te faltan ${fmtMoney(ins.montoSiguiente)} para alcanzarlo.`));
    }
    // 4) Racha / logros
    if (ins.racha > 1) {
      tips.push(tipRow("ok", "🔥", `Llevas <b>${ins.racha} meses seguidos</b> abonando. ¡Sigue así!`));
    }
    if (ins.mejorAbono > 0) {
      tips.push(tipRow("muted", "⭐", `Tu mejor abono fue de <b>${fmtMoney(ins.mejorAbono)}</b> · ${ins.numAbonos} movimiento(s) en total.`));
    }
    return tips.join("");
  }

  function viewAhorroDetalle() {
    const a = ahorroAbierto();
    if (!a) { OPEN_AHORRO = null; return viewAhorros(); }
    const ins = ahorroInsights(a);
    const hitosBadges = [25, 50, 75, 100].map((h) =>
      `<span class="hito ${ins.pct >= h ? "hito-on" : ""}">${h}%</span>`).join("");

    return `
      <div class="view-head">
        <div>
          <button class="btn btn-ghost btn-sm js-back-ahorro">← Ahorros</button>
          <div class="view-title" style="margin-top:8px">${esc(a.nombre)}</div>
          <div class="view-sub">
            <span class="goal-tag">${esc(a.tipo) || "Meta"}</span>
            ${a.fechaMeta ? " · 🎯 meta " + fmtDate(a.fechaMeta) : ""}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost js-edit" data-id="${a.id}" data-mod="ahorros">✏️ Editar</button>
          <button class="btn btn-primary js-add-abono" data-id="${a.id}">＋ Abono</button>
        </div>
      </div>

      <div class="kpi-grid">
        ${kpi("Ahorrado", fmtMoney(ins.ah), "pos", `${ins.pct}% del objetivo`)}
        ${kpi("Objetivo", fmtMoney(ins.obj), "", a.fechaMeta ? "meta " + fmtDate(a.fechaMeta) : "Sin fecha meta")}
        ${kpi("Te falta", fmtMoney(ins.falta), ins.falta > 0 ? "neg" : "pos", ins.completed ? "¡Completado! 🎉" : "para tu objetivo")}
        ${kpi("Ritmo histórico", ins.ritmoMensual > 0 ? fmtMoney(ins.ritmoMensual) + "/mes" : "—", "", ins.ritmoMensual > 0 ? "promedio mensual" : "Falta historial")}
        ${kpi("Pronóstico", ins.completed ? "🎉" : (ins.pronostico ? esc(monthLabel(ins.pronostico)) : "—"), ins.completed ? "pos" : "", ins.completed ? "Meta lograda" : (ins.pronostico ? "fecha estimada" : "Sin estimación aún"))}
      </div>

      <div class="card" style="margin-bottom:22px">
        <div class="card-title">Avance hacia tu objetivo</div>
        <div class="bar ${ins.completed ? "done" : ""}" style="height:14px"><span style="width:${ins.pct}%"></span></div>
        <div class="hito-row">${hitosBadges}</div>
      </div>

      <div class="card" style="margin-bottom:22px">
        <div class="card-title">💡 Tips e insights</div>
        <div class="tips">${ahorroTips(ins, a)}</div>
      </div>

      <div class="chart-grid">
        <div class="card"><div class="card-title">Ahorro acumulado</div><div class="chart-box"><canvas id="chAhorroAcum"></canvas></div></div>
        <div class="card"><div class="card-title">Abonos por mes</div><div class="chart-box"><canvas id="chAhorroMes"></canvas></div></div>
      </div>

      <div class="card">
        <div class="card-title proy-section-head">
          <span>Abonos (${ins.numAbonos})</span>
          <button class="btn btn-primary btn-sm js-add-abono" data-id="${a.id}">＋ Abono</button>
        </div>
        ${abonosHistory(a)}
      </div>
    `;
  }

  function renderAhorroCharts() {
    if (typeof Chart === "undefined") return;
    const a = ahorroAbierto();
    if (!a) return;
    const col = themeColors();
    Chart.defaults.color = col.soft;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

    const abonos = (a.abonos || []).slice().sort((x, y) => (x.fecha || "").localeCompare(y.fecha || ""));
    const obj = num(a.objetivo);

    // 1) Ahorro acumulado en el tiempo (línea) + línea de objetivo como referencia.
    if (abonos.length) {
      let acc = 0;
      const labels = [], data = [];
      abonos.forEach((x) => {
        acc += (x.tipo === "Retiro" ? -1 : 1) * num(x.monto);
        labels.push(fmtDate(x.fecha));
        data.push(acc);
      });
      const datasets = [{ label: "Ahorrado", data, borderColor: col.primary, backgroundColor: "transparent", tension: 0.25, pointRadius: 3, fill: false }];
      if (obj > 0) datasets.push({ label: "Objetivo", data: labels.map(() => obj), borderColor: col.success, borderDash: [6, 6], pointRadius: 0, fill: false });
      mkChart("chAhorroAcum", { type: "line", data: { labels, datasets }, options: baseOpts(col, true) });
    } else emptyCanvas("chAhorroAcum");

    // 2) Abonos netos por mes (barras).
    const porMes = {};
    abonos.forEach((x) => { const k = (x.fecha || "").slice(0, 7); if (k) porMes[k] = (porMes[k] || 0) + (x.tipo === "Retiro" ? -1 : 1) * num(x.monto); });
    const meses = Object.keys(porMes).sort();
    if (meses.length) {
      mkChart("chAhorroMes", {
        type: "bar",
        data: {
          labels: meses.map((m) => monthLabel(m).replace(" de ", " ")),
          datasets: [{ label: "Abonado", data: meses.map((m) => porMes[m]), backgroundColor: meses.map((m) => porMes[m] >= 0 ? col.success : col.danger), borderRadius: 6 }],
        },
        options: baseOpts(col, true),
      });
    } else emptyCanvas("chAhorroMes");
  }

  // ---------- Vista: Viajes ----------
  const estadoPill = { "Realizado": "ok", "En curso": "pend", "Reservado": "pend", "Planeado": "muted" };
  function viewViajes() {
    const vs = DATA.viajes.slice().sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));
    const totalPres = sum(vs, "presupuesto");
    const totalGas = sum(vs, "gastado");
    const cards = vs.map((v) => {
      const pres = num(v.presupuesto), gas = num(v.gastado);
      const pct = pres > 0 ? Math.min(100, Math.round((gas / pres) * 100)) : 0;
      const over = pres > 0 && gas > pres;
      const restante = pres - gas;
      return `<div class="goal" data-id="${v.id}">
        <div class="goal-actions">
          <button class="icon-btn js-edit" title="Editar">✏️</button>
          <button class="icon-btn js-del" title="Eliminar">🗑️</button>
        </div>
        <div class="goal-head"><div class="goal-name">🧳 ${esc(v.destino)}</div></div>
        <span class="goal-tag pill ${estadoPill[v.estado] || "muted"}">${esc(v.estado) || "Planeado"}</span>
        ${v.fecha ? `<span class="goal-tag">${fmtDate(v.fecha)}${v.dias ? " · " + esc(v.dias) + " días" : ""}</span>` : ""}
        <div class="goal-amounts">Gastado <b>${fmtMoney(gas)}</b> de <b>${fmtMoney(pres)}</b> · ${over ? `<span style="color:var(--danger)">${fmtMoney(-restante)} sobre presupuesto</span>` : `restan ${fmtMoney(restante)}`}</div>
        <div class="bar ${over ? "" : "done"}" ${over ? 'style="background:var(--danger-bg)"' : ""}><span style="width:${pct}%;${over ? "background:var(--danger)" : ""}"></span></div>
        <div class="goal-pct">${pct}% del presupuesto</div>
        ${v.notas ? `<div class="goal-amounts" style="margin-top:10px">${esc(v.notas)}</div>` : ""}
      </div>`;
    }).join("");

    return `
      <div class="view-head">
        <div>
          <div class="view-title">Viajes</div>
          <div class="view-sub">${vs.length} viaje(s) · Presupuesto total ${fmtMoney(totalPres)} · Gastado ${fmtMoney(totalGas)}</div>
        </div>
        <button class="btn btn-primary js-add" data-mod="viajes">＋ Nuevo viaje</button>
      </div>
      ${vs.length ? `
        <div class="card" style="margin-bottom:22px"><div class="card-title">Presupuesto vs gastado por viaje</div><div class="chart-box"><canvas id="chViajes"></canvas></div></div>
        <div class="goal-grid">${cards}</div>
      ` : emptyState("viajes", "Sin viajes planeados", "Agrega tus viajes con presupuesto y dales seguimiento al gasto.")}
    `;
  }

  function renderViajesChart() {
    if (typeof Chart === "undefined" || !DATA.viajes.length) return;
    const col = themeColors();
    Chart.defaults.color = col.soft;
    const vs = DATA.viajes.slice().sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));
    mkChart("chViajes", {
      type: "bar",
      data: {
        labels: vs.map((v) => v.destino),
        datasets: [
          { label: "Presupuesto", data: vs.map((v) => num(v.presupuesto)), backgroundColor: col.primary, borderRadius: 6 },
          { label: "Gastado", data: vs.map((v) => num(v.gastado)), backgroundColor: col.success, borderRadius: 6 },
        ],
      },
      options: baseOpts(col, true),
    });
  }

  // ============================================================
  //  PROYECTOS
  // ============================================================
  const estadoProyPill = { "Terminado": "ok", "En curso": "pend", "Reservado": "pend", "Pausado": "muted", "Planeado": "muted" };

  function proyectoActual() {
    return DATA.proyectos.find((p) => p.id === CURRENT_PROYECTO) || null;
  }

  // Métricas agregadas de un proyecto.
  function proyMetrics(p) {
    const movs = p.movimientos || [];
    const salidas = movs.filter((m) => m.tipo === "Salida");
    const aportado = sum(movs.filter((m) => m.tipo === "Entrada"), "monto");
    const gastado = sum(salidas, "monto");
    // Dinero con el que arrancaste, repartido en tus fondos/bolsas (BBVA, efectivo…).
    const inicial = sum(p.fondos || [], "saldoInicial");
    // Saldo disponible real = lo que tenías al inicio + aportaciones − gastos.
    const saldo = inicial + aportado - gastado;
    const presupuesto = num(p.presupuesto);
    const pctPres = presupuesto > 0 ? Math.round((gastado / presupuesto) * 100) : 0;

    const porCat = {};
    salidas.forEach((m) => { const k = m.categoria || "Otros"; porCat[k] = (porCat[k] || 0) + num(m.monto); });

    const porMes = {};
    salidas.forEach((m) => { const k = (m.fecha || "").slice(0, 7); if (k) porMes[k] = (porMes[k] || 0) + num(m.monto); });

    // Avance físico ponderado por presupuesto de etapa (o promedio simple si no hay presupuestos).
    const etapas = p.etapas || [];
    let avance = 0;
    if (etapas.length) {
      const peso = sum(etapas, "presupuesto");
      avance = peso > 0
        ? Math.round(etapas.reduce((a, e) => a + num(e.avance) * num(e.presupuesto), 0) / peso)
        : Math.round(etapas.reduce((a, e) => a + num(e.avance), 0) / etapas.length);
    }
    return { aportado, gastado, saldo, inicial, presupuesto, pctPres, porCat, porMes, avance, tieneEtapas: etapas.length > 0, tieneFondos: (p.fondos || []).length > 0 };
  }

  // Saldo actual de un fondo: arranque + entradas y traspasos recibidos − gastos y traspasos salientes.
  function fondoSaldo(p, nombre) {
    let s = num((p.fondos || []).find((f) => f.nombre === nombre)?.saldoInicial);
    (p.movimientos || []).forEach((m) => {
      const amt = num(m.monto);
      if (m.tipo === "Traspaso") {
        if (m.fondo === nombre) s -= amt;          // sale del fondo origen
        if (m.fondoDestino === nombre) s += amt;   // llega al fondo destino
      } else if (m.tipo === "Entrada") {
        if (m.fondo === nombre) s += amt;
      } else if (m.fondo === nombre) {             // Salida
        s -= amt;
      }
    });
    return s;
  }

  // ---------- Vista: lista de proyectos ----------
  function viewProyectos() {
    const ps = DATA.proyectos;
    const cards = ps.map((p) => {
      const mt = proyMetrics(p);
      const over = mt.presupuesto > 0 && mt.gastado > mt.presupuesto;
      const pct = mt.presupuesto > 0 ? Math.min(100, mt.pctPres) : 0;
      return `<div class="goal" data-id="${p.id}" data-mod="proyectos">
        <div class="goal-actions">
          <button class="icon-btn js-edit" title="Editar">✏️</button>
          <button class="icon-btn js-del" title="Eliminar">🗑️</button>
        </div>
        <div class="goal-head"><div class="goal-name">🏗️ ${esc(p.nombre)}</div></div>
        <span class="goal-tag pill ${estadoProyPill[p.estado] || "muted"}">${esc(p.estado) || "—"}</span>
        <span class="goal-tag">${esc(p.tipo) || "Proyecto"}${p.fechaMeta ? " · meta " + fmtDate(p.fechaMeta) : ""}</span>
        <div class="goal-amounts">Gastado <b>${fmtMoney(mt.gastado)}</b>${mt.presupuesto ? ` de <b>${fmtMoney(mt.presupuesto)}</b>` : ""}${over ? ` · <span style="color:var(--danger)">sobre presupuesto</span>` : ""}</div>
        <div class="bar ${over ? "" : "done"}"><span style="width:${pct}%;${over ? "background:var(--danger)" : ""}"></span></div>
        <div class="goal-pct">${mt.presupuesto ? `${mt.pctPres}% del presupuesto` : "Sin presupuesto"} · Avance obra ${mt.tieneEtapas ? mt.avance + "%" : "—"}</div>
        <div class="proy-foot">
          <span class="muted">Saldo: <b style="color:${mt.saldo >= 0 ? "var(--success)" : "var(--danger)"}">${fmtMoney(mt.saldo)}</b></span>
          <button class="btn btn-primary btn-sm js-open-proy" data-id="${p.id}">Abrir →</button>
        </div>
      </div>`;
    }).join("");

    return `
      <div class="view-head">
        <div>
          <div class="view-title">Proyectos</div>
          <div class="view-sub">${ps.length} proyecto(s) · Llévale el control de gastos, aportaciones y avance a cada obra</div>
        </div>
        <button class="btn btn-primary js-add" data-mod="proyectos">＋ Nuevo proyecto</button>
      </div>
      ${ps.length ? `<div class="goal-grid">${cards}</div>`
        : emptyState("proyectos", "Sin proyectos aún", "Crea un proyecto (una construcción, remodelación, negocio…) y registra dentro sus gastos, aportaciones y avance.")}
    `;
  }

  // ---------- Vista: detalle de un proyecto ----------
  function viewProyectoDetalle() {
    const p = proyectoActual();
    if (!p) { CURRENT_PROYECTO = null; return viewProyectos(); }
    const mt = proyMetrics(p);
    const overP = mt.presupuesto > 0 && mt.gastado > mt.presupuesto;

    return `
      <div class="view-head">
        <div>
          <button class="btn btn-ghost btn-sm js-back-proy">← Proyectos</button>
          <div class="view-title" style="margin-top:8px">🏗️ ${esc(p.nombre)}</div>
          <div class="view-sub">
            <span class="pill ${estadoProyPill[p.estado] || "muted"}">${esc(p.estado) || "—"}</span>
            ${esc(p.tipo) || "Proyecto"}
            ${p.ubicacion ? " · 📍 " + esc(p.ubicacion) : ""}
            ${p.fechaInicio ? " · inicio " + fmtDate(p.fechaInicio) : ""}
            ${p.fechaMeta ? " · meta " + fmtDate(p.fechaMeta) : ""}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost js-edit" data-id="${p.id}" data-mod="proyectos">✏️ Editar</button>
          <button class="btn btn-primary js-add" data-mod="movimiento">＋ Movimiento</button>
        </div>
      </div>

      <div class="kpi-grid">
        ${kpi("Aportado al proyecto", fmtMoney(mt.aportado), "pos", "Dinero que has metido")}
        ${kpi("Gastado", fmtMoney(mt.gastado), "neg", `${(p.movimientos || []).filter(m => m.tipo === "Salida").length} salida(s)`)}
        ${kpi("Saldo disponible", fmtMoney(mt.saldo), mt.saldo >= 0 ? "pos" : "neg", mt.tieneFondos ? "Suma de tus fondos" : (mt.saldo >= 0 ? "Te queda en el bote" : "Aportado de menos"))}
        ${kpi("Gastado vs presupuesto", mt.presupuesto ? mt.pctPres + "%" : "—", overP ? "neg" : "", mt.presupuesto ? `${fmtMoney(mt.gastado)} de ${fmtMoney(mt.presupuesto)}` : "Sin presupuesto definido")}
        ${kpi("Avance de obra", mt.tieneEtapas ? mt.avance + "%" : "—", "", mt.tieneEtapas ? `${p.etapas.length} etapa(s)` : "Agrega etapas abajo")}
      </div>

      ${mt.tieneEtapas && mt.presupuesto ? avanceVsGasto(mt) : ""}

      <div class="chart-grid">
        <div class="card"><div class="card-title">Gasto por categoría</div><div class="chart-box"><canvas id="chProyCat"></canvas></div></div>
        <div class="card"><div class="card-title">Gasto por mes</div><div class="chart-box"><canvas id="chProyMes"></canvas></div></div>
      </div>

      ${fondosSection(p, mt)}
      ${etapasSection(p, mt)}
      ${presupuestoCatSection(p, mt)}
      ${proveedoresSection(p)}
      ${movimientosSection(p)}
    `;
  }

  // Fondos / bolsas de dinero del proyecto: cuánto tenías y dónde, y cuánto queda en cada uno.
  function fondosSection(p, mt) {
    const fondos = p.fondos || [];
    const movs = p.movimientos || [];
    // Movimientos sin fondo asignado (el usuario los puede reasignar editándolos).
    const sinAsignarGasto = sum(movs.filter((m) => m.tipo === "Salida" && !m.fondo), "monto");
    const sinAsignarEntr = sum(movs.filter((m) => m.tipo === "Entrada" && !m.fondo), "monto");

    const rows = fondos.map((fnd) => {
      const saldo = fondoSaldo(p, fnd.nombre);
      const ini = num(fnd.saldoInicial);
      const gastado = sum(movs.filter((m) => m.tipo === "Salida" && m.fondo === fnd.nombre), "monto");
      const neg = saldo < 0;
      return `<tr data-id="${fnd.id}" data-mod="fondo">
        <td><b>${esc(fnd.nombre)}</b></td>
        <td class="t-num">${fmtMoney(ini)}</td>
        <td class="t-num">${fmtMoney(gastado)}</td>
        <td class="t-num" style="color:${neg ? "var(--danger)" : "var(--success)"}"><b>${fmtMoney(saldo)}</b>${neg ? " ⚠️" : ""}</td>
        <td class="notes-cell">${esc(fnd.notas) || ""}</td>
        ${actionsCell()}
      </tr>`;
    }).join("");

    const totalSaldo = fondos.reduce((a, fnd) => a + fondoSaldo(p, fnd.nombre), 0);
    const totalIni = sum(fondos, "saldoInicial");
    // Aviso si hay dinero que no cuadra con los fondos (gastos/entradas sin asignar).
    const avisoSinAsignar = (sinAsignarGasto || sinAsignarEntr)
      ? `<p class="pill late" style="margin-top:12px">Hay movimientos sin fondo asignado${sinAsignarGasto ? ` · ${fmtMoney(sinAsignarGasto)} en gastos` : ""}${sinAsignarEntr ? ` · ${fmtMoney(sinAsignarEntr)} en entradas` : ""}. Edítalos y elige un fondo para que cuadren con tus bolsas.</p>`
      : "";

    return `<div class="card" style="margin-bottom:22px">
      <div class="card-title proy-section-head">
        <span>Fondos / bolsas de dinero ${fondos.length ? `· disponible ${fmtMoney(totalSaldo)}` : ""}</span>
        <button class="btn btn-ghost btn-sm js-add" data-mod="fondo">＋ Fondo</button>
      </div>
      ${fondos.length ? `<div class="table-scroll"><table>
        <thead><tr><th>Fondo</th><th class="t-num">Saldo inicial</th><th class="t-num">Gastado</th><th class="t-num">Disponible</th><th>Notas</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="mov-foot-row">
          <td class="t-num"><b>Total</b></td>
          <td class="t-num">${fmtMoney(totalIni)}</td>
          <td class="t-num">—</td>
          <td class="t-num" style="color:${totalSaldo >= 0 ? "var(--success)" : "var(--danger)"}"><b>${fmtMoney(totalSaldo)}</b></td>
          <td colspan="2"></td>
        </tr></tfoot>
      </table></div>${avisoSinAsignar}`
        : `<p class="muted">Agrega tus bolsas de dinero (BBVA, Efectivo, Tarjeta…) con el saldo que tienes para este proyecto. Luego, al registrar un gasto eliges de qué fondo salió y verás cuánto te queda en cada uno.</p>`}
    </div>`;
  }

  // Aviso comparando avance físico vs gasto del presupuesto.
  function avanceVsGasto(mt) {
    const desfase = mt.pctPres - mt.avance; // gastas más rápido de lo que avanzas si >0
    let tono = "ok", msg = "Vas en línea: el gasto acompaña al avance de obra.";
    if (desfase > 15) { tono = "late"; msg = `Ojo: llevas ${mt.pctPres}% del presupuesto gastado pero solo ${mt.avance}% de avance. Vas gastando más rápido que la obra.`; }
    else if (desfase < -15) { tono = "ok"; msg = `Bien: ${mt.avance}% de obra con solo ${mt.pctPres}% del presupuesto gastado.`; }
    return `<div class="card" style="margin-bottom:22px">
      <div class="card-title">Avance de obra vs gasto</div>
      <div class="dual-bar"><span class="dual-lbl">Obra</span><div class="bar done"><span style="width:${Math.min(100, mt.avance)}%"></span></div><b>${mt.avance}%</b></div>
      <div class="dual-bar"><span class="dual-lbl">Gasto</span><div class="bar ${mt.pctPres > 100 ? "" : "done"}"><span style="width:${Math.min(100, mt.pctPres)}%;${mt.pctPres > 100 ? "background:var(--danger)" : ""}"></span></div><b>${mt.pctPres}%</b></div>
      <p class="pill ${tono}" style="margin-top:12px">${esc(msg)}</p>
    </div>`;
  }

  // Gasto real registrado en una etapa = salidas cuyo campo "etapa" coincide con su nombre.
  function gastoEtapa(p, nombre) {
    return sum((p.movimientos || []).filter((m) => m.tipo === "Salida" && m.etapa === nombre), "monto");
  }

  function etapasSection(p, mt) {
    const etapas = p.etapas || [];
    const rows = etapas.map((e) => {
      const av = Math.max(0, Math.min(100, num(e.avance)));
      const real = gastoEtapa(p, e.nombre);
      const plan = num(e.presupuesto);
      const over = plan > 0 && real > plan;
      // Línea de costo: gastado vs presupuesto de la etapa (si lo tiene).
      const costo = plan > 0
        ? `<span class="${over ? "etapa-over" : ""}">${fmtMoney(real)} de ${fmtMoney(plan)}${over ? ` · +${fmtMoney(real - plan)}` : ""}</span>`
        : (real > 0 ? `${fmtMoney(real)} gastado · sin presupuesto` : "sin presupuesto");
      return `<div class="etapa-row" data-id="${e.id}" data-mod="etapa">
        <div class="etapa-info">
          <span class="etapa-name">${esc(e.nombre)}</span>
          <span class="muted">${costo}${e.notas ? " · " + esc(e.notas) : ""}</span>
        </div>
        <input type="range" min="0" max="100" value="${av}" class="etapa-range js-etapa-avance" title="Avance %">
        <span class="etapa-pct">${av}%</span>
        <span class="etapa-acts">
          <button class="icon-btn js-edit" title="Editar">✏️</button>
          <button class="icon-btn js-del" title="Eliminar">🗑️</button>
        </span>
      </div>`;
    }).join("");
    return `<div class="card" style="margin-bottom:22px">
      <div class="card-title proy-section-head">
        <span>Etapas del proyecto ${mt.tieneEtapas ? `· avance global ${mt.avance}%` : ""}</span>
        <button class="btn btn-ghost btn-sm js-add" data-mod="etapa">＋ Etapa</button>
      </div>
      ${etapas.length ? rows : `<p class="muted">Aún no hay etapas. Agrega etapas (cimentación, muros, losa, acabados…) para medir el avance de la obra.</p>`}
    </div>`;
  }

  function presupuestoCatSection(p, mt) {
    const pc = p.presupuestoCat || {};
    const cats = [...new Set([...Object.keys(pc), ...Object.keys(mt.porCat)])];
    const rows = cats.map((c) => {
      const plan = num(pc[c]), real = num(mt.porCat[c]);
      const pct = plan > 0 ? Math.round((real / plan) * 100) : 0;
      const over = plan > 0 && real > plan;
      return `<tr>
        <td><b>${esc(c)}</b></td>
        <td class="t-num">${plan ? fmtMoney(plan) : "—"}</td>
        <td class="t-num">${fmtMoney(real)}</td>
        <td style="min-width:140px"><div class="bar ${over ? "" : "done"}"><span style="width:${Math.min(100, pct)}%;${over ? "background:var(--danger)" : ""}"></span></div></td>
        <td class="t-num">${plan ? (over ? `<span style="color:var(--danger)">+${fmtMoney(real - plan)}</span>` : fmtMoney(plan - real)) : "—"}</td>
      </tr>`;
    }).join("");
    return `<div class="card" style="margin-bottom:22px">
      <div class="card-title proy-section-head">
        <span>Presupuesto por categoría</span>
        <button class="btn btn-ghost btn-sm js-add" data-mod="presupuestoCat">✎ Definir presupuestos</button>
      </div>
      ${cats.length ? `<div class="table-scroll"><table>
        <thead><tr><th>Categoría</th><th class="t-num">Presupuesto</th><th class="t-num">Gastado</th><th>Consumo</th><th class="t-num">Restante</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
        : `<p class="muted">Define cuánto planeas gastar por categoría (mano de obra, material…) y compáralo con lo real.</p>`}
    </div>`;
  }

  function proveedoresSection(p) {
    const vs = p.proveedores || [];
    const pagado = (nombre) => sum((p.movimientos || []).filter((m) => m.tipo === "Salida" && m.proveedor === nombre), "monto");
    const rows = vs.map((v) => `<tr data-id="${v.id}" data-mod="proveedor">
        <td><b>${esc(v.nombre)}</b></td>
        <td>${esc(v.oficio) || "<span class='muted'>—</span>"}</td>
        <td>${esc(v.contacto) || "<span class='muted'>—</span>"}</td>
        <td class="t-num">${fmtMoney(pagado(v.nombre))}</td>
        <td class="notes-cell">${esc(v.notas) || ""}</td>
        ${actionsCell()}
      </tr>`).join("");
    return `<div class="card" style="margin-bottom:22px">
      <div class="card-title proy-section-head">
        <span>Proveedores y trabajadores</span>
        <button class="btn btn-ghost btn-sm js-add" data-mod="proveedor">＋ Proveedor</button>
      </div>
      ${vs.length ? `<div class="table-scroll"><table>
        <thead><tr><th>Nombre</th><th>Oficio / rol</th><th>Contacto</th><th class="t-num">Pagado</th><th>Notas</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
        : `<p class="muted">Registra a tus proveedores y trabajadores para ver cuánto le has pagado a cada uno.</p>`}
    </div>`;
  }

  // "2026-06" -> "Jun 2026"
  function fmtMes(ym) {
    const [y, m] = (ym || "").split("-").map(Number);
    if (!y || !m) return ym || "";
    return `${MESES[m - 1].slice(0, 3)} ${y}`;
  }

  const anyMovFilterActive = () => {
    const f = MOV_FILTER;
    return !!(f.q || f.tipo || f.categoria || f.proveedor || f.etapa || f.fondo || f.mes);
  };

  // Aplica el filtro activo a los movimientos del proyecto (ya ordenados por fecha desc).
  function filterMovs(p) {
    const f = MOV_FILTER;
    const q = (f.q || "").trim().toLowerCase();
    return (p.movimientos || []).slice()
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
      .filter((m) => {
        if (f.tipo && m.tipo !== f.tipo) return false;
        if (f.categoria && m.categoria !== f.categoria) return false;
        if (f.proveedor && m.proveedor !== f.proveedor) return false;
        if (f.etapa && m.etapa !== f.etapa) return false;
        // El filtro por fondo incluye los traspasos donde el fondo es origen o destino.
        if (f.fondo && m.fondo !== f.fondo && m.fondoDestino !== f.fondo) return false;
        if (f.mes && (m.fecha || "").slice(0, 7) !== f.mes) return false;
        if (q) {
          const hay = `${m.concepto || ""} ${m.proveedor || ""} ${m.notas || ""} ${m.recibo || ""} ${m.categoria || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }

  const movCountLabel = (shown, total) => (shown === total ? String(total) : `${shown} de ${total}`);

  // Celda de fondo para un movimiento: en traspasos muestra "origen → destino".
  function fondoCell(m) {
    if (m.tipo === "Traspaso") {
      const o = esc(m.fondo) || "?", d = esc(m.fondoDestino) || "?";
      return `<span class="muted">${o} → ${d}</span>`;
    }
    return esc(m.fondo) || "<span class='muted'>—</span>";
  }

  function movRowsHtml(movs, hasEtapas, hasFondos, colspan) {
    if (!movs.length) return `<tr><td colspan="${colspan}" class="muted mov-empty">Ningún movimiento coincide con el filtro.</td></tr>`;
    return movs.map((m) => {
      const entrada = m.tipo === "Entrada", traspaso = m.tipo === "Traspaso";
      const signo = traspaso ? "⇄" : entrada ? "+" : "−";
      const color = traspaso ? "var(--muted)" : entrada ? "var(--success)" : "var(--danger)";
      const tipoPill = traspaso ? `<span class="pill muted">🔁 Traspaso</span>`
        : entrada ? `<span class="pill ok">🟢 Entrada</span>` : `<span class="pill muted">🔴 Salida</span>`;
      return `<tr data-id="${m.id}" data-mod="movimiento">
        <td>${fmtDate(m.fecha)}</td>
        <td>${tipoPill}</td>
        <td><b>${esc(m.concepto)}</b></td>
        <td>${entrada || traspaso ? "<span class='muted'>—</span>" : `<span class="pill muted">${esc(m.categoria) || "—"}</span>`}</td>
        ${hasEtapas ? `<td>${esc(m.etapa) || "<span class='muted'>—</span>"}</td>` : ""}
        <td>${esc(m.proveedor) || "<span class='muted'>—</span>"}</td>
        <td>${esc(m.metodo) || "<span class='muted'>—</span>"}</td>
        ${hasFondos ? `<td>${fondoCell(m)}</td>` : ""}
        <td class="t-num" style="color:${color}">${signo} ${fmtMoney(m.monto)}</td>
        <td class="notes-cell">${reciboCell(m.recibo)}${esc(m.notas) ? (m.recibo ? " · " : "") + esc(m.notas) : ""}</td>
        ${actionsCell()}
      </tr>`;
    }).join("");
  }

  function movFootHtml(movs, hasEtapas, hasFondos) {
    if (!movs.length) return "";
    const entradas = sum(movs.filter((m) => m.tipo === "Entrada"), "monto");
    const salidas = sum(movs.filter((m) => m.tipo === "Salida"), "monto");
    const traspasos = sum(movs.filter((m) => m.tipo === "Traspaso"), "monto");
    const neto = entradas - salidas;
    // columnas antes de "Monto": base 6 (+etapa +fondo)
    const labelSpan = 6 + (hasEtapas ? 1 : 0) + (hasFondos ? 1 : 0);
    const traspText = traspasos ? ` · <span class="muted">⇄ ${fmtMoney(traspasos)} en traspasos</span>` : "";
    return `<tr class="mov-foot-row">
      <td colspan="${labelSpan}" class="t-num">Totales filtrados · <span style="color:var(--success)">+${fmtMoney(entradas)}</span> entradas · <span style="color:var(--danger)">−${fmtMoney(salidas)}</span> salidas${traspText}</td>
      <td class="t-num" style="color:${neto >= 0 ? "var(--success)" : "var(--danger)"}">${neto < 0 ? "−" : ""}${fmtMoney(Math.abs(neto))}</td>
      <td colspan="2"></td>
    </tr>`;
  }

  function movimientosSection(p) {
    const all = p.movimientos || [];
    if (!all.length) {
      return `<div class="card">
        <div class="card-title proy-section-head">
          <span>Movimientos (0)</span>
          <button class="btn btn-primary btn-sm js-add" data-mod="movimiento">＋ Movimiento</button>
        </div>
        <p class="muted">Sin movimientos. Registra entradas (aportaciones) y salidas (gastos) de este proyecto.</p>
      </div>`;
    }

    const hasEtapas = (p.etapas || []).length > 0;
    const hasFondos = (p.fondos || []).length > 0;
    const colspan = 9 + (hasEtapas ? 1 : 0) + (hasFondos ? 1 : 0);
    const movs = filterMovs(p);
    const f = MOV_FILTER;

    // Opciones de filtro derivadas de los movimientos reales del proyecto.
    const uniq = (key) => [...new Set(all.map((m) => m[key]).filter(Boolean))].sort();
    const cats = uniq("categoria"), provs = uniq("proveedor"), ets = uniq("etapa");
    const fondos = (p.fondos || []).map((x) => x.nombre).filter(Boolean);
    const meses = [...new Set(all.map((m) => (m.fecha || "").slice(0, 7)).filter(Boolean))].sort().reverse();
    const opt = (val, sel, label) => `<option value="${esc(val)}" ${sel === val ? "selected" : ""}>${esc(label)}</option>`;
    const optsFrom = (arr, sel) => arr.map((v) => opt(v, sel, v)).join("");

    const filterBar = `<div class="mov-filters">
      <input type="search" class="js-mov-filter mov-search" data-fk="q" placeholder="Buscar concepto, proveedor, notas…" value="${esc(f.q)}">
      <select class="js-mov-filter" data-fk="tipo"><option value="">Tipo: todos</option>${opt("Salida", f.tipo, "Salidas")}${opt("Entrada", f.tipo, "Entradas")}${opt("Traspaso", f.tipo, "Traspasos")}</select>
      <select class="js-mov-filter" data-fk="categoria"><option value="">Categoría: todas</option>${optsFrom(cats, f.categoria)}</select>
      <select class="js-mov-filter" data-fk="proveedor"><option value="">Proveedor: todos</option>${optsFrom(provs, f.proveedor)}</select>
      ${hasEtapas ? `<select class="js-mov-filter" data-fk="etapa"><option value="">Etapa: todas</option>${optsFrom(ets, f.etapa)}</select>` : ""}
      ${hasFondos ? `<select class="js-mov-filter" data-fk="fondo"><option value="">Fondo: todos</option>${optsFrom(fondos, f.fondo)}</select>` : ""}
      <select class="js-mov-filter" data-fk="mes"><option value="">Mes: todos</option>${meses.map((m) => opt(m, f.mes, fmtMes(m))).join("")}</select>
      <button class="btn btn-ghost btn-sm js-mov-clear" type="button" ${anyMovFilterActive() ? "" : "hidden"}>✕ Limpiar</button>
    </div>`;

    return `<div class="card">
      <div class="card-title proy-section-head">
        <span>Movimientos (<span id="movCount">${movCountLabel(movs.length, all.length)}</span>)</span>
        <button class="btn btn-primary btn-sm js-add" data-mod="movimiento">＋ Movimiento</button>
      </div>
      ${filterBar}
      <div class="table-scroll"><table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Categoría</th>${hasEtapas ? "<th>Etapa</th>" : ""}<th>Proveedor</th><th>Método</th>${hasFondos ? "<th>Fondo</th>" : ""}<th class="t-num">Monto</th><th>Recibo / notas</th><th></th></tr></thead>
        <tbody id="movTbody">${movRowsHtml(movs, hasEtapas, hasFondos, colspan)}</tbody>
        <tfoot id="movFoot">${movFootHtml(movs, hasEtapas, hasFondos)}</tfoot>
      </table></div>
    </div>`;
  }

  // Refresca solo la tabla de movimientos (sin re-render completo) para no perder el foco del buscador.
  function refreshMovTable() {
    const p = proyectoActual();
    if (!p) return;
    const hasEtapas = (p.etapas || []).length > 0;
    const hasFondos = (p.fondos || []).length > 0;
    const colspan = 9 + (hasEtapas ? 1 : 0) + (hasFondos ? 1 : 0);
    const movs = filterMovs(p);
    const tb = document.getElementById("movTbody");
    const ft = document.getElementById("movFoot");
    const cnt = document.getElementById("movCount");
    const clearBtn = document.querySelector(".js-mov-clear");
    if (tb) tb.innerHTML = movRowsHtml(movs, hasEtapas, hasFondos, colspan);
    if (ft) ft.innerHTML = movFootHtml(movs, hasEtapas, hasFondos);
    if (cnt) cnt.textContent = movCountLabel(movs.length, (p.movimientos || []).length);
    if (clearBtn) clearBtn.hidden = !anyMovFilterActive();
  }

  // Si el recibo parece una URL, la muestra como liga; si no, como texto.
  function reciboCell(r) {
    if (!r) return "";
    const v = String(r).trim();
    if (/^https?:\/\//i.test(v)) return `<a href="${esc(v)}" target="_blank" rel="noopener">📎 recibo</a>`;
    return `📎 ${esc(v)}`;
  }

  // ---------- Charts de proyecto ----------
  function renderProyectoCharts() {
    if (typeof Chart === "undefined") return;
    const p = proyectoActual();
    if (!p) return;
    const mt = proyMetrics(p);
    const col = themeColors();
    Chart.defaults.color = col.soft;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

    const catKeys = Object.keys(mt.porCat);
    if (catKeys.length) {
      mkChart("chProyCat", {
        type: "doughnut",
        data: { labels: catKeys, datasets: [{ data: catKeys.map((k) => mt.porCat[k]), backgroundColor: PALETTE, borderWidth: 0 }] },
        options: donutOpts(col),
      });
    } else emptyCanvas("chProyCat");

    const meses = Object.keys(mt.porMes).sort();
    if (meses.length) {
      mkChart("chProyMes", {
        type: "bar",
        data: {
          labels: meses.map((m) => monthLabel(m).replace(" de ", " ")),
          datasets: [{ label: "Gasto", data: meses.map((m) => mt.porMes[m]), backgroundColor: col.danger, borderRadius: 6 }],
        },
        options: baseOpts(col, true),
      });
    } else emptyCanvas("chProyMes");
  }

  // ============================================================
  //  COTIZACIONES (comparador de precios)
  // ============================================================
  const estadoCotizPill = { "Comprado": "ok", "Decidido": "pend", "Comparando": "muted" };

  function cotizacionActual() {
    return DATA.cotizaciones.find((c) => c.id === CURRENT_COTIZACION) || null;
  }
  function proyectoById(id) {
    return id ? DATA.proyectos.find((p) => p.id === id) || null : null;
  }
  const proyectoNombre = (id) => proyectoById(id)?.nombre || "";

  // Total de una opción = precio unitario × cantidad del insumo + envío.
  function opcionTotal(cot, o) {
    const qty = num(cot.cantidad) || 1;
    return num(o.precioUnitario) * qty + num(o.costoEnvio);
  }

  // Métricas de una cotización: opciones ordenadas, más barata, elegida y ahorro.
  function cotizMetrics(cot) {
    const ops = (cot.opciones || []).map((o) => ({ ...o, _total: opcionTotal(cot, o) }))
      .sort((a, b) => a._total - b._total);
    const totals = ops.map((o) => o._total);
    const min = totals.length ? Math.min(...totals) : 0;
    const max = totals.length ? Math.max(...totals) : 0;
    const baratoId = ops.length ? ops[0].id : null;
    const elegida = ops.find((o) => o.id === cot.elegidaId) || null;
    const elegidaTotal = elegida ? elegida._total : null;
    // Ahorro logrado al elegir = lo más caro − lo elegido. Si no hay elegida, muestra el potencial (max−min).
    const ahorro = elegida ? (max - elegidaTotal) : (max - min);
    return { ops, totals, min, max, baratoId, elegida, elegidaTotal, ahorro, count: ops.length };
  }

  // Lista de cotizaciones (opcionalmente filtrada por proyecto).
  function cotizacionesFiltradas() {
    const f = COTIZ_FILTER;
    return DATA.cotizaciones.filter((c) => !f.proyectoId || c.proyectoId === f.proyectoId);
  }

  // ---------- Vista: lista de cotizaciones ----------
  function viewCotizaciones() {
    const all = DATA.cotizaciones;
    const cs = cotizacionesFiltradas();

    // KPIs: comparando, ya decididas, gasto comprometido (suma de elegidas) y ahorro acumulado.
    let comprometido = 0, ahorroTotal = 0, decididas = 0;
    all.forEach((c) => {
      const mt = cotizMetrics(c);
      if (mt.elegida) { comprometido += mt.elegidaTotal; ahorroTotal += mt.ahorro; decididas++; }
    });
    const comparando = all.filter((c) => c.estado === "Comparando" || !c.estado).length;

    // Barra de filtro por proyecto.
    const proyOpts = DATA.proyectos.map((p) =>
      `<option value="${esc(p.id)}" ${COTIZ_FILTER.proyectoId === p.id ? "selected" : ""}>${esc(p.nombre)}</option>`).join("");
    const filterBar = DATA.proyectos.length ? `<div class="mov-filters">
      <select class="js-cotiz-filter"><option value="">Proyecto: todos</option>${proyOpts}</select>
      ${COTIZ_FILTER.proyectoId ? `<button class="btn btn-ghost btn-sm js-cotiz-clear" type="button">✕ Limpiar</button>` : ""}
    </div>` : "";

    const cards = cs.map((c) => {
      const mt = cotizMetrics(c);
      const proy = proyectoNombre(c.proyectoId);
      const cant = num(c.cantidad) || 1;
      return `<div class="goal" data-id="${c.id}" data-mod="cotizaciones">
        <div class="goal-actions">
          <button class="icon-btn js-edit" title="Editar">✏️</button>
          <button class="icon-btn js-del" title="Eliminar">🗑️</button>
        </div>
        <div class="goal-head"><div class="goal-name">🛒 ${esc(c.titulo)}</div></div>
        <span class="goal-tag pill ${estadoCotizPill[c.estado] || "muted"}">${esc(c.estado) || "Comparando"}</span>
        <span class="goal-tag">${esc(cant)} ${esc(c.unidad) || "u"}${c.categoria ? " · " + esc(c.categoria) : ""}</span>
        ${proy ? `<span class="goal-tag">🏗️ ${esc(proy)}</span>` : ""}
        <div class="goal-amounts">
          ${mt.count
            ? (mt.elegida
                ? `Elegido <b style="color:var(--success)">${fmtMoney(mt.elegidaTotal)}</b> · ${esc(mt.elegida.proveedor)}`
                : `Mejor precio <b>${fmtMoney(mt.min)}</b>${mt.count > 1 ? ` de ${mt.count} opciones` : ""}`)
            : `<span class="muted">Sin opciones aún</span>`}
        </div>
        ${mt.count > 1 ? `<div class="goal-pct">Ahorro ${mt.elegida ? "logrado" : "potencial"}: <b style="color:var(--success)">${fmtMoney(mt.ahorro)}</b> · rango ${fmtMoney(mt.min)}–${fmtMoney(mt.max)}</div>` : ""}
        <div class="proy-foot">
          <span class="muted">${mt.count} opción(es)</span>
          <button class="btn btn-primary btn-sm js-open-cotiz" data-id="${c.id}">Abrir →</button>
        </div>
      </div>`;
    }).join("");

    return `
      <div class="view-head">
        <div>
          <div class="view-title">Cotizaciones</div>
          <div class="view-sub">${all.length} cotización(es) · Compara proveedores y elige el que más te convenga</div>
        </div>
        <button class="btn btn-primary js-add" data-mod="cotizaciones">＋ Nueva cotización</button>
      </div>

      ${all.length ? `<div class="kpi-grid">
        ${kpi("Comparando", String(comparando), "", "Pendientes de decidir")}
        ${kpi("Decididas", String(decididas), "pos", "Ya elegiste proveedor")}
        ${kpi("Gasto comprometido", fmtMoney(comprometido), "neg", "Suma de las opciones elegidas")}
        ${kpi("Ahorro acumulado", fmtMoney(ahorroTotal), "pos", "Vs. la opción más cara")}
      </div>` : ""}

      ${filterBar}

      ${cs.length ? `<div class="goal-grid">${cards}</div>`
        : (all.length
            ? `<div class="empty"><div class="empty-ico">🔎</div><h3>Sin cotizaciones en este filtro</h3><p>Cambia el filtro de proyecto o crea una nueva.</p></div>`
            : emptyState("cotizaciones", "Sin cotizaciones aún", "Crea una cotización por cada insumo que andas cotizando (cemento, varilla…) y agrégale las opciones de cada proveedor para comparar."))}
    `;
  }

  // ---------- Vista: detalle de una cotización ----------
  function viewCotizacionDetalle() {
    const c = cotizacionActual();
    if (!c) { CURRENT_COTIZACION = null; return viewCotizaciones(); }
    const mt = cotizMetrics(c);
    const cant = num(c.cantidad) || 1;
    const proy = proyectoById(c.proyectoId);

    const rows = mt.ops.map((o) => {
      const esBarato = o.id === mt.baratoId && mt.count > 1;
      const esElegida = o.id === c.elegidaId;
      const cls = esElegida ? "cotiz-chosen" : (esBarato ? "cotiz-best" : "");
      const badges = `${esElegida ? `<span class="pill ok">✅ Elegido</span>` : ""}${esBarato && !esElegida ? `<span class="pill muted">💲 Más barato</span>` : ""}`;
      return `<tr data-id="${o.id}" data-mod="opcion" class="${cls}">
        <td><b>${esc(o.proveedor)}</b> ${badges}</td>
        <td class="t-num">${fmtMoney(o.precioUnitario)}</td>
        <td class="t-num">${num(o.costoEnvio) ? fmtMoney(o.costoEnvio) : "—"}</td>
        <td class="t-num"><b>${fmtMoney(o._total)}</b></td>
        <td>${esc(o.disponibilidad) || "<span class='muted'>—</span>"}</td>
        <td>${esc(o.contacto) || "<span class='muted'>—</span>"}</td>
        <td class="notes-cell">${reciboCell(o.url)}${esc(o.notas) ? (o.url ? " · " : "") + esc(o.notas) : ""}</td>
        <td class="t-actions">
          ${esElegida
            ? `<button class="icon-btn js-cotiz-unelegir" title="Quitar elección">↩️</button>`
            : `<button class="icon-btn js-cotiz-elegir" title="Elegir esta opción">✔️</button>`}
          <button class="icon-btn js-edit" title="Editar">✏️</button>
          <button class="icon-btn js-del" title="Eliminar">🗑️</button>
        </td>
      </tr>`;
    }).join("");

    // Panel de la opción elegida + acción de registrar el gasto en el proyecto.
    let panelElegida = "";
    if (mt.elegida) {
      const yaRegistrado = c.movimientoId && proy && (proy.movimientos || []).some((m) => m.id === c.movimientoId);
      let accion;
      if (!proy) accion = `<span class="muted">Vincula esta cotización a un proyecto (Editar) para registrar el gasto.</span>`;
      else if (yaRegistrado) accion = `<span class="pill ok">✓ Gasto ya registrado en ${esc(proy.nombre)}</span>
        <button class="btn btn-ghost btn-sm js-open-proy" data-id="${esc(proy.id)}">Ver proyecto →</button>`;
      else accion = `<button class="btn btn-primary btn-sm js-cotiz-registrar">＋ Registrar como gasto en ${esc(proy.nombre)}</button>`;
      panelElegida = `<div class="card cotiz-pick" style="margin-bottom:22px">
        <div class="card-title">✅ Opción elegida</div>
        <div class="goal-amounts"><b>${esc(mt.elegida.proveedor)}</b> · ${fmtMoney(mt.elegida.precioUnitario)} × ${esc(cant)} ${esc(c.unidad) || "u"}${num(mt.elegida.costoEnvio) ? " + envío " + fmtMoney(mt.elegida.costoEnvio) : ""} = <b style="color:var(--success)">${fmtMoney(mt.elegidaTotal)}</b></div>
        <div class="proy-section-head" style="margin-top:12px">${accion}</div>
      </div>`;
    }

    return `
      <div class="view-head">
        <div>
          <button class="btn btn-ghost btn-sm js-back-cotiz">← Cotizaciones</button>
          <div class="view-title" style="margin-top:8px">🛒 ${esc(c.titulo)}</div>
          <div class="view-sub">
            <span class="pill ${estadoCotizPill[c.estado] || "muted"}">${esc(c.estado) || "Comparando"}</span>
            ${esc(cant)} ${esc(c.unidad) || "u"}
            ${c.categoria ? " · " + esc(c.categoria) : ""}
            ${proy ? ` · 🏗️ ${esc(proy.nombre)}` : " · <span class='muted'>sin proyecto</span>"}
          </div>
          ${c.notas ? `<div class="view-sub">${esc(c.notas)}</div>` : ""}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost js-edit" data-id="${c.id}" data-mod="cotizaciones">✏️ Editar</button>
          <button class="btn btn-primary js-add" data-mod="opcion">＋ Opción</button>
        </div>
      </div>

      <div class="kpi-grid">
        ${kpi("Opciones", String(mt.count), "", "Proveedores cotizados")}
        ${kpi("Más barata", mt.count ? fmtMoney(mt.min) : "—", "pos", mt.count ? mt.ops[0].proveedor : "Agrega opciones")}
        ${kpi("Elegida", mt.elegida ? fmtMoney(mt.elegidaTotal) : "—", mt.elegida ? "pos" : "", mt.elegida ? mt.elegida.proveedor : "Aún sin elegir")}
        ${kpi("Ahorro", mt.count > 1 ? fmtMoney(mt.ahorro) : "—", "pos", mt.elegida ? "Logrado vs. más cara" : "Potencial (rango)")}
      </div>

      ${panelElegida}

      ${mt.count > 1 ? `<div class="card" style="margin-bottom:22px"><div class="card-title">Comparativo de precios por proveedor</div><div class="chart-box"><canvas id="chCotiz"></canvas></div></div>` : ""}

      <div class="card">
        <div class="card-title proy-section-head">
          <span>Opciones (${mt.count})</span>
          <button class="btn btn-primary btn-sm js-add" data-mod="opcion">＋ Opción</button>
        </div>
        ${mt.count ? `<div class="table-scroll"><table>
          <thead><tr><th>Proveedor</th><th class="t-num">P. unit</th><th class="t-num">Envío</th><th class="t-num">Total (${esc(cant)} ${esc(c.unidad) || "u"})</th><th>Disponibilidad</th><th>Contacto</th><th>Liga / notas</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
          : `<p class="muted">Aún no hay opciones. Agrega lo que te cotizó cada proveedor (precio por unidad y envío) para compararlos.</p>`}
      </div>
    `;
  }

  function renderCotizacionChart() {
    if (typeof Chart === "undefined") return;
    const c = cotizacionActual();
    if (!c) return;
    const mt = cotizMetrics(c);
    if (mt.count < 2) return;
    const col = themeColors();
    Chart.defaults.color = col.soft;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    // Resalta la elegida (o la más barata) en verde; el resto en el color primario.
    const refId = c.elegidaId || mt.baratoId;
    mkChart("chCotiz", {
      type: "bar",
      data: {
        labels: mt.ops.map((o) => o.proveedor),
        datasets: [{
          label: "Total",
          data: mt.ops.map((o) => o._total),
          backgroundColor: mt.ops.map((o) => (o.id === refId ? col.success : col.primary)),
          borderRadius: 6,
        }],
      },
      options: { ...baseOpts(col, true), indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => fmtMoney(x.raw) } } }, scales: { x: { beginAtZero: true, ticks: { callback: (v) => "$" + fmtNum(v) }, grid: { color: col.grid } }, y: { grid: { display: false } } } },
    });
  }

  // Marca/limpia la opción elegida y ajusta el estado de la cotización.
  function elegirOpcion(cot, opId) {
    cot.elegidaId = opId;
    if (opId && (cot.estado === "Comparando" || !cot.estado)) cot.estado = "Decidido";
    if (!opId && cot.estado === "Decidido") cot.estado = "Comparando";
    scheduleSave(); render();
    toast(opId ? "Opción elegida" : "Elección quitada");
  }

  // Crea (o actualiza) el movimiento de gasto en el proyecto vinculado a partir de la opción elegida.
  function registrarGastoCotizacion(cot) {
    const proy = proyectoById(cot.proyectoId);
    const mt = cotizMetrics(cot);
    if (!proy || !mt.elegida) return;
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
    if (existente) {
      Object.assign(existente, datos);
    } else {
      const mov = { id: uid(), ...datos };
      proy.movimientos.push(mov);
      cot.movimientoId = mov.id;
    }
    // Registra al proveedor en el proyecto si aún no existe (para el resumen de pagos por proveedor).
    if (o.proveedor && !(proy.proveedores || []).some((v) => v.nombre === o.proveedor)) {
      proy.proveedores = proy.proveedores || [];
      proy.proveedores.push({ id: uid(), nombre: o.proveedor, oficio: "Proveedor", contacto: o.contacto || "", notas: "" });
    }
    cot.estado = "Comprado";
    scheduleSave(); render();
    toast(existente ? "Gasto actualizado en el proyecto" : "Gasto registrado en el proyecto");
  }

  // ---------- Helpers de vista ----------
  function actionsCell() {
    return `<td class="t-actions">
      <button class="icon-btn js-edit" title="Editar">✏️</button>
      <button class="icon-btn js-del" title="Eliminar">🗑️</button>
    </td>`;
  }
  function emptyState(mod, title, sub) {
    return `<div class="empty">
      <div class="empty-ico">🗂️</div>
      <h3>${esc(title)}</h3>
      <p>${esc(sub)}</p>
      <button class="btn btn-primary js-add" data-mod="${mod}">＋ Agregar el primero</button>
    </div>`;
  }

  // ============================================================
  //  MODAL (crear / editar)
  // ============================================================
  let modalCtx = null; // { mod, id }

  function openModal(mod, record) {
    // El editor de presupuesto por categoría usa un esquema dinámico y un registro precargado.
    if (mod === "presupuestoCat") {
      const p = proyectoActual();
      const schema = presupuestoCatSchema();
      record = {}; const pc = (p && p.presupuestoCat) || {};
      schema.fields.forEach((f) => { record[f.k] = pc[f._cat] != null ? pc[f._cat] : ""; });
      return openModalWith(schema, "presupuestoCat", record, "Presupuesto por categoría");
    }
    // El perfil de sueldo es un objeto singleton (no un array de registros).
    if (mod === "sueldo") {
      return openModalWith(sueldoSchema(), "sueldo", DATA.sueldo || {}, "Configurar sueldo");
    }
    return openModalWith(SCHEMAS[mod], mod, record);
  }

  // Construye el esquema dinámico (un campo numérico por categoría de proyecto).
  function presupuestoCatSchema() {
    return { title: "presupuesto", fields: CAT_PROYECTO.map((c, i) => ({ k: "pc" + i, _cat: c, label: c, type: "number", min: 0 })) };
  }

  function openModalWith(schema, mod, record, forceTitle) {
    modalCtx = { mod, id: record?.id || null };
    $("#modalTitle").textContent = forceTitle || ((record ? "Editar " : "Nuevo ") + schema.title);

    const form = $("#modalForm");
    form.innerHTML = `<div class="field-grid">` + schema.fields.map((f) => {
      let val = record ? record[f.k] : (typeof f.default === "function" ? f.default() : "");
      const span = f.span === 2 ? " row2" : "";
      if (f.type === "checkbox") {
        const checked = record ? !!record[f.k] : (typeof f.default === "function" ? f.default() : false);
        return `<div class="field field-check row2"><input type="checkbox" id="f_${f.k}" class="chk" ${checked ? "checked" : ""}><label for="f_${f.k}">${esc(f.label)}</label></div>`;
      }
      let input;
      if (f.type === "select") {
        const optionList = typeof f.options === "function" ? f.options() : f.options;
        // Opciones simples (string) o {value,label} cuando el texto difiere del valor guardado.
        const opts = ['<option value="">—</option>'].concat(optionList.map((o) => {
          const ov = (o && typeof o === "object") ? o.value : o;
          const ol = (o && typeof o === "object") ? o.label : o;
          return `<option value="${esc(ov)}" ${String(val) === String(ov) ? "selected" : ""}>${esc(ol)}</option>`;
        })).join("");
        input = `<select id="f_${f.k}">${opts}</select>`;
      } else if (f.type === "textarea") {
        input = `<textarea id="f_${f.k}" placeholder="Opcional…">${esc(val)}</textarea>`;
      } else {
        const extra = f.type === "number" ? `step="0.01" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""}` : "";
        // Campo de texto con sugerencias opcionales (datalist): escribe libre o elige uno existente.
        let listAttr = "", listEl = "";
        if (f.datalist) {
          const items = (typeof f.datalist === "function" ? f.datalist() : f.datalist) || [];
          listAttr = ` list="dl_${f.k}"`;
          listEl = `<datalist id="dl_${f.k}">${items.map((o) => `<option value="${esc(o)}"></option>`).join("")}</datalist>`;
        }
        input = `<input id="f_${f.k}" type="${f.type}" value="${esc(val)}" ${extra}${listAttr} ${f.required ? "required" : ""}>${listEl}`;
      }
      return `<div class="field${span}"><label for="f_${f.k}">${esc(f.label)}${f.required ? " *" : ""}</label>${input}</div>`;
    }).join("") + `</div>`;

    $("#modalBackdrop").hidden = false;
    setTimeout(() => form.querySelector("input,select,textarea")?.focus(), 50);
  }

  function closeModal() { $("#modalBackdrop").hidden = true; modalCtx = null; }

  function submitModal(e) {
    e.preventDefault();
    if (!modalCtx) return;
    const { mod, id } = modalCtx;
    const schema = mod === "presupuestoCat" ? presupuestoCatSchema()
      : mod === "sueldo" ? sueldoSchema() : SCHEMAS[mod];

    // Caso especial: editor de presupuesto por categoría → objeto {categoria: monto}.
    if (mod === "presupuestoCat") {
      const p = proyectoActual();
      if (p) {
        const pc = {};
        schema.fields.forEach((f) => { const v = num($("#f_" + f.k)?.value); if (v) pc[f._cat] = v; });
        p.presupuestoCat = pc;
        scheduleSave(); closeModal(); render(); toast("Presupuestos guardados");
      } else closeModal();
      return;
    }

    // Caso especial: perfil de sueldo → se escribe sobre el objeto singleton.
    if (mod === "sueldo") {
      const s = DATA.sueldo || (DATA.sueldo = {});
      for (const f of schema.fields) {
        const el = $("#f_" + f.k);
        if (!el) continue;
        if (f.type === "checkbox") s[f.k] = el.checked;
        else if (f.type === "number") s[f.k] = num(el.value);
        else s[f.k] = el.value.trim();
      }
      scheduleSave(); closeModal(); render(); toast("Sueldo guardado");
      return;
    }

    const rec = { id: id || uid() };
    for (const f of schema.fields) {
      const el = $("#f_" + f.k);
      if (!el) continue;
      if (f.type === "checkbox") rec[f.k] = el.checked;
      else if (f.type === "number") rec[f.k] = num(el.value);
      else rec[f.k] = el.value.trim();
    }

    // ¿Es un sub-registro anidado (movimiento/etapa/proveedor en proyecto, opción en cotización)?
    const meta = NESTED_COLL[mod];
    let list;
    if (meta) {
      const parent = meta.parent();
      if (!parent) { closeModal(); return; }
      list = parent[meta.coll] || (parent[meta.coll] = []);
    } else {
      list = DATA[mod];
    }

    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) {
      // Al editar proyecto/cotización/meta, conserva sus sub-colecciones (no están en el formulario).
      list[idx] = (mod === "proyectos" || mod === "cotizaciones" || mod === "ahorros") ? { ...list[idx], ...rec } : rec;
    } else {
      if (mod === "proyectos") { rec.movimientos = []; rec.etapas = []; rec.proveedores = []; rec.fondos = []; rec.presupuestoCat = {}; }
      if (mod === "cotizaciones") { rec.opciones = []; rec.elegidaId = ""; rec.movimientoId = ""; rec.fecha = isoToday(); }
      if (mod === "ahorros") { rec.abonos = []; rec.ahorrado = 0; }
      list.push(rec);
    }
    // El total ahorrado de una meta se deriva de sus abonos.
    if (mod === "abono") recalcAhorrado(meta.parent());
    scheduleSave();
    closeModal();
    render();
    toast(idx >= 0 ? "Cambios guardados" : "Registro agregado");
  }

  // ============================================================
  //  EVENTOS
  // ============================================================
  function bindEvents() {
    // navegación
    $("#nav").addEventListener("click", (e) => {
      const b = e.target.closest(".nav-item");
      if (!b) return;
      VIEW = b.dataset.view;
      CURRENT_PROYECTO = null;     // siempre entra a la lista de proyectos
      CURRENT_COTIZACION = null;   // …y a la lista de cotizaciones
      OPEN_AHORRO = null;          // …y a la lista de ahorros
      closeNav();
      render();
    });

    // mes
    $("#monthInput").addEventListener("change", (e) => { CURRENT_MONTH = e.target.value || todayMonth(); render(); });
    $("#prevMonth").addEventListener("click", () => { CURRENT_MONTH = shiftMonth(CURRENT_MONTH, -1); syncMonthInput(); render(); });
    $("#nextMonth").addEventListener("click", () => { CURRENT_MONTH = shiftMonth(CURRENT_MONTH, 1); syncMonthInput(); render(); });

    // import / export / demo
    $("#importBtn").addEventListener("click", openImportDialog);
    $("#fileInput").addEventListener("change", onImportFile);
    $("#exportBtn").addEventListener("click", openExportDialog);
    $("#sampleBtn").addEventListener("click", loadSample);

    // tema
    $("#themeBtn").addEventListener("click", toggleTheme);

    // menú móvil (drawer + scrim)
    $("#menuBtn").addEventListener("click", () => {
      const open = $(".sidebar").classList.toggle("open");
      $("#navScrim").classList.toggle("show", open);
    });
    $("#navScrim").addEventListener("click", closeNav);

    // delegación en content (add / edit / del / toggle)
    $("#content").addEventListener("click", onContentClick);
    $("#content").addEventListener("change", onContentChange);
    $("#content").addEventListener("input", onContentInput);

    // modal
    $("#modalForm").addEventListener("submit", submitModal);
    $("#modalClose").addEventListener("click", closeModal);
    $("#modalCancel").addEventListener("click", closeModal);
    $("#modalBackdrop").addEventListener("click", (e) => { if (e.target.id === "modalBackdrop") closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modalBackdrop").hidden) closeModal(); });

    // re-pintar charts al cambiar tamaño de ventana (debounce simple)
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (VIEW === "dashboard") render(); }, 250); });
  }

  function onContentClick(e) {
    const goto = e.target.closest(".js-goto");
    if (goto) { VIEW = goto.dataset.view; render(); return; }

    // Abrir / cerrar el detalle de un proyecto (reinicia el filtro de movimientos).
    const openP = e.target.closest(".js-open-proy");
    if (openP) { VIEW = "proyectos"; CURRENT_COTIZACION = null; CURRENT_PROYECTO = openP.dataset.id; MOV_FILTER = emptyMovFilter(); render(); return; }
    if (e.target.closest(".js-back-proy")) { CURRENT_PROYECTO = null; MOV_FILTER = emptyMovFilter(); render(); return; }

    // Limpiar todos los filtros de la tabla de movimientos.
    if (e.target.closest(".js-mov-clear")) { MOV_FILTER = emptyMovFilter(); render(); return; }

    // Abrir / cerrar el detalle de una cotización.
    const openC = e.target.closest(".js-open-cotiz");
    if (openC) { CURRENT_COTIZACION = openC.dataset.id; render(); return; }
    if (e.target.closest(".js-back-cotiz")) { CURRENT_COTIZACION = null; render(); return; }
    if (e.target.closest(".js-cotiz-clear")) { COTIZ_FILTER.proyectoId = ""; render(); return; }

    // Elegir / quitar elección de una opción dentro de una cotización.
    const elegir = e.target.closest(".js-cotiz-elegir");
    if (elegir) { const c = cotizacionActual(); const id_ = e.target.closest("[data-id]")?.dataset.id; if (c && id_) elegirOpcion(c, id_); return; }
    if (e.target.closest(".js-cotiz-unelegir")) { const c = cotizacionActual(); if (c) elegirOpcion(c, ""); return; }

    // Registrar la opción elegida como gasto en el proyecto vinculado.
    if (e.target.closest(".js-cotiz-registrar")) { const c = cotizacionActual(); if (c) registrarGastoCotizacion(c); return; }

    // Abrir / cerrar el detalle de una meta de ahorro.
    const openA = e.target.closest(".js-open-ahorro");
    if (openA) { OPEN_AHORRO = openA.dataset.id; render(); return; }
    if (e.target.closest(".js-back-ahorro")) { OPEN_AHORRO = null; render(); return; }

    // Agregar un abono a una meta de ahorro (fija la meta destino y abre el modal).
    const addAbono = e.target.closest(".js-add-abono");
    if (addAbono) { CURRENT_AHORRO = addAbono.dataset.id; openModal("abono"); return; }

    const addBtn = e.target.closest(".js-add");
    if (addBtn) { openModal(addBtn.dataset.mod); return; }

    const row = e.target.closest("[data-id]");
    if (!row) return;
    const id = row.dataset.id;
    const mod = row.dataset.mod || currentMod();

    // Para editar/borrar un abono, fija primero su meta padre (viene en data-parent).
    if (mod === "abono" && row.dataset.parent) CURRENT_AHORRO = row.dataset.parent;

    // La colección puede ser global (DATA[mod]) o anidada dentro de su registro padre.
    const meta = NESTED_COLL[mod];
    const getList = () => meta ? (meta.parent()?.[meta.coll] || []) : DATA[mod];

    if (e.target.closest(".js-edit")) {
      const rec = getList().find((r) => r.id === id);
      if (rec) openModal(mod, rec);
    } else if (e.target.closest(".js-del")) {
      const rec = getList().find((r) => r.id === id);
      const name = rec?.concepto || rec?.nombre || rec?.titulo || rec?.proveedor || "este registro";
      if (confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) {
        if (meta) {
          const parent = meta.parent();
          if (parent) parent[meta.coll] = parent[meta.coll].filter((r) => r.id !== id);
          if (mod === "abono") recalcAhorrado(parent); // el total ahorrado depende de los abonos
        } else {
          DATA[mod] = DATA[mod].filter((r) => r.id !== id);
          if (mod === "proyectos" && CURRENT_PROYECTO === id) CURRENT_PROYECTO = null;
          if (mod === "cotizaciones" && CURRENT_COTIZACION === id) CURRENT_COTIZACION = null;
          if (mod === "ahorros" && OPEN_AHORRO === id) OPEN_AHORRO = null;
        }
        scheduleSave(); render(); toast("Registro eliminado");
      }
    }
  }

  // Actualiza el filtro de movimientos desde un control (select o input) y refresca solo la tabla.
  function applyMovFilterControl(el) {
    const fk = el?.dataset?.fk;
    if (!fk || !(fk in MOV_FILTER)) return false;
    MOV_FILTER[fk] = el.value;
    refreshMovTable();
    return true;
  }

  function onContentInput(e) {
    const ctrl = e.target.closest(".js-mov-filter");
    if (ctrl) applyMovFilterControl(ctrl);
  }

  function onContentChange(e) {
    // Filtro de la lista de cotizaciones por proyecto.
    const cf = e.target.closest(".js-cotiz-filter");
    if (cf) { COTIZ_FILTER.proyectoId = cf.value; render(); return; }

    // Filtros de la tabla de movimientos (selects).
    const ctrl = e.target.closest(".js-mov-filter");
    if (ctrl && applyMovFilterControl(ctrl)) return;

    // Slider de avance de etapa.
    const range = e.target.closest(".js-etapa-avance");
    if (range) {
      const row = e.target.closest("[data-id]");
      const p = proyectoActual();
      const et = p?.etapas.find((r) => r.id === row.dataset.id);
      if (et) { et.avance = num(range.value); scheduleSave(); render(); }
      return;
    }
    const t = e.target.closest(".js-toggle");
    if (!t) return;
    const row = e.target.closest("[data-id]");
    const p = DATA.pagos.find((r) => r.id === row.dataset.id);
    if (p) { p.pagado = t.checked; scheduleSave(); render(); }
  }

  function currentMod() {
    return ({ pagos: "pagos", recurrentes: "recurrentes", ingresos: "ingresos", ahorros: "ahorros", viajes: "viajes", proyectos: "proyectos", cotizaciones: "cotizaciones" })[VIEW] || "pagos";
  }

  // ---------- Import / Export ----------
  // Diálogo genérico (independiente del modal de registros).
  function openDialog(title, bodyHTML, buttons) {
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = `<div class="modal modal-lg">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn js-dlg-close" type="button">✕</button></div>
      <div class="dlg-body">${bodyHTML}</div>
      <div class="modal-foot"></div>
    </div>`;
    const close = () => { back.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const foot = back.querySelector(".modal-foot");
    (buttons || []).forEach((b) => {
      const btn = document.createElement("button");
      btn.className = "btn " + (b.cls || "btn-ghost");
      btn.type = "button";
      btn.textContent = b.label;
      btn.addEventListener("click", () => { if (b.onClick) b.onClick(close); if (b.close) close(); });
      foot.appendChild(btn);
    });
    back.querySelector(".js-dlg-close").addEventListener("click", close);
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(back);
    setTimeout(() => back.querySelector("textarea, input")?.focus(), 50);
    return close;
  }

  function openImportDialog() {
    const body = `
      <p class="dlg-hint">Pega aquí tu JSON, o carga un archivo. Esto <b>reemplazará</b> tus datos actuales (exporta antes si quieres respaldo).</p>
      <textarea id="dlgImportText" class="dlg-textarea" placeholder='Pega aquí tu JSON…  { "version": 1, "moneda": "MXN", ... }'></textarea>
      <div><button class="btn btn-ghost btn-sm" id="dlgImportFile" type="button">📂 Cargar desde archivo…</button></div>`;
    openDialog("Importar datos", body, [
      { label: "Cancelar", cls: "btn-ghost", close: true },
      { label: "Importar", cls: "btn-primary", onClick: (close) => {
          const txt = $("#dlgImportText").value.trim();
          if (!txt) { toast("Pega un JSON o carga un archivo"); return; }
          if (importFromText(txt)) close();
        } },
    ]);
    $("#dlgImportFile").addEventListener("click", () => $("#fileInput").click());
  }

  // Carga el contenido del archivo en el textarea del diálogo (o importa directo como fallback).
  function onImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ta = document.getElementById("dlgImportText");
      if (ta) { ta.value = reader.result; toast("Archivo cargado, revisa y pulsa Importar"); }
      else importFromText(reader.result);
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  function importFromText(text) {
    try {
      const parsed = JSON.parse(text);
      DATA = migrate(parsed);
      save(); render(); toast("📥 Datos importados correctamente");
      return true;
    } catch (err) {
      alert("El JSON no es válido.\n\n" + err.message);
      return false;
    }
  }

  function openExportDialog() {
    DATA.version = SCHEMA_VERSION;
    const json = JSON.stringify(DATA, null, 2);
    const body = `
      <p class="dlg-hint">Copia este JSON al portapapeles o descárgalo como respaldo.</p>
      <textarea id="dlgExportText" class="dlg-textarea" readonly>${esc(json)}</textarea>`;
    openDialog("Exportar datos", body, [
      { label: "Cerrar", cls: "btn-ghost", close: true },
      { label: "⬇️ Descargar", cls: "btn-ghost", onClick: () => downloadJSON(json) },
      { label: "📋 Copiar", cls: "btn-primary", onClick: () => copyText(json) },
    ]);
  }

  function downloadJSON(json) {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `finanzas-${isoToday()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("📤 JSON descargado");
  }

  function copyText(text) {
    const done = () => toast("📋 Copiado al portapapeles");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy());
    } else fallbackCopy();
    function fallbackCopy() {
      const ta = document.getElementById("dlgExportText");
      if (!ta) return;
      ta.focus(); ta.select();
      try { document.execCommand("copy"); done(); }
      catch { toast("No se pudo copiar; selecciónalo y copia manualmente"); }
    }
  }

  function loadSample() {
    if (DATA.pagos.length || DATA.ingresos.length || DATA.ahorros.length || DATA.recurrentes.length) {
      if (!confirm("Esto reemplazará tus datos actuales con datos de ejemplo. ¿Continuar?")) return;
    }
    DATA = migrate(SAMPLE());
    save(); render(); toast("✨ Datos de ejemplo cargados");
  }

  // ---------- Tema ----------
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $("#themeBtn").textContent = t === "dark" ? "☀️" : "🌙";
    // Sincroniza el color de la barra del navegador / status bar móvil con el topbar.
    const meta = $("#metaTheme");
    if (meta) meta.setAttribute("content", t === "dark" ? "#161b24" : "#ffffff");
    localStorage.setItem(LS_THEME, t);
  }
  // Cierra el drawer móvil y su scrim.
  function closeNav() {
    $(".sidebar")?.classList.remove("open");
    $("#navScrim")?.classList.remove("show");
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(cur === "dark" ? "light" : "dark");
    if (VIEW === "dashboard") render(); // re-color charts
  }

  // ---------- Misc UI ----------
  function syncMonthInput() { $("#monthInput").value = CURRENT_MONTH; }
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.hidden = false;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove("show"); setTimeout(() => (el.hidden = true), 200); }, 2200);
  }

  // ============================================================
  //  DATOS DE EJEMPLO
  // ============================================================
  function SAMPLE() {
    const m = todayMonth();
    const prev = shiftMonth(m, -1);
    const [y, mm] = m.split("-");
    const d = (day) => `${y}-${mm}-${String(day).padStart(2, "0")}`;
    return {
      version: 1, moneda: "MXN",
      pagos: [
        { id: uid(), mes: m, banco: "BBVA", concepto: "Renta departamento", categoria: "Vivienda", monto: 9500, fechaLimite: d(5), pagado: true, notas: "" },
        { id: uid(), mes: m, banco: "Santander", concepto: "Tarjeta de crédito", categoria: "Tarjeta de crédito", monto: 3200, fechaLimite: d(18), pagado: false, notas: "Pago mínimo 1,100" },
        { id: uid(), mes: m, banco: "CFE", concepto: "Luz", categoria: "Servicios", monto: 680, fechaLimite: d(22), pagado: false, notas: "" },
        { id: uid(), mes: m, banco: "Banorte", concepto: "Crédito automotriz", categoria: "Préstamo", monto: 4100, fechaLimite: d(10), pagado: false, notas: "" },
        { id: uid(), mes: prev, banco: "BBVA", concepto: "Renta departamento", categoria: "Vivienda", monto: 9500, fechaLimite: shiftMonth(m,-1)+"-05", pagado: true, notas: "" },
      ],
      recurrentes: [
        { id: uid(), concepto: "Netflix", categoria: "Suscripciones", banco: "Santander", monto: 219, diaCobro: 12, activo: true, notas: "Plan estándar" },
        { id: uid(), concepto: "Spotify", categoria: "Suscripciones", banco: "Santander", monto: 129, diaCobro: 3, activo: true, notas: "" },
        { id: uid(), concepto: "Internet Totalplay", categoria: "Servicios", banco: "BBVA", monto: 599, diaCobro: 15, activo: true, notas: "" },
        { id: uid(), concepto: "Gimnasio", categoria: "Salud", banco: "Efectivo", monto: 450, diaCobro: 1, activo: true, notas: "" },
      ],
      ingresos: [
        { id: uid(), fecha: d(15), concepto: "Quincena", fuente: "Mi empresa", tipo: "Salario", monto: 14000, notas: "" },
        { id: uid(), fecha: d(30), concepto: "Quincena", fuente: "Mi empresa", tipo: "Salario", monto: 14000, notas: "" },
        { id: uid(), fecha: d(20), concepto: "Proyecto freelance", fuente: "Cliente X", tipo: "Extra", monto: 6500, notas: "Landing page" },
      ],
      ahorros: [
        { id: uid(), nombre: "Boda", tipo: "Proyecto", objetivo: 180000, ahorrado: 64000, fechaMeta: `${Number(y)+1}-06-01`, notas: "Meta a 12 meses" },
        { id: uid(), nombre: "Fondo de emergencia", tipo: "Fondo emergencia", objetivo: 90000, ahorrado: 52000, fechaMeta: "", notas: "3 meses de gastos" },
        { id: uid(), nombre: "Viaje a Japón", tipo: "Viaje", objetivo: 60000, ahorrado: 18000, fechaMeta: `${Number(y)+1}-11-01`, notas: "" },
      ],
      viajes: [
        { id: uid(), destino: "Cancún", fecha: d(20), dias: 4, presupuesto: 18000, gastado: 12500, estado: "Reservado", notas: "Vuelo + hotel todo incluido" },
        { id: uid(), destino: "CDMX", fecha: shiftMonth(m,-1)+"-12", dias: 3, presupuesto: 9000, gastado: 9800, estado: "Realizado", notas: "Se pasó un poco el gasto" },
        { id: uid(), destino: "Japón", fecha: `${Number(y)+1}-11-05`, dias: 12, presupuesto: 60000, gastado: 0, estado: "Planeado", notas: "" },
      ],
      proyectos: [
        {
          id: uid(),
          nombre: "Construcción cuarto de azotea",
          tipo: "Construcción", estado: "En curso",
          presupuesto: 120000, fechaInicio: d(1), fechaMeta: `${Number(y)+1}-02-01`,
          ubicacion: "Casa", notas: "Cuarto de 4x5 m con baño.",
          movimientos: [
            { id: uid(), tipo: "Entrada", categoria: "", concepto: "Aportación inicial", monto: 50000, fecha: d(1), proveedor: "", metodo: "Transferencia", recibo: "", notas: "Ahorro destinado a la obra" },
            { id: uid(), tipo: "Entrada", categoria: "", concepto: "Aportación quincena", monto: 20000, fecha: d(15), proveedor: "", metodo: "Transferencia", recibo: "", notas: "" },
            { id: uid(), tipo: "Salida", categoria: "Material", concepto: "Cemento y varilla", monto: 18500, fecha: d(3), proveedor: "Materiales El Águila", etapa: "Cimentación", metodo: "Efectivo", recibo: "Factura A-1203", notas: "" },
            { id: uid(), tipo: "Salida", categoria: "Material", concepto: "Block y arena", monto: 9200, fecha: d(4), proveedor: "Materiales El Águila", etapa: "Muros", metodo: "Efectivo", recibo: "", notas: "" },
            { id: uid(), tipo: "Salida", categoria: "Mano de obra", concepto: "Albañil — semana 1", monto: 6500, fecha: d(8), proveedor: "Don Beto (albañil)", etapa: "Cimentación", metodo: "Efectivo", recibo: "", notas: "Incluye ayudante" },
            { id: uid(), tipo: "Salida", categoria: "Mano de obra", concepto: "Albañil — semana 2", monto: 6500, fecha: d(15), proveedor: "Don Beto (albañil)", etapa: "Muros", metodo: "Efectivo", recibo: "", notas: "" },
            { id: uid(), tipo: "Salida", categoria: "Permisos/Trámites", concepto: "Permiso de construcción", monto: 3200, fecha: d(2), proveedor: "", etapa: "", metodo: "Tarjeta", recibo: "", notas: "" },
            { id: uid(), tipo: "Salida", categoria: "Renta de maquinaria", concepto: "Revolvedora 2 días", monto: 1400, fecha: d(7), proveedor: "", etapa: "Cimentación", metodo: "Efectivo", recibo: "", notas: "" },
          ],
          etapas: [
            { id: uid(), nombre: "Cimentación", presupuesto: 25000, avance: 100, notas: "" },
            { id: uid(), nombre: "Muros", presupuesto: 35000, avance: 60, notas: "" },
            { id: uid(), nombre: "Losa / techo", presupuesto: 35000, avance: 10, notas: "" },
            { id: uid(), nombre: "Acabados", presupuesto: 25000, avance: 0, notas: "Pintura, piso, baño" },
          ],
          presupuestoCat: { "Material": 60000, "Mano de obra": 40000, "Permisos/Trámites": 5000, "Renta de maquinaria": 5000, "Otros": 10000 },
          proveedores: [
            { id: uid(), nombre: "Don Beto (albañil)", oficio: "Albañil", contacto: "55 1234 5678", notas: "Cobra por semana" },
            { id: uid(), nombre: "Materiales El Águila", oficio: "Proveedor material", contacto: "Tienda esquina", notas: "" },
          ],
        },
      ],
    };
  }

  // ============================================================
  //  INIT
  // ============================================================
  function init() {
    applyTheme(localStorage.getItem(LS_THEME) || "light");
    const had = loadLocal();
    setSaveState(had ? "saved" : "", had ? "Guardado local" : "Sin datos");
    syncMonthInput();
    bindEvents();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
