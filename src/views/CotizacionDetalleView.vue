<script setup>
import { computed, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useFinanzas } from "../store/finanzas.js";
import { useCrud } from "../composables/useCrud.js";
import { openModal } from "../composables/useModal.js";
import { toast } from "../composables/useToast.js";
import KpiCard from "../components/KpiCard.vue";
import ChartCanvas from "../components/ChartCanvas.vue";
import { fmtMoney, fmtNum, num } from "../utils/format.js";
import { themeColors, baseOpts } from "../utils/charts.js";
import { cotizMetrics } from "../utils/cotiz.js";

const store = useFinanzas();
const route = useRoute();
const router = useRouter();
const { edit, remove } = useCrud();

const estadoCotizPill = { "Comprado": "ok", "Decidido": "pend", "Comparando": "muted" };

const c = computed(() => store.data.cotizaciones.find((x) => x.id === route.params.id) || null);
const mt = computed(() => (c.value ? cotizMetrics(c.value) : null));
const cant = computed(() => num(c.value?.cantidad) || 1);
const proy = computed(() => store.proyectoById(c.value?.proyectoId));

watchEffect(() => { store.currentCotizacion = route.params.id; });
watchEffect(() => { if (!c.value) router.replace("/cotizaciones"); });

const yaRegistrado = computed(() =>
  c.value?.movimientoId && proy.value && (proy.value.movimientos || []).some((m) => m.id === c.value.movimientoId));

const esUrl = (v) => /^https?:\/\//i.test(String(v || "").trim());

function elegir(o) { store.elegirOpcion(c.value, o.id); toast("Opción elegida"); }
function unelegir() { store.elegirOpcion(c.value, ""); toast("Elección quitada"); }
function registrar() {
  const r = store.registrarGastoCotizacion(c.value);
  if (r) toast(r.creado ? "Gasto registrado en el proyecto" : "Gasto actualizado en el proyecto");
}

const chCotiz = computed(() => {
  void store.theme;
  if (!mt.value || mt.value.count < 2) return null;
  const col = themeColors();
  const refId = c.value.elegidaId || mt.value.baratoId;
  return {
    type: "bar",
    data: {
      labels: mt.value.ops.map((o) => o.proveedor),
      datasets: [{ label: "Total", data: mt.value.ops.map((o) => o._total), backgroundColor: mt.value.ops.map((o) => o.id === refId ? col.success : col.primary), borderRadius: 6 }],
    },
    options: {
      ...baseOpts(col, true), indexAxis: "y",
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => fmtMoney(x.raw) } } },
      scales: { x: { beginAtZero: true, ticks: { callback: (v) => "$" + fmtNum(v) }, grid: { color: col.grid } }, y: { grid: { display: false } } },
    },
  };
});
</script>

