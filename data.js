/**
 * data.js - Data Layer for Nalgonda Land Acquisition Dashboard
 * ES Module: Fetch + Parse + Normalise + Cache
 * No bundlers, no build step.
 */

export const SPREADSHEET_ID = "1XAJwRAT1jI4TRYiDVjsAtGTkWZJYfeYP8hHtaTxfGe0";
export const GVIZ_JSON_BASE = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;

export const KNOWN_SHEETS = [
  "Daily report 07.09.2026",
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

export const BOTTLENECK_HIGHLIGHTS = [
  {
    title: "Chinthapally Reservoir (₹82.98 Cr Pending)",
    lao: "PA to SPL Collector",
    urgency: "high",
    amount: "₹82.98 Cr",
    extent: "814.73 Ac",
    beneficiaries: "716 Pending",
    description: "Ac. 590.04 gts (General Award) awardees refusing compensation demanding higher rates. Ac. 224.09 gts consent award revised proposal submitted to District Collector.",
    actionItem: "Expedite Collectorate approval on revised consent proposals; hold stakeholder negotiation meeting."
  },
  {
    title: "Pendlipakala Balancing Reservoir (₹54.61 Cr Pending)",
    lao: "SDC Unit-I",
    urgency: "high",
    amount: "₹54.61 Cr",
    extent: "343.42 Ac",
    beneficiaries: "297 Pending",
    description: "Substantial funds remaining for 297 beneficiaries across Ac. 343.42. ₹113.65 Cr disbursed so far.",
    actionItem: "Accelerate verification camps and DTO clearance for remaining 297 awardees."
  },
  {
    title: "Nellikal & Dunnapothula Gandi (Title & Survey Disputes)",
    lao: "RDO Miryalaguda",
    urgency: "medium",
    amount: "₹14.39 Cr",
    extent: "49.88 Ac",
    beneficiaries: "880 Pending",
    description: "880 beneficiaries delayed due to vivat khbaja issues and pending title reports on Government land survey numbers.",
    actionItem: "Revenue and Survey team target completion in 15-20 days SLA."
  },
  {
    title: "Wattimarthy Village Rate Enhancement Claim",
    lao: "SDC Unit-II",
    urgency: "medium",
    amount: "₹12.00 Cr",
    extent: "33.12 Ac",
    beneficiaries: "Award Pending",
    description: "Villagers demanding compensation at ₹5,40,000/acre vs preliminary notification value of ₹2,70,000/acre.",
    actionItem: "Negotiation committee review on prevailing guideline values."
  }
];

export function isExcludedLao(lao) {
  return false; // Include 100% of records from Google Sheet without exclusions
}

export const SEED_ITEMS = [
  {
    slNo: 1,
    lao: "SDC Unit-I",
    project: "USBR",
    dtoToken: "2700676998, 07.06.2026",
    creditDate: "28.07.2026",
    releasedCr: 1.88,
    disbursedYesterdayCr: 1.88,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 1.88,
    balanceCr: 0.00,
    totalBeneficiaries: 1,
    beneficiariesPaid: 1,
    balanceBeneficiaries: 0,
    totalExtentAc: 5.00,
    paymentCompletedExtentAc: 5.00,
    balanceExtentAc: 0.00,
    status: "Completed",
    possession: "Completed",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Submerged under UBR. Payment completed.",
    bottleneckCategory: "None"
  },
  {
    slNo: 2,
    lao: "SDC Unit-I",
    project: "Pendlipakala Balancing Reservoir",
    dtoToken: "2522922019, 15.10.2024",
    creditDate: "30.05.2026",
    releasedCr: 11.19,
    disbursedYesterdayCr: 11.19,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 11.19,
    balanceCr: 0.00,
    totalBeneficiaries: 259,
    beneficiariesPaid: 259,
    balanceBeneficiaries: 0,
    totalExtentAc: 51.91,
    paymentCompletedExtentAc: 51.91,
    balanceExtentAc: 0.00,
    status: "Completed",
    possession: "No",
    postAwardCompleted: 0,
    postAwardBalance: 54,
    remarks: "₹27.26 Crores credited, out of which ₹11.19 Crores were disbursed, ₹16.06 Crores transferred to RDO, Devarakonda.",
    bottleneckCategory: "None"
  },
  {
    slNo: 3,
    lao: "SDC Unit-I",
    project: "Pendlipakala Balancing Reservoir",
    dtoToken: "2700673924, 07.06.2026",
    creditDate: "28.07.2026",
    releasedCr: 168.26,
    disbursedYesterdayCr: 113.65,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 113.65,
    balanceCr: 54.61,
    totalBeneficiaries: 444,
    beneficiariesPaid: 147,
    balanceBeneficiaries: 297,
    totalExtentAc: 520.19,
    paymentCompletedExtentAc: 176.77,
    balanceExtentAc: 343.42,
    status: "In Progress",
    possession: "No",
    postAwardCompleted: 0,
    postAwardBalance: 297,
    remarks: "Payment in Progress for 297 Beneficiaries.",
    bottleneckCategory: "Active Disbursement"
  },
  {
    slNo: 4,
    lao: "SDC Unit-II",
    project: "USLIS",
    dtoToken: "2523802411, 28.01.2025",
    creditDate: "30.05.2026",
    releasedCr: 11.00,
    disbursedYesterdayCr: 7.36,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 7.36,
    balanceCr: 3.64,
    totalBeneficiaries: 135,
    beneficiariesPaid: 135,
    balanceBeneficiaries: 0,
    totalExtentAc: 38.32,
    paymentCompletedExtentAc: 38.32,
    balanceExtentAc: 0.00,
    status: "Completed",
    possession: "Completed",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Remaining amount will be used for Wattimarthy Village. After Award passed compensation will be paid.",
    bottleneckCategory: "None"
  },
  {
    slNo: 5,
    lao: "SDC Unit-II",
    project: "USLIS",
    dtoToken: "2700677030, 07.06.2026",
    creditDate: "28.07.2026",
    releasedCr: 12.00,
    disbursedYesterdayCr: 0.00,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 0.00,
    balanceCr: 12.00,
    totalBeneficiaries: 0,
    beneficiariesPaid: 0,
    balanceBeneficiaries: 0,
    totalExtentAc: 33.12,
    paymentCompletedExtentAc: 0.00,
    balanceExtentAc: 33.12,
    status: "Award Pending",
    possession: "No",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Wattimarthy Award to be passed. Villagers requesting enhanced compensation @ ₹5,40,000/- vs ₹2,70,000/-.",
    bottleneckCategory: "Market Value Revision"
  },
  {
    slNo: 6,
    lao: "SDC Unit-II",
    project: "USLIS",
    dtoToken: "2700677054, 07.06.2026",
    creditDate: "28.07.2026",
    releasedCr: 4.00,
    disbursedYesterdayCr: 0.00,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 0.00,
    balanceCr: 4.00,
    totalBeneficiaries: 0,
    beneficiariesPaid: 0,
    balanceBeneficiaries: 0,
    totalExtentAc: 0.00,
    paymentCompletedExtentAc: 0.00,
    balanceExtentAc: 0.00,
    status: "Award Pending",
    possession: "No",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Kondapokoni Gudem & Vanipakala (Ac.6.31 gts) under Award enquiry notices issued.",
    bottleneckCategory: "Award Enquiry Pending"
  },
  {
    slNo: 7,
    lao: "SDC Unit-II",
    project: "Dindi Main canal",
    dtoToken: "2523816396, 31.01.2025",
    creditDate: "28.07.2026",
    releasedCr: 1.00,
    disbursedYesterdayCr: 0.00,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 0.00,
    balanceCr: 1.00,
    totalBeneficiaries: 0,
    beneficiariesPaid: 0,
    balanceBeneficiaries: 0,
    totalExtentAc: 0.00,
    paymentCompletedExtentAc: 0.00,
    balanceExtentAc: 0.00,
    status: "In Progress",
    possession: "No",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "No Land Acquisition Payment pending.",
    bottleneckCategory: "None"
  },
  {
    slNo: 8,
    lao: "RDO Miryalaguda",
    project: "Dunnapothula gandi Lift Irrgaition",
    dtoToken: "2701729731, 01.08.2026",
    creditDate: "18.08.2026",
    releasedCr: 3.60,
    disbursedYesterdayCr: 1.26,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 1.26,
    balanceCr: 2.34,
    totalBeneficiaries: 76,
    beneficiariesPaid: 46,
    balanceBeneficiaries: 30,
    totalExtentAc: 4.69,
    paymentCompletedExtentAc: 2.65,
    balanceExtentAc: 2.04,
    status: "In Progress",
    possession: "Yes",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Award passed. S.D.R Stage. In Sy.No. 159 to an extent of Ac.2-02 Gts Govt land involved.",
    bottleneckCategory: "Title & Survey Dispute"
  },
  {
    slNo: 9,
    lao: "RDO Miryalaguda",
    project: "Nellikal Lift Irrigation",
    dtoToken: "2701729732, 01.08.2026",
    creditDate: "18.08.2026",
    releasedCr: 12.30,
    disbursedYesterdayCr: 0.25,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 0.25,
    balanceCr: 12.05,
    totalBeneficiaries: 850,
    beneficiariesPaid: 46,
    balanceBeneficiaries: 804,
    totalExtentAc: 45.19,
    paymentCompletedExtentAc: 2.21,
    balanceExtentAc: 42.98,
    status: "In Progress",
    possession: "Pending",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Total Award Amount Rs 3.23 Cr. Vivat Khbaja issues pending for remaining beneficiaries.",
    bottleneckCategory: "Title & Survey Dispute"
  },
  {
    slNo: 10,
    lao: "RDO Nalgonda",
    project: "USBR",
    dtoToken: "2700676994, 07.06.2026",
    creditDate: "28.07.2026",
    releasedCr: 5.845,
    disbursedYesterdayCr: 5.845,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 5.845,
    balanceCr: 0.00,
    totalBeneficiaries: 23,
    beneficiariesPaid: 23,
    balanceBeneficiaries: 0,
    totalExtentAc: 18.27,
    paymentCompletedExtentAc: 18.27,
    balanceExtentAc: 0.00,
    status: "Completed",
    possession: "Completed",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Payment completed for entire extent.",
    bottleneckCategory: "None"
  },
  {
    slNo: 11,
    lao: "RDO Nalgonda",
    project: "USLIS",
    dtoToken: "2700677051, 07.06.2026",
    creditDate: "28.07.2026",
    releasedCr: 5.00,
    disbursedYesterdayCr: 0.00,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 0.00,
    balanceCr: 5.00,
    totalBeneficiaries: 0,
    beneficiariesPaid: 0,
    balanceBeneficiaries: 0,
    totalExtentAc: 0.00,
    paymentCompletedExtentAc: 0.00,
    balanceExtentAc: 0.00,
    status: "In Progress",
    possession: "No",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Award enquiry completed; proposals under scrutiny.",
    bottleneckCategory: "Award Enquiry Pending"
  },
  {
    slNo: 12,
    lao: "PA to SPL Collector",
    project: "Dindi Main canal",
    dtoToken: "2523816400, 31.01.2025",
    creditDate: "30.05.2026",
    releasedCr: 6.00,
    disbursedYesterdayCr: 3.53,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 3.53,
    balanceCr: 2.47,
    totalBeneficiaries: 141,
    beneficiariesPaid: 104,
    balanceBeneficiaries: 37,
    totalExtentAc: 28.00,
    paymentCompletedExtentAc: 18.39,
    balanceExtentAc: 9.61,
    status: "In Progress",
    possession: "Yes",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Out of 141 awardees, 104 paid. Balance 37 under verification.",
    bottleneckCategory: "Active Disbursement"
  },
  {
    slNo: 13,
    lao: "PA to SPL Collector",
    project: "Chinthapally Reservoir",
    dtoToken: "2701729735, 01.08.2026",
    creditDate: "18.08.2026",
    releasedCr: 85.32,
    disbursedYesterdayCr: 2.34,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 2.34,
    balanceCr: 82.98,
    totalBeneficiaries: 742,
    beneficiariesPaid: 26,
    balanceBeneficiaries: 716,
    totalExtentAc: 839.11,
    paymentCompletedExtentAc: 24.38,
    balanceExtentAc: 814.73,
    status: "In Progress",
    possession: "Partial",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Ac. 590.04 gts awardees demanding higher compensation. Ac. 224.09 gts consent proposal sent to Collector.",
    bottleneckCategory: "Market Value Revision"
  },
  {
    slNo: 14,
    lao: "RDO Devarakonda",
    project: "Akkampally Reservoir (Lift)",
    dtoToken: "2700673923, 07.06.2026",
    creditDate: "18.08.2026",
    releasedCr: 0.52,
    disbursedYesterdayCr: 0.52,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 0.52,
    balanceCr: 0.00,
    totalBeneficiaries: 44,
    beneficiariesPaid: 44,
    balanceBeneficiaries: 0,
    totalExtentAc: 4.28,
    paymentCompletedExtentAc: 4.28,
    balanceExtentAc: 0.00,
    status: "Completed",
    possession: "Yes",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Payment completed. Possession handed over to the irrigation Department",
    bottleneckCategory: "None"
  },
  {
    slNo: 15,
    lao: "RDO Devarakonda",
    project: "Ambabhavani lift irrigation",
    dtoToken: "2523500831, 18.12.2024",
    creditDate: "28.07.2026",
    releasedCr: 0.32,
    disbursedYesterdayCr: 0.32,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 0.32,
    balanceCr: 0.00,
    totalBeneficiaries: 35,
    beneficiariesPaid: 35,
    balanceBeneficiaries: 0,
    totalExtentAc: 4.11,
    paymentCompletedExtentAc: 4.11,
    balanceExtentAc: 0.00,
    status: "Completed",
    possession: "Yes",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Payment completed. Possession handed over to the irrigation Department",
    bottleneckCategory: "None"
  },
  {
    slNo: 16,
    lao: "RDO Devarakonda",
    project: "Pendlipakala balancing Reservoir (LA for R&R Centre)",
    dtoToken: "2522922019, 15.10.2024",
    creditDate: "30.05.2026",
    releasedCr: 16.03,
    disbursedYesterdayCr: 10.95,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 10.95,
    balanceCr: 5.08,
    totalBeneficiaries: 51,
    beneficiariesPaid: 29,
    balanceBeneficiaries: 22,
    totalExtentAc: 79.07,
    paymentCompletedExtentAc: 39.25,
    balanceExtentAc: 39.82,
    status: "In Progress",
    possession: "In Process",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Gummadavelly Village awardees not willing to receive the compensation due to alignment issue.",
    bottleneckCategory: "Alignment Dispute"
  },
  {
    slNo: 17,
    lao: "RDO Devarakonda",
    project: "Kistrainpally Balancing Reservoir",
    dtoToken: "2523802442, 28.01.2025",
    creditDate: "28.07.2026",
    releasedCr: 3.18,
    disbursedYesterdayCr: 0.00,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 0.00,
    balanceCr: 3.18,
    totalBeneficiaries: 18,
    beneficiariesPaid: 0,
    balanceBeneficiaries: 18,
    totalExtentAc: 26.00,
    paymentCompletedExtentAc: 0.00,
    balanceExtentAc: 26.00,
    status: "In Progress",
    possession: "Pending",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "Not willing to take compensation. Requesting to enhance compensation amount in view of market value revision.",
    bottleneckCategory: "Market Value Revision"
  },
  {
    slNo: 18,
    lao: "RDO Devarakonda",
    project: "Shivannagudem Balancing Reservoir",
    dtoToken: "2701729737, 01.08.2026",
    creditDate: "18.08.2026",
    releasedCr: 15.50,
    disbursedYesterdayCr: 12.08,
    disbursedTodayCr: 0.00,
    totalDisbursedCr: 12.08,
    balanceCr: 3.42,
    totalBeneficiaries: 22,
    beneficiariesPaid: 18,
    balanceBeneficiaries: 4,
    totalExtentAc: 54.23,
    paymentCompletedExtentAc: 43.23,
    balanceExtentAc: 11.00,
    status: "In Progress",
    possession: "Pending",
    postAwardCompleted: null,
    postAwardBalance: null,
    remarks: "The District Collector Nalgonda has conducted the meeting in the Village level in presence of the Hon'ble MLA Devarakonda, interacted with the Awardees and also convinced them to receive the compensation. Accordingly payments are under process.",
    bottleneckCategory: "Active Disbursement"
  }
];

/* ----------------------------------------------------
   NUMERICAL AND STRING COERCION
---------------------------------------------------- */
export function cleanNum(v) {
  if (v === null || v === undefined || v === "") return 0.0;
  if (typeof v === "number") return isNaN(v) ? 0.0 : v;
  const cleaned = String(v).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0.0 : num;
}

export function cleanInt(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : Math.round(v);
  const cleaned = String(v).replace(/[^0-9.-]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

export function cleanStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim().replace(/\s+/g, " ");
}

/* ----------------------------------------------------
   LOCAL STORAGE CACHING
---------------------------------------------------- */
const CACHE_PREFIX = "nalgonda_la_cache_v5_2_";

export function getCachedData(sheetName) {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(CACHE_PREFIX + (sheetName || "default"));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
      parsed.items = parsed.items.filter(it => !isExcludedLao(it.lao));
      return parsed;
    }
  } catch (err) {
    console.warn("Could not read localStorage cache:", err);
  }
  return null;
}

