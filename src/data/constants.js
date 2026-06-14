/* Catálogos / constantes — porteados de js/app.js */

export const SCHEMA_VERSION = 1;
export const LS_DATA = "finanzas:data";
export const LS_THEME = "finanzas:theme";

export const CATEGORIAS = [
  "Vivienda", "Servicios", "Tarjeta de crédito", "Préstamo", "Transporte",
  "Alimentación", "Salud", "Educación", "Suscripciones", "Entretenimiento",
  "Seguros", "Impuestos", "Otros",
];

// Categorías de gasto para proyectos (construcción, remodelación, etc.)
export const CAT_PROYECTO = [
  "Mano de obra", "Material", "Herramienta", "Permisos/Trámites",
  "Transporte/Flete", "Renta de maquinaria", "Otros",
];

export const TIPOS_PROYECTO = ["Construcción", "Remodelación", "Negocio", "Vehículo", "Mudanza", "Evento", "Otro"];
export const ESTADOS_PROYECTO = ["Planeado", "En curso", "Pausado", "Terminado"];

// Cotizaciones (comparador de precios por insumo)
export const ESTADOS_COTIZACION = ["Comparando", "Decidido", "Comprado"];
export const UNIDADES = ["pieza", "bulto", "saco", "kg", "ton", "m", "m²", "m³", "litro", "millar", "rollo", "lote", "servicio"];
export const DISPONIBILIDAD = ["En existencia", "Sobre pedido", "Agotado"];

export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const mesIdx = (nombre) => MESES.indexOf(nombre) + 1; // 1..12, 0 si no aplica

// Paleta para gráficas
export const PALETTE = ["#4f6ef7", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6", "#6366f1", "#a855f7", "#64748b"];
