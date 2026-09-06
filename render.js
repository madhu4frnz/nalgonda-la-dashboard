/**
 * render.js - DOM Painting Engine for Nalgonda Land Acquisition Dashboard
 * ES Module: All DOM rendering, 3 explicit UI states, Skeletons, Resilience Banner
 */

import { getFilteredItems, getSortedItems, calculateSimulation } from "./state.js";
import { BOTTLENECK_HIGHLIGHTS } from "./data.js";

/* ----------------------------------------------------
   NUMBER FORMATTING UTILITIES (INDIAN LOCALE)
---------------------------------------------------- */
export const inrFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

export const intFormatter = new Intl.NumberFormat("en-IN");

export function formatCr(val) {
  const num = Number(val) || 0;
  return `₹${inrFormatter.format(num)}`;
}

export function formatAc(val) {
  const num = Number(val) || 0;
  return `${inrFormatter.format(num)} Ac`;
}

/* ----------------------------------------------------
   RESILIENCE BANNER (CACHED DATA NOTICE)
---------------------------------------------------- */
export function renderResilienceBanner(state, onRetry) {
  let banner = document.getElementById("resilienceBanner");
  const main = document.getElementById("dashboardMain");
  if (!main) return;

  const { syncState } = state;

  if (syncState.isCached) {
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "resilienceBanner";
      banner.className = "resilience-banner";
      main.insertBefore(banner, main.firstChild);
    }

    const timeStr = syncState.cacheTime
      ? new Date(syncState.cacheTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : "earlier session";

    const reason = syncState.errorMessage ? ` (${syncState.errorMessage})` : "";

    banner.innerHTML = `
      <div class="resilience-content">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>
          <strong>Live sync failed${reason}:</strong> Displaying data cached at <strong>${timeStr}</strong>.
        </span>
      </div>
      <button class="btn btn-sm btn-resilience-retry" id="bannerRetryBtn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
        Retry Live Sync
      </button>
    `;
    banner.style.display = "flex";

    const retryBtn = banner.querySelector("#bannerRetryBtn");
    if (retryBtn && onRetry) {
      retryBtn.addEventListener("click", onRetry);
    }
  } else if (banner) {
    banner.style.display = "none";
  }
}

