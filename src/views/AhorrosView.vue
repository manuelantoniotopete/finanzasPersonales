<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useFinanzas } from "../store/finanzas.js";
import { useCrud } from "../composables/useCrud.js";
import { openModal } from "../composables/useModal.js";
import EmptyState from "../components/EmptyState.vue";
import { fmtMoney, fmtDate, num, sum } from "../utils/format.js";

const store = useFinanzas();
const router = useRouter();
const { edit, remove } = useCrud();

const as = computed(() => store.data.ahorros);
const cards = computed(() => as.value.map((a) => {
  const obj = num(a.objetivo), ah = num(a.ahorrado);
  const pct = obj > 0 ? Math.min(100, Math.round((ah / obj) * 100)) : 0;
  const done = obj > 0 && ah >= obj;
  return { ...a, obj, ah, pct, done, falta: Math.max(0, obj - ah), nAbonos: (a.abonos || []).length };
}));

// "+ Abono" fija la meta destino (currentAhorro) antes de abrir el modal.
function addAbono(a) { store.currentAhorro = a.id; openModal("abono"); }
function abrir(a) { router.push(`/ahorros/${a.id}`); }
</script>

<template>
  <div class="view-head">
    <div>
      <div class="view-title">Ahorros y proyectos</div>
      <div class="view-sub">{{ as.length }} meta(s) · Ahorrado {{ fmtMoney(sum(as, "ahorrado")) }} de {{ fmtMoney(sum(as, "objetivo")) }}</div>
    </div>
    <button class="btn btn-primary" @click="openModal('ahorros')">＋ Nueva meta</button>
  </div>

  <div v-if="as.length" class="goal-grid">
    <div v-for="a in cards" :key="a.id" class="goal">
      <div class="goal-actions">
        <button class="icon-btn" title="Editar" @click="edit('ahorros', a)">✏️</button>
        <button class="icon-btn" title="Eliminar" @click="remove('ahorros', a)">🗑️</button>
      </div>
      <div class="goal-head"><div class="goal-name">{{ a.nombre }}</div></div>
      <span class="goal-tag">{{ a.tipo || "Meta" }}<template v-if="a.fechaMeta"> · {{ fmtDate(a.fechaMeta) }}</template></span>
      <div class="goal-amounts">
        <b>{{ fmtMoney(a.ah) }}</b> de <b>{{ fmtMoney(a.obj) }}</b><template v-if="a.falta > 0"> · faltan {{ fmtMoney(a.falta) }}</template>
      </div>
      <div class="bar" :class="{ done: a.done }"><span :style="{ width: a.pct + '%' }"></span></div>
      <div class="goal-pct">{{ a.pct }}%<template v-if="a.done"> 🎉 ¡Completado!</template></div>
      <div v-if="a.notas" class="goal-amounts" style="margin-top:10px">{{ a.notas }}</div>
      <div class="goal-foot">
        <button class="btn btn-ghost btn-sm" @click="addAbono(a)">＋ Abono</button>
        <button class="btn btn-primary btn-sm" @click="abrir(a)">Abrir<template v-if="a.nAbonos"> · {{ a.nAbonos }} abono(s)</template> →</button>
      </div>
    </div>
  </div>
  <EmptyState v-else mod="ahorros" title="Sin metas de ahorro"
    sub="Crea metas, proyectos o viajes para darles seguimiento." />
</template>
