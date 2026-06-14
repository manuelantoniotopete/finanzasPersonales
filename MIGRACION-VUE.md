# Migración a Vue 3 + Vite

Rama: `migracion-vue`. Reescritura idiomática (SFC) de la app vanilla a **Vue 3 + Vite + Pinia + Vue Router**, por etapas. El `js/app.js` original se conserva como referencia hasta terminar la migración.

## Cómo correr

```bash
npm install
npm run dev      # servidor de desarrollo (Vite)
npm run build    # genera dist/ (estático, listo para servidor)
npm run preview  # sirve el dist/ generado
```

Despliegue: `npm run build` produce `dist/`. Como usa `base: "./"` y router en modo **hash**, se puede servir desde cualquier carpeta de un servidor estático (Nginx/Apache/Node) sin reglas de rewrite.

## Arquitectura nueva

```
src/
  main.js                 # bootstrap (Pinia + Router + estilos)
  App.vue                 # layout: sidebar + topbar + router-view + modal + toast
  router/index.js         # rutas (1 por vista)
  store/finanzas.js       # Pinia: DATA + autosave localStorage + agregaciones + CRUD
  schemas.js              # esquemas de formularios del modal (factory con el store)
  data/                   # constants.js, model.js (emptyData/migrate), sample.js
  utils/                  # format.js (dinero/fechas), charts.js (Chart.js helpers)
  composables/            # useToast.js, useModal.js
  components/             # AppSidebar, AppTopbar, AppModal, AppToast, KpiCard, ChartCanvas
  views/                  # DashboardView (migrada) + PlaceholderView (pendientes)
```

## Estado por etapas

- [x] **Etapa 1** — Scaffold Vite+Vue, store con persistencia/import/export/demo/tema, layout (sidebar/topbar/modal/toast), Dashboard completo (KPIs + 4 gráficas + próximos viajes). **Verificada en navegador** (Chrome headless): KPIs, las 4 gráficas, Demo, cambio de mes/tema, navegación y persistencia tras recarga, sin errores de consola. Bug corregido: `ChartCanvas` reconstruía la gráfica con flush `pre` (antes de montar el `<canvas>`); las gráficas que arrancan en estado vacío (`null`) no se dibujaban al llegar datos → se cambió a `flush:"post"`.
- [x] **Etapa 2** — Vistas: pagos (toggle pagado + estados), recurrentes, ingresos (banner de sueldo automático) y sueldo (KPIs + doughnut de composición anual + bonos). Piezas reutilizables: `useCrud` (alta/edición/borrado con confirm+toast), `EmptyState` y `RecordActions`. **Verificada en navegador**: CRUD completo (alta/edición/borrado), toggle de pagado reactivo, modal de sueldo y bonos, banner y gráfica condicionales con sueldo configurado, y persistencia tras recarga; sin errores de consola.
- [ ] **Etapa 3** — Vistas: ahorros (+detalle), proyectos (+detalle), cotizaciones (+detalle), viajes.
- [ ] **Etapa 4** — PWA (vite-plugin-pwa) + ajuste final de build para despliegue. Eliminar `js/app.js`, `css/`, `sw.js` legados.

## Notas

- Las gráficas usan `chart.js` como dependencia npm (antes era CDN), envueltas en `ChartCanvas.vue`.
- El modal y los esquemas ya están portados completos, así que las Etapas 2-3 solo arman cada vista y reutilizan `openModal(mod, record)`.
- Las vulnerabilidades de `npm audit` son de `esbuild`/`vite` (solo dev server), no afectan el `dist/` desplegado.
