/**
 * app.js - Application Orchestrator for Nalgonda Land Acquisition Dashboard
 * ES Module: Orchestrates data, state, render, and charts.
 * No bundlers, zero build steps.
 */

import { fetchSheetData, KNOWN_SHEETS } from "./data.js";
import { appState, getFilteredItems, getSortedItems } from "./state.js";
import {
  renderResilienceBanner,
  renderTable,
  renderLaoCircles,
  renderProjectCircles,
  renderKPICards,
  renderScopeBanner,
  renderSidebarLaoNav,
  renderBottleneckGrid,
  renderWhatIfSimulator,
  formatCr
} from "./render.js";
import { initOrUpdateCharts, resizeCharts } from "./charts.js";

document.addEventListener("DOMContentLoaded", () => {
  let syncIntervalId = null;
  let countdownIntervalId = null;
  let searchDebounceTimeout = null;

  /* ----------------------------------------------------
     DOM CACHED REFERENCES
  ---------------------------------------------------- */
  const sheetSelect = document.getElementById("sheetSelect");
  const laoFilter = document.getElementById("laoFilter");
  const statusFilter = document.getElementById("statusFilter");
  const searchInput = document.getElementById("searchInput");
  const bottleneckFilterChip = document.getElementById("bottleneckFilterChip");
  const highExtentFilterChip = document.getElementById("highExtentFilterChip");

  const manualSyncBtn = document.getElementById("manualSyncBtn");
  const syncIcon = document.getElementById("syncIcon");
  const syncBtnText = document.getElementById("syncBtnText");
  const lastSyncedTime = document.getElementById("lastSyncedTime");
  const syncStatusText = document.getElementById("syncStatusText");
  const liveDot = document.getElementById("liveDot");

  const syncToast = document.getElementById("syncToast");
  const toastMessage = document.getElementById("toastMessage");

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const mobileThemeToggleBtn = document.getElementById("mobileThemeToggleBtn");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const closeSidebarBtn = document.getElementById("closeSidebarBtn");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const printBtn = document.getElementById("printBtn");

  /* ----------------------------------------------------
     INITIALIZE THEME & SHEET SELECTOR
  ---------------------------------------------------- */
  initTheme();
  initSheetDropdown();

  /* ----------------------------------------------------
     STATE SUBSCRIPTION & RENDER DISPATCHER
  ---------------------------------------------------- */
  appState.subscribe((state, event) => {
    // 1. Resilience Banner
    renderResilienceBanner(state, () => triggerSync(true));

    // 2. Master Table
    renderTable(state, {
      onToggleRow: (slNo) => {
        if (state.expandedRows.has(slNo)) {
          state.expandedRows.delete(slNo);
        } else {
          state.expandedRows.add(slNo);
        }
        appState.setState({ expandedRows: new Set(state.expandedRows) });
      },
      onSelectProject: (slNo) => {
        appState.setState({ activeProject: slNo });
      },
      onSendWhatsApp: (row) => sendProjectWhatsApp(row),
      onCopyWhatsApp: (row) => copyProjectWhatsApp(row),
      onResetFilters: () => resetAllFilters(),
      onRetry: () => triggerSync(true)
    });

    // 3. LAO Circles & Project Drilldown
    renderLaoCircles(state, (laoId) => {
      appState.setState({
        activeLao: laoId,
        activeProject: "ALL"
      });
      if (laoFilter) laoFilter.value = laoId;
    });

    renderProjectCircles(
      state,
      (projectSl) => {
        appState.setState({ activeProject: projectSl });
      },
      (project) => sendProjectWhatsApp(project)
    );

    // 4. KPIs & Scope
    renderKPICards(state);
    renderScopeBanner(state, {
      onResetDistrict: () => {
        appState.setState({ activeLao: "ALL", activeProject: "ALL" });
        if (laoFilter) laoFilter.value = "ALL";
      },
      onResetAuthority: () => {
        appState.setState({ activeProject: "ALL" });
      },
      onSendWhatsApp: (project) => sendProjectWhatsApp(project)
    });

    // 5. Sidebar Nav & Obstacles
    renderSidebarLaoNav(state, (laoId) => {
      appState.setState({
        activeLao: laoId,
        activeProject: "ALL"
      });
      if (laoFilter) laoFilter.value = laoId;
      closeMobileSidebar();
    });

    renderBottleneckGrid(state, (item) => sendBottleneckWhatsApp(item));

    // 6. What-If Simulator
    renderWhatIfSimulator(state, (scenarioKey, value) => {
      const scenarios = { ...state.simulatorScenarios, [scenarioKey]: value };
      appState.setState({ simulatorScenarios: scenarios });
    });

    // 7. Charts & Analytics
    initOrUpdateCharts(state);

    // 8. Sync indicators & Clock
    updateSyncClockUI(state);
  });

  /* ----------------------------------------------------
     INITIAL SYNC & SCHEDULE
  ---------------------------------------------------- */
  triggerSync(false);
  startAutoSyncTimer(300); // 5-minute polling

  /* ----------------------------------------------------
     EVENT LISTENERS & WIRING
  ---------------------------------------------------- */
  setupEventListeners();

  /* ----------------------------------------------------
     SYNC ORCHESTRATOR
  ---------------------------------------------------- */
  async function triggerSync(forceRefresh = false) {
    if (appState.syncState.status === "loading" && appState.rawItems.length > 0) return;

    appState.setState({
      syncState: {
        status: "loading",
        countdownSeconds: 300
      }
    });

    if (syncIcon) syncIcon.classList.add("spinning");
    if (syncBtnText) syncBtnText.textContent = "Syncing...";

    try {
      const result = await fetchSheetData(appState.currentSheet, forceRefresh);

      appState.setState({
        rawItems: result.items,
        asOnDate: result.asOnDate,
        syncState: {
          status: result.isCached ? "cached" : "success",
          isCached: result.isCached,
          isSeed: !!result.isSeed,
          cacheTime: result.cacheTime,
          lastSynced: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          errorMessage: result.error,
          countdownSeconds: 300
        }
      });

      if (!result.isCached) {
        showToast(`Synced ${result.items.length} records live from '${appState.currentSheet}'`);
      }
    } catch (err) {
      console.error("[app.js] Sync failed:", err);
      appState.setState({
        syncState: {
          status: "error",
          errorMessage: err.message,
          countdownSeconds: 300
        }
      });
    } finally {
      if (syncIcon) syncIcon.classList.remove("spinning");
      if (syncBtnText) syncBtnText.textContent = "Sync";
    }
  }

  function startAutoSyncTimer(intervalSeconds = 300) {
    if (syncIntervalId) clearInterval(syncIntervalId);
    if (countdownIntervalId) clearInterval(countdownIntervalId);

    // Countdown tick every 1 second
    countdownIntervalId = setInterval(() => {
      const nextSeconds = (appState.syncState.countdownSeconds || 300) - 1;
      if (nextSeconds <= 0) {
        appState.setState({ syncState: { countdownSeconds: intervalSeconds } });
        triggerSync(true);
      } else {
        appState.setState({ syncState: { countdownSeconds: nextSeconds } }, "tick");
      }
    }, 1000);
  }

  function updateSyncClockUI(state) {
    const { syncState, asOnDate } = state;

    if (lastSyncedTime) {
      if (syncState.status === "loading" && state.rawItems.length === 0) {
        lastSyncedTime.textContent = "Connecting to Google Sheets...";
      } else if (syncState.lastSynced) {
        const mins = Math.floor(syncState.countdownSeconds / 60);
        const secs = syncState.countdownSeconds % 60;
        const padSecs = secs < 10 ? `0${secs}` : secs;
        lastSyncedTime.textContent = `Last: ${syncState.lastSynced} • Next: ${mins}:${padSecs}`;
      } else {
        lastSyncedTime.textContent = "Last synced: Just now";
      }
    }

    if (syncStatusText && liveDot) {
      if (syncState.isCached) {
        syncStatusText.textContent = "Cached Mode";
        liveDot.style.background = "#f59e0b";
      } else if (syncState.status === "loading") {
        syncStatusText.textContent = "Syncing...";
        liveDot.style.background = "#38bdf8";
      } else {
        syncStatusText.textContent = "Live Connected";
        liveDot.style.background = "#10b981";
      }
    }

    const dateBadge = document.querySelector(".district-badge");
    if (dateBadge && asOnDate) {
      dateBadge.title = `Data As On: ${asOnDate}`;
    }
  }

  /* ----------------------------------------------------
     EVENT HANDLERS & NAVIGATION
  ---------------------------------------------------- */
  function setupEventListeners() {
    // Sheet selector
    if (sheetSelect) {
      sheetSelect.addEventListener("change", (e) => {
        const newSheet = e.target.value || KNOWN_SHEETS[0];
        appState.setState({ currentSheet: newSheet, rawItems: [] });
        triggerSync(true);
      });
    }

    // Manual sync button
    if (manualSyncBtn) {
      manualSyncBtn.addEventListener("click", () => triggerSync(true));
    }

    // Tab buttons (Sidebar & Top sticky pills)
    document.querySelectorAll(".sidebar-nav-btn, .tab-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (tab) switchDashboardTab(tab);
      });
    });

    // LAO Filter dropdown
    if (laoFilter) {
      laoFilter.addEventListener("change", (e) => {
        appState.setState({
          activeLao: e.target.value,
          activeProject: "ALL"
        });
      });
    }

    // Status Filter dropdown
    if (statusFilter) {
      statusFilter.addEventListener("change", (e) => {
        appState.setState({ activeStatus: e.target.value });
      });
    }

    // Search Input (Debounced 250ms)
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const val = e.target.value;
        if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
          appState.setState({ searchQuery: val });
        }, 250);
      });
    }

    // Bottleneck & High Extent Chips
    if (bottleneckFilterChip) {
      bottleneckFilterChip.addEventListener("click", () => {
        const next = !appState.bottleneckOnly;
        bottleneckFilterChip.classList.toggle("active", next);
        appState.setState({ bottleneckOnly: next });
      });
    }

    if (highExtentFilterChip) {
      highExtentFilterChip.addEventListener("click", () => {
        const next = !appState.highExtentOnly;
        highExtentFilterChip.classList.toggle("active", next);
        appState.setState({ highExtentOnly: next });
      });
    }

    // Column Header Sorting
    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const field = th.dataset.sort;
        if (appState.sortField === field) {
          appState.setState({ sortAsc: !appState.sortAsc });
        } else {
          appState.setState({ sortField: field, sortAsc: true });
        }
      });
    });

    // What-If Simulator Scenario Toggles
    const simChinthapally = document.getElementById("simChinthapally");
    const simPendlipakala = document.getElementById("simPendlipakala");
    const simMiryalaguda = document.getElementById("simMiryalaguda");
    const resetSimBtn = document.getElementById("resetSimBtn");

    if (simChinthapally) {
      simChinthapally.addEventListener("change", (e) => {
        appState.setState({
          simulatorScenarios: { ...appState.simulatorScenarios, chinthapally: e.target.checked }
        });
      });
    }

    if (simPendlipakala) {
      simPendlipakala.addEventListener("change", (e) => {
        appState.setState({
          simulatorScenarios: { ...appState.simulatorScenarios, pendlipakala: e.target.checked }
        });
      });
    }

    if (simMiryalaguda) {
      simMiryalaguda.addEventListener("change", (e) => {
        appState.setState({
          simulatorScenarios: { ...appState.simulatorScenarios, miryalaguda: e.target.checked }
        });
      });
    }

    if (resetSimBtn) {
      resetSimBtn.addEventListener("click", () => {
        appState.setState({
          simulatorScenarios: { chinthapally: false, pendlipakala: false, miryalaguda: false }
        });
      });
    }

    // Mobile Sidebar Drawer
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener("click", openMobileSidebar);
    }
    if (closeSidebarBtn) {
      closeSidebarBtn.addEventListener("click", closeMobileSidebar);
    }
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener("click", closeMobileSidebar);
    }

    // Theme toggle
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", toggleTheme);
    }
    if (mobileThemeToggleBtn) {
      mobileThemeToggleBtn.addEventListener("click", toggleTheme);
    }

    // Close Project drilldown button
    const closeProjectDrilldownBtn = document.getElementById("closeProjectDrilldownBtn");
    if (closeProjectDrilldownBtn) {
      closeProjectDrilldownBtn.addEventListener("click", () => {
        appState.setState({ activeProject: "ALL" });
      });
    }

    // CSV Export & Print
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", exportFilteredCSV);
    }
    if (printBtn) {
      printBtn.addEventListener("click", () => window.print());
    }
  }

  function switchDashboardTab(tabName) {
    appState.setState({ activeTab: tabName || "overview" });

    // Update Top Sticky Pills
    document.querySelectorAll(".tab-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === appState.activeTab);
    });

    // Update Sidebar Navigation Buttons
    document.querySelectorAll(".sidebar-nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === appState.activeTab);
    });

    const main = document.getElementById("dashboardMain");
    if (!main) return;

    if (appState.activeTab === "all") {
      main.classList.add("show-all-views");
      document.querySelectorAll(".tab-view-section").forEach((sec) => {
        sec.classList.add("active");
      });
    } else {
      main.classList.remove("show-all-views");
      document.querySelectorAll(".tab-view-section").forEach((sec) => {
        sec.classList.toggle("active", sec.id === `view-${appState.activeTab}`);
      });
    }

    // If analytics view or full view activated, draw/resize charts
    if (appState.activeTab === "analytics" || appState.activeTab === "all") {
      setTimeout(() => {
        initOrUpdateCharts(appState);
        resizeCharts();
      }, 60);
    }

    // Smooth scroll to top on tab switch
    window.scrollTo({ top: 0, behavior: "smooth" });
    closeMobileSidebar();
  }

  function resetAllFilters() {
    if (laoFilter) laoFilter.value = "ALL";
    if (statusFilter) statusFilter.value = "ALL";
    if (searchInput) searchInput.value = "";
    if (bottleneckFilterChip) bottleneckFilterChip.classList.remove("active");
    if (highExtentFilterChip) highExtentFilterChip.classList.remove("active");

    appState.setState({
      activeLao: "ALL",
      activeProject: "ALL",
      activeStatus: "ALL",
      searchQuery: "",
      bottleneckOnly: false,
      highExtentOnly: false
    });
  }

  function initSheetDropdown() {
    if (!sheetSelect) return;
    sheetSelect.innerHTML = "";
    KNOWN_SHEETS.forEach((name, idx) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = idx === 0 ? `${name} (Latest)` : name;
      sheetSelect.appendChild(opt);
    });
    sheetSelect.value = appState.currentSheet;
  }

  /* ----------------------------------------------------
     THEME HANDLING
  ---------------------------------------------------- */
  function initTheme() {
    const savedTheme = localStorage.getItem("nalgonda_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("nalgonda_theme", next);
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

  function showToast(msg) {
    if (!syncToast || !toastMessage) return;
    toastMessage.textContent = msg;
    syncToast.classList.add("show");
    setTimeout(() => {
      syncToast.classList.remove("show");
    }, 3200);
  }

  /* ----------------------------------------------------
     WHATSAPP GENERATION & SHARING
  ---------------------------------------------------- */
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

    let statusBadge = (p.status || "In Progress").toUpperCase();

    return `━━━━━━━━━━━━━━━━━━━━━━
🏛️ *GOVERNMENT OF TELANGANA*
📊 *Land Acquisition & Payment Monitor*
🏢 *District Collectorate, Nalgonda*
━━━━━━━━━━━━━━━━━━━━━━

📍 *PROJECT DETAILS*
🔹 *Project:* *${p.project}* (Sl #${p.slNo})
🏢 *Authority (LAO):* 🏛️ *${p.lao}*
⚡ *Current Status:* *${statusBadge}*

━━━━━━━━━━━━━━━━━━━━━━
💰 *FINANCIAL DISBURSEMENT*
📈 Progress: *${pct}%*
💵 Total Released: *₹${rel.toFixed(2)} Cr*
✅ Total Disbursed: *₹${dis.toFixed(2)} Cr*
⚡ Disbursed Today: *₹${dtToday} Cr*
⏳ Upto Yesterday: *₹${dtYest} Cr*
🔴 Balance to Disburse: *₹${bal.toFixed(2)} Cr*

━━━━━━━━━━━━━━━━━━━━━━
👥 *BENEFICIARIES (AWARDEES)*
📊 Covered: *${benPct}%*
🎯 Total Awardees: *${totalBen.toLocaleString()}*
🟢 Awardees Paid: *${paidBen.toLocaleString()}*
🟡 Pending Payment: *${balBen.toLocaleString()}*

━━━━━━━━━━━━━━━━━━━━━━
📐 *LAND ACQUISITION EXTENT*
📊 Secured: *${extPct}%*
🌱 Total Extent: *${totalExt} Ac*
🟢 Payment Completed: *${compExt} Ac*
🟠 Balance Extent: *${balExt} Ac*

━━━━━━━━━━━━━━━━━━━━━━
📋 *GROUND RECONCILIATION*
🔹 DTO Token: *${p.dtoToken || 'N/A'}*
🔹 Credit Date: *${p.creditDate || 'N/A'}*
🔹 Possession: *${p.possession || 'Pending'}*
⚠️ Bottleneck: *${p.bottleneckCategory}*

📝 *FIELD REMARKS & STATUS:*
"${p.remarks || 'No remarks recorded.'}"
━━━━━━━━━━━━━━━━━━━━━━
📅 *Report Snapshot:* ${reportDate || appState.currentSheet}
🔗 *Live Monitor:* https://nalgonda-la-dashboard.vercel.app/`;
  }

  function sendProjectWhatsApp(p) {
    if (!p) return;
    const msg = generateWhatsAppProjectMessage(p, appState.currentSheet);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  function copyProjectWhatsApp(p) {
    if (!p) return;
    const msg = generateWhatsAppProjectMessage(p, appState.currentSheet);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).then(() => {
        showToast(`WhatsApp status for "${p.project}" copied!`);
      }).catch(() => {
        fallbackCopyText(msg);
      });
    } else {
      fallbackCopyText(msg);
    }
  }

  function sendBottleneckWhatsApp(item) {
    const msg = `🚨 *LAND ACQUISITION BOTTLENECK ALERT*
*District Collectorate, Nalgonda*
────────────────────────
⚠️ *OBSTACLE:* ${item.title}
🏢 *AUTHORITY:* ${item.lao}
🔴 *URGENCY:* ${item.urgency.toUpperCase()}
💰 *BLOCKED AMOUNT:* ${item.amount}
📐 *AFFECTED EXTENT:* ${item.extent}
👥 *AFFECTED TARGET:* ${item.beneficiaries}

📝 *SITUATION SUMMARY:*
${item.description}

⚡ *RECOMMENDED ACTION:*
${item.actionItem}
────────────────────────
🔗 *Live Portal:* https://nalgonda-la-dashboard.vercel.app/`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function fallbackCopyText(text) {
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
      showToast("Copied to clipboard!");
    } catch (err) {
      showToast("Failed to copy automatically");
    }
    document.body.removeChild(textArea);
  }

  /* ----------------------------------------------------
     CSV EXPORT (CURRENT FILTERED VIEW)
  ---------------------------------------------------- */
  function exportFilteredCSV() {
    const data = getSortedItems(getFilteredItems(appState), appState.sortField, appState.sortAsc);
    if (!data || data.length === 0) {
      alert("No records to export with current filters.");
      return;
    }

    const headers = [
      "Sl No",
      "LAO",
      "Project Name",
      "DTO Token No",
      "Date of Credit",
      "Released (Cr)",
      "Disbursed Yesterday (Cr)",
      "Disbursed Today (Cr)",
      "Total Disbursed (Cr)",
      "Balance (Cr)",
      "Total Beneficiaries",
      "Beneficiaries Paid",
      "Balance Beneficiaries",
      "Total Extent (Ac)",
      "Completed Extent (Ac)",
      "Balance Extent (Ac)",
      "Status",
      "Possession",
      "Bottleneck Category",
      "Remarks"
    ];

    const rows = data.map((r) => [
      r.slNo,
      `"${(r.lao || '').replace(/"/g, '""')}"`,
      `"${(r.project || '').replace(/"/g, '""')}"`,
      `"${(r.dtoToken || '').replace(/"/g, '""')}"`,
      `"${(r.creditDate || '').replace(/"/g, '""')}"`,
      r.releasedCr,
      r.disbursedYesterdayCr,
      r.disbursedTodayCr,
      r.totalDisbursedCr,
      r.balanceCr,
      r.totalBeneficiaries,
      r.beneficiariesPaid,
      r.balanceBeneficiaries,
      r.totalExtentAc,
      r.paymentCompletedExtentAc,
      r.balanceExtentAc,
      `"${(r.status || '').replace(/"/g, '""')}"`,
      `"${(r.possession || '').replace(/"/g, '""')}"`,
      `"${(r.bottleneckCategory || '').replace(/"/g, '""')}"`,
      `"${(r.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const safeSheet = appState.currentSheet.replace(/\s+/g, "_");
    link.setAttribute("download", `Nalgonda_LA_${safeSheet}_filtered.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
