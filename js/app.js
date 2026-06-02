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

  // ---------- Estado ----------
  const emptyData = () => ({
    version: SCHEMA_VERSION,
    moneda: "MXN",
    pagos: [],        // {id, mes, banco, concepto, categoria, monto, fechaLimite, pagado, notas}
    recurrentes: [],  // {id, concepto, categoria, banco, monto, diaCobro, activo, notas}
    ingresos: [],     // {id, fecha, concepto, fuente, tipo, monto, notas}
    ahorros: [],      // {id, nombre, tipo, objetivo, ahorrado, fechaMeta, notas}
    viajes: [],       // {id, destino, fecha, dias, presupuesto, gastado, estado, notas}
  });

  let DATA = emptyData();
  let VIEW = "dashboard";
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
    for (const k of ["pagos", "recurrentes", "ingresos", "ahorros", "viajes"]) {
      base[k] = Array.isArray(obj[k]) ? obj[k].map((r) => ({ id: r.id || uid(), ...r })) : [];
    }
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
  };

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
    else if (VIEW === "ahorros")     c.innerHTML = viewAhorros();
    else if (VIEW === "viajes")      c.innerHTML = viewViajes();
    // charts después de inyectar el HTML
    if (VIEW === "dashboard") renderDashboardCharts();
    else if (VIEW === "viajes") renderViajesChart();
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
    const ing = sum(ingresosDelMes(ym), "monto");
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
        ${kpi("Ingresos del mes", fmtMoney(ing), "pos", ingresosDelMes(ym).length + " registro(s)")}
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
    const ingData = months.map((m) => sum(ingresosDelMes(m), "monto"));
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
      ${is.length ? `<div class="table-wrap"><div class="table-scroll"><table>
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Fuente</th><th>Tipo</th><th class="t-num">Monto</th><th>Notas</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>` : emptyState("ingresos", "Sin ingresos registrados", "Agrega tus salarios y otros ingresos.")}
    `;
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
    const schema = SCHEMAS[mod];
    modalCtx = { mod, id: record?.id || null };
    $("#modalTitle").textContent = (record ? "Editar " : "Nuevo ") + schema.title;

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
        const opts = ['<option value="">—</option>'].concat(f.options.map((o) => `<option ${val === o ? "selected" : ""}>${esc(o)}</option>`)).join("");
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
    const schema = SCHEMAS[mod];
    const rec = { id: id || uid() };
    for (const f of schema.fields) {
      const el = $("#f_" + f.k);
      if (!el) continue;
      if (f.type === "checkbox") rec[f.k] = el.checked;
      else if (f.type === "number") rec[f.k] = num(el.value);
      else rec[f.k] = el.value.trim();
    }
    const list = DATA[mod];
    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) list[idx] = rec; else list.push(rec);
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
      $(".sidebar").classList.remove("open");
      render();
    });

    // mes
    $("#monthInput").addEventListener("change", (e) => { CURRENT_MONTH = e.target.value || todayMonth(); render(); });
    $("#prevMonth").addEventListener("click", () => { CURRENT_MONTH = shiftMonth(CURRENT_MONTH, -1); syncMonthInput(); render(); });
    $("#nextMonth").addEventListener("click", () => { CURRENT_MONTH = shiftMonth(CURRENT_MONTH, 1); syncMonthInput(); render(); });

    // import / export / demo
    $("#importBtn").addEventListener("click", () => $("#fileInput").click());
    $("#fileInput").addEventListener("change", onImportFile);
    $("#exportBtn").addEventListener("click", exportJSON);
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

    const addBtn = e.target.closest(".js-add");
    if (addBtn) { openModal(addBtn.dataset.mod); return; }

    const row = e.target.closest("[data-id]");
    if (!row) return;
    const id = row.dataset.id;
    const mod = currentMod();

    if (e.target.closest(".js-edit")) {
      const rec = DATA[mod].find((r) => r.id === id);
      if (rec) openModal(mod, rec);
    } else if (e.target.closest(".js-del")) {
      const rec = DATA[mod].find((r) => r.id === id);
      const name = rec?.concepto || rec?.nombre || "este registro";
      if (confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) {
        DATA[mod] = DATA[mod].filter((r) => r.id !== id);
        scheduleSave(); render(); toast("Registro eliminado");
      }
    }
  }

  function onContentChange(e) {
    const t = e.target.closest(".js-toggle");
    if (!t) return;
    const row = e.target.closest("[data-id]");
    const p = DATA.pagos.find((r) => r.id === row.dataset.id);
    if (p) { p.pagado = t.checked; scheduleSave(); render(); }
  }

  function currentMod() {
    return ({ pagos: "pagos", recurrentes: "recurrentes", ingresos: "ingresos", ahorros: "ahorros", viajes: "viajes" })[VIEW] || "pagos";
  }

  // ---------- Import / Export ----------
  function onImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        DATA = migrate(parsed);
        save(); render(); toast("📥 Datos importados correctamente");
      } catch (err) {
        alert("El archivo no es un JSON válido.\n\n" + err.message);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  function exportJSON() {
    DATA.version = SCHEMA_VERSION;
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = isoToday();
    a.href = url; a.download = `finanzas-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("📤 JSON exportado");
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
