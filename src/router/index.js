import { createRouter, createWebHashHistory } from "vue-router";
import DashboardView from "../views/DashboardView.vue";
import PagosView from "../views/PagosView.vue";
import RecurrentesView from "../views/RecurrentesView.vue";
import IngresosView from "../views/IngresosView.vue";
import SueldoView from "../views/SueldoView.vue";
import AhorrosView from "../views/AhorrosView.vue";
import AhorroDetalleView from "../views/AhorroDetalleView.vue";
import ProyectosView from "../views/ProyectosView.vue";
import ProyectoDetalleView from "../views/ProyectoDetalleView.vue";
import CotizacionesView from "../views/CotizacionesView.vue";
import CotizacionDetalleView from "../views/CotizacionDetalleView.vue";
import ViajesView from "../views/ViajesView.vue";

// Hash history: funciona al desplegar en cualquier server sin reglas de rewrite.
const routes = [
  { path: "/", name: "dashboard", component: DashboardView, meta: { title: "Dashboard" } },
  { path: "/pagos", component: PagosView, meta: { title: "Pagos del mes" } },
  { path: "/recurrentes", component: RecurrentesView, meta: { title: "Gastos recurrentes" } },
  { path: "/ingresos", component: IngresosView, meta: { title: "Ingresos" } },
  { path: "/sueldo", component: SueldoView, meta: { title: "Sueldo" } },
  { path: "/ahorros", component: AhorrosView, meta: { title: "Ahorros y metas" } },
  { path: "/ahorros/:id", component: AhorroDetalleView, meta: { title: "Ahorros y metas" } },
  { path: "/proyectos", component: ProyectosView, meta: { title: "Proyectos" } },
  { path: "/proyectos/:id", component: ProyectoDetalleView, meta: { title: "Proyectos" } },
  { path: "/cotizaciones", component: CotizacionesView, meta: { title: "Cotizaciones" } },
  { path: "/cotizaciones/:id", component: CotizacionDetalleView, meta: { title: "Cotizaciones" } },
  { path: "/viajes", component: ViajesView, meta: { title: "Viajes" } },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() { return { top: 0 }; },
});
