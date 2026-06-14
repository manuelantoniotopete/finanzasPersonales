<script setup>
import { computed, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useFinanzas } from "../store/finanzas.js";
import { useCrud } from "../composables/useCrud.js";
import { openModal } from "../composables/useModal.js";
import KpiCard from "../components/KpiCard.vue";
import ChartCanvas from "../components/ChartCanvas.vue";
import { fmtMoney, fmtDate, monthLabel, num } from "../utils/format.js";
import { themeColors, baseOpts } from "../utils/charts.js";
import { ahorroInsights, ahorroTips } from "../utils/ahorro.js";

const store = useFinanzas();
const route = useRoute();
const router = useRouter();
const { edit, remove } = useCrud();

const a = computed(() => store.data.ahorros.find((x) => x.id === route.params.id) || null);

// Sincroniza la meta activa (la usan el modal de abono y el borrado anidado).
watchEffect(() => { store.currentAhorro = route.params.id; store.openAhorro = route.params.id; });
// Si la meta no existe (p.ej. recién borrada), vuelve a la lista.
watchEffect(() => { if (!a.value) router.replace("/ahorros"); });

const ins = computed(() => (a.value ? ahorroInsights(a.value) : null));
const tips = computed(() => (a.value ? ahorroTips(ins.value, a.value) : []));
const hitos = [25, 50, 75, 100];

const abonosOrden = computed(() =>
  (a.value?.abonos || []).slice().sort((x, y) => (y.fecha || "").localeCompare(x.fecha || "")));

function addAbono() { store.currentAhorro = a.value.id; openModal("abono"); }
function editAbono(ab) { store.currentAhorro = a.value.id; edit("abono", ab); }
function delAbono(ab) { store.currentAhorro = a.value.id; remove("abono", ab); }

// Gráfica 1: ahorro acumulado en el tiempo (línea) + objetivo de referencia.
const chAcum = computed(() => {
  void store.theme;
  if (!a.value) return null;
  const abonos = (a.value.abonos || []).slice().sort((x, y) => (x.fecha || "").localeCompare(y.fecha || ""));
  if (!abonos.length) return null;
  const col = themeColors();
  let acc = 0;
  const labels = [], data = [];
  abonos.forEach((x) => { acc += (x.tipo === "Retiro" ? -1 : 1) * num(x.monto); labels.push(fmtDate(x.fecha)); data.push(acc); });
  const obj = num(a.value.objetivo);
  const datasets = [{ label: "Ahorrado", data, borderColor: col.primary, backgroundColor: "transparent", tension: 0.25, pointRadius: 3, fill: false }];
  if (obj > 0) datasets.push({ label: "Objetivo", data: labels.map(() => obj), borderColor: col.success, borderDash: [6, 6], pointRadius: 0, fill: false });
  return { type: "line", data: { labels, datasets }, options: baseOpts(col, true) };
});

// Gráfica 2: abonos netos por mes (barras).
const chMes = computed(() => {
  void store.theme;
  if (!a.value) return null;
  const abonos = a.value.abonos || [];
  const porMes = {};
  abonos.forEach((x) => { const k = (x.fecha || "").slice(0, 7); if (k) porMes[k] = (porMes[k] || 0) + (x.tipo === "Retiro" ? -1 : 1) * num(x.monto); });
  const meses = Object.keys(porMes).sort();
  if (!meses.length) return null;
  const col = themeColors();
  return {
    type: "bar",
    data: {
      labels: meses.map((m) => monthLabel(m).replace(" de ", " ")),
      datasets: [{ label: "Abonado", data: meses.map((m) => porMes[m]), backgroundColor: meses.map((m) => porMes[m] >= 0 ? col.success : col.danger), borderRadius: 6 }],
    },
    options: baseOpts(col, true),
  };
});
</script>

