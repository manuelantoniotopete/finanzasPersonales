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
  });

  let DATA = emptyData();
  let VIEW = "dashboard";
  let CURRENT_PROYECTO = null;        // id del proyecto abierto (vista detalle) o null (lista)
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
    for (const k of ["pagos", "recurrentes", "ingresos", "ahorros", "viajes", "bonos"]) {
      base[k] = Array.isArray(obj[k]) ? obj[k].map((r) => ({ id: r.id || uid(), ...r })) : [];
    }
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
      presupuestoCat: (p.presupuestoCat && typeof p.presupuestoCat === "object") ? p.presupuestoCat : {},
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
        { k: "ahorrado", label: "Ahorrado", type: "number" },
        { k: "fechaMeta", label: "Fecha meta", type: "date" },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
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
        { k: "tipo", label: "Tipo", type: "select", options: ["Salida", "Entrada"], required: true, default: () => "Salida" },
        { k: "categoria", label: "Categoría", type: "select", options: CAT_PROYECTO },
        { k: "concepto", label: "Concepto", type: "text", required: true, span: 2 },
        { k: "monto", label: "Monto", type: "number", required: true },
        { k: "fecha", label: "Fecha", type: "date", default: () => isoToday() },
        { k: "proveedor", label: "Proveedor / quién", type: "select", options: () => proveedoresOpts() },
        { k: "metodo", label: "Método de pago", type: "select", options: ["Efectivo", "Transferencia", "Tarjeta", "Crédito", "Otro"] },
        { k: "recibo", label: "Recibo / referencia (nota o URL)", type: "text", span: 2 },
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

  // Mapea un sub-esquema a la colección dentro del proyecto
  const NESTED_COLL = { movimiento: "movimientos", etapa: "etapas", proveedor: "proveedores" };

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
    else if (VIEW === "ahorros")     c.innerHTML = viewAhorros();
    else if (VIEW === "viajes")      c.innerHTML = viewViajes();
    else if (VIEW === "proyectos")   c.innerHTML = CURRENT_PROYECTO ? viewProyectoDetalle() : viewProyectos();
    // charts después de inyectar el HTML
    if (VIEW === "dashboard") renderDashboardCharts();
    else if (VIEW === "sueldo") renderSueldoChart();
    else if (VIEW === "viajes") renderViajesChart();
    else if (VIEW === "proyectos" && CURRENT_PROYECTO) renderProyectoCharts();
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
  function viewAhorros() {
    const as = DATA.ahorros;
    const cards = as.map((a) => {
      const obj = num(a.objetivo), ah = num(a.ahorrado);
      const pct = obj > 0 ? Math.min(100, Math.round((ah / obj) * 100)) : 0;
      const done = obj > 0 && ah >= obj;
      const falta = Math.max(0, obj - ah);
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
    const salidas = movs.filter((m) => m.tipo !== "Entrada");
    const aportado = sum(movs.filter((m) => m.tipo === "Entrada"), "monto");
    const gastado = sum(salidas, "monto");
    const saldo = aportado - gastado;
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
    return { aportado, gastado, saldo, presupuesto, pctPres, porCat, porMes, avance, tieneEtapas: etapas.length > 0 };
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
        ${kpi("Gastado", fmtMoney(mt.gastado), "neg", `${(p.movimientos || []).filter(m => m.tipo !== "Entrada").length} salida(s)`)}
        ${kpi("Saldo disponible", fmtMoney(mt.saldo), mt.saldo >= 0 ? "pos" : "neg", mt.saldo >= 0 ? "Te queda en el bote" : "Aportado de menos")}
        ${kpi("Gastado vs presupuesto", mt.presupuesto ? mt.pctPres + "%" : "—", overP ? "neg" : "", mt.presupuesto ? `${fmtMoney(mt.gastado)} de ${fmtMoney(mt.presupuesto)}` : "Sin presupuesto definido")}
        ${kpi("Avance de obra", mt.tieneEtapas ? mt.avance + "%" : "—", "", mt.tieneEtapas ? `${p.etapas.length} etapa(s)` : "Agrega etapas abajo")}
      </div>

      ${mt.tieneEtapas && mt.presupuesto ? avanceVsGasto(mt) : ""}

      <div class="chart-grid">
        <div class="card"><div class="card-title">Gasto por categoría</div><div class="chart-box"><canvas id="chProyCat"></canvas></div></div>
        <div class="card"><div class="card-title">Gasto por mes</div><div class="chart-box"><canvas id="chProyMes"></canvas></div></div>
      </div>

      ${etapasSection(p, mt)}
      ${presupuestoCatSection(p, mt)}
      ${proveedoresSection(p)}
      ${movimientosSection(p)}
    `;
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

  function etapasSection(p, mt) {
    const etapas = p.etapas || [];
    const rows = etapas.map((e) => {
      const av = Math.max(0, Math.min(100, num(e.avance)));
      return `<div class="etapa-row" data-id="${e.id}" data-mod="etapa">
        <div class="etapa-info">
          <span class="etapa-name">${esc(e.nombre)}</span>
          <span class="muted">${e.presupuesto ? fmtMoney(e.presupuesto) : "sin presupuesto"}${e.notas ? " · " + esc(e.notas) : ""}</span>
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
    const pagado = (nombre) => sum((p.movimientos || []).filter((m) => m.tipo !== "Entrada" && m.proveedor === nombre), "monto");
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

  function movimientosSection(p) {
    const movs = (p.movimientos || []).slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const rows = movs.map((m) => {
      const entrada = m.tipo === "Entrada";
      const signo = entrada ? "+" : "−";
      const color = entrada ? "var(--success)" : "var(--danger)";
      return `<tr data-id="${m.id}" data-mod="movimiento">
        <td>${fmtDate(m.fecha)}</td>
        <td><span class="pill ${entrada ? "ok" : "muted"}">${entrada ? "🟢 Entrada" : "🔴 Salida"}</span></td>
        <td><b>${esc(m.concepto)}</b></td>
        <td>${entrada ? "<span class='muted'>—</span>" : `<span class="pill muted">${esc(m.categoria) || "—"}</span>`}</td>
        <td>${esc(m.proveedor) || "<span class='muted'>—</span>"}</td>
        <td>${esc(m.metodo) || "<span class='muted'>—</span>"}</td>
        <td class="t-num" style="color:${color}">${signo} ${fmtMoney(m.monto)}</td>
        <td class="notes-cell">${reciboCell(m.recibo)}${esc(m.notas) ? (m.recibo ? " · " : "") + esc(m.notas) : ""}</td>
        ${actionsCell()}
      </tr>`;
    }).join("");
    return `<div class="card">
      <div class="card-title proy-section-head">
        <span>Movimientos (${movs.length})</span>
        <button class="btn btn-primary btn-sm js-add" data-mod="movimiento">＋ Movimiento</button>
      </div>
      ${movs.length ? `<div class="table-scroll"><table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Categoría</th><th>Proveedor</th><th>Método</th><th class="t-num">Monto</th><th>Recibo / notas</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
        : `<p class="muted">Sin movimientos. Registra entradas (aportaciones) y salidas (gastos) de este proyecto.</p>`}
    </div>`;
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
        const opts = ['<option value="">—</option>'].concat(optionList.map((o) => `<option ${val === o ? "selected" : ""}>${esc(o)}</option>`)).join("");
        input = `<select id="f_${f.k}">${opts}</select>`;
      } else if (f.type === "textarea") {
        input = `<textarea id="f_${f.k}" placeholder="Opcional…">${esc(val)}</textarea>`;
      } else {
        const extra = f.type === "number" ? `step="0.01" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""}` : "";
        input = `<input id="f_${f.k}" type="${f.type}" value="${esc(val)}" ${extra} ${f.required ? "required" : ""}>`;
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

    // ¿Es un sub-registro de proyecto (movimiento/etapa/proveedor)?
    const coll = NESTED_COLL[mod];
    let list;
    if (coll) {
      const p = proyectoActual();
      if (!p) { closeModal(); return; }
      list = p[coll] || (p[coll] = []);
    } else {
      list = DATA[mod];
    }

    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) {
      // Al editar un proyecto, conserva sus sub-colecciones (no están en el formulario).
      list[idx] = mod === "proyectos" ? { ...list[idx], ...rec } : rec;
    } else {
      if (mod === "proyectos") { rec.movimientos = []; rec.etapas = []; rec.proveedores = []; rec.presupuestoCat = {}; }
      list.push(rec);
    }
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
      $(".sidebar").classList.remove("open");
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

    // menú móvil
    $("#menuBtn").addEventListener("click", () => $(".sidebar").classList.toggle("open"));

    // delegación en content (add / edit / del / toggle)
    $("#content").addEventListener("click", onContentClick);
    $("#content").addEventListener("change", onContentChange);

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

    // Abrir / cerrar el detalle de un proyecto.
    const openP = e.target.closest(".js-open-proy");
    if (openP) { CURRENT_PROYECTO = openP.dataset.id; render(); return; }
    if (e.target.closest(".js-back-proy")) { CURRENT_PROYECTO = null; render(); return; }

    const addBtn = e.target.closest(".js-add");
    if (addBtn) { openModal(addBtn.dataset.mod); return; }

    const row = e.target.closest("[data-id]");
    if (!row) return;
    const id = row.dataset.id;
    const mod = row.dataset.mod || currentMod();

    // La colección puede ser global (DATA[mod]) o anidada dentro del proyecto actual.
    const coll = NESTED_COLL[mod];
    const getList = () => coll ? (proyectoActual()?.[coll] || []) : DATA[mod];

    if (e.target.closest(".js-edit")) {
      const rec = getList().find((r) => r.id === id);
      if (rec) openModal(mod, rec);
    } else if (e.target.closest(".js-del")) {
      const rec = getList().find((r) => r.id === id);
      const name = rec?.concepto || rec?.nombre || "este registro";
      if (confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) {
        if (coll) {
          const p = proyectoActual();
          if (p) p[coll] = p[coll].filter((r) => r.id !== id);
        } else {
          DATA[mod] = DATA[mod].filter((r) => r.id !== id);
          if (mod === "proyectos" && CURRENT_PROYECTO === id) CURRENT_PROYECTO = null;
        }
        scheduleSave(); render(); toast("Registro eliminado");
      }
    }
  }

  function onContentChange(e) {
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
    return ({ pagos: "pagos", recurrentes: "recurrentes", ingresos: "ingresos", ahorros: "ahorros", viajes: "viajes", proyectos: "proyectos" })[VIEW] || "pagos";
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
    localStorage.setItem(LS_THEME, t);
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
            { id: uid(), tipo: "Salida", categoria: "Material", concepto: "Cemento y varilla", monto: 18500, fecha: d(3), proveedor: "Materiales El Águila", metodo: "Efectivo", recibo: "Factura A-1203", notas: "" },
            { id: uid(), tipo: "Salida", categoria: "Material", concepto: "Block y arena", monto: 9200, fecha: d(4), proveedor: "Materiales El Águila", metodo: "Efectivo", recibo: "", notas: "" },
            { id: uid(), tipo: "Salida", categoria: "Mano de obra", concepto: "Albañil — semana 1", monto: 6500, fecha: d(8), proveedor: "Don Beto (albañil)", metodo: "Efectivo", recibo: "", notas: "Incluye ayudante" },
            { id: uid(), tipo: "Salida", categoria: "Mano de obra", concepto: "Albañil — semana 2", monto: 6500, fecha: d(15), proveedor: "Don Beto (albañil)", metodo: "Efectivo", recibo: "", notas: "" },
            { id: uid(), tipo: "Salida", categoria: "Permisos/Trámites", concepto: "Permiso de construcción", monto: 3200, fecha: d(2), proveedor: "", metodo: "Tarjeta", recibo: "", notas: "" },
            { id: uid(), tipo: "Salida", categoria: "Renta de maquinaria", concepto: "Revolvedora 2 días", monto: 1400, fecha: d(7), proveedor: "", metodo: "Efectivo", recibo: "", notas: "" },
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
