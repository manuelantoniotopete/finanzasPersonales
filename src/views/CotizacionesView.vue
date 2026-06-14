<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useFinanzas } from "../store/finanzas.js";
import { useCrud } from "../composables/useCrud.js";
import { openModal } from "../composables/useModal.js";
import KpiCard from "../components/KpiCard.vue";
import EmptyState from "../components/EmptyState.vue";
import { fmtMoney, num } from "../utils/format.js";
import { cotizMetrics } from "../utils/cotiz.js";

const store = useFinanzas();
const router = useRouter();
const { edit, remove } = useCrud();

const estadoCotizPill = { "Comprado": "ok", "Decidido": "pend", "Comparando": "muted" };

const filtroProy = ref("");
const all = computed(() => store.data.cotizaciones);
const cs = computed(() => all.value.filter((c) => !filtroProy.value || c.proyectoId === filtroProy.value));

const kpis = computed(() => {
  let comprometido = 0, ahorroTotal = 0, decididas = 0;
  all.value.forEach((c) => {
    const mt = cotizMetrics(c);
    if (mt.elegida) { comprometido += mt.elegidaTotal; ahorroTotal += mt.ahorro; decididas++; }
  });
  const comparando = all.value.filter((c) => c.estado === "Comparando" || !c.estado).length;
  return { comparando, decididas, comprometido, ahorroTotal };
});

const cards = computed(() => cs.value.map((c) => ({
  c, mt: cotizMetrics(c), proy: store.proyectoNombre(c.proyectoId), cant: num(c.cantidad) || 1,
})));

function abrir(c) { router.push(`/cotizaciones/${c.id}`); }
</script>

<template>
  <div class="view-head">
    <div>
      <div class="view-title">Cotizaciones</div>
      <div class="view-sub">{{ all.length }} cotización(es) · Compara proveedores y elige el que más te convenga</div>
    </div>
    <button class="btn btn-primary" @click="openModal('cotizaciones')">＋ Nueva cotización</button>
  </div>

  <div v-if="all.length" class="kpi-grid">
    <KpiCard label="Comparando" :value="String(kpis.comparando)" foot="Pendientes de decidir" />
    <KpiCard label="Decididas" :value="String(kpis.decididas)" cls="pos" foot="Ya elegiste proveedor" />
    <KpiCard label="Gasto comprometido" :value="fmtMoney(kpis.comprometido)" cls="neg" foot="Suma de las opciones elegidas" />
    <KpiCard label="Ahorro acumulado" :value="fmtMoney(kpis.ahorroTotal)" cls="pos" foot="Vs. la opción más cara" />
  </div>

  <div v-if="store.data.proyectos.length" class="mov-filters">
    <select v-model="filtroProy">
      <option value="">Proyecto: todos</option>
      <option v-for="pr in store.data.proyectos" :key="pr.id" :value="pr.id">{{ pr.nombre }}</option>
    </select>
    <button v-if="filtroProy" class="btn btn-ghost btn-sm" type="button" @click="filtroProy = ''">✕ Limpiar</button>
  </div>

  <div v-if="cs.length" class="goal-grid">
    <div v-for="{ c, mt, proy, cant } in cards" :key="c.id" class="goal">
      <div class="goal-actions">
        <button class="icon-btn" title="Editar" @click="edit('cotizaciones', c)">✏️</button>
        <button class="icon-btn" title="Eliminar" @click="remove('cotizaciones', c)">🗑️</button>
      </div>
      <div class="goal-head"><div class="goal-name">🛒 {{ c.titulo }}</div></div>
      <span class="goal-tag pill" :class="estadoCotizPill[c.estado] || 'muted'">{{ c.estado || "Comparando" }}</span>
      <span class="goal-tag">{{ cant }} {{ c.unidad || "u" }}<template v-if="c.categoria"> · {{ c.categoria }}</template></span>
      <span v-if="proy" class="goal-tag">🏗️ {{ proy }}</span>
      <div class="goal-amounts">
        <template v-if="mt.count">
          <template v-if="mt.elegida">Elegido <b style="color:var(--success)">{{ fmtMoney(mt.elegidaTotal) }}</b> · {{ mt.elegida.proveedor }}</template>
          <template v-else>Mejor precio <b>{{ fmtMoney(mt.min) }}</b><template v-if="mt.count > 1"> de {{ mt.count }} opciones</template></template>
        </template>
        <span v-else class="muted">Sin opciones aún</span>
      </div>
      <div v-if="mt.count > 1" class="goal-pct">
        Ahorro {{ mt.elegida ? "logrado" : "potencial" }}: <b style="color:var(--success)">{{ fmtMoney(mt.ahorro) }}</b> · rango {{ fmtMoney(mt.min) }}–{{ fmtMoney(mt.max) }}
      </div>
      <div class="proy-foot">
        <span class="muted">{{ mt.count }} opción(es)</span>
        <button class="btn btn-primary btn-sm" @click="abrir(c)">Abrir →</button>
      </div>
    </div>
  </div>
  <div v-else-if="all.length" class="empty">
    <div class="empty-ico">🔎</div><h3>Sin cotizaciones en este filtro</h3><p>Cambia el filtro de proyecto o crea una nueva.</p>
  </div>
  <EmptyState v-else mod="cotizaciones" title="Sin cotizaciones aún"
    sub="Crea una cotización por cada insumo que andas cotizando (cemento, varilla…) y agrégale las opciones de cada proveedor para comparar." />
</template>