/* ----------------------------------------------------
   MASTER LEDGER TABLE RENDERING
---------------------------------------------------- */
export function renderTable(state, options = {}) {
  const tableBody = document.getElementById("tableBody");
  const tableRecordCount = document.getElementById("tableRecordCount");
  const ledgerCountPill = document.getElementById("ledgerCountPill");
  const sidebarLedgerBadge = document.getElementById("sidebarLedgerBadge");

  if (!tableBody) return;

  const { syncState } = state;
  const filtered = getFilteredItems(state);
  const sorted = getSortedItems(filtered, state.sortField, state.sortAsc);
  const totalRaw = state.rawItems.length;

  // 1. Update Record Counters
  if (state.activeProject !== "ALL" && filtered.length === 1) {
    if (tableRecordCount) tableRecordCount.textContent = `Showing 1 scheme (#${filtered[0].slNo} ${filtered[0].project}) • Filtered`;
  } else if (state.activeLao !== "ALL") {
    if (tableRecordCount) tableRecordCount.textContent = `Showing ${filtered.length} schemes under ${state.activeLao}`;
  } else {
    if (tableRecordCount) tableRecordCount.textContent = `Showing ${filtered.length} of ${totalRaw} records`;
  }
  if (ledgerCountPill) ledgerCountPill.textContent = filtered.length;
  if (sidebarLedgerBadge) sidebarLedgerBadge.textContent = filtered.length;

  // 2. Update Column Sort Header Carets
  document.querySelectorAll("th.sortable").forEach((th) => {
    const field = th.dataset.sort;
    const isSorted = state.sortField === field;
    th.classList.toggle("active-sort", isSorted);
    const existingCaret = th.querySelector(".sort-caret");
    if (existingCaret) existingCaret.remove();

    if (isSorted) {
      const caret = document.createElement("span");
      caret.className = "sort-caret";
      caret.textContent = state.sortAsc ? " ▲" : " ▼";
      th.appendChild(caret);
    }
  });

  // 3. Explicit UI State 1: SKELETON LOADING
  if (syncState.status === "loading" && totalRaw === 0) {
    tableBody.innerHTML = Array(6).fill(0).map(() => `
      <tr class="skeleton-row">
        <td><div class="skeleton-bar" style="width: 20px;"></div></td>
        <td><div class="skeleton-bar" style="width: 90px;"></div></td>
        <td><div class="skeleton-bar" style="width: 160px;"></div></td>
        <td><div class="skeleton-bar" style="width: 65px;"></div></td>
        <td><div class="skeleton-bar" style="width: 65px;"></div></td>
        <td><div class="skeleton-bar" style="width: 65px;"></div></td>
        <td><div class="skeleton-bar" style="width: 50px;"></div></td>
        <td><div class="skeleton-bar" style="width: 70px;"></div></td>
        <td><div class="skeleton-bar" style="width: 75px;"></div></td>
        <td><div class="skeleton-bar" style="width: 60px;"></div></td>
        <td><div class="skeleton-bar" style="width: 30px;"></div></td>
      </tr>
    `).join("");
    return;
  }

  // 4. Explicit UI State 2: ERROR WITH RETRY
  if (syncState.status === "error" && totalRaw === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; padding: 3rem 1.5rem;">
          <div class="table-error-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h4 style="margin: 0.75rem 0 0.35rem; color: var(--text-primary);">Failed to Load Live Data</h4>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">
              ${syncState.errorMessage || "Unable to reach Google Sheets. Please check your internet connection."}
            </p>
            <button class="btn btn-primary" id="tableRetryBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              Retry Live Sync
            </button>
          </div>
        </td>
      </tr>
    `;
    const retryBtn = tableBody.querySelector("#tableRetryBtn");
    if (retryBtn && options.onRetry) {
      retryBtn.addEventListener("click", options.onRetry);
    }
    return;
  }

  // 5. Explicit UI State 3: EMPTY MATCH STATE
  if (sorted.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; padding: 3rem 1.5rem;">
          <div class="table-empty-state">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <h4 style="margin: 0.75rem 0 0.25rem; color: var(--text-primary);">No Matching Records</h4>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">
              No land acquisition records matched your active filter or search criteria.
            </p>
            <button class="btn btn-secondary btn-sm" id="tableResetFiltersBtn">
              Clear All Filters
            </button>
          </div>
        </td>
      </tr>
    `;
    const resetBtn = tableBody.querySelector("#tableResetFiltersBtn");
    if (resetBtn && options.onResetFilters) {
      resetBtn.addEventListener("click", options.onResetFilters);
    }
    return;
  }

  // 6. POPULATE VALID RECORDS
  tableBody.innerHTML = "";

  sorted.forEach((row) => {
    const pct = row.releasedCr > 0 ? (row.totalDisbursedCr / row.releasedCr) * 100 : 0;
    const isExpanded = state.expandedRows.has(row.slNo);

    let statusBadgeClass = "status-in-progress";
    const s = (row.status || "").toLowerCase();
    if (s.includes("completed")) {
      statusBadgeClass = "status-completed";
    } else if (s.includes("pending") || s.includes("enquiry") || s.includes("stage")) {
      statusBadgeClass = "status-pending";
    }

    const tr = document.createElement("tr");
    tr.className = isExpanded ? "expanded" : "";
    tr.dataset.sl = row.slNo;

    tr.innerHTML = `
      <td class="col-freeze-sl" style="font-weight: 600; color: var(--text-muted);">${row.slNo}</td>
      <td><strong style="color: var(--color-primary);">${row.lao}</strong></td>
      <td class="col-freeze-proj" style="font-weight: 500;">
        ${row.project}
        ${row.disbursedTodayCr > 0 ? `<span class="status-badge status-completed" style="margin-left: 0.35rem; font-size: 0.65rem;">+₹${row.disbursedTodayCr.toFixed(2)} Cr Today</span>` : ""}
      </td>
      <td>${formatCr(row.releasedCr)}</td>
      <td style="color: #34d399; font-weight: 600;">${formatCr(row.totalDisbursedCr)}</td>
      <td style="color: ${row.balanceCr > 0 ? '#fb7185' : 'var(--text-muted)'}; font-weight: 600;">${formatCr(row.balanceCr)}</td>
      <td>
        <span class="mini-progress-bar">
          <div class="mini-progress-fill" style="width: ${Math.min(100, pct)}%; background: ${pct >= 99 ? '#10b981' : pct > 30 ? '#38bdf8' : '#f59e0b'};"></div>
        </span>
        <span style="font-size: 0.75rem; font-weight: 600;">${pct.toFixed(0)}%</span>
      </td>
      <td>
        <span>${intFormatter.format(row.beneficiariesPaid)}</span>
        <span style="color: var(--text-muted);"> / ${intFormatter.format(row.totalBeneficiaries)}</span>
      </td>
      <td>
        <span>${row.paymentCompletedExtentAc.toFixed(2)}</span>
        <span style="color: var(--text-muted);"> / ${row.totalExtentAc.toFixed(2)} Ac</span>
      </td>
      <td>
        <span class="status-badge ${statusBadgeClass}">${row.status}</span>
      </td>
      <td style="text-align: center;">
        <button class="btn-icon row-expand-btn" aria-label="Toggle Details">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s ease; transform: ${isExpanded ? 'rotate(180deg)' : 'none'};">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </td>
    `;

    tr.addEventListener("click", () => {
      if (options.onToggleRow) options.onToggleRow(row.slNo);
    });

    tableBody.appendChild(tr);

    // Expandable Details Row
    if (isExpanded) {
      const detailTr = document.createElement("tr");
      detailTr.className = "row-detail";
      detailTr.innerHTML = `
        <td colspan="11">
          <div class="row-detail-content">
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">DTO Token & Date:</span>
                <span class="detail-value">${row.dtoToken || "—"}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Date of Credit:</span>
                <span class="detail-value">${row.creditDate || "—"}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Disbursed Yesterday:</span>
                <span class="detail-value">${formatCr(row.disbursedYesterdayCr)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Disbursed Today:</span>
                <span class="detail-value" style="color: #34d399;">${formatCr(row.disbursedTodayCr)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Possession Handed Over:</span>
                <span class="detail-value">${row.possession || "Pending"}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Post-Award Completed / Balance:</span>
                <span class="detail-value">${row.postAwardCompleted ? row.postAwardCompleted + ' Ac' : '—'} / ${row.postAwardBalance ? row.postAwardBalance + ' Ac' : '—'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Bottleneck Category:</span>
                <span class="detail-value" style="color: ${row.bottleneckCategory !== 'None' ? '#f59e0b' : '#10b981'}; font-weight: 600;">
                  ${row.bottleneckCategory}
                </span>
              </div>
              <div class="detail-item full-width">
                <span class="detail-label">Field Remarks & Ground Status:</span>
                <span class="detail-value" style="font-style: italic; line-height: 1.6;">"${row.remarks || 'No specific remarks recorded.'}"</span>
              </div>
            </div>
            <div class="detail-actions-bar">
              <button class="btn btn-whatsapp btn-sm wa-detail-send-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.456h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Send via WhatsApp
              </button>
              <button class="btn btn-secondary btn-sm wa-detail-copy-btn">
                Copy WhatsApp Format
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;

      const sendBtn = detailTr.querySelector(".wa-detail-send-btn");
      if (sendBtn && options.onSendWhatsApp) {
        sendBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          options.onSendWhatsApp(row);
        });
      }

      const copyBtn = detailTr.querySelector(".wa-detail-copy-btn");
      if (copyBtn && options.onCopyWhatsApp) {
        copyBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          options.onCopyWhatsApp(row);
        });
      }

      tableBody.appendChild(detailTr);
    }
  });
}

/* ----------------------------------------------------
   LAO CIRCULAR PROGRESS BADGES & SPOTLIGHT
---------------------------------------------------- */
export function renderLaoCircles(state, onSelectLao) {
  const laoCirclesTrack = document.getElementById("laoCirclesTrack");
  if (!laoCirclesTrack) return;

  const laoList = [
    { id: "ALL", name: "All District", short: "DIST" },
    { id: "SDC Unit-I", name: "SDC Unit-I", short: "SDC-I" },
    { id: "SDC Unit-II", name: "SDC Unit-II", short: "SDC-II" },
    { id: "RDO Miryalaguda", name: "Miryalaguda", short: "MLG" },
    { id: "RDO Nalgonda", name: "Nalgonda", short: "NLG" },
    { id: "PA to SPL Collector", name: "Spl Collector", short: "SPL" },
    { id: "RDO Devarakonda", name: "Devarakonda", short: "DVK" }
  ];

  laoCirclesTrack.innerHTML = "";

  const data = state.rawItems || [];

  // When a specific LAO is clicked, render the Executive Spotlight card
  if (state.activeLao !== "ALL") {
    const selectedLao = laoList.find((l) => l.id === state.activeLao);
    if (selectedLao) {
      const filtered = data.filter((d) => d.lao === selectedLao.id);
      const released = filtered.reduce((acc, d) => acc + (d.releasedCr || 0), 0);
      const disbursed = filtered.reduce((acc, d) => acc + (d.totalDisbursedCr || 0), 0);
      const balance = filtered.reduce((acc, d) => acc + (d.balanceCr || 0), 0);
      const beneficiaries = filtered.reduce((acc, d) => acc + (d.beneficiariesPaid || 0), 0);
      const totalBen = filtered.reduce((acc, d) => acc + (d.totalBeneficiaries || 0), 0);
      const schemesCount = filtered.length;
      const pct = released > 0 ? (disbursed / released) * 100 : 0;

      const spotlight = document.createElement("div");
      spotlight.className = "authority-spotlight-card";
      spotlight.innerHTML = `
        <div class="authority-spotlight-header">
          <div class="authority-title-wrap">
            <div class="authority-emblem-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M4 10l8-7 8 7" />
              </svg>
            </div>
            <div class="authority-spotlight-title">
              <h3>${selectedLao.name}</h3>
              <div class="authority-spotlight-meta">
                <span>🏛️ Authority Sub-Division</span>
                <span>•</span>
                <span>${schemesCount} Schemes Active</span>
                <span>•</span>
                <span style="color: #38bdf8; font-weight: 600;">${pct.toFixed(1)}% Disbursed</span>
              </div>
            </div>
          </div>
          <div>
            <button class="btn btn-secondary btn-sm" id="unhideAllAuthoritiesBtn">
              ← All Authorities
            </button>
          </div>
        </div>

        <div class="authority-metrics-row">
          <div class="authority-metric-cell">
            <span class="label">Total Released</span>
            <span class="val">${formatCr(released)}</span>
            <span class="sub">Treasury Sanctioned</span>
          </div>
          <div class="authority-metric-cell">
            <span class="label">Total Disbursed</span>
            <span class="val" style="color: #34d399;">${formatCr(disbursed)}</span>
            <span class="sub">${pct.toFixed(1)}% completed</span>
          </div>
          <div class="authority-metric-cell">
            <span class="label">Balance to Disburse</span>
            <span class="val" style="color: #fb7185;">${formatCr(balance)}</span>
            <span class="sub">${schemesCount} active schemes</span>
          </div>
          <div class="authority-metric-cell">
            <span class="label">Beneficiaries Paid</span>
            <span class="val" style="color: #38bdf8;">${intFormatter.format(beneficiaries)}</span>
            <span class="sub">of ${intFormatter.format(totalBen)} awardees</span>
          </div>
        </div>

        <div class="compact-lao-switcher">
          <span class="switcher-label">Switch Authority:</span>
        </div>
      `;

      const switcher = spotlight.querySelector(".compact-lao-switcher");
      laoList.forEach((lao) => {
        const chip = document.createElement("button");
        chip.className = `compact-lao-chip ${lao.id === state.activeLao ? 'active' : ''}`;
        chip.textContent = lao.name;
        chip.addEventListener("click", () => {
          if (onSelectLao) onSelectLao(lao.id);
        });
        switcher.appendChild(chip);
      });

      const unhideBtn = spotlight.querySelector("#unhideAllAuthoritiesBtn");
      if (unhideBtn) {
        unhideBtn.addEventListener("click", () => {
          if (onSelectLao) onSelectLao("ALL");
        });
      }

      laoCirclesTrack.appendChild(spotlight);
      return;
    }
  }

  // Default: Render all 7 circular cards
  laoList.forEach((lao) => {
    let released = 0;
    let disbursed = 0;
    let schemesCount = 0;

    if (lao.id === "ALL") {
      released = data.reduce((acc, d) => acc + (d.releasedCr || 0), 0);
      disbursed = data.reduce((acc, d) => acc + (d.totalDisbursedCr || 0), 0);
      schemesCount = data.length;
    } else {
      const filtered = data.filter((d) => d.lao === lao.id);
      released = filtered.reduce((acc, d) => acc + (d.releasedCr || 0), 0);
      disbursed = filtered.reduce((acc, d) => acc + (d.totalDisbursedCr || 0), 0);
      schemesCount = filtered.length;
    }

    const pct = released > 0 ? (disbursed / released) * 100 : 0;
    const isSelected = state.activeLao === lao.id;

    let ringColor = "#f43f5e";
    if (pct >= 60) ringColor = "#10b981";
    else if (pct >= 30) ringColor = "#38bdf8";

    const card = document.createElement("div");
    card.className = `lao-circle-card ${isSelected ? 'active' : ''}`;
    card.dataset.lao = lao.id;
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${lao.name}: ${schemesCount} schemes, ${pct.toFixed(0)}% disbursed`);
    card.title = `Click to filter: ${lao.name} (${pct.toFixed(1)}% disbursed)`;

    card.innerHTML = `
      <span class="lao-active-pill"></span>
      <div class="lao-ring-wrapper">
        <svg viewBox="0 0 36 36">
          <path class="lao-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          <path class="lao-ring-fill" stroke="${ringColor}" stroke-dasharray="${Math.min(100, Math.max(0, pct)).toFixed(1)}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        </svg>
        <div class="lao-ring-inner">
          <span class="lao-ring-pct">${pct.toFixed(0)}%</span>
          <span class="lao-ring-sub">${lao.short}</span>
        </div>
      </div>
      <div class="lao-circle-name">${lao.name}</div>
      <div class="lao-circle-amount">${formatCr(disbursed)}</div>
      <div class="lao-circle-stat">${schemesCount} Schemes</div>
    `;

    card.addEventListener("click", () => {
      if (onSelectLao) onSelectLao(lao.id);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (onSelectLao) onSelectLao(lao.id);
      }
    });

    laoCirclesTrack.appendChild(card);
  });
}

