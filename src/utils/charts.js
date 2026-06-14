/* Helpers de gráficas — porteados de js/app.js. */
import { fmtMoney, fmtNum } from "./format.js";

export function themeColors() {
  const css = getComputedStyle(document.documentElement);
  return {
    text: css.getPropertyValue("--text").trim(),
    soft: css.getPropertyValue("--text-soft").trim(),
    grid: css.getPropertyValue("--border").trim(),
    primary: css.getPropertyValue("--primary").trim(),
    success: css.getPropertyValue("--success").trim(),
    danger: css.getPropertyValue("--danger").trim(),
  };
}

export function baseOpts(col, money) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { boxWidth: 12, padding: 14 } },
      tooltip: { callbacks: money ? { label: (c) => `${c.dataset.label}: ${fmtMoney(c.raw)}` } : {} },
    },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v) => "$" + fmtNum(v) }, grid: { color: col.grid } },
      x: { grid: { display: false } },
    },
  };
}

export function donutOpts(col) {
  return {
    responsive: true, maintainAspectRatio: false, cutout: "62%",
    plugins: {
      legend: { position: "right", labels: { boxWidth: 12, padding: 12 } },
      tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtMoney(c.raw)}` } },
    },
  };
}
