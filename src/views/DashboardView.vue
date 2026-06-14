<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useFinanzas } from "../store/finanzas.js";
import KpiCard from "../components/KpiCard.vue";
import ChartCanvas from "../components/ChartCanvas.vue";
import { fmtMoney, fmtNum, fmtDate, monthLabel, num, sum } from "../utils/format.js";
import { shiftMonth } from "../utils/format.js";
import { themeColors, baseOpts, donutOpts } from "../utils/charts.js";
import { PALETTE } from "../data/constants.js";

const store = useFinanzas();
const router = useRouter();

const ym = computed(() => store.currentMonth);

// ---------- KPIs ----------
const model = computed(() => {
  const m = ym.value;
  const sld = store.ingresoSueldoMes(m);
  const ingExtra = store.ingresosDelMes(m);
  const ing = sum(ingExtra, "monto") + sld.total;
  const ingFoot = sld.total > 0
    ? `Sueldo ${fmtMoney(sld.neto)}${sld.aguinaldo ? " · 🎁 Aguinaldo " + fmtMoney(sld.aguinaldo) : ""}${sld.bonos ? " · 🎁 Bonos " + fmtMoney(sld.bonos) : ""}${ingExtra.length ? " · +" + ingExtra.length + " extra" : ""}`
    : ingExtra.length + " registro(s)";
  const g = store.gastoMesTotal(m);
  const balance = ing - g.total;
  const pagos = store.pagosDelMes(m);
  const pendientes = pagos.filter((p) => !p.pagado);
  const pendiente = sum(pendientes, "monto");
  const ahorrado = sum(store.data.ahorros, "ahorrado");
  const objetivo = sum(store.data.ahorros, "objetivo");
  return { ing, ingFoot, g, balance, pendiente, pendCount: pendientes.length, ahorrado, objetivo };
});

const prox = computed(() => store.viajesProximos());

const kpiViaje = computed(() => {
  const pv = prox.value[0];
  if (pv) {
    const dd = store.diasHasta(pv.fecha);
    const c = dd === 0 ? "¡Hoy!" : dd === 1 ? "Mañana" : `En ${dd} días`;
    return { label: "Próximo viaje", value: `🧳 ${pv.destino}`, cls: "", foot: `${c} · ${fmtDate(pv.fecha)} · ${fmtMoney(pv.presupuesto)}` };
  }
  return { label: "Próximo viaje", value: "—", cls: "", foot: store.data.viajes.length ? "Sin viajes próximos" : "Sin viajes aún" };
});

const miniTrips = computed(() => prox.value.slice(0, 3).map((v) => {
  const dd = store.diasHasta(v.fecha);
  const cuando = dd === 0 ? "Hoy" : dd === 1 ? "Mañana" : `En ${dd} d`;
  const pres = num(v.presupuesto), gas = num(v.gastado);
  const pct = pres > 0 ? Math.min(100, Math.round((gas / pres) * 100)) : 0;
  const over = pres > 0 && gas > pres;
  return { ...v, cuando, pres, gas, pct, over, soon: dd <= 7 };
}));

// ---------- Gráficas ----------
// Depende de store.theme para recolorear al cambiar de tema.
const chIngGas = computed(() => {
  void store.theme;
  const col = themeColors();
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(ym.value, -i));
  const ingData = months.map((mm) => store.ingresoTotalMes(mm));
  const recFijo = sum(store.data.recurrentes.filter((r) => r.activo !== false), "monto");
  const gasData = months.map((mm) => sum(store.pagosDelMes(mm), "monto") + recFijo);
  return {
    type: "bar",
    data: {
      labels: months.map((mm) => monthLabel(mm).replace(" de ", " ")),
      datasets: [
        { label: "Ingresos", data: ingData, backgroundColor: col.success, borderRadius: 6 },
        { label: "Gastos", data: gasData, backgroundColor: col.danger, borderRadius: 6 },
      ],
    },
    options: baseOpts(col, true),
  };
});

const chCat = computed(() => {
  void store.theme;
  const col = themeColors();
  const cat = {};
  store.pagosDelMes(ym.value).forEach((p) => { const k = p.categoria || "Otros"; cat[k] = (cat[k] || 0) + num(p.monto); });
  store.data.recurrentes.filter((r) => r.activo !== false).forEach((r) => { const k = r.categoria || "Otros"; cat[k] = (cat[k] || 0) + num(r.monto); });
  const keys = Object.keys(cat);
  if (!keys.length) return null;
  return {
    type: "doughnut",
    data: { labels: keys, datasets: [{ data: keys.map((k) => cat[k]), backgroundColor: PALETTE, borderWidth: 0 }] },
    options: donutOpts(col),
  };
});