/* ----------------------------------------------------
   PROJECT CIRCLES TRACK (DRILLDOWN UNDER SELECTED LAO)
---------------------------------------------------- */
export function renderProjectCircles(state, onSelectProject, onSendWhatsApp) {
  const panel = document.getElementById("projectDrilldownPanel");
  const track = document.getElementById("projectCirclesTrack");
  const title = document.getElementById("projectDrilldownTitleText");
  const badge = document.getElementById("projectCountBadge");

  if (!panel || !track) return;

  if (state.activeLao === "ALL") {
    panel.style.display = "none";
    return;
  }

  const projects = state.rawItems.filter((d) => d.lao === state.activeLao);
  if (projects.length === 0) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "flex";
  if (title) title.textContent = `${state.activeLao} Projects`;
  if (badge) badge.textContent = `${projects.length} Schemes`;

  track.innerHTML = "";

  // Spotlight card if a single project is active
  if (state.activeProject !== "ALL") {
    const proj = projects.find((p) => String(p.slNo) === String(state.activeProject));
    if (proj) {
      const rel = proj.releasedCr || 0;
      const dis = proj.totalDisbursedCr || 0;
      const bal = proj.balanceCr || 0;
      const pct = rel > 0 ? (dis / rel) * 100 : 0;

      const spotlight = document.createElement("div");
      spotlight.className = "scheme-spotlight-card";
      spotlight.innerHTML = `
        <div class="scheme-spotlight-header">
          <div class="scheme-title-wrap">
            <span class="scheme-sl-badge">#${proj.slNo}</span>
            <div class="scheme-title-text">
              <h3>${proj.project}</h3>
              <div class="scheme-meta-row">
                <span class="meta-item">🏢 ${proj.lao}</span>
                <span class="meta-item">•</span>
                <span class="meta-item">DTO: ${proj.dtoToken || 'N/A'}</span>
                <span class="meta-item">•</span>
                <span class="status-badge ${proj.status.includes('Completed') ? 'status-completed' : 'status-in-progress'}">${proj.status}</span>
              </div>
            </div>
          </div>
          <div class="scheme-actions">
            <button class="btn btn-whatsapp btn-sm wa-scheme-share-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.456h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Share Scheme
            </button>
            <button class="btn btn-secondary btn-sm" id="closeSchemeSpotlightBtn">
              ✕ All ${projects.length} Schemes
            </button>
          </div>
        </div>

        <div class="scheme-metrics-strip">
          <div class="scheme-metric-col">
            <span class="sub">Disbursed</span>
            <span class="big" style="color: #34d399;">${formatCr(dis)}</span>
            <span class="sub">${pct.toFixed(1)}% of ${formatCr(rel)}</span>
          </div>
          <div class="scheme-metric-col">
            <span class="sub">Balance to Pay</span>
            <span class="big" style="color: ${bal > 0 ? '#fb7185' : 'var(--text-muted)'};">${formatCr(bal)}</span>
            <span class="sub">${proj.balanceBeneficiaries} awardees remaining</span>
          </div>
          <div class="scheme-metric-col">
            <span class="sub">Beneficiaries</span>
            <span class="big" style="color: #38bdf8;">${intFormatter.format(proj.beneficiariesPaid)}</span>
            <span class="sub">of ${intFormatter.format(proj.totalBeneficiaries)} awardees</span>
          </div>
          <div class="scheme-metric-col">
            <span class="sub">Acquisition Extent</span>
            <span class="big" style="color: #818cf8;">${proj.paymentCompletedExtentAc.toFixed(2)} Ac</span>
            <span class="sub">of ${proj.totalExtentAc.toFixed(2)} Total Acres</span>
          </div>
        </div>

        <div class="scheme-pills-strip">
          <span class="pills-label">Switch Scheme:</span>
        </div>
      `;

      const pillsStrip = spotlight.querySelector(".scheme-pills-strip");
      projects.forEach((p) => {
        const chip = document.createElement("button");
        chip.className = `scheme-nav-chip ${String(p.slNo) === String(state.activeProject) ? 'active' : ''}`;
        chip.textContent = `#${p.slNo} ${p.project.length > 20 ? p.project.substring(0, 20) + '...' : p.project}`;
        chip.title = p.project;
        chip.addEventListener("click", () => {
          if (onSelectProject) onSelectProject(p.slNo);
        });
        pillsStrip.appendChild(chip);
      });

      const closeBtn = spotlight.querySelector("#closeSchemeSpotlightBtn");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          if (onSelectProject) onSelectProject("ALL");
        });
      }

      const waBtn = spotlight.querySelector(".wa-scheme-share-btn");
      if (waBtn && onSendWhatsApp) {
        waBtn.addEventListener("click", () => onSendWhatsApp(proj));
      }

      track.appendChild(spotlight);
      return;
    }
  }

  // Card 0: "All Schemes in Authority" Card
  const allCard = document.createElement("div");
  allCard.className = `project-circle-card ${state.activeProject === 'ALL' ? 'active' : ''}`;
  allCard.dataset.projectSl = "ALL";

  const laoTotalRel = projects.reduce((acc, d) => acc + (d.releasedCr || 0), 0);
  const laoTotalDis = projects.reduce((acc, d) => acc + (d.totalDisbursedCr || 0), 0);
  const laoPct = laoTotalRel > 0 ? (laoTotalDis / laoTotalRel) * 100 : 0;

  allCard.innerHTML = `
    <span class="project-active-pill"></span>
    <div class="project-ring-wrapper">
      <svg viewBox="0 0 36 36">
        <path class="project-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        <path class="project-ring-fill" stroke="#38bdf8" stroke-dasharray="${Math.min(100, Math.max(0, laoPct)).toFixed(1)}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
      </svg>
      <div class="project-ring-inner">
        <span class="project-ring-pct">${laoPct.toFixed(0)}%</span>
        <span class="project-ring-sl">ALL</span>
      </div>
    </div>
    <div class="project-circle-name">All ${projects.length} Schemes</div>
    <div class="project-circle-amount">${formatCr(laoTotalDis)}</div>
    <div class="project-circle-stat">Authority Total</div>
  `;

  allCard.addEventListener("click", () => {
    if (onSelectProject) onSelectProject("ALL");
  });
  track.appendChild(allCard);

  // Individual Project Cards
  projects.forEach((proj) => {
    const rel = proj.releasedCr || 0;
    const dis = proj.totalDisbursedCr || 0;
    const pct = rel > 0 ? (dis / rel) * 100 : 0;
    const isSelected = String(state.activeProject) === String(proj.slNo);

    let strokeColor = "#f43f5e";
    if (pct >= 60) strokeColor = "#10b981";
    else if (pct >= 30) strokeColor = "#38bdf8";

    const card = document.createElement("div");
    card.className = `project-circle-card ${isSelected ? 'active' : ''}`;
    card.dataset.projectSl = proj.slNo;

    card.innerHTML = `
      <span class="project-active-pill"></span>
      <div class="project-ring-wrapper">
        <svg viewBox="0 0 36 36">
          <path class="project-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          <path class="project-ring-fill" stroke="${strokeColor}" stroke-dasharray="${Math.min(100, Math.max(0, pct)).toFixed(1)}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        </svg>
        <div class="project-ring-inner">
          <span class="project-ring-pct">${pct.toFixed(0)}%</span>
          <span class="project-ring-sl">#${proj.slNo}</span>
        </div>
      </div>
      <div class="project-circle-name" title="${proj.project}">${proj.project}</div>
      <div class="project-circle-amount">${formatCr(dis)}</div>
      <div class="project-circle-stat">${proj.paymentCompletedExtentAc.toFixed(0)} Ac • ${intFormatter.format(proj.beneficiariesPaid)} Ben.</div>
    `;

    card.addEventListener("click", () => {
      if (onSelectProject) {
        onSelectProject(String(state.activeProject) === String(proj.slNo) ? "ALL" : proj.slNo);
      }
    });

    track.appendChild(card);
  });
}

