# 💰 Mis Finanzas

Sistema personal de finanzas hecho con **Vue 3 + Vite** (Pinia + Vue Router). **100% local**: los datos
se guardan en tu navegador (`localStorage`) y los puedes **exportar / importar como JSON** para
llevártelos a donde quieras. El build genera un sitio estático (`dist/`) que sirves en cualquier servidor.

## ✨ Características

- **Dashboard** con KPIs (ingresos, gastos, balance, por pagar, ahorrado) y 4 gráficas (Chart.js).
- **Pagos del mes** — banco, concepto, categoría, monto, fecha límite, pagado ✓, notas. Navegación mes a mes.
- **Gastos recurrentes** — suscripciones/servicios fijos, total mensual y anual.
- **Ingresos** — entradas extra/eventuales (freelance, ventas, regalos…).
- **Sueldo / Nómina** — tu **ingreso fijo virtual** (espejo de los gastos recurrentes): defines tu
  **neto mensual** (lo que cuenta), bruto (informativo), frecuencia (quincenal/mensual), **aguinaldo**
  y **bonos** que caen en su mes real (PTU, puntualidad…). Mientras esté **activo**, se suma solo a tus
  ingresos cada mes —sin recapturarlo— y alimenta el balance y las gráficas. Incluye KPI de **ingreso
  anual estimado** y una gráfica de composición.
- **Ahorros y metas** — metas con barra de progreso (boda, fondo de emergencia, viajes…).
- **Proyectos** — seguimiento completo de una obra/proyecto (p. ej. una construcción):
  libro de **movimientos** (entradas/aportaciones y salidas/gastos), **categorías** de gasto
  (mano de obra, material, herramienta, permisos, fletes, maquinaria…), **etapas** con % de avance,
  **presupuesto por categoría**, **directorio de proveedores/trabajadores**, recibo por nota/URL,
  y un tablero con saldo disponible, gastado vs presupuesto, avance de obra vs gasto y gráficas.
- **Viajes** — presupuesto vs gastado por viaje.
- **Tema claro/oscuro** con interruptor (recuerda tu preferencia).
- **PWA instalable** — se instala en celular/desktop como app (ícono propio, ventana sin barra) y
  **funciona offline** gracias a un service worker que cachea el shell. Diseño **responsivo** para móvil.
- **Moneda:** MXN (formato es-MX).

## 📲 Instalar como app (PWA)

Servida por **HTTPS** (GitHub Pages ya lo es), el navegador ofrece instalarla:

- **Android / Chrome:** menú ⋮ → *Instalar app* / *Agregar a pantalla de inicio*.
- **iPhone / Safari:** botón *Compartir* → *Agregar a pantalla de inicio*.
- **Desktop / Chrome–Edge:** ícono de instalar ⊕ en la barra de direcciones.

Una vez instalada abre offline (tus datos ya viven en `localStorage`). El service worker lo genera
**`vite-plugin-pwa`** en cada `npm run build` (estrategia `autoUpdate`: al publicar una versión nueva,
se actualiza solo). Solo funciona sobre **HTTP(S)** o `localhost`, no abriendo el archivo con `file://`.

## 💾 Cómo funciona la persistencia

1. Al abrir, la app inicia **vacía** (o con lo último que guardaste en este navegador).
2. **Autoguardado**: cada cambio se guarda automáticamente en `localStorage`.
3. Botón **⬇️ Exportar** → abre una ventana con tu JSON para **copiarlo** al portapapeles o **descargarlo** como `finanzas-AAAA-MM-DD.json`.
4. Botón **⬆️ Importar** → abre una ventana donde puedes **pegar** el JSON o **cargar un archivo**; al confirmar reemplaza los datos actuales.
5. Botón **✨ Demo** → carga datos de ejemplo para que veas cómo se ve.

> Flujo recomendado: trabajas, al terminar **Exportas** el JSON como respaldo. La próxima vez,
> si cambias de equipo o navegador, **Importas** ese JSON y sigues donde quedaste.