const chPagos = computed(() => {
  void store.theme;
  const col = themeColors();
  const ps = store.pagosDelMes(ym.value);
  const pagado = sum(ps.filter((p) => p.pagado), "monto");
  const pend = sum(ps.filter((p) => !p.pagado), "monto");
  if (pagado + pend <= 0) return null;
  return {
    type: "doughnut",
    data: { labels: ["Pagado", "Pendiente"], datasets: [{ data: [pagado, pend], backgroundColor: [col.success, col.danger], borderWidth: 0 }] },
    options: donutOpts(col),
  };
});

const chAhorro = computed(() => {
  void store.theme;
  const col = themeColors();
  const ah = store.data.ahorros;
  if (!ah.length) return null;
  return {
    type: "bar",
    data: {
      labels: ah.map((a) => a.nombre),
      datasets: [
        { label: "Ahorrado", data: ah.map((a) => num(a.ahorrado)), backgroundColor: col.primary, borderRadius: 6 },
        { label: "Objetivo", data: ah.map((a) => Math.max(0, num(a.objetivo) - num(a.ahorrado))), backgroundColor: col.grid, borderRadius: 6 },
      ],
    },
    options: {
      ...baseOpts(col, true), indexAxis: "y",
      scales: {
        x: { stacked: true, ticks: { callback: (v) => "$" + fmtNum(v) }, grid: { color: col.grid } },
        y: { stacked: true, grid: { display: false } },
      },
    },
  };
});

function gotoViajes() { router.push("/viajes"); }
</script>

<template>
  <div class="view-head">
    <div>
      <div class="view-title">Dashboard</div>
      <div class="view-sub">Resumen de {{ monthLabel(ym) }}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <KpiCard label="Ingresos del mes" :value="fmtMoney(model.ing)" cls="pos" :foot="model.ingFoot" />
    <KpiCard label="Gastos del mes" :value="fmtMoney(model.g.total)" cls="neg" :foot="`Pagos ${fmtMoney(model.g.pagos)} · Fijos ${fmtMoney(model.g.rec)}`" />
    <KpiCard label="Balance" :value="fmtMoney(model.balance)" :cls="model.balance >= 0 ? 'pos' : 'neg'" :foot="model.balance >= 0 ? 'Te sobra' : 'Vas en rojo'" />
    <KpiCard label="Por pagar" :value="fmtMoney(model.pendiente)" :cls="model.pendiente > 0 ? 'neg' : 'pos'" :foot="`${model.pendCount} pendiente(s)`" />
    <KpiCard label="Total ahorrado" :value="fmtMoney(model.ahorrado)" :foot="model.objetivo ? `de ${fmtMoney(model.objetivo)} meta` : 'Sin metas aún'" />
    <KpiCard v-bind="kpiViaje" />
  </div>

  <div v-if="miniTrips.length" class="card" style="margin-bottom:22px">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>Próximos viajes</span>
      <button class="btn btn-ghost btn-sm" @click="gotoViajes">Ver todos →</button>
    </div>
    <div v-for="v in miniTrips" :key="v.id" class="mini-trip">
      <div class="mini-trip-info">
        <span class="mini-trip-dest">🧳 {{ v.destino }}</span>
        <span class="muted">{{ fmtDate(v.fecha) }}<template v-if="v.dias"> · {{ v.dias }} días</template></span>
      </div>
      <div class="mini-trip-bar">
        <div class="bar" :class="{ done: !v.over }"><span :style="{ width: v.pct + '%', background: v.over ? 'var(--danger)' : '' }"></span></div>
        <span class="muted">{{ fmtMoney(v.gas) }} / {{ fmtMoney(v.pres) }}</span>
      </div>
      <span class="pill" :class="v.soon ? 'pend' : 'muted'">{{ v.cuando }}</span>
    </div>
  </div>

  <div class="chart-grid">
    <div class="card"><div class="card-title">Ingresos vs Gastos (últimos 6 meses)</div><div class="chart-box"><ChartCanvas :config="chIngGas" /></div></div>
    <div class="card"><div class="card-title">Gastos por categoría — {{ monthLabel(ym) }}</div><div class="chart-box"><ChartCanvas :config="chCat" /></div></div>
    <div class="card"><div class="card-title">Estado de pagos del mes</div><div class="chart-box"><ChartCanvas :config="chPagos" /></div></div>
    <div class="card"><div class="card-title">Progreso de ahorros</div><div class="chart-box"><ChartCanvas :config="chAhorro" /></div></div>
  </div>
</template>
