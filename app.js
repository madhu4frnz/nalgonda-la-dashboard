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
  let activeStatus = "ALL";
  let searchQuery = "";
  let bottleneckOnly = false;
  let highExtentOnly = false;
  let sortField = "slNo";
  let sortAsc = true;
  let expandedRows = new Set();

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

  // Simulator Elements
  const simChinthapally = document.getElementById("simChinthapally");
  const simPendlipakala = document.getElementById("simPendlipakala");
  const simMiryalaguda = document.getElementById("simMiryalaguda");
  const resetSimBtn = document.getElementById("resetSimBtn");
  const simPct = document.getElementById("simPct");
  const simDisbursed = document.getElementById("simDisbursed");
  const simClearedBeneficiaries = document.getElementById("simClearedBeneficiaries");
  const simClearedExtent = document.getElementById("simClearedExtent");

  // Initialize
  initTheme();
  initSheetDropdown();
  renderLaoCircles(currentItems);
  renderBottleneckGrid();
  initCharts();
  applyFilters();
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
    applyFilters();

    if (!isInitial) {
      showToast(`Synced ${items.length} records live from '${sheetName}'`);
    }
  }

  /* ----------------------------------------------------
     INTERACTIVE LAO CIRCULAR BADGES
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
        <div class="lao-circle-amount">₹${disbursed.toFixed(1)} Cr</div>
        <div class="lao-circle-stat">${schemesCount} Schemes</div>
      `;

      card.addEventListener("click", () => {
        if (activeLao === lao.id && lao.id !== "ALL") {
          activeLao = "ALL";
        } else {
          activeLao = lao.id;
        }

        if (laoFilter) laoFilter.value = activeLao;
        updateActiveLaoCircleUI();
        applyFilters();
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

    updateKPICards(filtered);
    renderTable(sorted);
    updateCharts(filtered);
  }

  /* ----------------------------------------------------
     KPI CARDS & RADIAL PROGRESS UPDATE
  ---------------------------------------------------- */
  function updateKPICards(data) {
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

    document.getElementById("kpiDisbursedCr").textContent = `₹${totalDisbursed.toFixed(2)}`;
    document.getElementById("kpiReleasedCr").textContent = `₹${totalReleased.toFixed(2)} Cr`;
    document.getElementById("kpiBalanceCr").textContent = `₹${totalBalance.toFixed(2)} Cr`;
    
    const disbursedTodayElem = document.getElementById("kpiDisbursedTodayCr");
    if (disbursedTodayElem) {
      disbursedTodayElem.textContent = `₹${totalDisbursedToday.toFixed(2)} Cr`;
    }

    document.getElementById("fundsPct").textContent = `${fundsPct.toFixed(1)}%`;
    setRadialGauge("fundsGaugeBar", fundsPct);

    document.getElementById("kpiPaidBeneficiaries").textContent = paidBeneficiaries.toLocaleString();
    document.getElementById("kpiTotalBeneficiaries").textContent = totalBeneficiaries.toLocaleString();
    document.getElementById("kpiPendingBeneficiaries").textContent = pendingBeneficiaries.toLocaleString();
    document.getElementById("beneficiaryPct").textContent = `${benPct.toFixed(1)}%`;
    setRadialGauge("beneficiaryGaugeBar", benPct);

    document.getElementById("kpiCompletedExtent").textContent = completedExtent.toFixed(2);
    document.getElementById("kpiTotalExtent").textContent = `${totalExtent.toFixed(2)} Ac`;
    document.getElementById("kpiBalanceExtent").textContent = `${balanceExtent.toFixed(2)} Ac`;
    document.getElementById("extentPct").textContent = `${extPct.toFixed(1)}%`;
    setRadialGauge("extentGaugeBar", extPct);

    document.getElementById("kpiTotalProjects").textContent = data.length;
    document.getElementById("kpiCompletedUnits").textContent = `${completedUnits} Completed`;
    document.getElementById("kpiActiveUnits").textContent = `${activeUnits} In Progress`;
    const projRatio = data.length > 0 ? (completedUnits / data.length) * 100 : 0;
    setRadialGauge("projectGaugeBar", projRatio);
  }

  function setRadialGauge(elementId, percentage) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const clamped = Math.max(0, Math.min(100, percentage));
    el.setAttribute("stroke-dasharray", `${clamped.toFixed(2)}, 100`);
  }

  /* ----------------------------------------------------
     TABLE RENDERING & INTERACTIVITY
  ---------------------------------------------------- */
  function renderTable(data) {
    tableRecordCount.textContent = `Showing ${data.length} of ${currentItems.length} records`;
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
        <td>
          <button class="btn-icon expand-btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
            ${isExpanded ? "▲ Hide" : "▼ Info"}
          </button>
        </td>
      `;

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
            </div>
          </td>
        `;
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

    highlights.forEach((item) => {
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
        <div class="bottleneck-action">
          <strong>Key Action:</strong> ${item.actionItem}
        </div>
      `;
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
     SCENARIO SIMULATOR
  ---------------------------------------------------- */
  function updateSimulation() {
    let additionalDisbursed = 0;
    let additionalBeneficiaries = 0;
    let additionalExtent = 0;

    if (simChinthapally && simChinthapally.checked) {
      additionalDisbursed += 82.98;
      additionalBeneficiaries += 716;
      additionalExtent += 814.73;
    }
    if (simPendlipakala && simPendlipakala.checked) {
      additionalDisbursed += 54.61;
      additionalBeneficiaries += 297;
      additionalExtent += 343.42;
    }
    if (simMiryalaguda && simMiryalaguda.checked) {
      additionalDisbursed += 14.39;
      additionalBeneficiaries += 880;
      additionalExtent += 49.88;
    }

    const baselineDisbursed = 171.18;
    const totalFunds = 362.95;
    const simulatedTotal = baselineDisbursed + additionalDisbursed;
    const simulatedPct = (simulatedTotal / totalFunds) * 100;

    if (simPct) simPct.textContent = `${simulatedPct.toFixed(1)}%`;
    if (simDisbursed) simDisbursed.textContent = `₹${simulatedTotal.toFixed(2)} Cr`;
    if (simClearedBeneficiaries) simClearedBeneficiaries.textContent = `+${additionalBeneficiaries.toLocaleString()}`;
    if (simClearedExtent) simClearedExtent.textContent = `+${additionalExtent.toFixed(2)} Ac`;

    const banner = document.getElementById("simResultsBanner");
    if (banner) {
      if (additionalDisbursed > 0) {
        banner.style.background = "rgba(16, 185, 129, 0.25)";
        banner.style.border = "1px solid #10b981";
      } else {
        banner.style.background = "rgba(16, 185, 129, 0.1)";
        banner.style.border = "1px solid rgba(16, 185, 129, 0.25)";
      }
    }
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

    laoFilter.addEventListener("change", (e) => {
      activeLao = e.target.value;
      updateActiveLaoCircleUI();
      applyFilters();
    });

    statusFilter.addEventListener("change", (e) => {
      activeStatus = e.target.value;
      applyFilters();
    });

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

    if (simChinthapally) simChinthapally.addEventListener("change", updateSimulation);
    if (simPendlipakala) simPendlipakala.addEventListener("change", updateSimulation);
    if (simMiryalaguda) simMiryalaguda.addEventListener("change", updateSimulation);

    if (resetSimBtn) {
      resetSimBtn.addEventListener("click", () => {
        if (simChinthapally) simChinthapally.checked = false;
        if (simPendlipakala) simPendlipakala.checked = false;
        if (simMiryalaguda) simMiryalaguda.checked = false;
        updateSimulation();
      });
    }
  }
});
