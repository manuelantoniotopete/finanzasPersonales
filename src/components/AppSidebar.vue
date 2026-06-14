<script setup>
import { storeToRefs } from "pinia";
import { useFinanzas } from "../store/finanzas.js";

defineProps({ open: { type: Boolean, default: false } });
const emit = defineEmits(["navigate"]);

const store = useFinanzas();
const { saveState } = storeToRefs(store);

const items = [
  { to: "/", ico: "📊", label: "Dashboard" },
  { to: "/pagos", ico: "🧾", label: "Pagos del mes" },
  { to: "/recurrentes", ico: "🔁", label: "Gastos recurrentes" },
  { to: "/ingresos", ico: "💵", label: "Ingresos" },
  { to: "/sueldo", ico: "💼", label: "Sueldo" },
  { to: "/ahorros", ico: "🎯", label: "Ahorros y metas" },
  { to: "/proyectos", ico: "🏗️", label: "Proyectos" },
  { to: "/cotizaciones", ico: "🛒", label: "Cotizaciones" },
  { to: "/viajes", ico: "🧳", label: "Viajes" },
];
</script>

<template>
  <aside class="sidebar" :class="{ open }">
    <div class="brand">
      <span class="brand-logo">💰</span>
      <span class="brand-name">Mis Finanzas</span>
    </div>

    <nav class="nav">
      <RouterLink
        v-for="it in items"
        :key="it.to"
        :to="it.to"
        class="nav-item"
        :active-class="it.to === '/' ? '' : 'is-active'"
        exact-active-class="is-active"
        @click="emit('navigate')"
      >
        <span class="nav-ico">{{ it.ico }}</span> {{ it.label }}
      </RouterLink>
    </nav>

    <div class="sidebar-foot">
      <div class="save-state" :class="saveState.cls" title="Estado de guardado local">
        <span class="dot"></span><span>{{ saveState.text }}</span>
      </div>
    </div>
  </aside>
</template>
