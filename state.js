/**
 * state.js - Single Source of Truth for State & Filter Logic
 * ES Module: appState + reactive listeners + computed filtering/sorting
 */

export const appState = {
  // Raw Data from Sheet
  rawItems: [],
  asOnDate: "07.09.2026",
  currentSheet: "latest",

  // Active Scope & Filters
  activeLao: "ALL",
  activeProject: "ALL",
  activeStatus: "ALL",
  searchQuery: "",
  bottleneckOnly: false,
  highExtentOnly: false,

  // Table Sorting
  sortField: "slNo",
  sortAsc: true,

  // UI Navigation
  activeTab: "overview", // 'overview' | 'ledger' | 'analytics' | 'bottlenecks' | 'simulator' | 'all'
  expandedRows: new Set(),

  // Sync & Resilience State
  syncState: {
    status: "loading", // 'loading' | 'success' | 'cached' | 'error'
    isCached: false,
    isSeed: false,
    cacheTime: null,
    lastSynced: null,
    errorMessage: null,
    countdownSeconds: 300,
    autoSyncEnabled: true
  },

  // What-If Simulator Scenarios
  simulatorScenarios: {
    chinthapally: false,
    pendlipakala: false,
    miryalaguda: false
  },

  // Listeners
  _listeners: new Set(),

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },

  notify(event = "change") {
    for (const listener of this._listeners) {
      try {
        listener(this, event);
      } catch (err) {
        console.error("[state.js] Error in state listener:", err);
      }
    }
  },

  setState(updates, event = "change") {
    if (typeof updates === "function") {
      updates = updates(this);
    }
    if (!updates || typeof updates !== "object") return;

    for (const key of Object.keys(updates)) {
      if (key === "syncState" && typeof updates.syncState === "object") {
        this.syncState = { ...this.syncState, ...updates.syncState };
      } else if (key === "simulatorScenarios" && typeof updates.simulatorScenarios === "object") {
        this.simulatorScenarios = { ...this.simulatorScenarios, ...updates.simulatorScenarios };
      } else {
        this[key] = updates[key];
      }
    }
    this.notify(event);
  }
};

/* ----------------------------------------------------
   FILTER COMPUTATION
---------------------------------------------------- */
export function getFilteredItems(state = appState) {
  const items = state.rawItems || [];
  const q = (state.searchQuery || "").trim().toLowerCase();

  return items.filter((item) => {
    // 1. LAO Scope Filter
    if (state.activeLao !== "ALL" && item.lao !== state.activeLao) {
      return false;
    }

    // 2. Specific Project Filter
    if (state.activeProject !== "ALL" && String(item.slNo) !== String(state.activeProject)) {
      return false;
    }

    // 3. Status Filter
    if (state.activeStatus !== "ALL") {
      const s = (item.status || "").toLowerCase();
      if (state.activeStatus === "Completed" && !s.includes("completed")) return false;
      if (state.activeStatus === "In Progress" && !s.includes("in progress")) return false;
      if (state.activeStatus === "Award Pending" && !s.includes("pending") && !s.includes("enquiry") && !s.includes("stage")) return false;
    }

    // 4. Critical Issues Chip
    if (state.bottleneckOnly) {
      if (item.bottleneckCategory === "None" || (item.balanceCr || 0) <= 0) return false;
    }

    // 5. High Extent (>50 Ac) Chip
    if (state.highExtentOnly) {
      if ((item.totalExtentAc || 0) < 50) return false;
    }

    // 6. Global Search (Debounced input)
    if (q) {
      const combined = `${item.project || ""} ${item.lao || ""} ${item.dtoToken || ""} ${item.remarks || ""} ${item.status || ""} ${item.bottleneckCategory || ""} ${item.creditDate || ""}`.toLowerCase();
      if (!combined.includes(q)) return false;
    }

    return true;
  });
}

/* ----------------------------------------------------
   SORTING COMPUTATION
---------------------------------------------------- */
export function getSortedItems(data, sortField = "slNo", sortAsc = true) {
  return [...data].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === undefined || valA === null) valA = "";
    if (valB === undefined || valB === null) valB = "";

    if (typeof valA === "string") {
      valA = valA.toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });
}

/* ----------------------------------------------------
   SIMULATION COMPUTATION
---------------------------------------------------- */
export function calculateSimulation(state = appState) {
  const items = state.rawItems || [];
  const baseReleased = items.reduce((acc, d) => acc + (d.releasedCr || 0), 0);
  const baseDisbursed = items.reduce((acc, d) => acc + (d.totalDisbursedCr || 0), 0);

  let additionalDisbursed = 0;
  let additionalBeneficiaries = 0;
  let additionalExtent = 0;

  const { chinthapally, pendlipakala, miryalaguda } = state.simulatorScenarios;

  if (chinthapally) {
    // Chinthapally Reservoir (Sl 13)
    const p13 = items.find((d) => d.slNo === 13);
    if (p13) {
      additionalDisbursed += p13.balanceCr || 82.98;
      additionalBeneficiaries += p13.balanceBeneficiaries || 716;
      additionalExtent += p13.balanceExtentAc || 814.73;
    } else {
      additionalDisbursed += 82.98;
      additionalBeneficiaries += 716;
      additionalExtent += 814.73;
    }
  }

  if (pendlipakala) {
    // Pendlipakala (Sl 3)
    const p3 = items.find((d) => d.slNo === 3);
    if (p3) {
      additionalDisbursed += p3.balanceCr || 54.61;
      additionalBeneficiaries += p3.balanceBeneficiaries || 297;
      additionalExtent += p3.balanceExtentAc || 343.42;
    } else {
      additionalDisbursed += 54.61;
      additionalBeneficiaries += 297;
      additionalExtent += 343.42;
    }
  }

  if (miryalaguda) {
    // Nellikal & Dunnapothula (Sl 8 + Sl 9)
    const p8 = items.find((d) => d.slNo === 8);
    const p9 = items.find((d) => d.slNo === 9);
    const b8 = p8 ? (p8.balanceCr || 2.34) : 2.34;
    const b9 = p9 ? (p9.balanceCr || 12.05) : 12.05;
    additionalDisbursed += b8 + b9;
    additionalBeneficiaries += (p8?.balanceBeneficiaries || 30) + (p9?.balanceBeneficiaries || 804);
    additionalExtent += (p8?.balanceExtentAc || 2.04) + (p9?.balanceExtentAc || 42.98);
  }

  const simulatedDisbursed = baseDisbursed + additionalDisbursed;
  const simulatedPct = baseReleased > 0 ? (simulatedDisbursed / baseReleased) * 100 : 0;

  return {
    baseDisbursed,
    baseReleased,
    additionalDisbursed,
    additionalBeneficiaries,
    additionalExtent,
    simulatedDisbursed,
    simulatedPct
  };
}
