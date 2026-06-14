<script setup>
import { computed, reactive, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useFinanzas } from "../store/finanzas.js";
import { useCrud } from "../composables/useCrud.js";
import { openModal } from "../composables/useModal.js";
import KpiCard from "../components/KpiCard.vue";
import ChartCanvas from "../components/ChartCanvas.vue";
import RecordActions from "../components/RecordActions.vue";
import { fmtMoney, fmtDate, monthLabel, num, sum } from "../utils/format.js";
import { MESES, PALETTE } from "../data/constants.js";
import { themeColors, baseOpts, donutOpts } from "../utils/charts.js";
import { proyMetrics, fondoSaldo, gastoEtapa } from "../utils/proyecto.js";

const store = useFinanzas();
const route = useRoute();
const router = useRouter();
const { edit, remove } = useCrud();

const estadoProyPill = { "Terminado": "ok", "En curso": "pend", "Reservado": "pend", "Pausado": "muted", "Planeado": "muted" };

const p = computed(() => store.data.proyectos.find((x) => x.id === route.params.id) || null);
const mt = computed(() => (p.value ? proyMetrics(p.value) : null));

// Sincroniza el proyecto activo (lo usan el modal de sub-registros y el borrado anidado).
watchEffect(() => { store.currentProyecto = route.params.id; });
watchEffect(() => { if (!p.value) router.replace("/proyectos"); });

// Filtro de movimientos (local a la vista).
const filtro = reactive({ q: "", tipo: "", categoria: "", proveedor: "", etapa: "", fondo: "", mes: "" });
function limpiarFiltro() { Object.assign(filtro, { q: "", tipo: "", categoria: "", proveedor: "", etapa: "", fondo: "", mes: "" }); }
const filtroActivo = computed(() => !!(filtro.q || filtro.tipo || filtro.categoria || filtro.proveedor || filtro.etapa || filtro.fondo || filtro.mes));

const hasEtapas = computed(() => (p.value?.etapas || []).length > 0);
const hasFondos = computed(() => (p.value?.fondos || []).length > 0);

const overP = computed(() => mt.value.presupuesto > 0 && mt.value.gastado > mt.value.presupuesto);
const salidasCount = computed(() => (p.value?.movimientos || []).filter((m) => m.tipo === "Salida").length);

// ----- Fondos -----
const fondosRows = computed(() => (p.value?.fondos || []).map((f) => {
  const saldo = fondoSaldo(p.value, f.nombre);
  return { f, ini: num(f.saldoInicial), gastado: sum((p.value.movimientos || []).filter((m) => m.tipo === "Salida" && m.fondo === f.nombre), "monto"), saldo, neg: saldo < 0 };
}));
const totalSaldo = computed(() => (p.value?.fondos || []).reduce((a, f) => a + fondoSaldo(p.value, f.nombre), 0));
const totalIni = computed(() => sum(p.value?.fondos || [], "saldoInicial"));
const sinAsignar = computed(() => ({
  gasto: sum((p.value?.movimientos || []).filter((m) => m.tipo === "Salida" && !m.fondo), "monto"),
  entr: sum((p.value?.movimientos || []).filter((m) => m.tipo === "Entrada" && !m.fondo), "monto"),
}));

// ----- avance vs gasto -----
const avanceMsg = computed(() => {
  const desfase = mt.value.pctPres - mt.value.avance;
  if (desfase > 15) return { tono: "late", msg: `Ojo: llevas ${mt.value.pctPres}% del presupuesto gastado pero solo ${mt.value.avance}% de avance. Vas gastando más rápido que la obra.` };
  if (desfase < -15) return { tono: "ok", msg: `Bien: ${mt.value.avance}% de obra con solo ${mt.value.pctPres}% del presupuesto gastado.` };
  return { tono: "ok", msg: "Vas en línea: el gasto acompaña al avance de obra." };
});

