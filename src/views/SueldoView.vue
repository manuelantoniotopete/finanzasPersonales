<script setup>
import { computed } from "vue";
import { useFinanzas } from "../store/finanzas.js";
import { useCrud } from "../composables/useCrud.js";
import KpiCard from "../components/KpiCard.vue";
import ChartCanvas from "../components/ChartCanvas.vue";
import EmptyState from "../components/EmptyState.vue";
import RecordActions from "../components/RecordActions.vue";
import { fmtMoney, monthLabel, num, sum } from "../utils/format.js";
import { mesIdx } from "../data/constants.js";
import { themeColors, donutOpts } from "../utils/charts.js";

const store = useFinanzas();
const { add, edit, remove } = useCrud();

const s = computed(() => store.data.sueldo || {});
const bonos = computed(() =>
  (store.data.bonos || []).slice().sort((a, b) => mesIdx(a.mes) - mesIdx(b.mes)));

const neto = computed(() => num(s.value.netoMensual));
const bruto = computed(() => num(s.value.brutoMensual));
const agui = computed(() => num(s.value.aguinaldoMonto));
const totalBonos = computed(() => sum(bonos.value, "monto"));
const anual = computed(() => neto.value * 12 + agui.value + totalBonos.value);
const sld = computed(() => store.ingresoSueldoMes(store.currentMonth));
const vigente = computed(() => store.sueldoVigente(store.currentMonth));

const kpis = computed(() => {
  const v = s.value;
  return [
    {
      label: "Sueldo neto mensual", value: fmtMoney(neto.value), cls: "pos",
      foot: v.frecuencia ? v.frecuencia + (v.diasPago ? " · días " + v.diasPago : "") : "Sin configurar",
    },
    { label: "Sueldo bruto mensual", value: fmtMoney(bruto.value), cls: "", foot: "Informativo (no se cuenta)" },
    { label: "Aguinaldo", value: fmtMoney(agui.value), cls: "", foot: agui.value ? "Cae en " + v.aguinaldoMes : "Sin aguinaldo" },
    { label: "Ingreso anual estimado", value: fmtMoney(anual.value), cls: "pos", foot: "Neto×12 + aguinaldo + bonos" },
    {
      label: "Cae este mes", value: fmtMoney(sld.value.total), cls: sld.value.total > 0 ? "pos" : "",
      foot: !vigente.value ? "Inactivo este mes" : "Neto" + (sld.value.aguinaldo ? " + aguinaldo" : "") + (sld.value.bonos ? " + bonos" : ""),
    },
    {
      label: "Estado", value: v.activo ? "Activo ✓" : "Inactivo", cls: v.activo ? "pos" : "neg",
      foot: v.activo ? "Se suma a tus ingresos" : "No se está contando",
    },
  ];
});

const subtitulo = computed(() => {
  const v = s.value;
  return `Tu ingreso fijo se cuenta solo cada mes${v.vigenteDesde ? " desde " + monthLabel(v.vigenteDesde) : ""}${v.activo ? "" : " · ⏸️ inactivo"}.`;
});

// Doughnut de composición anual (se muestra solo si hay ingreso anual).
const chSueldo = computed(() => {
  void store.theme;
  if (anual.value <= 0) return null;
  const col = themeColors();
  return {
    type: "doughnut",
    data: {
      labels: ["Sueldo (×12)", "Aguinaldo", "Bonos"],
      datasets: [{ data: [neto.value * 12, agui.value, totalBonos.value], backgroundColor: [col.primary, "#f59e0b", col.success], borderWidth: 0 }],
    },
    options: donutOpts(col),
  };
});
</script>

<template>
  <div class="view-head">
    <div>
      <div class="view-title">Sueldo / Nómina</div>
      <div class="view-sub">{{ subtitulo }}</div>
    </div>
    <button class="btn btn-primary" @click="add('sueldo')">✏️ Configurar sueldo</button>
  </div>

  <div class="kpi-grid">
    <KpiCard v-for="(k, idx) in kpis" :key="idx" v-bind="k" />
  </div>

  <div v-if="anual > 0" class="chart-grid">
    <div class="card">
      <div class="card-title">Composición de tu ingreso anual</div>
      <div class="chart-box"><ChartCanvas :config="chSueldo" /></div>
    </div>
  </div>

  <div class="view-head" style="margin-top:8px">
    <div>
      <div class="view-title" style="font-size:18px">🎁 Bonos y pagos extra</div>
      <div class="view-sub">{{ bonos.length }} registro(s) · Total anual {{ fmtMoney(totalBonos) }} · cada uno cae en el mes que indiques</div>
    </div>
    <button class="btn btn-primary" @click="add('bonos')">＋ Agregar bono</button>
  </div>

  <div v-if="bonos.length" class="table-wrap">
    <div class="table-scroll">
      <table>
        <thead>
          <tr><th>Nombre</th><th>Mes</th><th class="t-num">Monto</th><th>Notas</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="b in bonos" :key="b.id">
            <td><b>{{ b.nombre }}</b></td>
            <td><span class="pill muted">{{ b.mes || "—" }}</span></td>
            <td class="t-num" style="color:var(--success)">{{ fmtMoney(b.monto) }}</td>
            <td class="notes-cell">{{ b.notas || "" }}</td>
            <RecordActions @edit="edit('bonos', b)" @del="remove('bonos', b)" />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <EmptyState v-else mod="bonos" title="Sin bonos registrados"
    sub="Agrega PTU/utilidades, bono de puntualidad, vales, etc. Caen en su mes real." />
</template>
