import { createRouter, createWebHashHistory } from "vue-router";
import DashboardView from "../views/DashboardView.vue";
import PagosView from "../views/PagosView.vue";
import RecurrentesView from "../views/RecurrentesView.vue";
import IngresosView from "../views/IngresosView.vue";
import SueldoView from "../views/SueldoView.vue";
import PlaceholderView from "../views/PlaceholderView.vue";

// Hash history: funciona al desplegar en cualquier server sin reglas de rewrite.
const routes = [
  { path: "/", name: "dashboard", component: DashboardView, meta: { title: "Dashboard" } },
  { path: "/pagos", component: PagosView, meta: { title: "Pagos del mes" } },
  { path: "/recurrentes", component: RecurrentesView, meta: { title: "Gastos recurrentes" } },
  { path: "/ingresos", component: IngresosView, meta: { title: "Ingresos" } },
  { path: "/sueldo", component: SueldoView, meta: { title: "Sueldo" } },
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
