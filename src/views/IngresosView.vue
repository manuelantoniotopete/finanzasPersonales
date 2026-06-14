<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useFinanzas } from "../store/finanzas.js";
import { useCrud } from "../composables/useCrud.js";
import EmptyState from "../components/EmptyState.vue";
import RecordActions from "../components/RecordActions.vue";
import { fmtMoney, fmtDate, monthLabel, sum } from "../utils/format.js";

const store = useFinanzas();
const router = useRouter();
const { add, edit, remove } = useCrud();

const is = computed(() =>
  store.data.ingresos.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")));

const ym = computed(() => store.currentMonth);
const totalMes = computed(() => sum(store.ingresosDelMes(ym.value), "monto"));
const sld = computed(() => store.ingresoSueldoMes(ym.value));
const mostrarBanner = computed(() => store.sueldoVigente(ym.value) && sld.value.total > 0);
</script>

<template>
  <div class="view-head">
    <div>
      <div class="view-title">Ingresos</div>
      <div class="view-sub">{{ is.length }} registro(s) · {{ monthLabel(ym) }}: {{ fmtMoney(totalMes) }}</div>
    </div>
    <button class="btn btn-primary" @click="add('ingresos')">＋ Agregar ingreso</button>
  </div>

  <div v-if="mostrarBanner" class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <span>💼 Tu sueldo (<b>{{ fmtMoney(sld.total) }}</b> este mes) ya se cuenta automáticamente. Esta lista es para ingresos <b>extra/eventuales</b>.</span>
    <button class="btn btn-ghost btn-sm" @click="router.push('/sueldo')">Configurar sueldo →</button>
  </div>

  <div v-if="is.length" class="table-wrap">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Fecha</th><th>Concepto</th><th>Fuente</th><th>Tipo</th>
            <th class="t-num">Monto</th><th>Notas</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in is" :key="i.id">
            <td>{{ fmtDate(i.fecha) }}</td>
            <td><b>{{ i.concepto }}</b></td>
            <td><span v-if="i.fuente">{{ i.fuente }}</span><span v-else class="muted">—</span></td>
            <td><span class="pill muted">{{ i.tipo || "—" }}</span></td>
            <td class="t-num" style="color:var(--success)">{{ fmtMoney(i.monto) }}</td>
            <td class="notes-cell">{{ i.notas || "" }}</td>
            <RecordActions @edit="edit('ingresos', i)" @del="remove('ingresos', i)" />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <EmptyState v-else mod="ingresos" title="Sin ingresos registrados"
    sub="Agrega tus salarios y otros ingresos." />
</template>
