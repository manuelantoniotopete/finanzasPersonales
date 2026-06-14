/* Datos de ejemplo (Demo) — porteado de js/app.js */
import { uid, todayMonth, shiftMonth } from "../utils/format.js";

export function SAMPLE() {
  const m = todayMonth();
  const prev = shiftMonth(m, -1);
  const [y, mm] = m.split("-");
  const d = (day) => `${y}-${mm}-${String(day).padStart(2, "0")}`;
  return {
    version: 1, moneda: "MXN",
    pagos: [
      { id: uid(), mes: m, banco: "BBVA", concepto: "Renta departamento", categoria: "Vivienda", monto: 9500, fechaLimite: d(5), pagado: true, notas: "" },
      { id: uid(), mes: m, banco: "Santander", concepto: "Tarjeta de crédito", categoria: "Tarjeta de crédito", monto: 3200, fechaLimite: d(18), pagado: false, notas: "Pago mínimo 1,100" },
      { id: uid(), mes: m, banco: "CFE", concepto: "Luz", categoria: "Servicios", monto: 680, fechaLimite: d(22), pagado: false, notas: "" },
      { id: uid(), mes: m, banco: "Banorte", concepto: "Crédito automotriz", categoria: "Préstamo", monto: 4100, fechaLimite: d(10), pagado: false, notas: "" },
      { id: uid(), mes: prev, banco: "BBVA", concepto: "Renta departamento", categoria: "Vivienda", monto: 9500, fechaLimite: shiftMonth(m, -1) + "-05", pagado: true, notas: "" },
    ],
    recurrentes: [
      { id: uid(), concepto: "Netflix", categoria: "Suscripciones", banco: "Santander", monto: 219, diaCobro: 12, activo: true, notas: "Plan estándar" },
      { id: uid(), concepto: "Spotify", categoria: "Suscripciones", banco: "Santander", monto: 129, diaCobro: 3, activo: true, notas: "" },
      { id: uid(), concepto: "Internet Totalplay", categoria: "Servicios", banco: "BBVA", monto: 599, diaCobro: 15, activo: true, notas: "" },
      { id: uid(), concepto: "Gimnasio", categoria: "Salud", banco: "Efectivo", monto: 450, diaCobro: 1, activo: true, notas: "" },
    ],
    ingresos: [
      { id: uid(), fecha: d(15), concepto: "Quincena", fuente: "Mi empresa", tipo: "Salario", monto: 14000, notas: "" },
      { id: uid(), fecha: d(30), concepto: "Quincena", fuente: "Mi empresa", tipo: "Salario", monto: 14000, notas: "" },
      { id: uid(), fecha: d(20), concepto: "Proyecto freelance", fuente: "Cliente X", tipo: "Extra", monto: 6500, notas: "Landing page" },
    ],
    ahorros: [
      { id: uid(), nombre: "Boda", tipo: "Proyecto", objetivo: 180000, ahorrado: 64000, fechaMeta: `${Number(y) + 1}-06-01`, notas: "Meta a 12 meses" },
      { id: uid(), nombre: "Fondo de emergencia", tipo: "Fondo emergencia", objetivo: 90000, ahorrado: 52000, fechaMeta: "", notas: "3 meses de gastos" },
      { id: uid(), nombre: "Viaje a Japón", tipo: "Viaje", objetivo: 60000, ahorrado: 18000, fechaMeta: `${Number(y) + 1}-11-01`, notas: "" },
    ],
    viajes: [
      { id: uid(), destino: "Cancún", fecha: d(20), dias: 4, presupuesto: 18000, gastado: 12500, estado: "Reservado", notas: "Vuelo + hotel todo incluido" },
      { id: uid(), destino: "CDMX", fecha: shiftMonth(m, -1) + "-12", dias: 3, presupuesto: 9000, gastado: 9800, estado: "Realizado", notas: "Se pasó un poco el gasto" },
      { id: uid(), destino: "Japón", fecha: `${Number(y) + 1}-11-05`, dias: 12, presupuesto: 60000, gastado: 0, estado: "Planeado", notas: "" },
    ],
    proyectos: [
      {
        id: uid(),
        nombre: "Construcción cuarto de azotea",
        tipo: "Construcción", estado: "En curso",
        presupuesto: 120000, fechaInicio: d(1), fechaMeta: `${Number(y) + 1}-02-01`,
        ubicacion: "Casa", notas: "Cuarto de 4x5 m con baño.",
        movimientos: [
          { id: uid(), tipo: "Entrada", categoria: "", concepto: "Aportación inicial", monto: 50000, fecha: d(1), proveedor: "", metodo: "Transferencia", recibo: "", notas: "Ahorro destinado a la obra" },
          { id: uid(), tipo: "Entrada", categoria: "", concepto: "Aportación quincena", monto: 20000, fecha: d(15), proveedor: "", metodo: "Transferencia", recibo: "", notas: "" },
          { id: uid(), tipo: "Salida", categoria: "Material", concepto: "Cemento y varilla", monto: 18500, fecha: d(3), proveedor: "Materiales El Águila", etapa: "Cimentación", metodo: "Efectivo", recibo: "Factura A-1203", notas: "" },
          { id: uid(), tipo: "Salida", categoria: "Material", concepto: "Block y arena", monto: 9200, fecha: d(4), proveedor: "Materiales El Águila", etapa: "Muros", metodo: "Efectivo", recibo: "", notas: "" },
          { id: uid(), tipo: "Salida", categoria: "Mano de obra", concepto: "Albañil — semana 1", monto: 6500, fecha: d(8), proveedor: "Don Beto (albañil)", etapa: "Cimentación", metodo: "Efectivo", recibo: "", notas: "Incluye ayudante" },
          { id: uid(), tipo: "Salida", categoria: "Mano de obra", concepto: "Albañil — semana 2", monto: 6500, fecha: d(15), proveedor: "Don Beto (albañil)", etapa: "Muros", metodo: "Efectivo", recibo: "", notas: "" },
          { id: uid(), tipo: "Salida", categoria: "Permisos/Trámites", concepto: "Permiso de construcción", monto: 3200, fecha: d(2), proveedor: "", etapa: "", metodo: "Tarjeta", recibo: "", notas: "" },
          { id: uid(), tipo: "Salida", categoria: "Renta de maquinaria", concepto: "Revolvedora 2 días", monto: 1400, fecha: d(7), proveedor: "", etapa: "Cimentación", metodo: "Efectivo", recibo: "", notas: "" },
        ],
        etapas: [
          { id: uid(), nombre: "Cimentación", presupuesto: 25000, avance: 100, notas: "" },
          { id: uid(), nombre: "Muros", presupuesto: 35000, avance: 60, notas: "" },
          { id: uid(), nombre: "Losa / techo", presupuesto: 35000, avance: 10, notas: "" },
          { id: uid(), nombre: "Acabados", presupuesto: 25000, avance: 0, notas: "Pintura, piso, baño" },
        ],
        presupuestoCat: { "Material": 60000, "Mano de obra": 40000, "Permisos/Trámites": 5000, "Renta de maquinaria": 5000, "Otros": 10000 },
        proveedores: [
          { id: uid(), nombre: "Don Beto (albañil)", oficio: "Albañil", contacto: "55 1234 5678", notas: "Cobra por semana" },
          { id: uid(), nombre: "Materiales El Águila", oficio: "Proveedor material", contacto: "Tienda esquina", notas: "" },
        ],
        fondos: [],
      },
    ],
    cotizaciones: [],
  };
}
