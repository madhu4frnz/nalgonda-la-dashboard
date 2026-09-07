/**
 * charts.js - Chart Engine for Nalgonda Land Acquisition Dashboard
 * ES Module: Lazy loading Chart.js CDN, high-fidelity responsive canvases,
 * clean updates on tab transitions.
 */

import { getFilteredItems } from "./state.js";

let chartJsLoadingPromise = null;
let laoChartInstance = null;
let bottleneckChartInstance = null;

export function ensureChartJsLoaded() {
  if (window.Chart) {
    return Promise.resolve(window.Chart);
  }

  if (chartJsLoadingPromise) {
    return chartJsLoadingPromise;
  }

  chartJsLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="chart.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Chart));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js";
    script.async = true;
    script.onload = () => resolve(window.Chart);
    script.onerror = (e) => reject(new Error("Failed to load Chart.js from CDN"));
    document.head.appendChild(script);
  });

  return chartJsLoadingPromise;
}

export async function initOrUpdateCharts(state) {
  const analyticsSection = document.getElementById("view-analytics");
  if (!analyticsSection) return;

  // If the analytics tab or all-views tab is not active, defer render
  const isActive = analyticsSection.classList.contains("active") || state.activeTab === "all";
  if (!isActive) return;

  try {
    await ensureChartJsLoaded();
  } catch (err) {
    console.warn("[charts.js] Could not load Chart.js:", err);
    return;
  }

  const data = getFilteredItems(state);
  const laos = ["SDC Unit-I", "SDC Unit-II", "RDO Miryalaguda", "RDO Nalgonda", "PA to SPL Collector"];
  const activeLaos = state.activeLao === "ALL" ? laos : [state.activeLao];

  const disbursedByLao = activeLaos.map((name) => {
    return data.filter((d) => d.lao === name).reduce((acc, d) => acc + (d.totalDisbursedCr || 0), 0);
  });

  const balanceByLao = activeLaos.map((name) => {
    return data.filter((d) => d.lao === name).reduce((acc, d) => acc + (d.balanceCr || 0), 0);
  });

  const labels = activeLaos.map((name) => name.replace("RDO ", "").replace("to SPL Collector", "(Spl)"));

  // 1. LAO Financial Progress Bar Chart
  const canvasLao = document.getElementById("laoFinanceChart");
  if (canvasLao) {
    if (!laoChartInstance) {
      const ctx = canvasLao.getContext("2d");
      laoChartInstance = new window.Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Disbursed (₹ Cr)",
              data: disbursedByLao,
              backgroundColor: "#38bdf8",
              borderRadius: 4
            },
            {
              label: "Balance to Disburse (₹ Cr)",
              data: balanceByLao,
              backgroundColor: "#f43f5e",
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              ticks: { color: "#94a3b8", font: { size: 10 } }
            },
            y: {
              stacked: true,
              grid: { color: "rgba(255, 255, 255, 0.05)" },
              ticks: { color: "#94a3b8", callback: (val) => `₹${val} Cr` }
            }
          },
          plugins: {
            legend: {
              position: "top",
              labels: { color: "#cbd5e1", boxWidth: 12 }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ₹${ctx.raw.toFixed(2)} Cr`
              }
            }
          }
        }
      });
    } else {
      laoChartInstance.data.labels = labels;
      laoChartInstance.data.datasets[0].data = disbursedByLao;
      laoChartInstance.data.datasets[1].data = balanceByLao;
      laoChartInstance.update();
    }
  }

  // 2. Bottleneck Doughnut Chart
  const catMap = {
    "Market Value Revision": 0,
    "Title & Survey Disputes": 0,
    "Alignment Issues": 0,
    "Active In Progress": 0,
    "Disbursement Completed": 0
  };

  data.forEach((d) => {
    const s = (d.status || "").toLowerCase();
    const b = (d.bottleneckCategory || "").toLowerCase();
    if (s.includes("completed")) {
      catMap["Disbursement Completed"] += (d.releasedCr || 0);
    } else if (b.includes("rate") || b.includes("market")) {
      catMap["Market Value Revision"] += (d.balanceCr || 0);
    } else if (b.includes("title") || b.includes("survey") || b.includes("sdr")) {
      catMap["Title & Survey Disputes"] += (d.balanceCr || 0);
    } else if (b.includes("alignment")) {
      catMap["Alignment Issues"] += (d.balanceCr || 0);
    } else {
      catMap["Active In Progress"] += (d.balanceCr || 0);
    }
  });

  const pieLabels = Object.keys(catMap);
  const pieValues = Object.values(catMap);

  const canvasBottleneck = document.getElementById("bottleneckPieChart");
  if (canvasBottleneck) {
    if (!bottleneckChartInstance) {
      const ctx = canvasBottleneck.getContext("2d");
      bottleneckChartInstance = new window.Chart(ctx, {
        type: "doughnut",
        data: {
          labels: pieLabels,
          datasets: [
            {
              data: pieValues,
              backgroundColor: [
                "#f43f5e",
                "#f59e0b",
                "#818cf8",
                "#38bdf8",
                "#10b981"
              ],
              borderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: {
              position: "right",
              labels: { color: "#cbd5e1", boxWidth: 10, font: { size: 11 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ₹${ctx.raw.toFixed(2)} Cr (${ctx.label})`
              }
            }
          }
        }
      });
    } else {
      bottleneckChartInstance.data.labels = pieLabels;
      bottleneckChartInstance.data.datasets[0].data = pieValues;
      bottleneckChartInstance.update();
    }
  }
}

export function resizeCharts() {
  if (laoChartInstance) {
    laoChartInstance.resize();
  }
  if (bottleneckChartInstance) {
    bottleneckChartInstance.resize();
  }
}