// ----- Etapas -----
const etapasRows = computed(() => (p.value?.etapas || []).map((e) => {
  const av = Math.max(0, Math.min(100, num(e.avance)));
  const real = gastoEtapa(p.value, e.nombre);
  const plan = num(e.presupuesto);
  const over = plan > 0 && real > plan;
  let costo;
  if (plan > 0) costo = `${fmtMoney(real)} de ${fmtMoney(plan)}${over ? ` · +${fmtMoney(real - plan)}` : ""}`;
  else costo = real > 0 ? `${fmtMoney(real)} gastado · sin presupuesto` : "sin presupuesto";
  return { e, av, over, costo };
}));
function setAvance(e, val) { e.avance = num(val); }

// ----- Presupuesto por categoría -----
const presupCatRows = computed(() => {
  const pc = p.value?.presupuestoCat || {};
  const cats = [...new Set([...Object.keys(pc), ...Object.keys(mt.value.porCat)])];
  return cats.map((c) => {
    const plan = num(pc[c]), real = num(mt.value.porCat[c]);
    const pct = plan > 0 ? Math.round((real / plan) * 100) : 0;
    return { c, plan, real, pct, over: plan > 0 && real > plan };
  });
});

// ----- Proveedores -----
const proveedoresRows = computed(() => (p.value?.proveedores || []).map((v) => ({
  v, pagado: sum((p.value.movimientos || []).filter((m) => m.tipo === "Salida" && m.proveedor === v.nombre), "monto"),
})));

// ----- Movimientos (filtro) -----
const uniq = (key) => [...new Set((p.value?.movimientos || []).map((m) => m[key]).filter(Boolean))].sort();
const catOpts = computed(() => uniq("categoria"));
const provOpts = computed(() => uniq("proveedor"));
const etapaOpts = computed(() => uniq("etapa"));
const fondoOpts = computed(() => (p.value?.fondos || []).map((x) => x.nombre).filter(Boolean));
const mesesOpts = computed(() => [...new Set((p.value?.movimientos || []).map((m) => (m.fecha || "").slice(0, 7)).filter(Boolean))].sort().reverse());
const fmtMes = (ym) => { const [y, m] = (ym || "").split("-").map(Number); return (!y || !m) ? (ym || "") : `${MESES[m - 1].slice(0, 3)} ${y}`; };