/* ----------------------------------------------------
   EXECUTIVE KPI CARDS
---------------------------------------------------- */
export function renderKPICards(state) {
  const data = getFilteredItems(state);
  const isSingleProject = state.activeProject !== "ALL" && data.length === 1;

  const totalReleased = data.reduce((acc, d) => acc + (d.releasedCr || 0), 0);
  const totalDisbursed = data.reduce((acc, d) => acc + (d.totalDisbursedCr || 0), 0);
  const totalDisbursedToday = data.reduce((acc, d) => acc + (d.disbursedTodayCr || 0), 0);
  const totalBalance = data.reduce((acc, d) => acc + (d.balanceCr || 0), 0);

  const totalBeneficiaries = data.reduce((acc, d) => acc + (d.totalBeneficiaries || 0), 0);
  const paidBeneficiaries = data.reduce((acc, d) => acc + (d.beneficiariesPaid || 0), 0);
  const pendingBeneficiaries = data.reduce((acc, d) => acc + (d.balanceBeneficiaries || 0), 0);

  const totalExtent = data.reduce((acc, d) => acc + (d.totalExtentAc || 0), 0);
  const completedExtent = data.reduce((acc, d) => acc + (d.paymentCompletedExtentAc || 0), 0);
  const balanceExtent = data.reduce((acc, d) => acc + (d.balanceExtentAc || 0), 0);

  const completedUnits = data.filter((d) => (d.status || "").toLowerCase().includes("completed")).length;
  const activeUnits = data.length - completedUnits;

  const fundsPct = totalReleased > 0 ? (totalDisbursed / totalReleased) * 100 : 0;
  const benPct = totalBeneficiaries > 0 ? (paidBeneficiaries / totalBeneficiaries) * 100 : 0;
  const extPct = totalExtent > 0 ? (completedExtent / totalExtent) * 100 : 0;

  // Card 1: Funds
  const kpi1Title = document.getElementById("kpi1Title");
  const kpi1Unit = document.getElementById("kpi1Unit");
  if (kpi1Title) kpi1Title.textContent = isSingleProject ? "Project Funds Disbursed" : "Disbursement Progress";
  if (kpi1Unit) kpi1Unit.textContent = isSingleProject ? "Disbursed So Far" : "Cr Disbursed";

  const kpiDisbursedCr = document.getElementById("kpiDisbursedCr");
  if (kpiDisbursedCr) kpiDisbursedCr.textContent = formatCr(totalDisbursed);

  const kpiReleasedCr = document.getElementById("kpiReleasedCr");
  if (kpiReleasedCr) kpiReleasedCr.textContent = `${formatCr(totalReleased)} Cr`;

  const kpiBalanceCr = document.getElementById("kpiBalanceCr");
  if (kpiBalanceCr) kpiBalanceCr.textContent = `${formatCr(totalBalance)} Cr`;

  const kpiDisbursedTodayCr = document.getElementById("kpiDisbursedTodayCr");
  if (kpiDisbursedTodayCr) kpiDisbursedTodayCr.textContent = `${formatCr(totalDisbursedToday)} Cr`;

  const fundsPctEl = document.getElementById("fundsPct");
  if (fundsPctEl) fundsPctEl.textContent = `${fundsPct.toFixed(1)}%`;
  setRadialGauge("fundsGaugeBar", fundsPct);

  // Card 2: Beneficiaries
  const kpi2Title = document.getElementById("kpi2Title");
  const kpi2Unit = document.getElementById("kpi2Unit");
  if (kpi2Title) kpi2Title.textContent = isSingleProject ? "Project Beneficiaries" : "Beneficiaries Reached";
  if (kpi2Unit) kpi2Unit.textContent = isSingleProject ? `of ${totalBeneficiaries} Awardees` : "Awardees Paid";

  const kpiPaidBen = document.getElementById("kpiPaidBeneficiaries");
  if (kpiPaidBen) kpiPaidBen.textContent = intFormatter.format(paidBeneficiaries);

  const kpiTotalBen = document.getElementById("kpiTotalBeneficiaries");
  if (kpiTotalBen) kpiTotalBen.textContent = intFormatter.format(totalBeneficiaries);

  const kpiPendingBen = document.getElementById("kpiPendingBeneficiaries");
  if (kpiPendingBen) kpiPendingBen.textContent = intFormatter.format(pendingBeneficiaries);

  const benPctEl = document.getElementById("beneficiaryPct");
  if (benPctEl) benPctEl.textContent = `${benPct.toFixed(1)}%`;
  setRadialGauge("beneficiaryGaugeBar", benPct);

  // Card 3: Extent
  const kpi3Title = document.getElementById("kpi3Title");
  const kpi3Unit = document.getElementById("kpi3Unit");
  if (kpi3Title) kpi3Title.textContent = isSingleProject ? "Acquisition Area Cleared" : "Land Extent Secured";
  if (kpi3Unit) kpi3Unit.textContent = isSingleProject ? `of ${totalExtent.toFixed(2)} Acres` : "Acres Cleared";

  const kpiCompExt = document.getElementById("kpiCompletedExtentAc");
  if (kpiCompExt) kpiCompExt.textContent = inrFormatter.format(completedExtent);

  const kpiTotExt = document.getElementById("kpiTotalExtentAc");
  if (kpiTotExt) kpiTotExt.textContent = `${inrFormatter.format(totalExtent)} Ac`;

  const kpiBalExt = document.getElementById("kpiBalanceExtentAc");
  if (kpiBalExt) kpiBalExt.textContent = `${inrFormatter.format(balanceExtent)} Ac`;

  const extPctEl = document.getElementById("extentPct");
  if (extPctEl) extPctEl.textContent = `${extPct.toFixed(1)}%`;
  setRadialGauge("extentGaugeBar", extPct);

  // Card 4: Project Units
  const kpi4Title = document.getElementById("kpi4Title");
  const kpi4Unit = document.getElementById("kpi4Unit");
  const kpiTotProj = document.getElementById("kpiTotalProjects");

  if (isSingleProject) {
    if (kpi4Title) kpi4Title.textContent = "Scheme Status";
    if (kpi4Unit) kpi4Unit.textContent = "Current Status";
    if (kpiTotProj) kpiTotProj.textContent = data[0].status || "In Progress";
  } else if (state.activeLao !== "ALL") {
    if (kpi4Title) kpi4Title.textContent = `${state.activeLao} Schemes`;
    if (kpi4Unit) kpi4Unit.textContent = "Schemes in Office";
    if (kpiTotProj) kpiTotProj.textContent = data.length;
  } else {
    if (kpi4Title) kpi4Title.textContent = "Project Schemes";
    if (kpi4Unit) kpi4Unit.textContent = "Active Sub-Entries";
    if (kpiTotProj) kpiTotProj.textContent = data.length;
  }

  const kpiCompUnits = document.getElementById("kpiCompletedUnits");
  if (kpiCompUnits) kpiCompUnits.textContent = `${completedUnits} Completed`;

  const kpiActiveUnits = document.getElementById("kpiActiveUnits");
  if (kpiActiveUnits) kpiActiveUnits.textContent = `${activeUnits} Schemes`;

  const projPctEl = document.getElementById("projectPct");
  if (projPctEl) projPctEl.textContent = state.activeLao === "ALL" ? "6 LAOs" : `${data.length} Units`;
  setRadialGauge("projectGaugeBar", data.length > 0 ? (completedUnits / data.length) * 100 : 0);
}

