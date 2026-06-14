<script setup>
import { computed } from "vue";
import { useFinanzas } from "../store/finanzas.js";
import { useCrud } from "../composables/useCrud.js";
import EmptyState from "../components/EmptyState.vue";
import RecordActions from "../components/RecordActions.vue";
import { fmtMoney, fmtDate, monthLabel, isoToday, shiftMonth, sum } from "../utils/format.js";
import { toast } from "../composables/useToast.js";

const store = useFinanzas();
const { add, edit, remove } = useCrud();

const ps = computed(() =>
  store.pagosDelMes(store.currentMonth)
    .slice()
    .sort((a, b) => (a.fechaLimite || "").localeCompare(b.fechaLimite || "")));

const total = computed(() => sum(ps.value, "monto"));
const pagado = computed(() => sum(ps.value.filter((p) => p.pagado), "monto"));

// Feature extra: ¿hay pagos en el mes anterior para copiar?
const prevCount = computed(() =>
  store.pagosDelMes(shiftMonth(store.currentMonth, -1)).length);

function copiarMesAnterior() {
  const r = store.copiarPagosMesAnterior();
  if (r.copiados === 0) {
    toast(r.disponibles ? "Esos pagos ya están en el mes actual" : "No hay pagos en el mes anterior");
  } else {
    toast(`📋 ${r.copiados} pago(s) copiados del mes anterior`);
  }
}

// Estado del pago: pagado / vencido / pendiente.
function estado(p) {
  if (p.pagado) return { cls: "ok", text: "✓ Pagado" };
  if (p.fechaLimite && p.fechaLimite < isoToday()) return { cls: "late", text: "⚠ Vencido" };
  return { cls: "pend", text: "● Pendiente" };
}
</script>

<template>
  <div class="view-head">
    <div>
      <div class="view-title">Pagos del mes</div>
      <div class="view-sub">{{ monthLabel(store.currentMonth) }} · {{ ps.length }} pago(s) · Pagado {{ fmtMoney(pagado) }} de {{ fmtMoney(total) }}</div>
    </div>
    <div style="display:flex;gap:8px">
      <button v-if="prevCount" class="btn btn-ghost" title="Clona los pagos del mes anterior a este mes (sin duplicar)" @click="copiarMesAnterior">📋 Copiar del mes anterior</button>
      <button class="btn btn-primary" @click="add('pagos')">＋ Agregar pago</button>
    </div>
  </div>

  <div v-if="ps.length" class="table-wrap">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th></th><th>Concepto</th><th>Banco</th><th>Categoría</th>
            <th>Fecha límite</th><th>Estado</th><th class="t-num">Monto</th><th>Notas</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in ps" :key="p.id">
            <td><input type="checkbox" class="chk" :checked="p.pagado" @change="p.pagado = $event.target.checked" /></td>
            <td><b>{{ p.concepto }}</b></td>
            <td><span v-if="p.banco">{{ p.banco }}</span><span v-else class="muted">—</span></td>
            <td><span class="pill muted">{{ p.categoria || "—" }}</span></td>
            <td>{{ fmtDate(p.fechaLimite) }}</td>
            <td><span class="pill" :class="estado(p).cls">{{ estado(p).text }}</span></td>
            <td class="t-num">{{ fmtMoney(p.monto) }}</td>
            <td class="notes-cell">{{ p.notas || "" }}</td>
            <RecordActions @edit="edit('pagos', p)" @del="remove('pagos', p)" />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <EmptyState v-else mod="pagos" title="Sin pagos en este mes"
    sub="Agrega tus pagos o cámbiate de mes en la barra superior." />
</template>
