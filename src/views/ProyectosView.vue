<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useFinanzas } from "../store/finanzas.js";
import { useCrud } from "../composables/useCrud.js";
import { openModal } from "../composables/useModal.js";
import EmptyState from "../components/EmptyState.vue";
import { fmtMoney, fmtDate } from "../utils/format.js";
import { proyMetrics } from "../utils/proyecto.js";

const store = useFinanzas();
const router = useRouter();
const { edit, remove } = useCrud();

const estadoProyPill = { "Terminado": "ok", "En curso": "pend", "Reservado": "pend", "Pausado": "muted", "Planeado": "muted" };

const cards = computed(() => store.data.proyectos.map((p) => {
  const mt = proyMetrics(p);
  const over = mt.presupuesto > 0 && mt.gastado > mt.presupuesto;
  const pct = mt.presupuesto > 0 ? Math.min(100, mt.pctPres) : 0;
  return { p, mt, over, pct };
}));
const count = computed(() => store.data.proyectos.length);

function abrir(p) { router.push(`/proyectos/${p.id}`); }
</script>

<template>
  <div class="view-head">
    <div>
      <div class="view-title">Proyectos</div>
      <div class="view-sub">{{ count }} proyecto(s) · Llévale el control de gastos, aportaciones y avance a cada obra</div>
    </div>
    <button class="btn btn-primary" @click="openModal('proyectos')">＋ Nuevo proyecto</button>
  </div>

  <div v-if="count" class="goal-grid">
    <div v-for="{ p, mt, over, pct } in cards" :key="p.id" class="goal">
      <div class="goal-actions">
        <button class="icon-btn" title="Editar" @click="edit('proyectos', p)">✏️</button>
        <button class="icon-btn" title="Eliminar" @click="remove('proyectos', p)">🗑️</button>
      </div>
      <div class="goal-head"><div class="goal-name">🏗️ {{ p.nombre }}</div></div>
      <span class="goal-tag pill" :class="estadoProyPill[p.estado] || 'muted'">{{ p.estado || "—" }}</span>
      <span class="goal-tag">{{ p.tipo || "Proyecto" }}<template v-if="p.fechaMeta"> · meta {{ fmtDate(p.fechaMeta) }}</template></span>
      <div class="goal-amounts">
        Gastado <b>{{ fmtMoney(mt.gastado) }}</b><template v-if="mt.presupuesto"> de <b>{{ fmtMoney(mt.presupuesto) }}</b></template>
        <template v-if="over"> · <span style="color:var(--danger)">sobre presupuesto</span></template>
      </div>
      <div class="bar" :class="{ done: !over }"><span :style="{ width: pct + '%', background: over ? 'var(--danger)' : '' }"></span></div>
      <div class="goal-pct">
        {{ mt.presupuesto ? `${mt.pctPres}% del presupuesto` : "Sin presupuesto" }} · Avance obra {{ mt.tieneEtapas ? mt.avance + "%" : "—" }}
      </div>
      <div class="proy-foot">
        <span class="muted">Saldo: <b :style="{ color: mt.saldo >= 0 ? 'var(--success)' : 'var(--danger)' }">{{ fmtMoney(mt.saldo) }}</b></span>
        <button class="btn btn-primary btn-sm" @click="abrir(p)">Abrir →</button>
      </div>
    </div>
  </div>
  <EmptyState v-else mod="proyectos" title="Sin proyectos aún"
    sub="Crea un proyecto (una construcción, remodelación, negocio…) y registra dentro sus gastos, aportaciones y avance." />
</template>
