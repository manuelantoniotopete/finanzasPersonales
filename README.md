# 💰 Mis Finanzas

Sistema personal de finanzas, **100% estático** (HTML + CSS + JavaScript puro, sin frameworks ni build).
Listo para publicar en **GitHub Pages**. Los datos se guardan en tu navegador y los puedes
**exportar / importar como JSON** para llevártelos a donde quieras.

## ✨ Características

- **Dashboard** con KPIs (ingresos, gastos, balance, por pagar, ahorrado) y 4 gráficas (Chart.js).
- **Pagos del mes** — banco, concepto, categoría, monto, fecha límite, pagado ✓, notas. Navegación mes a mes.
- **Gastos recurrentes** — suscripciones/servicios fijos, total mensual y anual.
- **Ingresos** — salarios y entradas extra.
- **Ahorros y proyectos** — metas con barra de progreso (boda, fondo de emergencia, viajes…).
- **Tema claro/oscuro** con interruptor (recuerda tu preferencia).
- **Moneda:** MXN (formato es-MX).

## 💾 Cómo funciona la persistencia

1. Al abrir, la app inicia **vacía** (o con lo último que guardaste en este navegador).
2. **Autoguardado**: cada cambio se guarda automáticamente en `localStorage`.
3. Botón **⬇️ Exportar** → descarga un archivo `finanzas-AAAA-MM-DD.json` con todos tus datos.
4. Botón **⬆️ Importar** → carga un JSON y reemplaza los datos actuales.
5. Botón **✨ Demo** → carga datos de ejemplo para que veas cómo se ve.

> Flujo recomendado: trabajas, al terminar **Exportas** el JSON como respaldo. La próxima vez,
> si cambias de equipo o navegador, **Importas** ese JSON y sigues donde quedaste.

## 🚀 Publicar en GitHub Pages

1. Crea un repositorio y sube estos archivos (`index.html`, `css/`, `js/`, etc.).
2. En GitHub: **Settings → Pages → Source: `main` / root**.
3. Tu sitio queda en `https://TU-USUARIO.github.io/TU-REPO/`.

No requiere servidor ni compilación. La única dependencia (Chart.js) se carga por CDN.

## 📁 Estructura

```
index.html            Estructura y layout
css/styles.css        Estilos + temas claro/oscuro
js/app.js             Toda la lógica (estado, render, charts, import/export)
data.ejemplo.json     JSON de ejemplo para importar
```

## 🧩 Formato del JSON

```jsonc
{
  "version": 1,
  "moneda": "MXN",
  "pagos":       [{ "mes": "2026-06", "banco": "", "concepto": "", "categoria": "", "monto": 0, "fechaLimite": "2026-06-05", "pagado": false, "notas": "" }],
  "recurrentes": [{ "concepto": "", "categoria": "", "banco": "", "monto": 0, "diaCobro": 1, "activo": true, "notas": "" }],
  "ingresos":    [{ "fecha": "2026-06-15", "concepto": "", "fuente": "", "tipo": "Salario", "monto": 0, "notas": "" }],
  "ahorros":     [{ "nombre": "", "tipo": "Meta", "objetivo": 0, "ahorrado": 0, "fechaMeta": "", "notas": "" }]
}
```

Los `id` se generan solos si faltan, así que puedes editar el JSON a mano sin preocuparte por ellos.