## 🛠️ Desarrollo

```bash
npm install      # instala dependencias
npm run dev      # servidor de desarrollo (Vite) en http://localhost:5173
npm run build    # genera el sitio estático en dist/
npm run preview  # sirve el dist/ ya construido para probarlo
```

## 🚀 Desplegar en un servidor

1. `npm run build` → genera la carpeta **`dist/`** (HTML, JS, CSS, service worker, manifest).
2. Sube el contenido de `dist/` a tu servidor estático (Nginx, Apache, Node, GitHub Pages…).
3. Como usa `base: "./"` y el router en **modo hash**, funciona desde la raíz **o desde cualquier
   subcarpeta** sin reglas de rewrite.

## 📁 Estructura

```
index.html              Punto de entrada de Vite (monta la app en #app)
vite.config.js          Config de Vite + PWA (vite-plugin-pwa)
public/icons/           Iconos de la app (192, 512, maskable, apple-touch)
public/data.ejemplo.json JSON de ejemplo para importar
src/
  main.js               Bootstrap (Pinia + Router + estilos)
  App.vue               Layout: sidebar + topbar + router-view + modal + toast
  router/index.js       Rutas (una por vista; detalles en /x/:id)
  store/finanzas.js     Pinia: estado + autosave localStorage + agregaciones + CRUD
  schemas.js            Esquemas de los formularios del modal
  data/                 constants, model (emptyData/migrate), sample
  utils/                format, charts, ahorro, proyecto, cotiz
  composables/          useToast, useModal, useCrud
  components/           Sidebar, Topbar, Modal, Toast, KpiCard, ChartCanvas, EmptyState…
  views/                Una vista .vue por sección (+ las de detalle)
```

## 🧩 Formato del JSON

```jsonc
{
  "version": 1,
  "moneda": "MXN",
  "pagos":       [{ "mes": "2026-06", "banco": "", "concepto": "", "categoria": "", "monto": 0, "fechaLimite": "2026-06-05", "pagado": false, "notas": "" }],
  "recurrentes": [{ "concepto": "", "categoria": "", "banco": "", "monto": 0, "diaCobro": 1, "activo": true, "notas": "" }],
  "ingresos":    [{ "fecha": "2026-06-15", "concepto": "", "fuente": "", "tipo": "Extra", "monto": 0, "notas": "" }],
  "sueldo":      { "activo": true, "netoMensual": 0, "brutoMensual": 0, "frecuencia": "Quincenal", "diasPago": "15, 30", "vigenteDesde": "2026-01", "aguinaldoMonto": 0, "aguinaldoMes": "Diciembre", "notas": "" },
  "bonos":       [{ "nombre": "PTU", "monto": 0, "mes": "Mayo", "notas": "" }],
  "ahorros":     [{ "nombre": "", "tipo": "Meta", "objetivo": 0, "ahorrado": 0, "fechaMeta": "", "notas": "" }],
  "viajes":      [{ "destino": "", "fecha": "", "dias": 0, "presupuesto": 0, "gastado": 0, "estado": "Planeado", "notas": "" }],
  "proyectos":   [{
    "nombre": "", "tipo": "Construcción", "estado": "En curso", "presupuesto": 0,
    "fechaInicio": "", "fechaMeta": "", "ubicacion": "", "notas": "",
    "movimientos":   [{ "tipo": "Salida", "categoria": "Material", "concepto": "", "monto": 0, "fecha": "", "proveedor": "", "etapa": "", "metodo": "Efectivo", "recibo": "", "notas": "" }],
    "etapas":        [{ "nombre": "Cimentación", "presupuesto": 0, "avance": 0, "notas": "" }],
    "presupuestoCat": { "Material": 0, "Mano de obra": 0 },
    "proveedores":   [{ "nombre": "", "oficio": "", "contacto": "", "notas": "" }]
  }]
}
```

Los `id` se generan solos si faltan, así que puedes editar el JSON a mano sin preocuparte por ellos.
