/* Métricas del comparador de cotizaciones — porteado de js/app.js. */
import { num } from "./format.js";

// Total de una opción = precio unitario × cantidad del insumo + envío.
export function opcionTotal(cot, o) {
  const qty = num(cot.cantidad) || 1;
  return num(o.precioUnitario) * qty + num(o.costoEnvio);
}

// Métricas de una cotización: opciones ordenadas, más barata, elegida y ahorro.
export function cotizMetrics(cot) {
  const ops = (cot.opciones || []).map((o) => ({ ...o, _total: opcionTotal(cot, o) }))
    .sort((a, b) => a._total - b._total);
  const totals = ops.map((o) => o._total);
  const min = totals.length ? Math.min(...totals) : 0;
  const max = totals.length ? Math.max(...totals) : 0;
  const baratoId = ops.length ? ops[0].id : null;
  const elegida = ops.find((o) => o.id === cot.elegidaId) || null;
  const elegidaTotal = elegida ? elegida._total : null;
  const ahorro = elegida ? (max - elegidaTotal) : (max - min);
  return { ops, totals, min, max, baratoId, elegida, elegidaTotal, ahorro, count: ops.length };
}