<template>
  <template v-if="a">
    <div class="view-head">
      <div>
        <button class="btn btn-ghost btn-sm" @click="router.push('/ahorros')">← Ahorros</button>
        <div class="view-title" style="margin-top:8px">{{ a.nombre }}</div>
        <div class="view-sub">
          <span class="goal-tag">{{ a.tipo || "Meta" }}</span>
          <template v-if="a.fechaMeta"> · 🎯 meta {{ fmtDate(a.fechaMeta) }}</template>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" @click="edit('ahorros', a)">✏️ Editar</button>
        <button class="btn btn-primary" @click="addAbono">＋ Abono</button>
      </div>
    </div>

    <div class="kpi-grid">
      <KpiCard label="Ahorrado" :value="fmtMoney(ins.ah)" cls="pos" :foot="`${ins.pct}% del objetivo`" />
      <KpiCard label="Objetivo" :value="fmtMoney(ins.obj)" :foot="a.fechaMeta ? 'meta ' + fmtDate(a.fechaMeta) : 'Sin fecha meta'" />
      <KpiCard label="Te falta" :value="fmtMoney(ins.falta)" :cls="ins.falta > 0 ? 'neg' : 'pos'" :foot="ins.completed ? '¡Completado! 🎉' : 'para tu objetivo'" />
      <KpiCard label="Ritmo histórico" :value="ins.ritmoMensual > 0 ? fmtMoney(ins.ritmoMensual) + '/mes' : '—'" :foot="ins.ritmoMensual > 0 ? 'promedio mensual' : 'Falta historial'" />
      <KpiCard label="Pronóstico" :value="ins.completed ? '🎉' : (ins.pronostico ? monthLabel(ins.pronostico) : '—')" :cls="ins.completed ? 'pos' : ''" :foot="ins.completed ? 'Meta lograda' : (ins.pronostico ? 'fecha estimada' : 'Sin estimación aún')" />
    </div>

    <div class="card" style="margin-bottom:22px">
      <div class="card-title">Avance hacia tu objetivo</div>
      <div class="bar" :class="{ done: ins.completed }" style="height:14px"><span :style="{ width: ins.pct + '%' }"></span></div>
      <div class="hito-row">
        <span v-for="h in hitos" :key="h" class="hito" :class="{ 'hito-on': ins.pct >= h }">{{ h }}%</span>
      </div>
    </div>

    <div class="card" style="margin-bottom:22px">
      <div class="card-title">💡 Tips e insights</div>
      <div class="tips">
        <div v-for="(t, i) in tips" :key="i" class="tip-row">
          <span class="pill" :class="t.tono">{{ t.ico }}</span><span v-html="t.html"></span>
        </div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="card"><div class="card-title">Ahorro acumulado</div><div class="chart-box"><ChartCanvas :config="chAcum" /></div></div>
      <div class="card"><div class="card-title">Abonos por mes</div><div class="chart-box"><ChartCanvas :config="chMes" /></div></div>
    </div>

    <div class="card">
      <div class="card-title proy-section-head">
        <span>Abonos ({{ ins.numAbonos }})</span>
        <button class="btn btn-primary btn-sm" @click="addAbono">＋ Abono</button>
      </div>
      <div class="abonos-box">
        <p v-if="!abonosOrden.length" class="muted" style="margin:0">Sin abonos aún. Usa "＋ Abono".</p>
        <div v-for="x in abonosOrden" :key="x.id" class="abono-row">
          <span class="abono-date">{{ fmtDate(x.fecha) }}</span>
          <span class="abono-amt" :style="{ color: x.tipo === 'Retiro' ? 'var(--danger)' : 'var(--success)' }">
            {{ x.tipo === "Retiro" ? "−" : "+" }} {{ fmtMoney(x.monto) }}
          </span>
          <span class="abono-note">{{ x.notas || (x.tipo === "Retiro" ? "Retiro" : "Abono") }}</span>
          <span class="abono-acts">
            <button class="icon-btn" title="Editar" @click="editAbono(x)">✏️</button>
            <button class="icon-btn" title="Eliminar" @click="delAbono(x)">🗑️</button>
          </span>
        </div>
      </div>
    </div>
  </template>
</template>