function setRadialGauge(id, percentage) {
  const el = document.getElementById(id);
  if (!el) return;
  const clamped = Math.max(0, Math.min(100, percentage || 0));
  el.setAttribute("stroke-dasharray", `${clamped.toFixed(2)}, 100`);
}

/* ----------------------------------------------------
   ACTIVE SCOPE BANNER
---------------------------------------------------- */
export function renderScopeBanner(state, options = {}) {
  const banner = document.getElementById("activeScopeBanner");
  const scopeLevel = document.getElementById("scopeLevel");
  const scopeTitle = document.getElementById("scopeTitle");
  const scopeBadge = document.getElementById("scopeBadge");
  const resetScopeBtn = document.getElementById("resetScopeBtn");
  const resetProjectScopeBtn = document.getElementById("resetProjectScopeBtn");
  const scopeShareWhatsAppBtn = document.getElementById("scopeShareWhatsAppBtn");

  if (!banner) return;

  if (state.activeLao === "ALL") {
    if (scopeLevel) scopeLevel.textContent = "DISTRICT VIEW";
    if (scopeTitle) scopeTitle.textContent = "Whole District Overview (All Authorities & Schemes)";
    if (scopeBadge) {
      scopeBadge.textContent = "District Aggregated";
      scopeBadge.style.background = "rgba(16, 185, 129, 0.15)";
      scopeBadge.style.color = "#34d399";
      scopeBadge.style.borderColor = "rgba(16, 185, 129, 0.35)";
    }
    if (resetScopeBtn) resetScopeBtn.style.display = "none";
    if (resetProjectScopeBtn) resetProjectScopeBtn.style.display = "none";
    if (scopeShareWhatsAppBtn) scopeShareWhatsAppBtn.style.display = "none";
  } else if (state.activeProject === "ALL") {
    const laoSchemes = state.rawItems.filter((d) => d.lao === state.activeLao);
    if (scopeLevel) scopeLevel.textContent = "AUTHORITY SCOPE";
    if (scopeTitle) scopeTitle.textContent = `${state.activeLao} (All ${laoSchemes.length} Schemes)`;
    if (scopeBadge) {
      scopeBadge.textContent = `${laoSchemes.length} Schemes Active`;
      scopeBadge.style.background = "rgba(56, 189, 248, 0.15)";
      scopeBadge.style.color = "#38bdf8";
      scopeBadge.style.borderColor = "rgba(56, 189, 248, 0.35)";
    }
    if (resetScopeBtn) {
      resetScopeBtn.style.display = "inline-flex";
      resetScopeBtn.onclick = () => { if (options.onResetDistrict) options.onResetDistrict(); };
    }
    if (resetProjectScopeBtn) resetProjectScopeBtn.style.display = "none";
    if (scopeShareWhatsAppBtn) scopeShareWhatsAppBtn.style.display = "none";
  } else {
    const proj = state.rawItems.find((d) => String(d.slNo) === String(state.activeProject));
    if (proj) {
      const pct = proj.releasedCr > 0 ? (proj.totalDisbursedCr / proj.releasedCr) * 100 : 0;
      if (scopeLevel) scopeLevel.textContent = `${state.activeLao} › SCHEME #${proj.slNo}`;
      if (scopeTitle) scopeTitle.textContent = proj.project;
      if (scopeBadge) {
        scopeBadge.textContent = `${pct.toFixed(1)}% Disbursed • ${proj.status || 'Active'}`;
        scopeBadge.style.background = pct >= 60 ? "rgba(16, 185, 129, 0.15)" : "rgba(251, 191, 36, 0.15)";
        scopeBadge.style.color = pct >= 60 ? "#34d399" : "#fbbf24";
        scopeBadge.style.borderColor = pct >= 60 ? "rgba(16, 185, 129, 0.35)" : "rgba(251, 191, 36, 0.35)";
      }
      if (scopeShareWhatsAppBtn) {
        scopeShareWhatsAppBtn.style.display = "inline-flex";
        scopeShareWhatsAppBtn.onclick = () => { if (options.onSendWhatsApp) options.onSendWhatsApp(proj); };
      }
    }
    if (resetScopeBtn) {
      resetScopeBtn.style.display = "inline-flex";
      resetScopeBtn.onclick = () => { if (options.onResetDistrict) options.onResetDistrict(); };
    }
    if (resetProjectScopeBtn) {
      resetProjectScopeBtn.style.display = "inline-flex";
      resetProjectScopeBtn.onclick = () => { if (options.onResetAuthority) options.onResetAuthority(); };
    }
  }
}