<template>
  <template v-if="c">
    <div class="view-head">
      <div>
        <button class="btn btn-ghost btn-sm" @click="router.push('/cotizaciones')">← Cotizaciones</button>
        <div class="view-title" style="margin-top:8px">🛒 {{ c.titulo }}</div>
        <div class="view-sub">
          <span class="pill" :class="estadoCotizPill[c.estado] || 'muted'">{{ c.estado || "Comparando" }}</span>
          {{ cant }} {{ c.unidad || "u" }}
          <template v-if="c.categoria"> · {{ c.categoria }}</template>
          <template v-if="proy"> · 🏗️ {{ proy.nombre }}</template>
          <span v-else class="muted"> · sin proyecto</span>
        </div>
        <div v-if="c.notas" class="view-sub">{{ c.notas }}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" @click="edit('cotizaciones', c)">✏️ Editar</button>
        <button class="btn btn-primary" @click="openModal('opcion')">＋ Opción</button>
      </div>
    </div>

    <div class="kpi-grid">
      <KpiCard label="Opciones" :value="String(mt.count)" foot="Proveedores cotizados" />
      <KpiCard label="Más barata" :value="mt.count ? fmtMoney(mt.min) : '—'" cls="pos" :foot="mt.count ? mt.ops[0].proveedor : 'Agrega opciones'" />
      <KpiCard label="Elegida" :value="mt.elegida ? fmtMoney(mt.elegidaTotal) : '—'" :cls="mt.elegida ? 'pos' : ''" :foot="mt.elegida ? mt.elegida.proveedor : 'Aún sin elegir'" />
      <KpiCard label="Ahorro" :value="mt.count > 1 ? fmtMoney(mt.ahorro) : '—'" cls="pos" :foot="mt.elegida ? 'Logrado vs. más cara' : 'Potencial (rango)'" />
    </div>

    <!-- Opción elegida -->
    <div v-if="mt.elegida" class="card cotiz-pick" style="margin-bottom:22px">
      <div class="card-title">✅ Opción elegida</div>
      <div class="goal-amounts">
        <b>{{ mt.elegida.proveedor }}</b> · {{ fmtMoney(mt.elegida.precioUnitario) }} × {{ cant }} {{ c.unidad || "u" }}<template v-if="num(mt.elegida.costoEnvio)"> + envío {{ fmtMoney(mt.elegida.costoEnvio) }}</template> = <b style="color:var(--success)">{{ fmtMoney(mt.elegidaTotal) }}</b>
      </div>
      <div class="proy-section-head" style="margin-top:12px">
        <span v-if="!proy" class="muted">Vincula esta cotización a un proyecto (Editar) para registrar el gasto.</span>
        <template v-else-if="yaRegistrado">
          <span class="pill ok">✓ Gasto ya registrado en {{ proy.nombre }}</span>
          <button class="btn btn-ghost btn-sm" @click="router.push(`/proyectos/${proy.id}`)">Ver proyecto →</button>
        </template>
        <button v-else class="btn btn-primary btn-sm" @click="registrar">＋ Registrar como gasto en {{ proy.nombre }}</button>
      </div>
    </div>

    <div v-if="mt.count > 1" class="card" style="margin-bottom:22px">
      <div class="card-title">Comparativo de precios por proveedor</div>
      <div class="chart-box"><ChartCanvas :config="chCotiz" /></div>
    </div>

    <div class="card">
      <div class="card-title proy-section-head">
        <span>Opciones ({{ mt.count }})</span>
        <button class="btn btn-primary btn-sm" @click="openModal('opcion')">＋ Opción</button>
      </div>
      <div v-if="mt.count" class="table-scroll">
        <table>
          <thead><tr><th>Proveedor</th><th class="t-num">P. unit</th><th class="t-num">Envío</th><th class="t-num">Total ({{ cant }} {{ c.unidad || "u" }})</th><th>Disponibilidad</th><th>Contacto</th><th>Liga / notas</th><th></th></tr></thead>
          <tbody>
            <tr v-for="o in mt.ops" :key="o.id" :class="o.id === c.elegidaId ? 'cotiz-chosen' : (o.id === mt.baratoId && mt.count > 1 ? 'cotiz-best' : '')">
              <td>
                <b>{{ o.proveedor }}</b>
                <span v-if="o.id === c.elegidaId" class="pill ok">✅ Elegido</span>
                <span v-else-if="o.id === mt.baratoId && mt.count > 1" class="pill muted">💲 Más barato</span>
              </td>
              <td class="t-num">{{ fmtMoney(o.precioUnitario) }}</td>
              <td class="t-num">{{ num(o.costoEnvio) ? fmtMoney(o.costoEnvio) : "—" }}</td>
              <td class="t-num"><b>{{ fmtMoney(o._total) }}</b></td>
              <td><span v-if="o.disponibilidad">{{ o.disponibilidad }}</span><span v-else class="muted">—</span></td>
              <td><span v-if="o.contacto">{{ o.contacto }}</span><span v-else class="muted">—</span></td>
              <td class="notes-cell">
                <template v-if="o.url"><a v-if="esUrl(o.url)" :href="o.url" target="_blank" rel="noopener">📎 recibo</a><span v-else>📎 {{ o.url }}</span></template>
                <template v-if="o.notas">{{ o.url ? " · " : "" }}{{ o.notas }}</template>
              </td>
              <td class="t-actions">
                <button v-if="o.id === c.elegidaId" class="icon-btn" title="Quitar elección" @click="unelegir">↩️</button>
                <button v-else class="icon-btn" title="Elegir esta opción" @click="elegir(o)">✔️</button>
                <button class="icon-btn" title="Editar" @click="edit('opcion', o)">✏️</button>
                <button class="icon-btn" title="Eliminar" @click="remove('opcion', o)">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="muted">Aún no hay opciones. Agrega lo que te cotizó cada proveedor (precio por unidad y envío) para compararlos.</p>
    </div>
  </template>
</template>
