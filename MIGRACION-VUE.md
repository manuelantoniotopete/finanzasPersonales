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
- [x] **Etapa 3** — Vistas con detalle: ahorros (+detalle con insights/tips/gráficas), viajes, proyectos (+detalle con fondos, etapas con slider, presupuesto por categoría, proveedores y movimientos con filtros), cotizaciones (+detalle comparador con elegir/registrar gasto). Lógica pura en `utils/ahorro.js`, `utils/proyecto.js`, `utils/cotiz.js`. Detalles vía router (`/x/:id`) sincronizando los `current*` del store. **Feature extra:** botón "Copiar del mes anterior" en Pagos (clona los pagos del mes previo sin duplicar). **Verificado en navegador**: CRUD de sub-colecciones, filtros/búsqueda de movimientos, slider de avance, comparador (elegir + registrar gasto en proyecto), copiar pagos y persistencia; sin errores de consola.
- [x] **Etapa 4** — PWA con `vite-plugin-pwa` (`registerType: autoUpdate`): genera service worker + manifest, app **instalable y offline**. Eliminados los archivos legados del vanilla (`js/app.js`, `css/`, `sw.js`, `manifest.webmanifest`, `icons/`, `data.ejemplo.json` de la raíz). README actualizado al nuevo stack. **Verificado en navegador** sobre el build: manifest válido, service worker activo y carga offline desde caché; sin errores de consola.

---

✅ **Migración completa.** La app corre 100% en Vue 3 + Vite. El `js/app.js` original quedó como referencia en el historial de git (commits previos a la rama).

## Notas

- Las gráficas usan `chart.js` como dependencia npm (antes era CDN), envueltas en `ChartCanvas.vue`.
- El modal y los esquemas ya están portados completos, así que las Etapas 2-3 solo arman cada vista y reutilizan `openModal(mod, record)`.
- Las vulnerabilidades de `npm audit` son de `esbuild`/`vite` (solo dev server), no afectan el `dist/` desplegado.
