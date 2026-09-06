/**
 * Application Logic for Land Acquisition Payment Disbursement Dashboard
 * Nalgonda District Collectorate
 * 
 * Features:
 * - Direct Client-Side Auto-Sync with Google Sheets (gviz public API)
 * - Auto-detects newest daily tab and supports historical sheet selection
 * - 100% Column Fidelity with dynamic header mapping
 * - Interactive Chart.js charts & SVG radial progress gauges
 * - Instant filtering, searching, column sorting, and CSV export
 */

document.addEventListener("DOMContentLoaded", () => {
  const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/1XAJwRAT1jI4TRYiDVjsAtGTkWZJYfeYP8hHtaTxfGe0/gviz/tq?tqx=out:csv";

  let activeLao = "ALL";
  let activeProject = "ALL";
  let activeStatus = "ALL";
  let searchQuery = "";
  let bottleneckOnly = false;
  let highExtentOnly = false;
  let sortField = "slNo";
  let sortAsc = true;
  let expandedRows = new Set();
  let currentTab = "overview";

  let laoChart = null;
  let bottleneckChart = null;
  let currentItems = typeof LA_DATA !== "undefined" ? [...LA_DATA] : [];
  
  const knownSheets = [
    "Daily Report 06.09.2026",
    "Daily Report 05.09.2026",
    "Daily Report 04.09.2026",
    "Daily Report 03.09.2026",
    "Daily Report 02.09.2026",
    "Daily report 01.09.2026",
    "Daily report 29.08.2026 2",
    "Daily report 28.08.2026",
    "Daily report 27.08.2026",
    "Daily report 26.08.2026",
    "Daily report 24.08.2026",
    "Daily report 22.08.2026",
    "Daily report 21.08.2026",
    "Daily report 20.08.2026",
    "Daily report 19.08.2026"
  ];

  let currentSelectedSheet = knownSheets[0];
  let isSyncing = false;
  let autoSyncTimer = null;

  // DOM Elements
  const laoCirclesTrack = document.getElementById("laoCirclesTrack");
  const projectDrilldownPanel = document.getElementById("projectDrilldownPanel");
  const projectDrilldownTitleText = document.getElementById("projectDrilldownTitleText");
  const projectCountBadge = document.getElementById("projectCountBadge");
  const closeProjectDrilldownBtn = document.getElementById("closeProjectDrilldownBtn");
  const projectCirclesTrack = document.getElementById("projectCirclesTrack");

  // Active Scope Banner Elements
  const activeScopeBanner = document.getElementById("activeScopeBanner");
  const scopeIcon = document.getElementById("scopeIcon");
  const scopeLevel = document.getElementById("scopeLevel");
  const scopeTitle = document.getElementById("scopeTitle");
  const scopeBadge = document.getElementById("scopeBadge");
  const resetScopeBtn = document.getElementById("resetScopeBtn");
  const resetProjectScopeBtn = document.getElementById("resetProjectScopeBtn");
  const scopeShareWhatsAppBtn = document.getElementById("scopeShareWhatsAppBtn");

  const sheetSelect = document.getElementById("sheetSelect");
  const laoFilter = document.getElementById("laoFilter");
  const statusFilter = document.getElementById("statusFilter");
  const searchInput = document.getElementById("searchInput");
  const bottleneckFilterChip = document.getElementById("bottleneckFilterChip");
  const highExtentFilterChip = document.getElementById("highExtentFilterChip");
  const tableBody = document.getElementById("tableBody");
  const tableRecordCount = document.getElementById("tableRecordCount");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const themeToggleBtn = document.getElementById("themeToggleBtn");

  // Sync Elements
  const manualSyncBtn = document.getElementById("manualSyncBtn");
  const syncIcon = document.getElementById("syncIcon");
  const syncBtnText = document.getElementById("syncBtnText");
  const lastSyncedTime = document.getElementById("lastSyncedTime");
  const syncToast = document.getElementById("syncToast");
  const toastMessage = document.getElementById("toastMessage");

  // Initialize
  initTheme();
  initSheetDropdown();
  renderLaoCircles(currentItems);
  renderSidebarLaoNav();
  renderProjectCircles(activeLao, currentItems);
  updateScopeBannerUI();
  renderBottleneckGrid();
  initCharts();
  applyFilters();
  switchDashboardTab(currentTab);
  setupEventListeners();

  // Fetch live from Google Sheets immediately & schedule every 30s
  fetchGoogleSheetData(true, currentSelectedSheet);
  startAutoSync(30000);

  /* ----------------------------------------------------
     CSV PARSER (RFC 4180 COMPLIANT FOR GOOGLE SHEETS)
  ---------------------------------------------------- */
  function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentVal = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentVal += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentVal.trim());
        if (currentRow.some(c => c !== '')) rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    if (currentVal || currentRow.length > 0) {
      currentRow.push(currentVal.trim());
      if (currentRow.some(c => c !== '')) rows.push(currentRow);
    }
    return rows;
  }

  function cleanNum(val) {
    if (!val) return 0.0;
    const str = String(val).replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0.0 : num;
  }

  function cleanInt(val) {
    if (!val) return 0;
    const str = String(val).replace(/,/g, '').trim();
    const num = parseInt(str, 10);
    return isNaN(num) ? 0 : num;
  }

  /* ----------------------------------------------------
     DYNAMIC SEMANTIC HEADER MAPPING (CLIENT-SIDE)
  ---------------------------------------------------- */
  function buildDynamicColumnMapping(headerRow) {
    const mapping = {};
    headerRow.forEach((val, idx) => {
      const text = (val || '').toLowerCase().trim();
      if (!text) return;

      if (text.includes('sl') && text.includes('no') && !mapping.sl_no) {
        mapping.sl_no = idx;
      } else if (text.includes('lao') && !mapping.lao) {
        mapping.lao = idx;
      } else if (text.includes('project') && !mapping.project) {
        mapping.project = idx;
      } else if ((text.includes('dto') || text.includes('token')) && !mapping.dto_token) {
        mapping.dto_token = idx;
      } else if (text.includes('credit') && text.includes('date') && !mapping.credit_date) {
        mapping.credit_date = idx;
      } else if ((text.includes('amount released') || text.includes('released in crores')) && !mapping.released_cr) {
        mapping.released_cr = idx;
      } else if (text.includes('yesterday') && !mapping.disbursed_yesterday) {
        mapping.disbursed_yesterday = idx;
      } else if ((text.includes('to day') || text.includes('today')) && !mapping.disbursed_today) {
        mapping.disbursed_today = idx;
      } else if ((text.includes('total amount disbursed') || text.includes('disbursed so far')) && !mapping.total_disbursed) {
        mapping.total_disbursed = idx;
      } else if ((text.includes('balance to be disbursed') || (text.startsWith('balance') && text.includes('cr'))) && !mapping.balance_cr) {
        mapping.balance_cr = idx;
      } else if ((text.includes('benefic') || text.includes('awardees')) && (text.includes('total') || text.includes('covered')) && !mapping.total_ben) {
        mapping.total_ben = idx;
      } else if ((text.includes('benefic') || text.includes('awardees')) && text.includes('paid') && !text.includes('balance') && !mapping.paid_ben) {
        mapping.paid_ben = idx;
      } else if ((text.includes('benefic') || text.includes('awardees')) && text.includes('balance') && !mapping.balance_ben) {
        mapping.balance_ben = idx;
      } else if (text.includes('extent') && (text.includes('total') || text.includes('covered')) && !text.includes('post') && !mapping.total_extent) {
        mapping.total_extent = idx;
      } else if (text.includes('extent') && (text.includes('payment completed') || text.includes('completed for extent')) && !text.includes('post') && !mapping.completed_extent) {
        mapping.completed_extent = idx;
      } else if (text.includes('extent') && text.includes('balance') && !text.includes('post') && !mapping.balance_extent) {
        mapping.balance_extent = idx;
      } else if ((text.includes('payment completed or not') || text === 'status') && !mapping.status) {
        mapping.status = idx;
      } else if (text.includes('possession') && !mapping.possession) {
        mapping.possession = idx;
      } else if (text.includes('post award') && text.includes('completed') && !mapping.post_award_comp) {
        mapping.post_award_comp = idx;
      } else if (text.includes('post award') && text.includes('balance') && !mapping.post_award_bal) {
        mapping.post_award_bal = idx;
      } else if (text.includes('remarks') && !mapping.remarks) {
        mapping.remarks = idx;
      }
    });

    if (mapping.post_award_comp !== undefined && mapping.post_award_bal === undefined) {
      mapping.post_award_bal = mapping.post_award_comp + 1;
    }

    return mapping;
  }

  /* ----------------------------------------------------
     DIRECT GOOGLE SHEET SYNC (NO SERVER REQUIRED)
  ---------------------------------------------------- */
  async function fetchGoogleSheetData(isInitial = false, sheetName = null) {
    if (isSyncing) return;
    isSyncing = true;

    if (syncIcon) syncIcon.classList.add("spinning");
    if (syncBtnText) syncBtnText.textContent = "Syncing...";

    try {
      // First try local server if running, otherwise use Google Sheets directly
      let url = `${SHEET_BASE_URL}&sheet=${encodeURIComponent(sheetName || currentSelectedSheet)}`;
      
      let text = '';
      try {
        const localResp = await fetch(`/api/sync?sheet=${encodeURIComponent(sheetName || currentSelectedSheet)}`, { cache: 'no-store' });
        if (localResp.ok) {
          const json = await localResp.json();
          if (json && json.items && json.items.length > 0) {
            handleParsedData(json.items, json.asOnDate, sheetName || currentSelectedSheet, isInitial);
            return;
          }
        }
      } catch (e) {
        // Fallback to direct Google Sheets fetch
      }

      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Google Sheets responded with status ${response.status}`);
      text = await response.text();

      const rawRows = parseCSV(text);
      if (!rawRows || rawRows.length < 2) {
        throw new Error("Empty data received from Google Sheets");
      }

      // Extract title as on date
      let asOnDate = "06.09.2026";
      const titleLine = rawRows[0].join(" ");
      const dateMatch = titleLine.match(/as on\s+([0-9]{1,2}[\.\-\/][0-9]{1,2}[\.\-\/][0-9]{2,4})/i);
      if (dateMatch) {
        asOnDate = dateMatch[1];
      }

      // Build column mapping from header row
      const headerRow = rawRows[0];
      const colMap = buildDynamicColumnMapping(headerRow);

      const items = [];
      let currentLao = "SDC Unit-I";
      let currentProj = "";

      const slIdx = colMap.sl_no !== undefined ? colMap.sl_no : 0;
      const laoIdx = colMap.lao !== undefined ? colMap.lao : 1;
      const projIdx = colMap.project !== undefined ? colMap.project : 2;

      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        const col0 = (row[slIdx] || '').replace('.0', '').trim();
        const col1 = (row[laoIdx] || '').replace('.0', '').trim();

        // Skip index numbering row: 1, 2, 3...
        if (col0 === '1' && col1 === '2') continue;
        if (row.join(' ').toLowerCase().includes('grand total')) continue;

        if (/^\d+$/.test(col0) && parseInt(col0, 10) > 0) {
          const slNo = parseInt(col0, 10);
          const rawLao = (row[laoIdx] || '').trim();
          if (rawLao && !/^\d+$/.test(rawLao.replace('.0', ''))) {
            currentLao = rawLao.replace(/\s+/g, ' ');
          }

          const rawProj = (row[projIdx] || '').trim();
          if (rawProj && !/^\d+$/.test(rawProj.replace('.0', ''))) {
            currentProj = rawProj.replace(/\s+/g, ' ');
          }
          const projName = rawProj && !/^\d+$/.test(rawProj.replace('.0', '')) ? rawProj : currentProj;

          const dtoToken = (row[colMap.dto_token] || '').replace(/\s+/g, ' ');
          const creditDate = (row[colMap.credit_date] || '').trim();

          const releasedCr = cleanNum(row[colMap.released_cr]);
          const disbYest = cleanNum(row[colMap.disbursed_yesterday]);
          const disbToday = cleanNum(row[colMap.disbursed_today]);
          let disbTot = cleanNum(row[colMap.total_disbursed]);
          const balCr = cleanNum(row[colMap.balance_cr]);

          if (disbTot === 0.0 && (disbYest > 0 || disbToday > 0)) {
            disbTot = disbYest + disbToday;
          }

          const totalBen = cleanInt(row[colMap.total_ben]);
          const paidBen = cleanInt(row[colMap.paid_ben]);
          const balBen = cleanInt(row[colMap.balance_ben]);

          const totalExt = cleanNum(row[colMap.total_extent]);
          const compExt = cleanNum(row[colMap.completed_extent]);
          const balExt = cleanNum(row[colMap.balance_extent]);

          let status = (row[colMap.status] || '').trim();
          if (!status) {
            status = balCr <= 0.001 && disbTot > 0 ? "Completed" : "In Progress";
          }

          const possession = (row[colMap.possession] || '').trim() || "Pending";
          const postAwardComp = row[colMap.post_award_comp] ? String(row[colMap.post_award_comp]).trim() : null;
          const postAwardBal = row[colMap.post_award_bal] ? String(row[colMap.post_award_bal]).trim() : null;
          const remarks = (row[colMap.remarks] || '').replace(/\s+/g, ' ').trim();

          let bottleneckCat = "None";
          const rLower = remarks.toLowerCase();
          if (rLower.includes("enhanced") || rLower.includes("market value") || rLower.includes("revision")) {
            bottleneckCat = "Market Value Revision";
          } else if (rLower.includes("vivat") || rLower.includes("title") || rLower.includes("survey")) {
            bottleneckCat = "Title & Survey Dispute";
          } else if (rLower.includes("alignment")) {
            bottleneckCat = "Alignment Dispute";
          } else if (rLower.includes("award to be passed") || rLower.includes("enquiry")) {
            bottleneckCat = "Award Enquiry Pending";
          } else if (rLower.includes("sdr")) {
            bottleneckCat = "SDR Statutory Stage";
          } else if (balCr > 0) {
            bottleneckCat = "Active Disbursement";
          }

          items.push({
            slNo: slNo,
            lao: currentLao,
            project: projName,
            dtoToken: dtoToken,
            creditDate: creditDate,
            releasedCr: releasedCr,
            disbursedYesterdayCr: disbYest,
            disbursedTodayCr: disbToday,
            totalDisbursedCr: disbTot,
            balanceCr: balCr,
            totalBeneficiaries: totalBen,
            beneficiariesPaid: paidBen,
            balanceBeneficiaries: balBen,
            totalExtentAc: totalExt,
            paymentCompletedExtentAc: compExt,
            balanceExtentAc: balExt,
            status: status,
            possession: possession,
            postAwardCompleted: postAwardComp,
            postAwardBalance: postAwardBal,
            remarks: remarks,
            bottleneckCategory: bottleneckCat
          });
        }
      }

      if (items.length > 0) {
        handleParsedData(items, asOnDate, sheetName || currentSelectedSheet, isInitial);
      }

    } catch (err) {
      console.warn("Direct fetch notification (fallback to cached data):", err);
      if (lastSyncedTime && isInitial) {
        lastSyncedTime.textContent = `Loaded (cached)`;
      }
    } finally {
      isSyncing = false;
      if (syncIcon) syncIcon.classList.remove("spinning");
      if (syncBtnText) syncBtnText.textContent = "Sync Now";
    }
  }

  function handleParsedData(items, asOnDate, sheetName, isInitial) {
    currentItems = items;
    const nowStr = new Date().toLocaleTimeString();
    if (lastSyncedTime) lastSyncedTime.textContent = `Last synced: ${nowStr}`;

    const dateBadge = document.querySelector(".district-badge");
    if (dateBadge && asOnDate) {
      dateBadge.title = `Data As On: ${asOnDate}`;
    }

    renderLaoCircles(items);
    renderSidebarLaoNav();
    renderProjectCircles(activeLao, items);
    updateScopeBannerUI();
    applyFilters();

    if (!isInitial) {
      showToast(`Synced ${items.length} records live from '${sheetName}'`);
    }
  }

  /* ----------------------------------------------------
     INTERACTIVE LAO CIRCULAR BADGES & PROJECT DRILLDOWN
  ---------------------------------------------------- */
  function renderLaoCircles(data) {
    if (!laoCirclesTrack) return;
    laoCirclesTrack.innerHTML = "";

    const laoList = [
      { id: "ALL", name: "All District", short: "DIST" },
      { id: "SDC Unit-I", name: "SDC Unit-I", short: "SDC-I" },
      { id: "SDC Unit-II", name: "SDC Unit-II", short: "SDC-II" },
      { id: "RDO Miryalaguda", name: "Miryalaguda", short: "MLG" },
      { id: "RDO Nalgonda", name: "Nalgonda", short: "NLG" },
      { id: "PA to SPL Collector", name: "Spl Collector", short: "SPL" },
      { id: "RDO Devarakonda", name: "Devarakonda", short: "DVK" }
    ];

    // When a specific LAO is clicked, display the Executive Authority Spotlight Card
    if (activeLao !== "ALL") {
      const selectedLao = laoList.find((l) => l.id === activeLao);
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
              <button class="btn btn-secondary btn-sm" id="unhideAllAuthoritiesBtn" title="View all authorities across the district">
                ← All Authorities
              </button>
            </div>
          </div>

          <div class="authority-metrics-row">
            <div class="authority-metric-cell">
              <span class="label">Total Released</span>
              <span class="val">₹${released.toFixed(2)} Cr</span>
              <span class="sub">Treasury Sanctioned</span>
            </div>
            <div class="authority-metric-cell">
              <span class="label">Total Disbursed</span>
              <span class="val" style="color: #34d399;">₹${disbursed.toFixed(2)} Cr</span>
              <span class="sub">${pct.toFixed(1)}% completed</span>
            </div>
            <div class="authority-metric-cell">
              <span class="label">Balance to Disburse</span>
              <span class="val" style="color: #fb7185;">₹${balance.toFixed(2)} Cr</span>
              <span class="sub">${schemesCount} active schemes</span>
            </div>
            <div class="authority-metric-cell">
              <span class="label">Beneficiaries Paid</span>
              <span class="val" style="color: #38bdf8;">${beneficiaries.toLocaleString()}</span>
              <span class="sub">of ${totalBen.toLocaleString()} awardees</span>
            </div>
          </div>

          <div class="compact-lao-switcher">
            <span class="switcher-label">Switch Authority:</span>
          </div>
        `;

        const switcher = spotlight.querySelector(".compact-lao-switcher");
        laoList.forEach((lao) => {
          const chip = document.createElement("button");
          chip.className = `compact-lao-chip ${lao.id === activeLao ? "active" : ""}`;
          chip.textContent = lao.name;
          chip.addEventListener("click", () => {
            activeLao = lao.id;
            activeProject = "ALL";
            if (laoFilter) laoFilter.value = activeLao;
            renderLaoCircles(currentItems);
            renderProjectCircles(activeLao, currentItems);
            updateScopeBannerUI();
            applyFilters();
            renderSidebarLaoNav();
          });
          switcher.appendChild(chip);
        });

        const unhideBtn = spotlight.querySelector("#unhideAllAuthoritiesBtn");
        if (unhideBtn) {
          unhideBtn.addEventListener("click", () => {
            activeLao = "ALL";
            activeProject = "ALL";
            if (laoFilter) laoFilter.value = "ALL";
            renderLaoCircles(currentItems);
            renderProjectCircles("ALL", currentItems);
            updateScopeBannerUI();
            applyFilters();
            renderSidebarLaoNav();
          });
        }

        laoCirclesTrack.appendChild(spotlight);
      }
      return;
    }

    // Default: render all LAO circles
    laoList.forEach((lao) => {
      let released = 0;
      let disbursed = 0;
      let schemesCount = 0;

      if (lao.id === "ALL") {
        released = data.reduce((acc, d) => acc + (d.releasedCr || 0), 0);
        disbursed = data.reduce((acc, d) => acc + (d.totalDisbursedCr || 0), 0);
        schemesCount = data.length;
      } else {
        const filtered = data.filter(d => d.lao === lao.id);
        released = filtered.reduce((acc, d) => acc + (d.releasedCr || 0), 0);
        disbursed = filtered.reduce((acc, d) => acc + (d.totalDisbursedCr || 0), 0);
        schemesCount = filtered.length;
      }

      const pct = released > 0 ? (disbursed / released) * 100 : 0;
      const isSelected = activeLao === lao.id;

      let ringColor = "#f43f5e"; // Rose
      if (pct >= 60) {
        ringColor = "#10b981"; // Emerald
      } else if (pct >= 30) {
        ringColor = "#38bdf8"; // Cyan
      }

      const card = document.createElement("div");
      card.className = `lao-circle-card ${isSelected ? "active" : ""}`;
      card.dataset.lao = lao.id;
      card.title = `Click to filter and view only: ${lao.name} (${pct.toFixed(1)}% disbursed)`;
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
        <div class="lao-circle-amount">₹${disbursed.toFixed(1)} Cr</div>
        <div class="lao-circle-stat">${schemesCount} Schemes</div>
      `;

      card.addEventListener("click", () => {
        if (activeLao === lao.id && lao.id !== "ALL") {
          activeLao = "ALL";
          activeProject = "ALL";
        } else {
          activeLao = lao.id;
          activeProject = "ALL";
        }

        if (laoFilter) laoFilter.value = activeLao;
        renderLaoCircles(currentItems);
        renderProjectCircles(activeLao, currentItems);
        updateActiveLaoCircleUI();
        updateScopeBannerUI();
        applyFilters();
        renderSidebarLaoNav();
      });

      laoCirclesTrack.appendChild(card);
    });
  }

  function updateActiveLaoCircleUI() {
    document.querySelectorAll(".lao-circle-card").forEach(c => {
      if (c.dataset.lao === activeLao) {
        c.classList.add("active");
      } else {
        c.classList.remove("active");
      }
    });
    document.querySelectorAll(".sidebar-lao-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.lao === activeLao);
    });
  }

  function renderSidebarLaoNav() {
    const container = document.getElementById("sidebarLaoNav");
    if (!container) return;

    const laoList = [
      { id: "ALL", name: "All District", count: currentItems.length },
      { id: "SDC Unit-I", name: "SDC Unit-I", count: currentItems.filter(d => d.lao === "SDC Unit-I").length },
      { id: "SDC Unit-II", name: "SDC Unit-II", count: currentItems.filter(d => d.lao === "SDC Unit-II").length },
      { id: "RDO Miryalaguda", name: "Miryalaguda", count: currentItems.filter(d => d.lao === "RDO Miryalaguda").length },
      { id: "RDO Nalgonda", name: "Nalgonda", count: currentItems.filter(d => d.lao === "RDO Nalgonda").length },
      { id: "PA to SPL Collector", name: "Spl Collector", count: currentItems.filter(d => d.lao === "PA to SPL Collector").length },
      { id: "RDO Devarakonda", name: "Devarakonda", count: currentItems.filter(d => d.lao === "RDO Devarakonda").length }
    ];

    container.innerHTML = "";
    laoList.forEach(item => {
      const btn = document.createElement("button");
      btn.className = `sidebar-lao-btn ${activeLao === item.id ? "active" : ""}`;
      btn.dataset.lao = item.id;
      btn.innerHTML = `
        <span class="lao-btn-name">${item.name}</span>
        <span class="sidebar-lao-count">${item.count}</span>
      `;

      btn.addEventListener("click", () => {
        activeLao = item.id;
        activeProject = "ALL";
        if (laoFilter) laoFilter.value = activeLao;
        updateActiveLaoCircleUI();
        renderProjectCircles(activeLao, currentItems);
        updateScopeBannerUI();
        applyFilters();
        closeMobileSidebar();
      });

      container.appendChild(btn);
    });
  }

  function switchDashboardTab(tabName) {
    currentTab = tabName || "overview";

    // Update Top Sticky Pills
    document.querySelectorAll(".tab-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === currentTab);
    });

    // Update Sidebar Navigation Buttons
    document.querySelectorAll(".sidebar-nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === currentTab);
    });

    const main = document.getElementById("dashboardMain");
    if (!main) return;

    if (currentTab === "all") {
      main.classList.add("show-all-views");
      document.querySelectorAll(".tab-view-section").forEach((sec) => {
        sec.classList.add("active");
      });
    } else {
      main.classList.remove("show-all-views");
      document.querySelectorAll(".tab-view-section").forEach((sec) => {
        sec.classList.toggle("active", sec.id === `view-${currentTab}`);
      });
    }

    // Trigger Chart.js recalculation if analytics tab or all view activated
    if (currentTab === "analytics" || currentTab === "all") {
      setTimeout(() => {
        if (laoChart) laoChart.resize();
        if (bottleneckChart) bottleneckChart.resize();
      }, 80);
    }

    // Scroll to top of main area when switching tabs
    main.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "smooth" });

    // On mobile, close sidebar drawer
    closeMobileSidebar();
  }

  function openMobileSidebar() {
    const sidebar = document.getElementById("dashboardSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById("dashboardSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
    document.body.style.overflow = "";
  }

  /* ----------------------------------------------------
     DYNAMIC PROJECT DEPLOYMENT (UNDER SELECTED LAO)
  ---------------------------------------------------- */
  function renderProjectCircles(laoId, data) {
    if (!projectDrilldownPanel || !projectCirclesTrack) return;

    if (laoId === "ALL") {
      projectDrilldownPanel.style.display = "none";
      activeProject = "ALL";
      updateScopeBannerUI();
      return;
    }

    const projects = data.filter(d => d.lao === laoId);
    if (projects.length === 0) {
      projectDrilldownPanel.style.display = "none";
      activeProject = "ALL";
      updateScopeBannerUI();
      return;
    }

    projectDrilldownPanel.style.display = "flex";
    if (projectDrilldownTitleText) {
      projectDrilldownTitleText.textContent = `${laoId} Projects`;
    }

    projectCirclesTrack.innerHTML = "";

    // If a specific project is selected, display the Executive Scheme Spotlight Card
    if (activeProject !== "ALL") {
      const proj = projects.find((p) => String(p.slNo) === String(activeProject));
      if (proj) {
        const rel = proj.releasedCr || 0;
        const dis = proj.totalDisbursedCr || 0;
        const bal = proj.balanceCr || 0;
        const pct = rel > 0 ? (dis / rel) * 100 : 0;
        const statusClass = (proj.status || "").toLowerCase().includes("completed") ? "status-completed" : "status-in-progress";

        if (projectCountBadge) {
          projectCountBadge.textContent = `Scheme #${proj.slNo} of ${projects.length}`;
        }

        const spotlight = document.createElement("div");
        spotlight.className = "scheme-spotlight-card";
        spotlight.innerHTML = `
          <div class="scheme-spotlight-header">
            <div class="scheme-spotlight-titles">
              <div class="scheme-tag-row">
                <span class="urgency-badge medium" style="font-size: 0.7rem; font-weight: 700;">SCHEME #${proj.slNo}</span>
                <span class="status-badge ${statusClass}">${proj.status || "Active"}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${proj.lao}</span>
              </div>
              <h3 class="scheme-spotlight-title">${proj.project}</h3>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-whatsapp btn-sm wa-spotlight-btn" title="Send this scheme's status directly to WhatsApp">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.456h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                WhatsApp Status
              </button>
              <button class="btn btn-secondary btn-sm" id="unhideAuthoritySchemesBtn">
                ← All Schemes in ${laoId}
              </button>
            </div>
          </div>

          <div class="scheme-spotlight-grid">
            <div class="scheme-metric-tile">
              <span class="tile-label">Disbursed Amount</span>
              <span class="tile-val" style="color: #34d399;">₹${dis.toFixed(2)} Cr</span>
              <span class="tile-sub">${pct.toFixed(1)}% of ₹${rel.toFixed(2)} Cr</span>
            </div>
            <div class="scheme-metric-tile">
              <span class="tile-label">Balance Funds</span>
              <span class="tile-val" style="color: ${bal > 0 ? "#fb7185" : "var(--text-muted)"};">₹${bal.toFixed(2)} Cr</span>
              <span class="tile-sub">Remaining to Disburse</span>
            </div>
            <div class="scheme-metric-tile">
              <span class="tile-label">Awardees Paid</span>
              <span class="tile-val" style="color: #38bdf8;">${proj.beneficiariesPaid || 0}</span>
              <span class="tile-sub">of ${proj.totalBeneficiaries || 0} (${proj.balanceBeneficiaries || 0} Pending)</span>
            </div>
            <div class="scheme-metric-tile">
              <span class="tile-label">Acquired Extent</span>
              <span class="tile-val" style="color: #fbbf24;">${(proj.paymentCompletedExtentAc || 0).toFixed(2)} Ac</span>
              <span class="tile-sub">of ${(proj.totalExtentAc || 0).toFixed(2)} Ac (${(proj.balanceExtentAc || 0).toFixed(2)} Ac Bal)</span>
            </div>
          </div>

          <div class="scheme-remarks-callout">
            <div class="scheme-remarks-title">
              <span>📝 Ground Remarks & Administrative Status</span>
              <span>DTO Token: <strong style="color: #38bdf8;">${proj.dtoToken || "N/A"}</strong> | Credit: <strong>${proj.creditDate || "N/A"}</strong></span>
            </div>
            <p class="scheme-remarks-body">"${proj.remarks || "No specific field bottleneck or dispute noted for this scheme."}"</p>
          </div>

          <div class="scheme-pills-strip">
            <span class="switcher-label">Other Schemes in ${laoId}:</span>
          </div>
        `;

        const waBtn = spotlight.querySelector(".wa-spotlight-btn");
        if (waBtn) {
          waBtn.addEventListener("click", () => sendProjectWhatsApp(proj.slNo));
        }

        const unhideBtn = spotlight.querySelector("#unhideAuthoritySchemesBtn");
        if (unhideBtn) {
          unhideBtn.addEventListener("click", () => {
            activeProject = "ALL";
            renderProjectCircles(activeLao, currentItems);
            updateScopeBannerUI();
            applyFilters();
          });
        }

        const pillsStrip = spotlight.querySelector(".scheme-pills-strip");
        const allPill = document.createElement("button");
        allPill.className = "compact-lao-chip";
        allPill.textContent = `All ${projects.length} Schemes`;
        allPill.addEventListener("click", () => {
          activeProject = "ALL";
          renderProjectCircles(activeLao, currentItems);
          updateScopeBannerUI();
          applyFilters();
        });
        pillsStrip.appendChild(allPill);

        projects.forEach((p) => {
          const chip = document.createElement("button");
          chip.className = `compact-lao-chip ${String(p.slNo) === String(activeProject) ? "active" : ""}`;
          chip.textContent = `#${p.slNo} ${p.project.length > 20 ? p.project.substring(0, 20) + "..." : p.project}`;
          chip.title = p.project;
          chip.addEventListener("click", () => {
            activeProject = p.slNo;
            renderProjectCircles(activeLao, currentItems);
            updateScopeBannerUI();
            applyFilters();
          });
          pillsStrip.appendChild(chip);
        });

        projectCirclesTrack.appendChild(spotlight);
      }
      return;
    }

    // Default when activeProject === "ALL": show all schemes under this LAO
    if (projectCountBadge) {
      projectCountBadge.textContent = `${projects.length} Schemes Deployed`;
    }

    // Card 0: "All Schemes in Authority" Card
    const allCard = document.createElement("div");
    const isAllActive = activeProject === "ALL";
    allCard.className = `project-circle-card ${isAllActive ? "active" : ""}`;
    allCard.dataset.projectSl = "ALL";
    allCard.title = `View aggregated stats for all ${projects.length} schemes under ${laoId}`;

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
      <div class="project-circle-amount">₹${laoTotalDis.toFixed(1)} Cr</div>
      <div class="project-circle-stat">Authority Total</div>
    `;

    allCard.addEventListener("click", () => {
      activeProject = "ALL";
      renderProjectCircles(activeLao, currentItems);
      updateScopeBannerUI();
      applyFilters();
    });
    projectCirclesTrack.appendChild(allCard);

    // Individual Project Cards
    projects.forEach((proj) => {
      const rel = proj.releasedCr || 0;
      const dis = proj.totalDisbursedCr || 0;
      const pct = rel > 0 ? (dis / rel) * 100 : 0;
      const isSelected = String(activeProject) === String(proj.slNo);

      let strokeColor = "#f43f5e";
      if (pct >= 60) strokeColor = "#10b981";
      else if (pct >= 30) strokeColor = "#38bdf8";

      const card = document.createElement("div");
      card.className = `project-circle-card ${isSelected ? "active" : ""}`;
      card.dataset.projectSl = proj.slNo;
      card.title = `Click to show only this scheme: ${proj.project} (${pct.toFixed(1)}% disbursed)`;

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
        <div class="project-circle-amount">₹${dis.toFixed(1)} Cr</div>
        <div class="project-circle-stat">${(proj.paymentCompletedExtentAc || 0).toFixed(0)} Ac • ${proj.beneficiariesPaid || 0} Ben.</div>
      `;

      card.addEventListener("click", () => {
        if (String(activeProject) === String(proj.slNo)) {
          activeProject = "ALL";
        } else {
          activeProject = proj.slNo;
        }
        renderProjectCircles(activeLao, currentItems);
        updateScopeBannerUI();
        applyFilters();

        const banner = document.getElementById("activeScopeBanner");
        if (banner) {
          banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });

      projectCirclesTrack.appendChild(card);
    });
  }

  function updateProjectCircleUI() {
    document.querySelectorAll(".project-circle-card").forEach(c => {
      if (String(c.dataset.projectSl) === String(activeProject)) {
        c.classList.add("active");
      } else {
        c.classList.remove("active");
      }
    });
  }

  function updateScopeBannerUI() {
    if (!activeScopeBanner) return;

    if (activeLao === "ALL") {
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
    } else if (activeProject === "ALL") {
      const laoSchemes = currentItems.filter(d => d.lao === activeLao);
      if (scopeLevel) scopeLevel.textContent = "AUTHORITY SCOPE";
      if (scopeTitle) scopeTitle.textContent = `${activeLao} (All ${laoSchemes.length} Schemes)`;
      if (scopeBadge) {
        scopeBadge.textContent = `${laoSchemes.length} Schemes Active`;
        scopeBadge.style.background = "rgba(56, 189, 248, 0.15)";
        scopeBadge.style.color = "#38bdf8";
        scopeBadge.style.borderColor = "rgba(56, 189, 248, 0.35)";
      }
      if (resetScopeBtn) resetScopeBtn.style.display = "inline-flex";
      if (resetProjectScopeBtn) resetProjectScopeBtn.style.display = "none";
      if (scopeShareWhatsAppBtn) scopeShareWhatsAppBtn.style.display = "none";
    } else {
      const proj = currentItems.find(d => String(d.slNo) === String(activeProject));
      if (proj) {
        const pct = (proj.releasedCr > 0 ? (proj.totalDisbursedCr / proj.releasedCr) * 100 : 0);
        if (scopeLevel) scopeLevel.textContent = `${activeLao} › SCHEME #${proj.slNo}`;
        if (scopeTitle) scopeTitle.textContent = proj.project;
        if (scopeBadge) {
          scopeBadge.textContent = `${pct.toFixed(1)}% Disbursed • ${proj.status || 'Active'}`;
          scopeBadge.style.background = pct >= 60 ? "rgba(16, 185, 129, 0.15)" : "rgba(251, 191, 36, 0.15)";
          scopeBadge.style.color = pct >= 60 ? "#34d399" : "#fbbf24";
          scopeBadge.style.borderColor = pct >= 60 ? "rgba(16, 185, 129, 0.35)" : "rgba(251, 191, 36, 0.35)";
        }
      }
      if (resetScopeBtn) resetScopeBtn.style.display = "inline-flex";
      if (resetProjectScopeBtn) resetProjectScopeBtn.style.display = "inline-flex";
      if (scopeShareWhatsAppBtn) {
        scopeShareWhatsAppBtn.style.display = "inline-flex";
        scopeShareWhatsAppBtn.onclick = (e) => {
          e.stopPropagation();
          sendProjectWhatsApp(activeProject);
        };
      }
    }
  }

  function initSheetDropdown() {
    if (!sheetSelect) return;
    sheetSelect.innerHTML = "";
    knownSheets.forEach((name, idx) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = idx === 0 ? `${name} (Latest)` : name;
      sheetSelect.appendChild(opt);
    });
    sheetSelect.value = currentSelectedSheet;
  }

  function startAutoSync(intervalMs = 30000) {
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    autoSyncTimer = setInterval(() => {
      fetchGoogleSheetData(false, currentSelectedSheet);
    }, intervalMs);
  }

  function showToast(msg) {
    if (!syncToast || !toastMessage) return;
    toastMessage.textContent = msg;
    syncToast.classList.add("show");
    setTimeout(() => {
      syncToast.classList.remove("show");
    }, 3200);
  }

  /* ----------------------------------------------------
     FILTERING & DATA PROCESSING
  ---------------------------------------------------- */
  function getFilteredData() {
    return currentItems.filter((item) => {
      if (activeLao !== "ALL" && item.lao !== activeLao) {
        return false;
      }

      if (activeProject !== "ALL" && String(item.slNo) !== String(activeProject)) {
        return false;
      }

      if (activeStatus !== "ALL") {
        const s = (item.status || "").toLowerCase();
        if (activeStatus === "Completed" && !s.includes("completed")) return false;
        if (activeStatus === "In Progress" && !s.includes("in progress")) return false;
        if (activeStatus === "Award Pending" && !s.includes("pending") && !s.includes("enquiry") && !s.includes("stage")) return false;
      }

      if (bottleneckOnly) {
        if (item.bottleneckCategory === "None" || (item.balanceCr || 0) <= 0) return false;
      }

      if (highExtentOnly) {
        if ((item.totalExtentAc || 0) < 50) return false;
      }

      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const combined = `${item.project || ""} ${item.lao || ""} ${item.dtoToken || ""} ${item.remarks || ""} ${item.status || ""} ${item.bottleneckCategory || ""}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }

      return true;
    });
  }

  function getSortedData(data) {
    return [...data].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === undefined || valA === null) valA = "";
      if (valB === undefined || valB === null) valB = "";

      if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  function applyFilters() {
    const filtered = getFilteredData();
    const sorted = getSortedData(filtered);

    // If viewing a single specific scheme, auto-expand its full ground details and remarks
    if (activeProject !== "ALL" && filtered.length === 1) {
      expandedRows.add(filtered[0].slNo);
    }

    updateKPICards(filtered);
    renderTable(sorted);
    updateCharts(filtered);
    renderBottleneckGrid();
  }

  /* ----------------------------------------------------
     KPI CARDS & RADIAL PROGRESS UPDATE (STATS ON TOP)
  ---------------------------------------------------- */
  function updateKPICards(data) {
    const isSingleProject = activeProject !== "ALL" && data.length === 1;

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

    document.getElementById("kpiDisbursedCr").textContent = `₹${totalDisbursed.toFixed(2)}`;
    document.getElementById("kpiReleasedCr").textContent = `₹${totalReleased.toFixed(2)} Cr`;
    document.getElementById("kpiBalanceCr").textContent = `₹${totalBalance.toFixed(2)} Cr`;
    
    const disbursedTodayElem = document.getElementById("kpiDisbursedTodayCr");
    if (disbursedTodayElem) {
      disbursedTodayElem.textContent = `₹${totalDisbursedToday.toFixed(2)} Cr`;
    }

    document.getElementById("fundsPct").textContent = `${fundsPct.toFixed(1)}%`;
    setRadialGauge("fundsGaugeBar", fundsPct);

    // Card 2: Beneficiaries
    const kpi2Title = document.getElementById("kpi2Title");
    const kpi2Unit = document.getElementById("kpi2Unit");
    if (kpi2Title) kpi2Title.textContent = isSingleProject ? "Project Beneficiaries" : "Beneficiaries Reached";
    if (kpi2Unit) kpi2Unit.textContent = isSingleProject ? `of ${totalBeneficiaries} Awardees` : "Awardees Paid";

    document.getElementById("kpiPaidBeneficiaries").textContent = paidBeneficiaries.toLocaleString();
    document.getElementById("kpiTotalBeneficiaries").textContent = totalBeneficiaries.toLocaleString();
    document.getElementById("kpiPendingBeneficiaries").textContent = pendingBeneficiaries.toLocaleString();
    document.getElementById("beneficiaryPct").textContent = `${benPct.toFixed(1)}%`;
    setRadialGauge("beneficiaryGaugeBar", benPct);

    // Card 3: Extent
    const kpi3Title = document.getElementById("kpi3Title");
    const kpi3Unit = document.getElementById("kpi3Unit");
    if (kpi3Title) kpi3Title.textContent = isSingleProject ? "Project Land Extent" : "Land Acquisition Extent";
    if (kpi3Unit) kpi3Unit.textContent = isSingleProject ? `of ${totalExtent.toFixed(1)} Ac Total` : "Acres Acquired";

    document.getElementById("kpiCompletedExtent").textContent = completedExtent.toFixed(2);
    document.getElementById("kpiTotalExtent").textContent = `${totalExtent.toFixed(2)} Ac`;
    document.getElementById("kpiBalanceExtent").textContent = `${balanceExtent.toFixed(2)} Ac`;
    document.getElementById("extentPct").textContent = `${extPct.toFixed(1)}%`;
    setRadialGauge("extentGaugeBar", extPct);

    // Card 4: Project Info or Schemes Summary
    const kpi4Title = document.getElementById("kpi4Title");
    const kpi4Unit = document.getElementById("kpi4Unit");
    const kpi4Submetrics = document.getElementById("kpi4Submetrics");
    const projectPct = document.getElementById("projectPct");

    if (isSingleProject) {
      const p = data[0];
      if (kpi4Title) kpi4Title.textContent = "Scheme Status & Token";
      document.getElementById("kpiTotalProjects").textContent = p.status || "In Progress";
      if (kpi4Unit) kpi4Unit.textContent = `Scheme #${p.slNo} (${p.lao})`;
      if (projectPct) projectPct.textContent = `${fundsPct.toFixed(0)}% Disb.`;
      setRadialGauge("projectGaugeBar", fundsPct);

      if (kpi4Submetrics) {
        kpi4Submetrics.innerHTML = `
          <span>DTO Token: <strong style="color: #38bdf8;">${p.dtoToken || 'Pending / N/A'}</strong></span>
          <span>Credit Date: <strong>${p.creditDate || 'N/A'}</strong></span>
          <span>Bottleneck: <strong style="color: #fb7185;">${p.bottleneckCategory !== 'None' ? p.bottleneckCategory : (p.remarks ? (p.remarks.length > 22 ? p.remarks.substring(0, 22) + '...' : p.remarks) : 'Clear')}</strong></span>
        `;
      }
    } else {
      if (kpi4Title) kpi4Title.textContent = "Project Schemes";
      document.getElementById("kpiTotalProjects").textContent = data.length;
      if (kpi4Unit) kpi4Unit.textContent = "Active Sub-Entries";
      if (projectPct) projectPct.textContent = `${data.length} Units`;
      const projRatio = data.length > 0 ? (completedUnits / data.length) * 100 : 0;
      setRadialGauge("projectGaugeBar", projRatio);

      if (kpi4Submetrics) {
        kpi4Submetrics.innerHTML = `
          <span>Completed Units: <strong id="kpiCompletedUnits" style="color: #34d399;">${completedUnits} Completed</strong></span>
          <span>In Progress / Review: <strong id="kpiActiveUnits" style="color: #38bdf8;">${activeUnits} Schemes</strong></span>
        `;
      }
    }
  }

  function setRadialGauge(elementId, percentage) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const clamped = Math.max(0, Math.min(100, percentage));
    el.setAttribute("stroke-dasharray", `${clamped.toFixed(2)}, 100`);
  }

  /* ----------------------------------------------------
     WHATSAPP STATUS MESSAGE GENERATION & SHARING
  ---------------------------------------------------- */
  function getVisualProgressBar(pct) {
    const total = 10;
    const clamped = Math.min(100, Math.max(0, pct || 0));
    const filled = Math.min(total, Math.max(0, Math.round((clamped / 100) * total)));
    const empty = total - filled;
    return "▰".repeat(filled) + "▱".repeat(empty);
  }

  function generateWhatsAppProjectMessage(p, reportDate) {
    const rel = p.releasedCr || 0;
    const dis = p.totalDisbursedCr || 0;
    const bal = p.balanceCr || 0;
    const pctNum = rel > 0 ? (dis / rel) * 100 : 0;
    const pct = pctNum.toFixed(1);

    const totalBen = p.totalBeneficiaries || 0;
    const paidBen = p.beneficiariesPaid || 0;
    const balBen = p.balanceBeneficiaries || 0;
    const benPctNum = totalBen > 0 ? (paidBen / totalBen) * 100 : 0;
    const benPct = benPctNum.toFixed(1);

    const totalExt = (p.totalExtentAc || 0).toFixed(2);
    const compExt = (p.paymentCompletedExtentAc || 0).toFixed(2);
    const balExt = (p.balanceExtentAc || 0).toFixed(2);
    const extPctNum = (p.totalExtentAc && p.totalExtentAc > 0) ? (((p.paymentCompletedExtentAc || 0) / p.totalExtentAc) * 100) : 0;
    const extPct = extPctNum.toFixed(1);

    const dtToday = (p.disbursedTodayCr || 0).toFixed(2);
    const dtYest = (p.disbursedYesterdayCr || 0).toFixed(2);
    const postComp = (p.postAwardCompleted !== null && p.postAwardCompleted !== undefined) ? `${p.postAwardCompleted} Ac` : "N/A";
    const postBal = (p.postAwardBalance !== null && p.postAwardBalance !== undefined) ? `${p.postAwardBalance} Ac` : "N/A";

    const dateStr = reportDate || currentSelectedSheet || "Current Report";

    let statusEmoji = "⏳";
    let statusBadge = p.status || "In Progress";
    const s = (p.status || "").toLowerCase();
    if (s.includes("completed")) {
      statusEmoji = "✅";
      statusBadge = "COMPLETED";
    } else if (s.includes("progress")) {
      statusEmoji = "⚡";
      statusBadge = "IN PROGRESS";
    } else if (s.includes("pending") || s.includes("enquiry") || s.includes("stage")) {
      statusEmoji = "⚠️";
      statusBadge = (p.status || "PENDING").toUpperCase();
    }

    return `━━━━━━━━━━━━━━━━━━━━━━
🏛️ *GOVERNMENT OF TELANGANA*
📊 *Land Acquisition & Payment Monitor*
🏢 *District Collectorate, Nalgonda*
━━━━━━━━━━━━━━━━━━━━━━

📍 *PROJECT DETAILS*
🔹 *Project:* *${p.project}* (Sl #${p.slNo})
🏢 *Authority (LAO):* 🏛️ *${p.lao}*
${statusEmoji} *Current Status:* *${statusBadge}*

━━━━━━━━━━━━━━━━━━━━━━
💰 *FINANCIAL DISBURSEMENT*
📈 Progress: [${getVisualProgressBar(pctNum)}] *${pct}%*
💵 Total Released: *₹${rel.toFixed(2)} Cr*
✅ Total Disbursed: *₹${dis.toFixed(2)} Cr*
⚡ Disbursed Today: *₹${dtToday} Cr*
⏳ Upto Yesterday: *₹${dtYest} Cr*
🔴 Balance to Disburse: *₹${bal.toFixed(2)} Cr*

━━━━━━━━━━━━━━━━━━━━━━
👥 *BENEFICIARIES (AWARDEES)*
📊 Covered: [${getVisualProgressBar(benPctNum)}] *${benPct}%*
🎯 Total Awardees: *${totalBen.toLocaleString()}*
🟢 Awardees Paid: *${paidBen.toLocaleString()}*
🟡 Pending Payment: *${balBen.toLocaleString()}*

━━━━━━━━━━━━━━━━━━━━━━
📐 *LAND ACQUISITION EXTENT*
📊 Secured: [${getVisualProgressBar(extPctNum)}] *${extPct}%*
🌱 Total Extent: *${totalExt} Ac*
🟢 Payment Completed: *${compExt} Ac*
🟠 Balance Extent: *${balExt} Ac*

━━━━━━━━━━━━━━━━━━━━━━
📑 *ADMINISTRATIVE & TOKEN DETAILS*
🔖 DTO Token: \`${p.dtoToken || "N/A"}\`
🗓️ Date of Credit: *${p.creditDate || "N/A"}*
🚜 Land Possession: *${p.possession || "Pending / In Progress"}*
📋 Post-Award Details: Completed *${postComp}* | Balance *${postBal}*
⚠️ Bottleneck Category: *${p.bottleneckCategory && p.bottleneckCategory !== "None" ? p.bottleneckCategory : "None / Clear"}*

━━━━━━━━━━━━━━━━━━━━━━
📝 *FIELD REMARKS & GROUND STATUS*
💬 _"${p.remarks ? p.remarks : "No specific remarks recorded."}"_

━━━━━━━━━━━━━━━━━━━━━━
📅 *Report As On:* ${dateStr}
🌐 *Live Dashboard:* https://nalgonda-la-dashboard.vercel.app/
━━━━━━━━━━━━━━━━━━━━━━`;
  }

  function sendProjectWhatsApp(slNo) {
    const p = currentItems.find(d => String(d.slNo) === String(slNo));
    if (!p) return;
    const msg = generateWhatsAppProjectMessage(p, currentSelectedSheet);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  }

  function copyProjectWhatsAppText(slNo) {
    const p = currentItems.find(d => String(d.slNo) === String(slNo));
    if (!p) return;
    const msg = generateWhatsAppProjectMessage(p, currentSelectedSheet);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).then(() => {
        showToast(`WhatsApp status for "${p.project}" copied!`);
      }).catch(() => {
        fallbackCopyText(msg, `WhatsApp status for "${p.project}" copied!`);
      });
    } else {
      fallbackCopyText(msg, `WhatsApp status for "${p.project}" copied!`);
    }
  }

  function fallbackCopyText(text, successToastMsg) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      showToast(successToastMsg || "Copied to clipboard!");
    } catch (err) {
      showToast("Failed to copy automatically");
    }
    document.body.removeChild(textArea);
  }

  /* ----------------------------------------------------
     TABLE RENDERING & INTERACTIVITY
  ---------------------------------------------------- */
  function renderTable(data) {
    if (activeProject !== "ALL" && data.length === 1) {
      tableRecordCount.textContent = `Showing 1 scheme (#${data[0].slNo} ${data[0].project}) • Filtered`;
    } else if (activeLao !== "ALL") {
      tableRecordCount.textContent = `Showing ${data.length} schemes under ${activeLao}`;
    } else {
      tableRecordCount.textContent = `Showing ${data.length} of ${currentItems.length} records`;
    }
    const ledgerPill = document.getElementById("ledgerCountPill");
    if (ledgerPill) ledgerPill.textContent = data.length;
    const sidebarBadge = document.getElementById("sidebarLedgerBadge");
    if (sidebarBadge) sidebarBadge.textContent = data.length;
    tableBody.innerHTML = "";

    if (data.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No land acquisition records matched your filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    data.forEach((row) => {
      const pct = (row.releasedCr && row.releasedCr > 0) ? (row.totalDisbursedCr / row.releasedCr) * 100 : 0;
      const isExpanded = expandedRows.has(row.slNo);

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
        <td style="font-weight: 600; color: var(--text-muted);">${row.slNo}</td>
        <td><strong style="color: var(--color-primary);">${row.lao}</strong></td>
        <td style="font-weight: 500;">
          ${row.project}
          ${(row.disbursedTodayCr || 0) > 0 ? `<span class="status-badge status-completed" style="margin-left: 0.35rem; font-size: 0.65rem;">+₹${row.disbursedTodayCr} Cr Today</span>` : ''}
        </td>
        <td>₹${(row.releasedCr || 0).toFixed(2)}</td>
        <td style="color: #34d399; font-weight: 600;">₹${(row.totalDisbursedCr || 0).toFixed(2)}</td>
        <td style="color: ${(row.balanceCr || 0) > 0 ? '#fb7185' : 'var(--text-muted)'}; font-weight: 600;">₹${(row.balanceCr || 0).toFixed(2)}</td>
        <td>
          <span class="mini-progress-bar">
            <div class="mini-progress-fill" style="width: ${Math.min(100, pct)}%; background: ${pct >= 99 ? '#10b981' : pct > 30 ? '#38bdf8' : '#f59e0b'};"></div>
          </span>
          <span style="font-size: 0.75rem; font-weight: 600;">${pct.toFixed(0)}%</span>
        </td>
        <td>
          <span>${row.beneficiariesPaid}</span>
          <span style="color: var(--text-muted);"> / ${row.totalBeneficiaries}</span>
        </td>
        <td>
          <span>${(row.paymentCompletedExtentAc || 0).toFixed(2)}</span>
          <span style="color: var(--text-muted);"> / ${(row.totalExtentAc || 0).toFixed(2)} Ac</span>
        </td>
        <td>
          <span class="status-badge ${statusBadgeClass}">${row.status}</span>
        </td>
        <td style="text-align: center;">
          <div class="table-actions-cell">
            <button class="btn-whatsapp-sm wa-row-btn" data-sl="${row.slNo}" title="Send '${row.project}' status on WhatsApp">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.456h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span>WhatsApp</span>
            </button>
            <button class="btn-icon expand-btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" title="${isExpanded ? 'Collapse row' : 'View full details'}">
              ${isExpanded ? "▲ Hide" : "▼ Info"}
            </button>
          </div>
        </td>
      `;

      const waRowBtn = tr.querySelector(".wa-row-btn");
      if (waRowBtn) {
        waRowBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          sendProjectWhatsApp(row.slNo);
        });
      }

      tr.addEventListener("click", () => toggleRowExpand(row.slNo));
      tableBody.appendChild(tr);

      if (isExpanded) {
        const detailTr = document.createElement("tr");
        detailTr.className = "detail-row";
        detailTr.innerHTML = `
          <td colspan="11">
            <div class="detail-content-wrap">
              <div class="detail-left">
                <span class="detail-title">Field Remarks & Ground Status</span>
                <div class="detail-remarks">
                  ${row.remarks || "No specific bottleneck or remarks noted."}
                </div>
                ${
                  row.bottleneckCategory && row.bottleneckCategory !== "None"
                    ? `<div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.35rem;">
                         <span style="font-size: 0.75rem; color: var(--text-secondary);">Bottleneck Classification:</span>
                         <span class="urgency-badge ${row.balanceCr > 15 ? 'high' : 'medium'}">${row.bottleneckCategory}</span>
                       </div>`
                    : ""
                }
              </div>
              <div class="detail-grid-meta">
                <div class="meta-box">
                  <div class="meta-label">DTO Token No & Date</div>
                  <div class="meta-val">${row.dtoToken || 'N/A'}</div>
                </div>
                <div class="meta-box">
                  <div class="meta-label">Date of Credit</div>
                  <div class="meta-val">${row.creditDate || 'N/A'}</div>
                </div>
                <div class="meta-box">
                  <div class="meta-label">Disbursed Today vs Yesterday</div>
                  <div class="meta-val">
                    Today: <strong style="color: #34d399;">₹${(row.disbursedTodayCr || 0).toFixed(2)} Cr</strong> | Upto Yesterday: ₹${(row.disbursedYesterdayCr || 0).toFixed(2)} Cr
                  </div>
                </div>
                <div class="meta-box">
                  <div class="meta-label">Possession Handed Over</div>
                  <div class="meta-val">${row.possession || "Pending / In Progress"}</div>
                </div>
                <div class="meta-box" style="grid-column: span 2;">
                  <div class="meta-label">Post-Award Extent Details</div>
                  <div class="meta-val">
                    Completed: <strong>${row.postAwardCompleted !== null && row.postAwardCompleted !== undefined ? row.postAwardCompleted : '0'} Ac</strong>
                    &nbsp;|&nbsp;
                    Balance: <strong>${row.postAwardBalance !== null && row.postAwardBalance !== undefined ? row.postAwardBalance : '0'} Ac</strong>
                  </div>
                </div>
              </div>

              <!-- Action Toolbar for WhatsApp Sharing -->
              <div class="detail-actions-bar" style="grid-column: span 2;">
                <button class="btn btn-whatsapp wa-detail-send-btn" style="font-size: 0.8rem; padding: 0.4rem 0.85rem;" data-sl="${row.slNo}" title="Open WhatsApp with formatted project status">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.456h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span>Share Status on WhatsApp</span>
                </button>
                <button class="btn btn-copy-wa wa-detail-copy-btn" style="font-size: 0.8rem; padding: 0.4rem 0.85rem;" data-sl="${row.slNo}" title="Copy formatted WhatsApp text to clipboard">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span>Copy WhatsApp Text</span>
                </button>
                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: auto;">Includes complete financial breakdown, awardees, extent, token & field remarks</span>
              </div>
            </div>
          </td>
        `;

        const waDetailSendBtn = detailTr.querySelector(".wa-detail-send-btn");
        if (waDetailSendBtn) {
          waDetailSendBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            sendProjectWhatsApp(row.slNo);
          });
        }

        const waDetailCopyBtn = detailTr.querySelector(".wa-detail-copy-btn");
        if (waDetailCopyBtn) {
          waDetailCopyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            copyProjectWhatsAppText(row.slNo);
          });
        }

        tableBody.appendChild(detailTr);
      }
    });
  }

  function toggleRowExpand(slNo) {
    if (expandedRows.has(slNo)) {
      expandedRows.delete(slNo);
    } else {
      expandedRows.add(slNo);
    }
    renderTable(getSortedData(getFilteredData()));
  }

  /* ----------------------------------------------------
     BOTTLENECK CARDS
  ---------------------------------------------------- */
  function renderBottleneckGrid() {
    const container = document.getElementById("bottleneckGrid");
    if (!container) return;
    container.innerHTML = "";

    const highlights = typeof BOTTLENECK_HIGHLIGHTS !== "undefined" ? BOTTLENECK_HIGHLIGHTS : [];

    // Filter bottlenecks if a specific LAO or scheme is selected
    const filteredHighlights = highlights.filter((item) => {
      if (activeLao !== "ALL" && item.lao !== activeLao && !item.lao.includes(activeLao)) {
        return false;
      }
      if (activeProject !== "ALL") {
        const p = currentItems.find((d) => String(d.slNo) === String(activeProject));
        if (p) {
          const tLower = item.title.toLowerCase();
          const pLower = p.project.toLowerCase();
          if (!tLower.includes(pLower) && !pLower.includes(tLower) && !tLower.includes(String(p.slNo))) {
            return false;
          }
        }
      }
      return true;
    });

    const displayList = (activeLao !== "ALL" || activeProject !== "ALL") ? filteredHighlights : highlights;

    if (displayList.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
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
        <div class="bottleneck-action" style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
          <div style="flex: 1;"><strong>Key Action:</strong> ${item.actionItem}</div>
          <button class="btn-whatsapp-sm wa-bottleneck-btn" style="flex-shrink: 0;" title="Share bottleneck issue on WhatsApp">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.456h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span>Share</span>
          </button>
        </div>
      `;

      const btn = card.querySelector(".wa-bottleneck-btn");
      if (btn) {
        btn.addEventListener("click", () => {
          const msg = `🚨 *LAND ACQUISITION BOTTLENECK ALERT*
*District Collectorate, Nalgonda*
────────────────────────
⚠️ *Priority:* *${(item.urgency || '').toUpperCase()}*
📌 *Issue:* *${item.title}*
🏢 *Authority:* ${item.lao}

📊 *KEY METRICS:*
• Blocked Funds: *${item.amount}*
• Extent Affected: *${item.extent}*
• Beneficiaries Impacted: *${item.beneficiaries}*

📝 *SITUATION SUMMARY:*
${item.description}

⚡ *RECOMMENDED ACTION:*
${item.actionItem}
────────────────────────
🔗 *Live Portal:* https://nalgonda-la-dashboard.vercel.app/`;
          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
        });
      }

      container.appendChild(card);
    });
  }

  /* ----------------------------------------------------
     CHARTS (CHART.JS)
  ---------------------------------------------------- */
  function initCharts() {
    const ctxLao = document.getElementById("laoFinanceChart").getContext("2d");
    laoChart = new Chart(ctxLao, {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          {
            label: "Disbursed (₹ Cr)",
            data: [],
            backgroundColor: "#38bdf8",
            borderRadius: 4
          },
          {
            label: "Balance to Disburse (₹ Cr)",
            data: [],
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

    const ctxBottleneck = document.getElementById("bottleneckPieChart").getContext("2d");
    bottleneckChart = new Chart(ctxBottleneck, {
      type: "doughnut",
      data: {
        labels: [],
        datasets: [
          {
            data: [],
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

    updateCharts(getFilteredData());
  }

  function updateCharts(data) {
    if (!laoChart || !bottleneckChart) return;

    const laos = ["SDC Unit-I", "SDC Unit-II", "RDO Miryalaguda", "RDO Nalgonda", "PA to SPL Collector", "RDO Devarakonda"];
    const activeLaos = activeLao === "ALL" ? laos : [activeLao];

    const disbursedByLao = activeLaos.map((name) => {
      return data.filter((d) => d.lao === name).reduce((acc, d) => acc + (d.totalDisbursedCr || 0), 0);
    });

    const balanceByLao = activeLaos.map((name) => {
      return data.filter((d) => d.lao === name).reduce((acc, d) => acc + (d.balanceCr || 0), 0);
    });

    laoChart.data.labels = activeLaos.map((name) => name.replace("RDO ", "").replace("to SPL Collector", "(Spl)"));
    laoChart.data.datasets[0].data = disbursedByLao;
    laoChart.data.datasets[1].data = balanceByLao;
    laoChart.update();

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
      } else if (b.includes("title") || b.includes("survey")) {
        catMap["Title & Survey Disputes"] += (d.balanceCr || 0);
      } else if (b.includes("alignment")) {
        catMap["Alignment Issues"] += (d.balanceCr || 0);
      } else {
        catMap["Active In Progress"] += (d.balanceCr || 0);
      }
    });

    bottleneckChart.data.labels = Object.keys(catMap);
    bottleneckChart.data.datasets[0].data = Object.values(catMap);
    bottleneckChart.update();
  }

  /* ----------------------------------------------------
     CSV EXPORT
  ---------------------------------------------------- */
  function exportCSV() {
    const data = getSortedData(getFilteredData());
    if (data.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = [
      "Sl No",
      "LAO",
      "Project Name",
      "DTO Token & Date",
      "Date of Credit",
      "Released (Cr)",
      "Disbursed Yesterday (Cr)",
      "Disbursed Today (Cr)",
      "Total Disbursed (Cr)",
      "Balance (Cr)",
      "Total Beneficiaries",
      "Paid Beneficiaries",
      "Balance Beneficiaries",
      "Total Extent (Ac)",
      "Completed Extent (Ac)",
      "Balance Extent (Ac)",
      "Status",
      "Possession Handed Over",
      "Post Award Completed Extent",
      "Post Award Balance Extent",
      "Remarks"
    ];

    const rows = data.map((d) => [
      d.slNo,
      `"${d.lao || ''}"`,
      `"${d.project || ''}"`,
      `"${d.dtoToken || ''}"`,
      d.creditDate || '',
      d.releasedCr || 0,
      d.disbursedYesterdayCr || 0,
      d.disbursedTodayCr || 0,
      d.totalDisbursedCr || 0,
      d.balanceCr || 0,
      d.totalBeneficiaries || 0,
      d.beneficiariesPaid || 0,
      d.balanceBeneficiaries || 0,
      d.totalExtentAc || 0,
      d.paymentCompletedExtentAc || 0,
      d.balanceExtentAc || 0,
      `"${d.status || ''}"`,
      `"${d.possession || ''}"`,
      d.postAwardCompleted || 0,
      d.postAwardBalance || 0,
      `"${(d.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Nalgonda_LA_Payment_${currentSelectedSheet || "Report"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ----------------------------------------------------
     THEME TOGGLE
  ---------------------------------------------------- */
  function initTheme() {
    const saved = localStorage.getItem("la_theme") || "dark";
    if (saved === "light") {
      document.body.setAttribute("data-theme", "light");
    }
  }

  function toggleTheme() {
    const current = document.body.getAttribute("data-theme");
    if (current === "light") {
      document.body.removeAttribute("data-theme");
      localStorage.setItem("la_theme", "dark");
    } else {
      document.body.setAttribute("data-theme", "light");
      localStorage.setItem("la_theme", "light");
    }
    updateCharts(getFilteredData());
  }

  /* ----------------------------------------------------
     EVENT LISTENERS
  ---------------------------------------------------- */
  function setupEventListeners() {
    if (sheetSelect) {
      sheetSelect.addEventListener("change", (e) => {
        currentSelectedSheet = e.target.value;
        fetchGoogleSheetData(false, currentSelectedSheet);
      });
    }

    if (laoFilter) {
      laoFilter.addEventListener("change", (e) => {
        activeLao = e.target.value;
        activeProject = "ALL";
        renderLaoCircles(currentItems);
        renderProjectCircles(activeLao, currentItems);
        updateActiveLaoCircleUI();
        updateScopeBannerUI();
        applyFilters();
        renderSidebarLaoNav();
      });
    }

    if (closeProjectDrilldownBtn) {
      closeProjectDrilldownBtn.addEventListener("click", () => {
        activeProject = "ALL";
        renderProjectCircles(activeLao, currentItems);
        updateScopeBannerUI();
        applyFilters();
      });
    }

    if (resetProjectScopeBtn) {
      resetProjectScopeBtn.addEventListener("click", () => {
        activeProject = "ALL";
        renderProjectCircles(activeLao, currentItems);
        updateScopeBannerUI();
        applyFilters();
      });
    }

    if (resetScopeBtn) {
      resetScopeBtn.addEventListener("click", () => {
        activeLao = "ALL";
        activeProject = "ALL";
        if (laoFilter) laoFilter.value = "ALL";
        renderLaoCircles(currentItems);
        renderProjectCircles("ALL", currentItems);
        updateActiveLaoCircleUI();
        updateScopeBannerUI();
        applyFilters();
        renderSidebarLaoNav();
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener("change", (e) => {
        activeStatus = e.target.value;
        applyFilters();
      });
    }

    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      applyFilters();
    });

    bottleneckFilterChip.addEventListener("click", () => {
      bottleneckOnly = !bottleneckOnly;
      bottleneckFilterChip.classList.toggle("active", bottleneckOnly);
      applyFilters();
    });

    highExtentFilterChip.addEventListener("click", () => {
      highExtentOnly = !highExtentOnly;
      highExtentFilterChip.classList.toggle("active", highExtentOnly);
      applyFilters();
    });

    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const field = th.dataset.sort;
        if (sortField === field) {
          sortAsc = !sortAsc;
        } else {
          sortField = field;
          sortAsc = true;
        }

        document.querySelectorAll("th.sortable").forEach((h) => {
          h.classList.remove("sorted-asc", "sorted-desc");
        });
        th.classList.add(sortAsc ? "sorted-asc" : "sorted-desc");

        applyFilters();
      });
    });

    manualSyncBtn.addEventListener("click", () => fetchGoogleSheetData(false, currentSelectedSheet));
    exportCsvBtn.addEventListener("click", exportCSV);
    themeToggleBtn.addEventListener("click", toggleTheme);

    const printBtn = document.getElementById("printBtn");
    if (printBtn) {
      printBtn.addEventListener("click", () => {
        window.print();
      });
    }

    // Dashboard View Tabs
    document.querySelectorAll(".tab-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        switchDashboardTab(pill.dataset.tab);
      });
    });

    document.querySelectorAll(".sidebar-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchDashboardTab(btn.dataset.tab);
      });
    });

    // Mobile Drawer Controls
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener("click", openMobileSidebar);
    }

    const closeSidebarBtn = document.getElementById("closeSidebarBtn");
    if (closeSidebarBtn) {
      closeSidebarBtn.addEventListener("click", closeMobileSidebar);
    }

    const sidebarBackdrop = document.getElementById("sidebarBackdrop");
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener("click", closeMobileSidebar);
    }

    const mobileThemeToggleBtn = document.getElementById("mobileThemeToggleBtn");
    if (mobileThemeToggleBtn) {
      mobileThemeToggleBtn.addEventListener("click", toggleTheme);
    }
  }
});
