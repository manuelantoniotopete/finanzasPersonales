/* Métricas de proyectos — porteado de js/app.js. */
import { num, sum } from "./format.js";

// Métricas agregadas de un proyecto.
export function proyMetrics(p) {
  const movs = p.movimientos || [];
  const salidas = movs.filter((m) => m.tipo === "Salida");
  const aportado = sum(movs.filter((m) => m.tipo === "Entrada"), "monto");
  const gastado = sum(salidas, "monto");
  const inicial = sum(p.fondos || [], "saldoInicial");
  const saldo = inicial + aportado - gastado;
  const presupuesto = num(p.presupuesto);
  const pctPres = presupuesto > 0 ? Math.round((gastado / presupuesto) * 100) : 0;

  const porCat = {};
  salidas.forEach((m) => { const k = m.categoria || "Otros"; porCat[k] = (porCat[k] || 0) + num(m.monto); });

  const porMes = {};
  salidas.forEach((m) => { const k = (m.fecha || "").slice(0, 7); if (k) porMes[k] = (porMes[k] || 0) + num(m.monto); });

  const etapas = p.etapas || [];
  let avance = 0;
  if (etapas.length) {
    const peso = sum(etapas, "presupuesto");
    avance = peso > 0
      ? Math.round(etapas.reduce((a, e) => a + num(e.avance) * num(e.presupuesto), 0) / peso)
      : Math.round(etapas.reduce((a, e) => a + num(e.avance), 0) / etapas.length);
  }
  return { aportado, gastado, saldo, inicial, presupuesto, pctPres, porCat, porMes, avance, tieneEtapas: etapas.length > 0, tieneFondos: (p.fondos || []).length > 0 };
}

// Saldo actual de un fondo: arranque + entradas/traspasos recibidos − gastos/traspasos salientes.
export function fondoSaldo(p, nombre) {
  let s = num((p.fondos || []).find((f) => f.nombre === nombre)?.saldoInicial);
  (p.movimientos || []).forEach((m) => {
    const amt = num(m.monto);
    if (m.tipo === "Traspaso") {
      if (m.fondo === nombre) s -= amt;
      if (m.fondoDestino === nombre) s += amt;
    } else if (m.tipo === "Entrada") {
      if (m.fondo === nombre) s += amt;
    } else if (m.fondo === nombre) {
      s -= amt;
    }
  });
  return s;
}

// Gasto real registrado en una etapa.
export function gastoEtapa(p, nombre) {
  return sum((p.movimientos || []).filter((m) => m.tipo === "Salida" && m.etapa === nombre), "monto");
}