export function setCachedData(sheetName, payload) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      CACHE_PREFIX + (sheetName || "default"),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        asOnDate: payload.asOnDate || "06.09.2026",
        items: payload.items || []
      })
    );
  } catch (err) {
    console.warn("Could not write to localStorage:", err);
  }
}

/* ----------------------------------------------------
   SEMANTIC COLUMN MAPPING FROM GVIZ COLS
---------------------------------------------------- */
function buildColumnIndexMap(cols) {
  const map = {};
  cols.forEach((col, idx) => {
    const label = cleanStr(col ? col.label : "").toLowerCase();
    if (!label) return;

    if (label.includes("sl") && label.includes("no") && map.slNo === undefined) map.slNo = idx;
    else if (label.includes("lao") && map.lao === undefined) map.lao = idx;
    else if (label.includes("project") && map.project === undefined) map.project = idx;
    else if ((label.includes("dto") || label.includes("token")) && map.dtoToken === undefined) map.dtoToken = idx;
    else if (label.includes("credit") && label.includes("date") && map.creditDate === undefined) map.creditDate = idx;
    else if ((label.includes("amount released") || label.includes("released in crores")) && map.releasedCr === undefined) map.releasedCr = idx;
    else if (label.includes("yesterday") && map.disbursedYesterday === undefined) map.disbursedYesterday = idx;
    else if ((label.includes("to day") || label.includes("today")) && map.disbursedToday === undefined) map.disbursedToday = idx;
    else if ((label.includes("total amount disbursed") || label.includes("disbursed so far")) && map.totalDisbursed === undefined) map.totalDisbursed = idx;
    else if ((label.includes("balance to be disbursed") || (label.startsWith("balance") && label.includes("cr"))) && map.balanceCr === undefined) map.balanceCr = idx;
    else if ((label.includes("benefic") || label.includes("awardees")) && (label.includes("total") || label.includes("covered")) && map.totalBen === undefined) map.totalBen = idx;
    else if ((label.includes("benefic") || label.includes("awardees")) && label.includes("paid") && !label.includes("balance") && map.paidBen === undefined) map.paidBen = idx;
    else if ((label.includes("benefic") || label.includes("awardees")) && label.includes("balance") && map.balanceBen === undefined) map.balanceBen = idx;
    else if (label.includes("extent") && (label.includes("total") || label.includes("covered")) && !label.includes("post") && map.totalExtent === undefined) map.totalExtent = idx;
    else if (label.includes("extent") && (label.includes("payment completed") || label.includes("completed for extent")) && !label.includes("post") && map.completedExtent === undefined) map.completedExtent = idx;
    else if (label.includes("extent") && label.includes("balance") && !label.includes("post") && map.balanceExtent === undefined) map.balanceExtent = idx;
    else if ((label.includes("payment completed or not") || label === "status") && map.status === undefined) map.status = idx;
    else if (label.includes("possession") && map.possession === undefined) map.possession = idx;
    else if (label.includes("post award") && label.includes("completed") && map.postAwardComp === undefined) map.postAwardComp = idx;
    else if (label.includes("post award") && label.includes("balance") && map.postAwardBal === undefined) map.postAwardBal = idx;
    else if (label.includes("remarks") && map.remarks === undefined) map.remarks = idx;
  });

  // Safe fallback indices if labels missing
  const defaults = {
    slNo: 0,
    lao: 1,
    project: 2,
    dtoToken: 3,
    creditDate: 4,
    releasedCr: 5,
    disbursedYesterday: 6,
    disbursedToday: 7,
    totalDisbursed: 8,
    balanceCr: 9,
    totalBen: 10,
    paidBen: 11,
    balanceBen: 12,
    totalExtent: 13,
    completedExtent: 14,
    balanceExtent: 15,
    status: 16,
    possession: 17,
    postAwardComp: 18,
    postAwardBal: 19,
    remarks: 20
  };

  return { ...defaults, ...map };
}

