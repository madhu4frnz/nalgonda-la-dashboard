"""
Multi-Sheet Auto-Sync Server for Nalgonda Land Acquisition Dashboard
Features:
- Dynamic Semantic Header Detection across all 15 historical sheet structures
- Auto-detects and defaults to newest daily tab
- 100% column fidelity: Disbursed Today, Disbursed Yesterday, Extents, Beneficiaries, Post Award, Remarks
- Historical date switching via query param (?sheet=...)
"""

import http.server
import socketserver
import urllib.request
import zipfile
import io
import json
import re
import datetime
import os
import threading
import time
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, parse_qs

PORT = 3033
WORKBOOK_XLSX_URL = "https://docs.google.com/spreadsheets/d/1XAJwRAT1jI4TRYiDVjsAtGTkWZJYfeYP8hHtaTxfGe0/export?format=xlsx"

cached_workbook = {
    "lastSyncedAt": None,
    "availableSheets": [],
    "activeSheet": None,
    "asOnDate": "",
    "items": [],
    "grandTotal": {}
}

def clean_num(val):
    if val is None or val == "":
        return 0.0
    val_str = str(val).replace(",", "").strip()
    try:
        return float(val_str)
    except:
        return 0.0

def clean_int(val):
    if val is None or val == "":
        return 0
    val_str = str(val).replace(",", "").strip()
    try:
        return int(float(val_str))
    except:
        return 0

def col_letter_to_index(col_letter):
    """Converts Excel column letters (A, B, ... Z, AA, AB) to 0-based index."""
    idx = 0
    for char in col_letter.upper():
        idx = idx * 26 + (ord(char) - ord('A') + 1)
    return idx - 1

def parse_cell_ref(ref):
    m = re.match(r'([A-Z]+)([0-9]+)', ref)
    if m:
        return m.group(1), int(m.group(2))
    return 'A', 1

def build_dynamic_column_mapping(grid):
    """
    Dynamically maps column indices to standard field keys by semantically
    analyzing the header text in rows 1, 2, and 3.
    Works consistently across all historical formats (12-col, 16-col, 19-col, 21-col).
    """
    col_text = {}
    for r in [1, 2, 3]:
        if r in grid:
            for c_idx, val in grid[r].items():
                if val:
                    col_text[c_idx] = (col_text.get(c_idx, '') + ' ' + str(val)).lower().strip()

    mapping = {}
    for c_idx, text in col_text.items():
        if not text:
            continue
        
        # Identity
        if 'sl' in text and 'no' in text and 'sl_no' not in mapping:
            mapping['sl_no'] = c_idx
        elif 'lao' in text and 'lao' not in mapping:
            mapping['lao'] = c_idx
        elif 'project' in text and 'project' not in mapping:
            mapping['project'] = c_idx
            
        # DTO & Credit Date
        elif ('dto' in text or 'token' in text) and 'dto_token' not in mapping:
            mapping['dto_token'] = c_idx
        elif ('credit' in text and 'date' in text) and 'credit_date' not in mapping:
            mapping['credit_date'] = c_idx
            
        # Financials
        elif ('amount released' in text or 'released in crores' in text) and 'released_cr' not in mapping:
            mapping['released_cr'] = c_idx
        elif 'yesterday' in text and 'disbursed_yesterday' not in mapping:
            mapping['disbursed_yesterday'] = c_idx
        elif ('to day' in text or 'today' in text) and 'disbursed_today' not in mapping:
            mapping['disbursed_today'] = c_idx
        elif ('total amount disbursed' in text or 'disbursed so far' in text) and 'total_disbursed' not in mapping:
            mapping['total_disbursed'] = c_idx
        elif ('balance to be disbursed' in text or (text.startswith('balance') and 'cr' in text)) and 'balance_cr' not in mapping:
            mapping['balance_cr'] = c_idx
            
        # Beneficiaries
        elif ('benefic' in text or 'awardees' in text) and ('total' in text or 'covered' in text) and 'total_ben' not in mapping:
            mapping['total_ben'] = c_idx
        elif ('benefic' in text or 'awardees' in text) and 'paid' in text and 'balance' not in text and 'paid_ben' not in mapping:
            mapping['paid_ben'] = c_idx
        elif ('benefic' in text or 'awardees' in text) and 'balance' in text and 'balance_ben' not in mapping:
            mapping['balance_ben'] = c_idx
            
        # Land Extent
        elif 'extent' in text and ('total' in text or 'covered' in text) and 'post' not in text and 'total_extent' not in mapping:
            mapping['total_extent'] = c_idx
        elif 'extent' in text and ('payment completed' in text or 'completed for extent' in text) and 'post' not in text and 'completed_extent' not in mapping:
            mapping['completed_extent'] = c_idx
        elif 'extent' in text and 'balance' in text and 'payment' in text and 'post' not in text and 'balance_extent' not in mapping:
            mapping['balance_extent'] = c_idx
        elif 'extent' in text and 'balance' in text and 'post' not in text and 'completed_extent' in mapping and 'balance_extent' not in mapping:
            mapping['balance_extent'] = c_idx
            
        # Status & Possession
        elif ('payment completed or not' in text or text == 'status') and 'status' not in mapping:
            mapping['status'] = c_idx
        elif 'possession' in text and 'possession' not in mapping:
            mapping['possession'] = c_idx
            
        # Post Award
        elif 'post award' in text and 'completed' in text and 'post_award_comp' not in mapping:
            mapping['post_award_comp'] = c_idx
        elif ('post award' in text and 'balance' in text) and 'post_award_bal' not in mapping:
            mapping['post_award_bal'] = c_idx
            
        # Remarks
        elif 'remarks' in text and 'remarks' not in mapping:
            mapping['remarks'] = c_idx

    # Handle post-award balance fallback if immediately following post-award completed
    if 'post_award_comp' in mapping and 'post_award_bal' not in mapping:
        mapping['post_award_bal'] = mapping['post_award_comp'] + 1

    return mapping

