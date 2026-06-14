import { createRouter, createWebHashHistory } from "vue-router";
import DashboardView from "../views/DashboardView.vue";
import PlaceholderView from "../views/PlaceholderView.vue";

// Hash history: funciona al desplegar en cualquier server sin reglas de rewrite.
const routes = [
  { path: "/", name: "dashboard", component: DashboardView, meta: { title: "Dashboard" } },
  { path: "/pagos", component: PlaceholderView, meta: { title: "Pagos del mes", etapa: "Etapa 2" } },
  { path: "/recurrentes", component: PlaceholderView, meta: { title: "Gastos recurrentes", etapa: "Etapa 2" } },
  { path: "/ingresos", component: PlaceholderView, meta: { title: "Ingresos", etapa: "Etapa 2" } },
  { path: "/sueldo", component: PlaceholderView, meta: { title: "Sueldo", etapa: "Etapa 2" } },
  { path: "/ahorros", component: PlaceholderView, meta: { title: "Ahorros y metas", etapa: "Etapa 3" } },
  { path: "/proyectos", component: PlaceholderView, meta: { title: "Proyectos", etapa: "Etapa 3" } },
  { path: "/cotizaciones", component: PlaceholderView, meta: { title: "Cotizaciones", etapa: "Etapa 3" } },
  { path: "/viajes", component: PlaceholderView, meta: { title: "Viajes", etapa: "Etapa 3" } },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() { return { top: 0 }; },
});