/* ----------------------------------------------------
   BOTTLENECK CATEGORIZATION
---------------------------------------------------- */
export function deriveBottleneckCategory(remarks, balanceCr) {
  const rLower = cleanStr(remarks).toLowerCase();
  if (rLower.includes("enhanced") || rLower.includes("market value") || rLower.includes("revision") || rLower.includes("dispute")) {
    return "Market Value Revision";
  } else if (rLower.includes("vivat") || rLower.includes("title") || rLower.includes("survey") || rLower.includes("govt land")) {
    return "Title & Survey Dispute";
  } else if (rLower.includes("alignment") || rLower.includes("r&r")) {
    return "Alignment Dispute";
  } else if (rLower.includes("award to be passed") || rLower.includes("enquiry") || rLower.includes("scrutiny")) {
    return "Award Enquiry Pending";
  } else if (rLower.includes("sdr")) {
    return "SDR Statutory Stage";
  } else if (balanceCr > 0) {
    return "Active Disbursement";
  }
  return "None";
}

/* ----------------------------------------------------
   FETCH & NORMALISE PIPELINE (GVIZ JSON)
---------------------------------------------------- */
export async function fetchSheetData(sheetName = "latest", forceRefresh = false) {
  const isLatest = !sheetName || sheetName === "latest" || sheetName === "auto";
  const url = isLatest
    ? `${GVIZ_JSON_BASE}&_t=${Date.now()}`
    : `${GVIZ_JSON_BASE}&sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`;

  try {
    const response = await fetch(url, {
      cache: forceRefresh ? "no-store" : "default"
    });

    if (!response.ok) {
      throw new Error(`Google Sheets responded with HTTP status ${response.status}`);
    }

    const text = await response.text();

    // Strip Google visualization JSONP wrapper /*O_o*/\ngoogle.visualization.Query.setResponse({...})
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("Invalid GVIZ JSONP format received from Google Sheets");
    }

    const jsonStr = text.substring(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonStr);

    if (parsed.status !== "ok" || !parsed.table) {
      throw new Error(parsed.errors ? parsed.errors[0].message : "Google Sheets query returned error status");
    }

    const cols = parsed.table.cols || [];
    const rows = parsed.table.rows || [];
    const colMap = buildColumnIndexMap(cols);

    // Extract As On Date dynamically from col 0 label if present
    let asOnDate = "07.09.2026";
    const col0Label = (cols[0] && cols[0].label) || "";
    const dateMatch = col0Label.match(/as on\s+([0-9]{1,2}[\.\-\/][0-9]{1,2}[\.\-\/][0-9]{2,4})/i);
    if (dateMatch) {
      asOnDate = dateMatch[1];
    }

    const items = [];
    let currentLao = "SDC Unit-I";
    let currentProj = "";

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const cells = row.c || [];

      const getCellVal = (idx) => {
        const c = cells[idx];
        if (!c) return "";
        return c.v !== undefined && c.v !== null ? c.v : "";
      };

      const rawSl = cleanStr(getCellVal(colMap.slNo));
      const rawLao = cleanStr(getCellVal(colMap.lao));
      const rawProj = cleanStr(getCellVal(colMap.project));

      // Skip column numbering row (e.g. 1, 2, 3...)
      if (rawSl === "1" && rawLao === "2") continue;

      // Skip subtotal and grand total rows
      const rowStr = cells.map(c => (c ? cleanStr(c.v) : "")).join(" ").toLowerCase();
      if (rowStr.includes("grand total") || (rawLao.toLowerCase() === "total" && !rawSl)) continue;

      // Detect valid serial number
      const slNum = cleanInt(rawSl);
      if (slNum <= 0) {
        // Not a numbered project row
        continue;
      }

      // Carry forward LAO if merged cell
      if (rawLao && isNaN(Number(rawLao))) {
        currentLao = rawLao;
      }

      // Carry forward Project Name if merged cell
      if (rawProj && isNaN(Number(rawProj))) {
        currentProj = rawProj;
      }
      const projName = rawProj && isNaN(Number(rawProj)) ? rawProj : currentProj;

      try {
        const releasedCr = cleanNum(getCellVal(colMap.releasedCr));
        const disbYest = cleanNum(getCellVal(colMap.disbursedYesterday));
        const disbToday = cleanNum(getCellVal(colMap.disbursedToday));
        let disbTot = cleanNum(getCellVal(colMap.totalDisbursed));
        const balCr = cleanNum(getCellVal(colMap.balanceCr));

        if (disbTot === 0.0 && (disbYest > 0 || disbToday > 0)) {
          disbTot = disbYest + disbToday;
        }

        const totalBen = cleanInt(getCellVal(colMap.totalBen));
        const paidBen = cleanInt(getCellVal(colMap.paidBen));
        const balBen = cleanInt(getCellVal(colMap.balanceBen));

        const totalExt = cleanNum(getCellVal(colMap.totalExtent));
        const compExt = cleanNum(getCellVal(colMap.completedExtent));
        const balExt = cleanNum(getCellVal(colMap.balanceExtent));

        let status = cleanStr(getCellVal(colMap.status));
        if (!status) {
          status = balCr <= 0.001 && disbTot > 0 ? "Completed" : "In Progress";
        }

        const possession = cleanStr(getCellVal(colMap.possession)) || "Pending";
        const postAwardComp = getCellVal(colMap.postAwardComp) !== "" ? cleanStr(getCellVal(colMap.postAwardComp)) : null;
        const postAwardBal = getCellVal(colMap.postAwardBal) !== "" ? cleanStr(getCellVal(colMap.postAwardBal)) : null;
        const remarks = cleanStr(getCellVal(colMap.remarks));

        const bottleneckCat = deriveBottleneckCategory(remarks, balCr);

        items.push({
          slNo: slNum,
          lao: currentLao,
          project: projName,
          dtoToken: cleanStr(getCellVal(colMap.dtoToken)),
          creditDate: cleanStr(getCellVal(colMap.creditDate)),
          releasedCr,
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
          status,
          possession,
          postAwardCompleted: postAwardComp,
          postAwardBalance: postAwardBal,
          remarks,
          bottleneckCategory: bottleneckCat
        });
      } catch (rowErr) {
        console.warn(`[data.js] Failed to normalise row ${rIdx + 1}:`, rowErr);
      }
    }

    const validItems = items.filter(it => !isExcludedLao(it.lao));

    if (validItems.length === 0) {
      throw new Error("No valid project records could be parsed from sheet");
    }

    // Cache successful payload in localStorage
    const resolvedSheetName = isLatest ? `Daily report ${asOnDate}` : sheetName;
    setCachedData(sheetName, { items: validItems, asOnDate });
    if (isLatest) {
      setCachedData("latest", { items: validItems, asOnDate });
    }

    return {
      items: validItems,
      asOnDate,
      sheetName: resolvedSheetName,
      isCached: false,
      cacheTime: new Date().toISOString(),
      error: null
    };

  } catch (err) {
    console.warn(`[data.js] Live fetch failed for '${sheetName}', falling back to cache:`, err);

    const cached = getCachedData(sheetName) || getCachedData("latest");
    if (cached && cached.items && cached.items.length > 0) {
      return {
        items: cached.items,
        asOnDate: cached.asOnDate || "07.09.2026",
        isCached: true,
        cacheTime: cached.timestamp || new Date().toISOString(),
        error: err.message
      };
    }

    // Last line of resilience: Seed data
    return {
      items: SEED_ITEMS,
      asOnDate: "07.09.2026",
      isCached: true,
      isSeed: true,
      cacheTime: null,
      error: err.message
    };
  }
}