/* ----------------------------------------------------
   SIDEBAR LAO NAV LIST
---------------------------------------------------- */
export function renderSidebarLaoNav(state, onSelectLao) {
  const container = document.getElementById("sidebarLaoNav");
  if (!container) return;
  container.innerHTML = "";

  const laoList = [
    { id: "ALL", name: "All Authorities", short: "DIST" },
    { id: "SDC Unit-I", name: "SDC Unit-I", short: "SDC-I" },
    { id: "SDC Unit-II", name: "SDC Unit-II", short: "SDC-II" },
    { id: "RDO Miryalaguda", name: "RDO Miryalaguda", short: "MLG" },
    { id: "RDO Nalgonda", name: "RDO Nalgonda", short: "NLG" },
    { id: "PA to SPL Collector", name: "PA to Spl Collector", short: "SPL" },
    { id: "RDO Devarakonda", name: "RDO Devarakonda", short: "DVK" }
  ];

  laoList.forEach((lao) => {
    const btn = document.createElement("button");
    const isActive = state.activeLao === lao.id;
    btn.className = `sidebar-sub-item ${isActive ? 'active' : ''}`;

    let count = 0;
    if (lao.id === "ALL") {
      count = state.rawItems.length;
    } else {
      count = state.rawItems.filter((d) => d.lao === lao.id).length;
    }

    btn.innerHTML = `
      <span class="sub-item-text">${lao.name}</span>
      <span class="sub-item-badge">${count}</span>
    `;

    btn.addEventListener("click", () => {
      if (onSelectLao) onSelectLao(lao.id);
    });

    container.appendChild(btn);
  });
}

