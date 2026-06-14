/* Insights de metas de ahorro — porteado de js/app.js.
   ahorroInsights() devuelve métricas; ahorroTips() una lista estructurada
   de tips {tono, ico, html} para renderizar en la vista de detalle. */
import { num, isoToday, shiftMonth, fmtMoney, fmtDate, monthLabel } from "./format.js";

export function diasEntre(a, b) {
  const da = Date.parse(a), db = Date.parse(b);
  if (isNaN(da) || isNaN(db)) return 0;
  return (db - da) / 86400000;
}

export function mesDesdeHoy(nMeses) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + nMeses);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ahorroInsights(a) {
  const obj = num(a.objetivo), ah = num(a.ahorrado);
  const falta = Math.max(0, obj - ah);
  const pct = obj > 0 ? Math.min(100, Math.round((ah / obj) * 100)) : 0;
  const completed = obj > 0 && ah >= obj;

  const abonos = (a.abonos || []).slice().sort((x, y) => (x.fecha || "").localeCompare(y.fecha || ""));
  const aportes = abonos.filter((x) => x.tipo !== "Retiro");
  const hoy = isoToday();
  const firstDate = abonos.length ? abonos[0].fecha : null;

  let ritmoMensual = 0, mesesTranscurridos = 0;
  if (firstDate) {
    mesesTranscurridos = Math.max(0, diasEntre(firstDate, hoy)) / 30.4375;
    if (mesesTranscurridos >= 0.5 && ah > 0) ritmoMensual = ah / mesesTranscurridos;
  }

  let pronostico = null;
  if (!completed && ritmoMensual > 0) pronostico = mesDesdeHoy(Math.ceil(falta / ritmoMensual));

  let requeridoMensual = null, mesesRestantes = null, metaVencida = false;
  if (!completed && a.fechaMeta) {
    mesesRestantes = diasEntre(hoy, a.fechaMeta) / 30.4375;
    if (mesesRestantes > 0) requeridoMensual = falta / mesesRestantes;
    else metaVencida = true;
  }

  const HITOS = [25, 50, 75, 100];
  const siguienteHito = HITOS.find((h) => pct < h) || null;
  const montoSiguiente = siguienteHito ? Math.max(0, (obj * siguienteHito) / 100 - ah) : 0;

  const mesesConAbono = [...new Set(aportes.map((x) => (x.fecha || "").slice(0, 7)).filter(Boolean))].sort();
  let racha = 0;
  if (mesesConAbono.length) {
    racha = 1;
    for (let i = mesesConAbono.length - 1; i > 0; i--) {
      if (shiftMonth(mesesConAbono[i], -1) === mesesConAbono[i - 1]) racha++; else break;
    }
  }
  const mejorAbono = aportes.reduce((m, x) => Math.max(m, num(x.monto)), 0);

  return {
    obj, ah, falta, pct, completed, ritmoMensual, pronostico,
    requeridoMensual, mesesRestantes, metaVencida,
    siguienteHito, montoSiguiente, racha, mejorAbono,
    numAbonos: abonos.length, numAportes: aportes.length,
  };
}

const tip = (tono, ico, html) => ({ tono, ico, html });

export function ahorroTips(ins, a) {
  const tips = [];
  if (ins.completed) {
    tips.push(tip("ok", "🎉", `<b>¡Meta completada!</b> Juntaste ${fmtMoney(ins.ah)} de ${fmtMoney(ins.obj)}.`));
  } else if (ins.pronostico) {
    tips.push(tip("ok", "📅", `A tu ritmo histórico (~${fmtMoney(ins.ritmoMensual)}/mes) llegas a tu objetivo aprox. en <b>${monthLabel(ins.pronostico)}</b>.`));
  } else {
    tips.push(tip("muted", "📅", `Aún no puedo estimar tu fecha de llegada. Registra abonos en distintos meses y aquí verás el pronóstico.`));
  }
  if (!ins.completed) {
    if (!a.fechaMeta) {
      tips.push(tip("muted", "🎯", `Define una <b>fecha meta</b> (editando la meta) para calcular cuánto necesitas abonar al mes.`));
    } else if (ins.metaVencida) {
      tips.push(tip("late", "⏰", `Tu fecha meta (${fmtDate(a.fechaMeta)}) ya pasó y aún faltan ${fmtMoney(ins.falta)}. ${ins.pronostico ? `A tu ritmo, la alcanzarías en ${monthLabel(ins.pronostico)}.` : ""}`));
    } else {
      const acelera = ins.ritmoMensual > 0 && ins.requeridoMensual > ins.ritmoMensual;
      const buenRitmo = ins.ritmoMensual > 0 && ins.ritmoMensual >= ins.requeridoMensual;
      let extra = "";
      if (buenRitmo) extra = ` Vas con buen ritmo 👍`;
      else if (acelera) extra = ` Te falta ~${fmtMoney(ins.requeridoMensual - ins.ritmoMensual)}/mes más que tu ritmo actual.`;
      tips.push(tip(acelera ? "late" : "ok", "🎯", `Para llegar el <b>${fmtDate(a.fechaMeta)}</b> necesitas abonar ~<b>${fmtMoney(ins.requeridoMensual)}/mes</b>.${extra}`));
    }
  }
  if (!ins.completed && ins.siguienteHito) {
    tips.push(tip("pend", "🏁", `Siguiente hito: <b>${ins.siguienteHito}%</b> — te faltan ${fmtMoney(ins.montoSiguiente)} para alcanzarlo.`));
  }
  if (ins.racha > 1) {
    tips.push(tip("ok", "🔥", `Llevas <b>${ins.racha} meses seguidos</b> abonando. ¡Sigue así!`));
  }
  if (ins.mejorAbono > 0) {
    tips.push(tip("muted", "⭐", `Tu mejor abono fue de <b>${fmtMoney(ins.mejorAbono)}</b> · ${ins.numAbonos} movimiento(s) en total.`));
  }
  return tips;
}