def fetch_and_parse_workbook(selected_sheet_name=None):
    global cached_workbook
    try:
        req = urllib.request.Request(
            WORKBOOK_XLSX_URL,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=18) as response:
            data = response.read()

        zf = zipfile.ZipFile(io.BytesIO(data))

        # 1. Discover all sheets
        wb_xml = zf.read('xl/workbook.xml').decode('utf-8', errors='replace')
        root_wb = ET.fromstring(wb_xml)
        
        rels_map = {}
        if 'xl/_rels/workbook.xml.rels' in zf.namelist():
            for rel in ET.fromstring(zf.read('xl/_rels/workbook.xml.rels')):
                rels_map[rel.attrib.get('Id')] = rel.attrib.get('Target')

        sheets = []
        for s in root_wb.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet'):
            name = s.attrib.get('name')
            r_id = s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            target = rels_map.get(r_id, 'worksheets/sheet1.xml')
            if not target.startswith('xl/'):
                target = 'xl/' + target.lstrip('/')
            sheets.append({"name": name, "file": target})

        if not sheets:
            return cached_workbook

        # Target sheet: newest (first) by default, or matched by name
        target_sheet = sheets[0]
        if selected_sheet_name:
            for s in sheets:
                if s["name"].strip().lower() == selected_sheet_name.strip().lower():
                    target_sheet = s
                    break

        # 2. Shared strings
        shared_strings = []
        if 'xl/sharedStrings.xml' in zf.namelist():
            for si in ET.fromstring(zf.read('xl/sharedStrings.xml')).iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                text_parts = [t.text for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if t.text]
                shared_strings.append("".join(text_parts))

        # 3. Parse target sheet XML into grid
        sheet_xml = zf.read(target_sheet["file"])
        sheet_root = ET.fromstring(sheet_xml)

        grid = {}
        for row in sheet_root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
            row_idx = int(row.attrib.get('r', 0))
            grid[row_idx] = {}
            for c in row.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                ref = c.attrib.get('r')
                col_letter, _ = parse_cell_ref(ref)
                col_idx = col_letter_to_index(col_letter)
                
                t_type = c.attrib.get('t')
                val_elem = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                val = val_elem.text if val_elem is not None else ""
                
                if t_type == 's' and val.isdigit():
                    str_idx = int(val)
                    val = shared_strings[str_idx] if str_idx < len(shared_strings) else val
                elif t_type == 'inlineStr':
                    t_elem = c.find('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
                    if t_elem is not None and t_elem.text:
                        val = t_elem.text

                grid[row_idx][col_idx] = str(val).strip()

        # 4. Build dynamic semantic column mapping
        col_map = build_dynamic_column_mapping(grid)

        # 5. Extract Title Date
        as_on_date = ""
        for r_num in sorted(grid.keys())[:4]:
            row_text = " ".join(grid[r_num].values())
            m = re.search(r'as on\s+([0-9]{1,2}[\.\-\/][0-9]{1,2}[\.\-\/][0-9]{2,4})', row_text, re.I)
            if m:
                as_on_date = m.group(1)
                break
        if not as_on_date:
            m = re.search(r'([0-9]{1,2}[\.\-\/][0-9]{1,2}[\.\-\/][0-9]{2,4})', target_sheet["name"])
            if m:
                as_on_date = m.group(1)

        current_lao = "SDC Unit-I"
        current_project = ""
        items = []
        grand_total = {}

        sl_idx = col_map.get('sl_no', 0)
        lao_idx = col_map.get('lao', 1)
        proj_idx = col_map.get('project', 2)

        for r_num in sorted(grid.keys()):
            # Skip header and index numbering rows (rows 1, 2, 3, 4)
            if r_num < 4:
                continue

            row_dict = grid[r_num]
            col_0 = row_dict.get(sl_idx, "").replace('.0', '').strip()
            col_1 = row_dict.get(lao_idx, "").replace('.0', '').strip()

            # Skip the column index row: 1.0, 2.0, 3.0, 4.0...
            if col_0 == '1' and col_1 == '2':
                continue

            # Check for Grand Total row
            row_vals_lower = " ".join(row_dict.values()).lower()
            if 'grand total' in row_vals_lower:
                rel_val = clean_num(row_dict.get(col_map.get('released_cr', -1), 0))
                disb_yest = clean_num(row_dict.get(col_map.get('disbursed_yesterday', -1), 0))
                disb_today = clean_num(row_dict.get(col_map.get('disbursed_today', -1), 0))
                disb_tot = clean_num(row_dict.get(col_map.get('total_disbursed', -1), 0))
                bal_val = clean_num(row_dict.get(col_map.get('balance_cr', -1), 0))

                t_ben = clean_int(row_dict.get(col_map.get('total_ben', -1), 0))
                p_ben = clean_int(row_dict.get(col_map.get('paid_ben', -1), 0))
                b_ben = clean_int(row_dict.get(col_map.get('balance_ben', -1), 0))

                t_ext = clean_num(row_dict.get(col_map.get('total_extent', -1), 0))
                c_ext = clean_num(row_dict.get(col_map.get('completed_extent', -1), 0))
                b_ext = clean_num(row_dict.get(col_map.get('balance_extent', -1), 0))

                grand_total = {
                    "releasedCr": rel_val,
                    "disbursedYesterdayCr": disb_yest,
                    "disbursedTodayCr": disb_today,
                    "disbursedCr": disb_tot,
                    "balanceCr": bal_val,
                    "totalBeneficiaries": t_ben,
                    "paidBeneficiaries": p_ben,
                    "balanceBeneficiaries": b_ben,
                    "totalExtentAc": t_ext,
                    "completedExtentAc": c_ext,
                    "balanceExtentAc": b_ext
                }
                continue

            # Project Record Row (Sl No is an integer 1..25)
            if col_0.isdigit() and int(col_0) > 0:
                sl_no = int(col_0)
                
                raw_lao = row_dict.get(lao_idx, "").strip()
                if raw_lao and not raw_lao.replace('.0', '').isdigit():
                    current_lao = " ".join(raw_lao.split())

                raw_proj = row_dict.get(proj_idx, "").strip()
                if raw_proj and not raw_proj.replace('.0', '').isdigit():
                    current_project = " ".join(raw_proj.split())
                
                proj_name = raw_proj if raw_proj and not raw_proj.replace('.0', '').isdigit() else current_project

                dto_token = " ".join(row_dict.get(col_map.get('dto_token', -1), "").split())
                credit_date = row_dict.get(col_map.get('credit_date', -1), "")

                released_cr = clean_num(row_dict.get(col_map.get('released_cr', -1), 0))
                disbursed_yesterday = clean_num(row_dict.get(col_map.get('disbursed_yesterday', -1), 0))
                disbursed_today = clean_num(row_dict.get(col_map.get('disbursed_today', -1), 0))
                total_disbursed = clean_num(row_dict.get(col_map.get('total_disbursed', -1), 0))
                balance_cr = clean_num(row_dict.get(col_map.get('balance_cr', -1), 0))

                # Correct total disbursed fallback if missing
                if total_disbursed == 0.0 and (disbursed_yesterday > 0 or disbursed_today > 0):
                    total_disbursed = disbursed_yesterday + disbursed_today

                total_ben = clean_int(row_dict.get(col_map.get('total_ben', -1), 0))
                paid_ben = clean_int(row_dict.get(col_map.get('paid_ben', -1), 0))
                balance_ben = clean_int(row_dict.get(col_map.get('balance_ben', -1), 0))

                total_extent = clean_num(row_dict.get(col_map.get('total_extent', -1), 0))
                completed_extent = clean_num(row_dict.get(col_map.get('completed_extent', -1), 0))
                balance_extent = clean_num(row_dict.get(col_map.get('balance_extent', -1), 0))

                status = row_dict.get(col_map.get('status', -1), "").strip()
                if not status:
                    if balance_cr <= 0.001 and total_disbursed > 0:
                        status = "Completed"
                    else:
                        status = "In Progress"

                possession = row_dict.get(col_map.get('possession', -1), "").strip()
                post_award_comp = row_dict.get(col_map.get('post_award_comp', -1), "").strip()
                post_award_bal = row_dict.get(col_map.get('post_award_bal', -1), "").strip()
                remarks = " ".join(row_dict.get(col_map.get('remarks', -1), "").split())

                # Classify Bottleneck
                bottleneck_cat = "None"
                rem_lower = remarks.lower()
                if "enhanced" in rem_lower or "market value" in rem_lower or "revision" in rem_lower:
                    bottleneck_cat = "Market Value Revision"
                elif "vivat" in rem_lower or "title" in rem_lower or "survey" in rem_lower:
                    bottleneck_cat = "Title & Survey Dispute"
                elif "alignment" in rem_lower:
                    bottleneck_cat = "Alignment Dispute"
                elif "award to be passed" in rem_lower or "enquiry" in rem_lower:
                    bottleneck_cat = "Award Enquiry Pending"
                elif "sdr" in rem_lower:
                    bottleneck_cat = "SDR Statutory Stage"
                elif balance_cr > 0:
                    bottleneck_cat = "Active Disbursement"

                items.append({
                    "slNo": sl_no,
                    "lao": current_lao,
                    "project": proj_name,
                    "dtoToken": dto_token,
                    "creditDate": credit_date,
                    "releasedCr": released_cr,
                    "disbursedYesterdayCr": disbursed_yesterday,
                    "disbursedTodayCr": disbursed_today,
                    "totalDisbursedCr": total_disbursed,
                    "balanceCr": balance_cr,
                    "totalBeneficiaries": total_ben,
                    "beneficiariesPaid": paid_ben,
                    "balanceBeneficiaries": balance_ben,
                    "totalExtentAc": total_extent,
                    "paymentCompletedExtentAc": completed_extent,
                    "balanceExtentAc": balance_extent,
                    "status": status,
                    "possession": possession or "Pending",
                    "postAwardCompleted": post_award_comp or None,
                    "postAwardBalance": post_award_bal or None,
                    "remarks": remarks,
                    "bottleneckCategory": bottleneck_cat
                })

        now_str = datetime.datetime.now().strftime("%d-%m-%Y %H:%M:%S")
        cached_workbook = {
            "success": True,
            "lastSyncedAt": now_str,
            "availableSheets": [s["name"] for s in sheets],
            "activeSheet": target_sheet["name"],
            "asOnDate": as_on_date,
            "itemCount": len(items),
            "items": items,
            "grandTotal": grand_total
        }

        # Cache to json
        with open("live_data.json", "w", encoding="utf-8") as f:
            json.dump(cached_workbook, f, indent=2)

        print(f"[{now_str}] Workbook synced! Active: '{target_sheet['name']}', Items: {len(items)}, Released: ₹{grand_total.get('releasedCr', 0)} Cr, Disbursed: ₹{grand_total.get('disbursedCr', 0)} Cr")
        return cached_workbook

    except Exception as e:
        print(f"Error syncing workbook: {e}")
        import traceback
        traceback.print_exc()
        return cached_workbook

def background_worker():
    while True:
        try:
            fetch_and_parse_workbook(cached_workbook.get("activeSheet"))
        except Exception as e:
            print(f"Background worker error: {e}")
        time.sleep(30)

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        if parsed_url.path in ('/api/sync', '/api/data'):
            qs = parse_qs(parsed_url.query)
            target_sheet = qs.get('sheet', [None])[0]
            
            if target_sheet or parsed_url.path == '/api/sync':
                data = fetch_and_parse_workbook(target_sheet)
            else:
                data = cached_workbook

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
            return

        return super().do_GET()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print("Initial fetch with dynamic semantic header mapping...")
    fetch_and_parse_workbook()

    t = threading.Thread(target=background_worker, daemon=True)
    t.start()

    server = socketserver.TCPServer(("127.0.0.1", PORT), CustomHandler)
    server.allow_reuse_address = True
    print(f"Server ready at http://127.0.0.1:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