/* ----------------------------------------------------
   BOTTLENECKS & CRITICAL PRIORITIES
---------------------------------------------------- */
export function renderBottleneckGrid(state, onWhatsAppShare) {
  const container = document.getElementById("bottleneckGrid");
  if (!container) return;
  container.innerHTML = "";

  const highlights = BOTTLENECK_HIGHLIGHTS;

  const filtered = highlights.filter((item) => {
    if (state.activeLao !== "ALL" && item.lao !== state.activeLao && !item.lao.includes(state.activeLao)) {
      return false;
    }
    return true;
  });

  const displayList = state.activeLao !== "ALL" ? filtered : highlights;

  if (displayList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        No active high-priority obstacles flagged for this selection.
      </div>
    `;
    return;
  }

  displayList.forEach((item) => {
    const card = document.createElement("div");
    card.className = `bottleneck-card ${item.urgency}`;
    card.innerHTML = `
      <div>
        <div class="bottleneck-top">
          <div class="bottleneck-header">
            <h4>${item.title}</h4>
            <div class="bottleneck-lao">${item.lao}</div>
          </div>
          <span class="urgency-badge ${item.urgency}">${item.urgency.toUpperCase()}</span>
        </div>
        <div class="bottleneck-metrics" style="margin-top: 0.6rem;">
          <span>Blocked: <strong>${item.amount}</strong></span>
          <span>Extent: <strong>${item.extent}</strong></span>
          <span>Target: <strong>${item.beneficiaries}</strong></span>
        </div>
        <p class="bottleneck-desc" style="margin-top: 0.6rem;">${item.description}</p>
      </div>
      <div class="bottleneck-action" style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-top: 0.75rem;">
        <div style="flex: 1;"><strong>Key Action:</strong> ${item.actionItem}</div>
        <button class="btn-whatsapp-sm wa-bottleneck-btn" style="flex-shrink: 0;" title="Share bottleneck alert on WhatsApp">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.456h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          <span>Share</span>
        </button>
      </div>
    `;

    const btn = card.querySelector(".wa-bottleneck-btn");
    if (btn && onWhatsAppShare) {
      btn.addEventListener("click", () => onWhatsAppShare(item));
    }

    container.appendChild(card);
  });
}

/* ----------------------------------------------------
   WHAT-IF SCENARIO SIMULATOR (REACTIVE RESTORATION)
---------------------------------------------------- */
export function renderWhatIfSimulator(state, onToggleScenario) {
  const panel = document.getElementById("view-simulator");
  if (!panel) return;

  const { chinthapally, pendlipakala, miryalaguda } = state.simulatorScenarios;
  const sim = calculateSimulation(state);

  const chkChinthapally = document.getElementById("simChinthapally");
  const chkPendlipakala = document.getElementById("simPendlipakala");
  const chkMiryalaguda = document.getElementById("simMiryalaguda");

  if (chkChinthapally) chkChinthapally.checked = !!chinthapally;
  if (chkPendlipakala) chkPendlipakala.checked = !!pendlipakala;
  if (chkMiryalaguda) chkMiryalaguda.checked = !!miryalaguda;

  const simPct = document.getElementById("simPct");
  const simDisbursed = document.getElementById("simDisbursed");
  const simClearedBen = document.getElementById("simClearedBeneficiaries");
  const simClearedExt = document.getElementById("simClearedExtent");
  const simBanner = document.getElementById("simResultsBanner");

  if (simPct) simPct.textContent = `${sim.simulatedPct.toFixed(1)}%`;
  if (simDisbursed) simDisbursed.textContent = formatCr(sim.simulatedDisbursed);
  if (simClearedBen) simClearedBen.textContent = `+${intFormatter.format(sim.additionalBeneficiaries)}`;
  if (simClearedExt) simClearedExt.textContent = `+${inrFormatter.format(sim.additionalExtent)} Ac`;

  if (simBanner) {
    if (sim.additionalDisbursed > 0) {
      simBanner.style.background = "rgba(16, 185, 129, 0.22)";
      simBanner.style.borderColor = "#10b981";
    } else {
      simBanner.style.background = "rgba(16, 185, 129, 0.08)";
      simBanner.style.borderColor = "rgba(16, 185, 129, 0.25)";
    }
  }
}
