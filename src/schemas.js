/* Esquemas de campos del modal (crear/editar) — porteados de js/app.js.
   Factory: recibe el store para resolver opciones dinámicas (proveedores, etapas, etc.). */

import {
  CATEGORIAS, CAT_PROYECTO, TIPOS_PROYECTO, ESTADOS_PROYECTO,
  ESTADOS_COTIZACION, UNIDADES, DISPONIBILIDAD, MESES,
} from "./data/constants.js";
import { isoToday } from "./utils/format.js";

export function createSchemas(store) {
  const cm = () => store.currentMonth;

  const proveedoresOpts = () => {
    const p = store.proyectoActual();
    return p && Array.isArray(p.proveedores) ? p.proveedores.map((v) => v.nombre).filter(Boolean) : [];
  };
  const etapasOpts = () => {
    const p = store.proyectoActual();
    return p && Array.isArray(p.etapas) ? p.etapas.map((e) => e.nombre).filter(Boolean) : [];
  };
  const fondosOpts = () => {
    const p = store.proyectoActual();
    return p && Array.isArray(p.fondos) ? p.fondos.map((f) => f.nombre).filter(Boolean) : [];
  };
  const proyectoOpts = () => store.data.proyectos.map((p) => ({ value: p.id, label: p.nombre }));
  const cotizProveedorOpts = () => {
    const c = store.cotizacionActual();
    const set = new Set();
    if (c) {
      const proy = store.proyectoById(c.proyectoId);
      if (proy) (proy.proveedores || []).forEach((v) => v.nombre && set.add(v.nombre));
      (c.opciones || []).forEach((o) => o.proveedor && set.add(o.proveedor));
    }
    return [...set];
  };

  const SCHEMAS = {
    pagos: {
      title: "pago",
      fields: [
        { k: "concepto", label: "Concepto", type: "text", required: true, span: 2 },
        { k: "banco", label: "Banco", type: "text" },
        { k: "categoria", label: "Categoría", type: "select", options: CATEGORIAS },
        { k: "monto", label: "Monto", type: "number", required: true },
        { k: "fechaLimite", label: "Fecha límite", type: "date" },
        { k: "mes", label: "Mes", type: "month", default: () => cm() },
        { k: "pagado", label: "¿Ya está pagado?", type: "checkbox" },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    recurrentes: {
      title: "gasto recurrente",
      fields: [
        { k: "concepto", label: "Concepto", type: "text", required: true, span: 2 },
        { k: "categoria", label: "Categoría", type: "select", options: CATEGORIAS },
        { k: "banco", label: "Banco / método", type: "text" },
        { k: "monto", label: "Monto mensual", type: "number", required: true },
        { k: "diaCobro", label: "Día de cobro", type: "number", min: 1, max: 31 },
        { k: "activo", label: "Activo", type: "checkbox", default: () => true },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    ingresos: {
      title: "ingreso",
      fields: [
        { k: "concepto", label: "Concepto", type: "text", required: true, span: 2 },
        { k: "fuente", label: "Fuente / empresa", type: "text" },
        { k: "tipo", label: "Tipo", type: "select", options: ["Salario", "Extra", "Bono", "Inversión", "Otro"] },
        { k: "monto", label: "Monto", type: "number", required: true },
        { k: "fecha", label: "Fecha", type: "date", default: () => isoToday() },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    ahorros: {
      title: "meta / proyecto",
      fields: [
        { k: "nombre", label: "Nombre", type: "text", required: true, span: 2 },
        { k: "tipo", label: "Tipo", type: "select", options: ["Meta", "Proyecto", "Viaje", "Fondo emergencia"] },
        { k: "objetivo", label: "Objetivo", type: "number", required: true },
        { k: "fechaMeta", label: "Fecha meta", type: "date" },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    abono: {
      title: "abono",
      fields: [
        { k: "tipo", label: "Tipo", type: "select", options: ["Abono", "Retiro"], required: true, default: () => "Abono" },
        { k: "monto", label: "Monto", type: "number", required: true },
        { k: "fecha", label: "Fecha", type: "date", default: () => isoToday() },
        { k: "notas", label: "Nota (ej. quincena, aguinaldo…)", type: "text", span: 2 },
      ],
    },
    viajes: {
      title: "viaje",
      fields: [
        { k: "destino", label: "Destino", type: "text", required: true, span: 2 },
        { k: "estado", label: "Estado", type: "select", options: ["Planeado", "Reservado", "En curso", "Realizado"] },
        { k: "fecha", label: "Fecha de salida", type: "date" },
        { k: "dias", label: "Días", type: "number", min: 1 },
        { k: "presupuesto", label: "Presupuesto", type: "number", required: true },
        { k: "gastado", label: "Gastado", type: "number" },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    proyectos: {
      title: "proyecto",
      fields: [
        { k: "nombre", label: "Nombre del proyecto", type: "text", required: true, span: 2 },
        { k: "tipo", label: "Tipo", type: "select", options: TIPOS_PROYECTO, default: () => "Construcción" },
        { k: "estado", label: "Estado", type: "select", options: ESTADOS_PROYECTO, default: () => "En curso" },
        { k: "presupuesto", label: "Presupuesto estimado", type: "number" },
        { k: "fechaInicio", label: "Fecha de inicio", type: "date", default: () => isoToday() },
        { k: "fechaMeta", label: "Fecha meta", type: "date" },
        { k: "ubicacion", label: "Ubicación", type: "text", span: 2 },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    movimiento: {
      title: "movimiento",
      fields: [
        { k: "tipo", label: "Tipo", type: "select", options: ["Salida", "Entrada", "Traspaso"], required: true, default: () => "Salida" },
        { k: "categoria", label: "Categoría", type: "select", options: CAT_PROYECTO },
        { k: "concepto", label: "Concepto", type: "text", required: true, span: 2 },
        { k: "monto", label: "Monto", type: "number", required: true },
        { k: "fecha", label: "Fecha", type: "date", default: () => isoToday() },
        { k: "proveedor", label: "Proveedor / quién", type: "text", datalist: proveedoresOpts },
        { k: "etapa", label: "Etapa (opcional)", type: "select", options: etapasOpts },
        { k: "metodo", label: "Método de pago", type: "select", options: ["Efectivo", "Transferencia", "Tarjeta", "Crédito", "Otro"] },
        { k: "fondo", label: "Fondo (de dónde sale el dinero)", type: "select", options: fondosOpts },
        { k: "fondoDestino", label: "Fondo destino (solo para traspasos)", type: "select", options: fondosOpts },
        { k: "recibo", label: "Recibo / referencia (nota o URL)", type: "text", span: 2 },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    fondo: {
      title: "fondo / bolsa de dinero",
      fields: [
        { k: "nombre", label: "Nombre (BBVA, Efectivo, Tarjeta…)", type: "text", required: true, span: 2 },
        { k: "saldoInicial", label: "Saldo disponible al iniciar", type: "number", default: () => 0 },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    etapa: {
      title: "etapa",
      fields: [
        { k: "nombre", label: "Nombre de la etapa", type: "text", required: true, span: 2 },
        { k: "presupuesto", label: "Presupuesto de la etapa", type: "number" },
        { k: "avance", label: "Avance %", type: "number", min: 0, max: 100, default: () => 0 },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    proveedor: {
      title: "proveedor / trabajador",
      fields: [
        { k: "nombre", label: "Nombre", type: "text", required: true, span: 2 },
        { k: "oficio", label: "Oficio / rol", type: "text" },
        { k: "contacto", label: "Teléfono / contacto", type: "text" },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    cotizaciones: {
      title: "cotización",
      fields: [
        { k: "titulo", label: "¿Qué vas a comprar? (insumo)", type: "text", required: true, span: 2 },
        { k: "proyectoId", label: "Proyecto vinculado", type: "select", options: proyectoOpts },
        { k: "categoria", label: "Categoría", type: "select", options: CAT_PROYECTO },
        { k: "cantidad", label: "Cantidad", type: "number", min: 0, default: () => 1 },
        { k: "unidad", label: "Unidad", type: "text", datalist: () => UNIDADES, default: () => "pieza" },
        { k: "estado", label: "Estado", type: "select", options: ESTADOS_COTIZACION, default: () => "Comparando" },
        { k: "notas", label: "Notas / especificaciones", type: "textarea", span: 2 },
      ],
    },
    opcion: {
      title: "opción de proveedor",
      fields: [
        { k: "proveedor", label: "Proveedor / tienda", type: "text", required: true, span: 2, datalist: cotizProveedorOpts },
        { k: "precioUnitario", label: "Precio por unidad", type: "number", required: true, min: 0 },
        { k: "costoEnvio", label: "Costo de envío / flete (opcional)", type: "number", min: 0 },
        { k: "disponibilidad", label: "Disponibilidad", type: "select", options: DISPONIBILIDAD },
        { k: "contacto", label: "Contacto (tel / vendedor)", type: "text" },
        { k: "fecha", label: "Fecha de la cotización", type: "date", default: () => isoToday() },
        { k: "url", label: "Liga / referencia (URL o nota)", type: "text", span: 2 },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
    bonos: {
      title: "bono",
      fields: [
        { k: "nombre", label: "Nombre del bono (PTU, puntualidad, vales…)", type: "text", required: true, span: 2 },
        { k: "monto", label: "Monto neto", type: "number", required: true },
        { k: "mes", label: "Mes en que cae", type: "select", options: MESES, required: true, default: () => "Diciembre" },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    },
  };

  function sueldoSchema() {
    return {
      title: "sueldo",
      fields: [
        { k: "netoMensual", label: "Sueldo NETO mensual (lo que te cae)", type: "number", required: true, span: 2 },
        { k: "brutoMensual", label: "Sueldo bruto mensual (informativo)", type: "number" },
        { k: "frecuencia", label: "Frecuencia de pago", type: "select", options: ["Mensual", "Quincenal", "Semanal"], default: () => "Quincenal" },
        { k: "diasPago", label: "Días de pago (ej. 15, 30)", type: "text" },
        { k: "vigenteDesde", label: "Vigente desde (mes)", type: "month", default: () => cm() },
        { k: "aguinaldoMonto", label: "Aguinaldo neto", type: "number" },
        { k: "aguinaldoMes", label: "Mes del aguinaldo", type: "select", options: MESES, default: () => "Diciembre" },
        { k: "activo", label: "Activo — cuéntalo en mis ingresos cada mes", type: "checkbox", default: () => true },
        { k: "notas", label: "Notas", type: "textarea", span: 2 },
      ],
    };
  }

  function presupuestoCatSchema() {
    return { title: "presupuesto", fields: CAT_PROYECTO.map((c, i) => ({ k: "pc" + i, _cat: c, label: c, type: "number", min: 0 })) };
  }

  return { SCHEMAS, sueldoSchema, presupuestoCatSchema };
}
