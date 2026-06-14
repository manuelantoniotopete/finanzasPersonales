/* Modelo de datos: estructura vacía, migración/normalización y derivados.
   Porteado fielmente de js/app.js. */

import { SCHEMA_VERSION } from "./constants.js";
import { uid, num, sum, isoToday } from "../utils/format.js";

export const emptyData = () => ({
  version: SCHEMA_VERSION,
  moneda: "MXN",
  pagos: [],        // {id, mes, banco, concepto, categoria, monto, fechaLimite, pagado, notas}
  recurrentes: [],  // {id, concepto, categoria, banco, monto, diaCobro, activo, notas}
  ingresos: [],     // {id, fecha, concepto, fuente, tipo, monto, notas}
  // Perfil de sueldo (ingreso fijo virtual, espejo de los recurrentes de gasto).
  sueldo: {
    activo: true, netoMensual: 0, brutoMensual: 0,
    frecuencia: "Quincenal", diasPago: "15, 30", vigenteDesde: "",
    aguinaldoMonto: 0, aguinaldoMes: "Diciembre", notas: "",
  },
  bonos: [],        // {id, nombre, monto, mes}  ← caen en su mes real (cada año)
  ahorros: [],      // {id, nombre, tipo, objetivo, ahorrado, fechaMeta, notas, abonos:[...]}
  viajes: [],       // {id, destino, fecha, dias, presupuesto, gastado, estado, notas}
  proyectos: [],    // {id, nombre, tipo, estado, presupuesto, ..., movimientos, etapas, proveedores, fondos, presupuestoCat}
  cotizaciones: [], // {id, titulo, proyectoId, ..., opciones:[...], elegidaId, movimientoId}
});

// Recalcula el total ahorrado de una meta a partir de sus abonos (abonos − retiros).
export function recalcAhorrado(a) {
  if (!a) return 0;
  const abs = a.abonos || [];
  a.ahorrado = sum(abs.filter((x) => x.tipo !== "Retiro"), "monto") - sum(abs.filter((x) => x.tipo === "Retiro"), "monto");
  return a.ahorrado;
}

// Normaliza/migra un objeto importado para que nunca falten arrays.
export function migrate(obj) {
  const base = emptyData();
  if (!obj || typeof obj !== "object") return base;
  base.moneda = obj.moneda || "MXN";
  for (const k of ["pagos", "recurrentes", "ingresos", "viajes", "bonos"]) {
    base[k] = Array.isArray(obj[k]) ? obj[k].map((r) => ({ id: r.id || uid(), ...r })) : [];
  }
  // ahorros: cada meta lleva su historial de abonos; el total "ahorrado" se calcula de ahí.
  base.ahorros = Array.isArray(obj.ahorros) ? obj.ahorros.map((a) => {
    const rec = { id: a.id || uid(), ...a };
    if (Array.isArray(a.abonos)) {
      rec.abonos = a.abonos.map((x) => ({ id: x.id || uid(), ...x }));
    } else {
      // Migración: lo que ya tenías ahorrado se vuelve un primer abono "Saldo inicial".
      const ini = num(a.ahorrado);
      rec.abonos = ini ? [{ id: uid(), tipo: "Abono", monto: ini, fecha: isoToday(), notas: "Saldo inicial" }] : [];
    }
    recalcAhorrado(rec);
    return rec;
  }) : [];
  // Perfil de sueldo: mezcla con los defaults para no perder llaves nuevas.
  base.sueldo = (obj.sueldo && typeof obj.sueldo === "object")
    ? { ...base.sueldo, ...obj.sueldo } : base.sueldo;
  // proyectos: normaliza también sus sub-colecciones
  base.proyectos = Array.isArray(obj.proyectos) ? obj.proyectos.map((p) => ({
    id: p.id || uid(),
    ...p,
    movimientos: Array.isArray(p.movimientos) ? p.movimientos.map((m) => ({ id: m.id || uid(), ...m })) : [],
    etapas: Array.isArray(p.etapas) ? p.etapas.map((e) => ({ id: e.id || uid(), ...e })) : [],
    proveedores: Array.isArray(p.proveedores) ? p.proveedores.map((v) => ({ id: v.id || uid(), ...v })) : [],
    fondos: Array.isArray(p.fondos) ? p.fondos.map((f) => ({ id: f.id || uid(), ...f })) : [],
    presupuestoCat: (p.presupuestoCat && typeof p.presupuestoCat === "object") ? p.presupuestoCat : {},
  })) : [];
  // cotizaciones: normaliza su sub-colección de opciones
  base.cotizaciones = Array.isArray(obj.cotizaciones) ? obj.cotizaciones.map((c) => ({
    id: c.id || uid(),
    ...c,
    opciones: Array.isArray(c.opciones) ? c.opciones.map((o) => ({ id: o.id || uid(), ...o })) : [],
  })) : [];
  return base;
}
