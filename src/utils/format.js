/* Utilidades de formato y fechas — porteadas de js/app.js (vanilla). */

// La moneda activa se sincroniza desde el store al cargar/importar datos.
let CURRENCY = "MXN";
export function setCurrency(c) { CURRENCY = c || "MXN"; }

export const fmtMoney = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: CURRENCY })
    .format(Number(n) || 0);

export const fmtNum = (n) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(Number(n) || 0);

export function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

export function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const sum = (arr, key) => arr.reduce((a, r) => a + num(r[key]), 0);

export function diasHasta(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - t) / 86400000);
}