const movsFiltrados = computed(() => {
  const q = (filtro.q || "").trim().toLowerCase();
  return (p.value?.movimientos || []).slice()
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
    .filter((m) => {
      if (filtro.tipo && m.tipo !== filtro.tipo) return false;
      if (filtro.categoria && m.categoria !== filtro.categoria) return false;
      if (filtro.proveedor && m.proveedor !== filtro.proveedor) return false;
      if (filtro.etapa && m.etapa !== filtro.etapa) return false;
      if (filtro.fondo && m.fondo !== filtro.fondo && m.fondoDestino !== filtro.fondo) return false;
      if (filtro.mes && (m.fecha || "").slice(0, 7) !== filtro.mes) return false;
      if (q) {
        const hay = `${m.concepto || ""} ${m.proveedor || ""} ${m.notas || ""} ${m.recibo || ""} ${m.categoria || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
});
const movTotal = computed(() => (p.value?.movimientos || []).length);
const movCountLabel = computed(() => movsFiltrados.value.length === movTotal.value ? String(movTotal.value) : `${movsFiltrados.value.length} de ${movTotal.value}`);
const movFoot = computed(() => {
  const ms = movsFiltrados.value;
  const entradas = sum(ms.filter((m) => m.tipo === "Entrada"), "monto");
  const salidas = sum(ms.filter((m) => m.tipo === "Salida"), "monto");
  const traspasos = sum(ms.filter((m) => m.tipo === "Traspaso"), "monto");
  return { entradas, salidas, traspasos, neto: entradas - salidas, span: 6 + (hasEtapas.value ? 1 : 0) + (hasFondos.value ? 1 : 0) };
});

function movMeta(m) {
  const entrada = m.tipo === "Entrada", traspaso = m.tipo === "Traspaso";
  return {
    entrada, traspaso,
    signo: traspaso ? "⇄" : entrada ? "+" : "−",
    color: traspaso ? "var(--text-soft)" : entrada ? "var(--success)" : "var(--danger)",
    pillCls: entrada ? "ok" : "muted",
    pillTxt: traspaso ? "🔁 Traspaso" : entrada ? "🟢 Entrada" : "🔴 Salida",
  };
}
const esUrl = (v) => /^https?:\/\//i.test(String(v || "").trim());

// ----- Gráficas -----
const chCat = computed(() => {
  void store.theme;
  if (!mt.value) return null;
  const keys = Object.keys(mt.value.porCat);
  if (!keys.length) return null;
  const col = themeColors();
  return { type: "doughnut", data: { labels: keys, datasets: [{ data: keys.map((k) => mt.value.porCat[k]), backgroundColor: PALETTE, borderWidth: 0 }] }, options: donutOpts(col) };
});
const chMes = computed(() => {
  void store.theme;
  if (!mt.value) return null;
  const meses = Object.keys(mt.value.porMes).sort();
  if (!meses.length) return null;
  const col = themeColors();
  return { type: "bar", data: { labels: meses.map((m) => monthLabel(m).replace(" de ", " ")), datasets: [{ label: "Gasto", data: meses.map((m) => mt.value.porMes[m]), backgroundColor: col.danger, borderRadius: 6 }] }, options: baseOpts(col, true) };
});
</script>

<template>
  <template v-if="p">
    <div class="view-head">
      <div>
        <button class="btn btn-ghost btn-sm" @click="router.push('/proyectos')">← Proyectos</button>
        <div class="view-title" style="margin-top:8px">🏗️ {{ p.nombre }}</div>
        <div class="view-sub">
          <span class="pill" :class="estadoProyPill[p.estado] || 'muted'">{{ p.estado || "—" }}</span>
          {{ p.tipo || "Proyecto" }}
          <template v-if="p.ubicacion"> · 📍 {{ p.ubicacion }}</template>
          <template v-if="p.fechaInicio"> · inicio {{ fmtDate(p.fechaInicio) }}</template>
          <template v-if="p.fechaMeta"> · meta {{ fmtDate(p.fechaMeta) }}</template>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" @click="edit('proyectos', p)">✏️ Editar</button>
        <button class="btn btn-primary" @click="openModal('movimiento')">＋ Movimiento</button>
      </div>
    </div>

    <div class="kpi-grid">
      <KpiCard label="Aportado al proyecto" :value="fmtMoney(mt.aportado)" cls="pos" foot="Dinero que has metido" />
      <KpiCard label="Gastado" :value="fmtMoney(mt.gastado)" cls="neg" :foot="`${salidasCount} salida(s)`" />
      <KpiCard label="Saldo disponible" :value="fmtMoney(mt.saldo)" :cls="mt.saldo >= 0 ? 'pos' : 'neg'" :foot="mt.tieneFondos ? 'Suma de tus fondos' : (mt.saldo >= 0 ? 'Te queda en el bote' : 'Aportado de menos')" />
      <KpiCard label="Gastado vs presupuesto" :value="mt.presupuesto ? mt.pctPres + '%' : '—'" :cls="overP ? 'neg' : ''" :foot="mt.presupuesto ? `${fmtMoney(mt.gastado)} de ${fmtMoney(mt.presupuesto)}` : 'Sin presupuesto definido'" />
      <KpiCard label="Avance de obra" :value="mt.tieneEtapas ? mt.avance + '%' : '—'" :foot="mt.tieneEtapas ? `${p.etapas.length} etapa(s)` : 'Agrega etapas abajo'" />
    </div>

    <!-- Avance vs gasto -->
    <div v-if="mt.tieneEtapas && mt.presupuesto" class="card" style="margin-bottom:22px">
      <div class="card-title">Avance de obra vs gasto</div>
      <div class="dual-bar"><span class="dual-lbl">Obra</span><div class="bar done"><span :style="{ width: Math.min(100, mt.avance) + '%' }"></span></div><b>{{ mt.avance }}%</b></div>
      <div class="dual-bar"><span class="dual-lbl">Gasto</span><div class="bar" :class="{ done: mt.pctPres <= 100 }"><span :style="{ width: Math.min(100, mt.pctPres) + '%', background: mt.pctPres > 100 ? 'var(--danger)' : '' }"></span></div><b>{{ mt.pctPres }}%</b></div>
      <p class="pill" :class="avanceMsg.tono" style="margin-top:12px">{{ avanceMsg.msg }}</p>
    </div>

    <div class="chart-grid">
      <div class="card"><div class="card-title">Gasto por categoría</div><div class="chart-box"><ChartCanvas :config="chCat" /></div></div>
      <div class="card"><div class="card-title">Gasto por mes</div><div class="chart-box"><ChartCanvas :config="chMes" /></div></div>
    </div>

    <!-- Fondos -->
    <div class="card" style="margin-bottom:22px">
      <div class="card-title proy-section-head">
        <span>Fondos / bolsas de dinero <template v-if="fondosRows.length">· disponible {{ fmtMoney(totalSaldo) }}</template></span>
        <button class="btn btn-ghost btn-sm" @click="openModal('fondo')">＋ Fondo</button>
      </div>
      <template v-if="fondosRows.length">
        <div class="table-scroll">
          <table>
            <thead><tr><th>Fondo</th><th class="t-num">Saldo inicial</th><th class="t-num">Gastado</th><th class="t-num">Disponible</th><th>Notas</th><th></th></tr></thead>
            <tbody>
              <tr v-for="r in fondosRows" :key="r.f.id">
                <td><b>{{ r.f.nombre }}</b></td>
                <td class="t-num">{{ fmtMoney(r.ini) }}</td>
                <td class="t-num">{{ fmtMoney(r.gastado) }}</td>
                <td class="t-num" :style="{ color: r.neg ? 'var(--danger)' : 'var(--success)' }"><b>{{ fmtMoney(r.saldo) }}</b><template v-if="r.neg"> ⚠️</template></td>
                <td class="notes-cell">{{ r.f.notas || "" }}</td>
                <RecordActions @edit="edit('fondo', r.f)" @del="remove('fondo', r.f)" />
              </tr>
            </tbody>
            <tfoot><tr class="mov-foot-row">
              <td class="t-num"><b>Total</b></td>
              <td class="t-num">{{ fmtMoney(totalIni) }}</td>
              <td class="t-num">—</td>
              <td class="t-num" :style="{ color: totalSaldo >= 0 ? 'var(--success)' : 'var(--danger)' }"><b>{{ fmtMoney(totalSaldo) }}</b></td>
              <td colspan="2"></td>
            </tr></tfoot>
          </table>
        </div>
        <p v-if="sinAsignar.gasto || sinAsignar.entr" class="pill late" style="margin-top:12px">
          Hay movimientos sin fondo asignado<template v-if="sinAsignar.gasto"> · {{ fmtMoney(sinAsignar.gasto) }} en gastos</template><template v-if="sinAsignar.entr"> · {{ fmtMoney(sinAsignar.entr) }} en entradas</template>. Edítalos y elige un fondo para que cuadren con tus bolsas.
        </p>
      </template>
      <p v-else class="muted">Agrega tus bolsas de dinero (BBVA, Efectivo, Tarjeta…) con el saldo que tienes para este proyecto. Luego, al registrar un gasto eliges de qué fondo salió y verás cuánto te queda en cada uno.</p>
    </div>

    <!-- Etapas -->
    <div class="card" style="margin-bottom:22px">
      <div class="card-title proy-section-head">
        <span>Etapas del proyecto <template v-if="mt.tieneEtapas">· avance global {{ mt.avance }}%</template></span>
        <button class="btn btn-ghost btn-sm" @click="openModal('etapa')">＋ Etapa</button>
      </div>
      <template v-if="etapasRows.length">
        <div v-for="r in etapasRows" :key="r.e.id" class="etapa-row">
          <div class="etapa-info">
            <span class="etapa-name">{{ r.e.nombre }}</span>
            <span class="muted"><span :class="{ 'etapa-over': r.over }">{{ r.costo }}</span><template v-if="r.e.notas"> · {{ r.e.notas }}</template></span>
          </div>
          <input type="range" min="0" max="100" :value="r.av" class="etapa-range" title="Avance %" @input="setAvance(r.e, $event.target.value)" />
          <span class="etapa-pct">{{ r.av }}%</span>
          <span class="etapa-acts">
            <button class="icon-btn" title="Editar" @click="edit('etapa', r.e)">✏️</button>
            <button class="icon-btn" title="Eliminar" @click="remove('etapa', r.e)">🗑️</button>
          </span>
        </div>
      </template>
      <p v-else class="muted">Aún no hay etapas. Agrega etapas (cimentación, muros, losa, acabados…) para medir el avance de la obra.</p>
    </div>

    <!-- Presupuesto por categoría -->
    <div class="card" style="margin-bottom:22px">
      <div class="card-title proy-section-head">
        <span>Presupuesto por categoría</span>
        <button class="btn btn-ghost btn-sm" @click="openModal('presupuestoCat')">✎ Definir presupuestos</button>
      </div>
      <div v-if="presupCatRows.length" class="table-scroll">
        <table>
          <thead><tr><th>Categoría</th><th class="t-num">Presupuesto</th><th class="t-num">Gastado</th><th>Consumo</th><th class="t-num">Restante</th></tr></thead>
          <tbody>
            <tr v-for="r in presupCatRows" :key="r.c">
              <td><b>{{ r.c }}</b></td>
              <td class="t-num">{{ r.plan ? fmtMoney(r.plan) : "—" }}</td>
              <td class="t-num">{{ fmtMoney(r.real) }}</td>
              <td style="min-width:140px"><div class="bar" :class="{ done: !r.over }"><span :style="{ width: Math.min(100, r.pct) + '%', background: r.over ? 'var(--danger)' : '' }"></span></div></td>
              <td class="t-num">
                <template v-if="r.plan"><span v-if="r.over" style="color:var(--danger)">+{{ fmtMoney(r.real - r.plan) }}</span><span v-else>{{ fmtMoney(r.plan - r.real) }}</span></template>
                <template v-else>—</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="muted">Define cuánto planeas gastar por categoría (mano de obra, material…) y compáralo con lo real.</p>
    </div>

    <!-- Proveedores -->
    <div class="card" style="margin-bottom:22px">
      <div class="card-title proy-section-head">
        <span>Proveedores y trabajadores</span>
        <button class="btn btn-ghost btn-sm" @click="openModal('proveedor')">＋ Proveedor</button>
      </div>
      <div v-if="proveedoresRows.length" class="table-scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Oficio / rol</th><th>Contacto</th><th class="t-num">Pagado</th><th>Notas</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in proveedoresRows" :key="r.v.id">
              <td><b>{{ r.v.nombre }}</b></td>
              <td><span v-if="r.v.oficio">{{ r.v.oficio }}</span><span v-else class="muted">—</span></td>
              <td><span v-if="r.v.contacto">{{ r.v.contacto }}</span><span v-else class="muted">—</span></td>
              <td class="t-num">{{ fmtMoney(r.pagado) }}</td>
              <td class="notes-cell">{{ r.v.notas || "" }}</td>
              <RecordActions @edit="edit('proveedor', r.v)" @del="remove('proveedor', r.v)" />
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="muted">Registra a tus proveedores y trabajadores para ver cuánto le has pagado a cada uno.</p>
    </div>

    <!-- Movimientos -->
    <div class="card">
      <div class="card-title proy-section-head">
        <span>Movimientos (<span>{{ movTotal ? movCountLabel : 0 }}</span>)</span>
        <button class="btn btn-primary btn-sm" @click="openModal('movimiento')">＋ Movimiento</button>
      </div>

      <template v-if="movTotal">
        <div class="mov-filters">
          <input type="search" class="mov-search" placeholder="Buscar concepto, proveedor, notas…" v-model="filtro.q" />
          <select v-model="filtro.tipo"><option value="">Tipo: todos</option><option value="Salida">Salidas</option><option value="Entrada">Entradas</option><option value="Traspaso">Traspasos</option></select>
          <select v-model="filtro.categoria"><option value="">Categoría: todas</option><option v-for="c in catOpts" :key="c" :value="c">{{ c }}</option></select>
          <select v-model="filtro.proveedor"><option value="">Proveedor: todos</option><option v-for="v in provOpts" :key="v" :value="v">{{ v }}</option></select>
          <select v-if="hasEtapas" v-model="filtro.etapa"><option value="">Etapa: todas</option><option v-for="e in etapaOpts" :key="e" :value="e">{{ e }}</option></select>
          <select v-if="hasFondos" v-model="filtro.fondo"><option value="">Fondo: todos</option><option v-for="f in fondoOpts" :key="f" :value="f">{{ f }}</option></select>
          <select v-model="filtro.mes"><option value="">Mes: todos</option><option v-for="m in mesesOpts" :key="m" :value="m">{{ fmtMes(m) }}</option></select>
          <button v-if="filtroActivo" class="btn btn-ghost btn-sm" type="button" @click="limpiarFiltro">✕ Limpiar</button>
        </div>

        <div class="table-scroll">
          <table>
            <thead><tr>
              <th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Categoría</th>
              <th v-if="hasEtapas">Etapa</th><th>Proveedor</th><th>Método</th>
              <th v-if="hasFondos">Fondo</th><th class="t-num">Monto</th><th>Recibo / notas</th><th></th>
            </tr></thead>
            <tbody>
              <tr v-if="!movsFiltrados.length"><td :colspan="9 + (hasEtapas ? 1 : 0) + (hasFondos ? 1 : 0)" class="muted mov-empty">Ningún movimiento coincide con el filtro.</td></tr>
              <tr v-for="m in movsFiltrados" :key="m.id">
                <td>{{ fmtDate(m.fecha) }}</td>
                <td><span class="pill" :class="movMeta(m).pillCls">{{ movMeta(m).pillTxt }}</span></td>
                <td><b>{{ m.concepto }}</b></td>
                <td>
                  <span v-if="movMeta(m).entrada || movMeta(m).traspaso" class="muted">—</span>
                  <span v-else class="pill muted">{{ m.categoria || "—" }}</span>
                </td>
                <td v-if="hasEtapas"><span v-if="m.etapa">{{ m.etapa }}</span><span v-else class="muted">—</span></td>
                <td><span v-if="m.proveedor">{{ m.proveedor }}</span><span v-else class="muted">—</span></td>
                <td><span v-if="m.metodo">{{ m.metodo }}</span><span v-else class="muted">—</span></td>
                <td v-if="hasFondos">
                  <span v-if="m.tipo === 'Traspaso'" class="muted">{{ m.fondo || "?" }} → {{ m.fondoDestino || "?" }}</span>
                  <span v-else-if="m.fondo">{{ m.fondo }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="t-num" :style="{ color: movMeta(m).color }">{{ movMeta(m).signo }} {{ fmtMoney(m.monto) }}</td>
                <td class="notes-cell">
                  <template v-if="m.recibo">
                    <a v-if="esUrl(m.recibo)" :href="m.recibo" target="_blank" rel="noopener">📎 recibo</a>
                    <span v-else>📎 {{ m.recibo }}</span>
                  </template>
                  <template v-if="m.notas">{{ m.recibo ? " · " : "" }}{{ m.notas }}</template>
                </td>
                <RecordActions @edit="edit('movimiento', m)" @del="remove('movimiento', m)" />
              </tr>
            </tbody>
            <tfoot v-if="movsFiltrados.length">
              <tr class="mov-foot-row">
                <td :colspan="movFoot.span" class="t-num">
                  Totales filtrados · <span style="color:var(--success)">+{{ fmtMoney(movFoot.entradas) }}</span> entradas ·
                  <span style="color:var(--danger)">−{{ fmtMoney(movFoot.salidas) }}</span> salidas<template v-if="movFoot.traspasos"> · <span class="muted">⇄ {{ fmtMoney(movFoot.traspasos) }} en traspasos</span></template>
                </td>
                <td class="t-num" :style="{ color: movFoot.neto >= 0 ? 'var(--success)' : 'var(--danger)' }">{{ movFoot.neto < 0 ? "−" : "" }}{{ fmtMoney(Math.abs(movFoot.neto)) }}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </template>
      <p v-else class="muted">Sin movimientos. Registra entradas (aportaciones) y salidas (gastos) de este proyecto.</p>
    </div>
  </template>
</template>
