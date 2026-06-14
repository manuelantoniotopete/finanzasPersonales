<script setup>
import { computed } from "vue";
import { useFinanzas } from "../store/finanzas.js";
import { useCrud } from "../composables/useCrud.js";
import EmptyState from "../components/EmptyState.vue";
import ChartCanvas from "../components/ChartCanvas.vue";
import { fmtMoney, fmtDate, num, sum } from "../utils/format.js";
import { themeColors, baseOpts } from "../utils/charts.js";

const store = useFinanzas();
const { add, edit, remove } = useCrud();

const estadoPill = { "Realizado": "ok", "En curso": "pend", "Reservado": "pend", "Planeado": "muted" };

const vs = computed(() =>
  store.data.viajes.slice().sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999")));
const totalPres = computed(() => sum(vs.value, "presupuesto"));
const totalGas = computed(() => sum(vs.value, "gastado"));

const cards = computed(() => vs.value.map((v) => {
  const pres = num(v.presupuesto), gas = num(v.gastado);
  const pct = pres > 0 ? Math.min(100, Math.round((gas / pres) * 100)) : 0;
  const over = pres > 0 && gas > pres;
  return { ...v, pres, gas, pct, over, restante: pres - gas };
}));

const chViajes = computed(() => {
  void store.theme;
  if (!vs.value.length) return null;
  const col = themeColors();
  return {
    type: "bar",
    data: {
      labels: vs.value.map((v) => v.destino),
      datasets: [
        { label: "Presupuesto", data: vs.value.map((v) => num(v.presupuesto)), backgroundColor: col.primary, borderRadius: 6 },
        { label: "Gastado", data: vs.value.map((v) => num(v.gastado)), backgroundColor: col.success, borderRadius: 6 },
      ],
    },
    options: baseOpts(col, true),
  };
});
</script>

<template>
  <div class="view-head">
    <div>
      <div class="view-title">Viajes</div>
      <div class="view-sub">{{ vs.length }} viaje(s) · Presupuesto total {{ fmtMoney(totalPres) }} · Gastado {{ fmtMoney(totalGas) }}</div>
    </div>
    <button class="btn btn-primary" @click="add('viajes')">＋ Nuevo viaje</button>
  </div>

  <template v-if="vs.length">
    <div class="card" style="margin-bottom:22px">
      <div class="card-title">Presupuesto vs gastado por viaje</div>
      <div class="chart-box"><ChartCanvas :config="chViajes" /></div>
    </div>
    <div class="goal-grid">
      <div v-for="v in cards" :key="v.id" class="goal">
        <div class="goal-actions">
          <button class="icon-btn" title="Editar" @click="edit('viajes', v)">✏️</button>
          <button class="icon-btn" title="Eliminar" @click="remove('viajes', v)">🗑️</button>
        </div>
        <div class="goal-head"><div class="goal-name">🧳 {{ v.destino }}</div></div>
        <span class="goal-tag pill" :class="estadoPill[v.estado] || 'muted'">{{ v.estado || "Planeado" }}</span>
        <span v-if="v.fecha" class="goal-tag">{{ fmtDate(v.fecha) }}<template v-if="v.dias"> · {{ v.dias }} días</template></span>
        <div class="goal-amounts">
          Gastado <b>{{ fmtMoney(v.gas) }}</b> de <b>{{ fmtMoney(v.pres) }}</b> ·
          <span v-if="v.over" style="color:var(--danger)">{{ fmtMoney(-v.restante) }} sobre presupuesto</span>
          <span v-else>restan {{ fmtMoney(v.restante) }}</span>
        </div>
        <div class="bar" :class="{ done: !v.over }" :style="v.over ? 'background:var(--danger-bg)' : ''">
          <span :style="{ width: v.pct + '%', background: v.over ? 'var(--danger)' : '' }"></span>
        </div>
        <div class="goal-pct">{{ v.pct }}% del presupuesto</div>
        <div v-if="v.notas" class="goal-amounts" style="margin-top:10px">{{ v.notas }}</div>
      </div>
    </div>
  </template>
  <EmptyState v-else mod="viajes" title="Sin viajes planeados"
    sub="Agrega tus viajes con presupuesto y dales seguimiento al gasto." />
</template>
