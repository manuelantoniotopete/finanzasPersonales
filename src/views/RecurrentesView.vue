<script setup>
import { computed } from "vue";
import { useFinanzas } from "../store/finanzas.js";
import { useCrud } from "../composables/useCrud.js";
import EmptyState from "../components/EmptyState.vue";
import RecordActions from "../components/RecordActions.vue";
import { fmtMoney, num, sum } from "../utils/format.js";

const store = useFinanzas();
const { add, edit, remove } = useCrud();

const rs = computed(() =>
  store.data.recurrentes.slice().sort((a, b) => num(a.diaCobro) - num(b.diaCobro)));

const totalAct = computed(() => sum(rs.value.filter((r) => r.activo !== false), "monto"));
</script>

<template>
  <div class="view-head">
    <div>
      <div class="view-title">Gastos recurrentes</div>
      <div class="view-sub">{{ rs.length }} servicio(s) · Total mensual activo {{ fmtMoney(totalAct) }} · {{ fmtMoney(totalAct * 12) }} al año</div>
    </div>
    <button class="btn btn-primary" @click="add('recurrentes')">＋ Agregar recurrente</button>
  </div>

  <div v-if="rs.length" class="table-wrap">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Concepto</th><th>Categoría</th><th>Método</th><th>Cobro</th>
            <th>Estado</th><th class="t-num">Monto/mes</th><th>Notas</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rs" :key="r.id">
            <td><b>{{ r.concepto }}</b></td>
            <td><span class="pill muted">{{ r.categoria || "—" }}</span></td>
            <td><span v-if="r.banco">{{ r.banco }}</span><span v-else class="muted">—</span></td>
            <td><span v-if="r.diaCobro">Día {{ r.diaCobro }}</span><span v-else class="muted">—</span></td>
            <td>
              <span v-if="r.activo !== false" class="pill ok">Activo</span>
              <span v-else class="pill muted">Pausado</span>
            </td>
            <td class="t-num">{{ fmtMoney(r.monto) }}</td>
            <td class="notes-cell">{{ r.notas || "" }}</td>
            <RecordActions @edit="edit('recurrentes', r)" @del="remove('recurrentes', r)" />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <EmptyState v-else mod="recurrentes" title="Sin gastos recurrentes"
    sub="Registra tus suscripciones y servicios fijos mensuales." />
</template>
