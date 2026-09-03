"""
Power System Topology & Electrical Analysis Engine (Django / Python)
Analyzes single-line diagrams (SLD) from JointJS schema JSON.
Performs graph construction, power flow traversal, grounding propagation,
fault detection (short circuits, voltage mismatches, loops), and load aggregation.
"""

from collections import deque
import re
from typing import Any, Dict, List, Optional, Set, Tuple


def parse_voltage_value(val: Any) -> float:
    """Extract float voltage value in kV."""
    if val is None:
        return 0.4
    if isinstance(val, (int, float)):
        # If it's 380, 220, assume V and convert to kV (0.38, 0.22)
        if val > 1000:
            return round(val / 1000.0, 3)
        if val in [380, 440, 480]:
            return 0.38
        if val in [220, 110]:
            return 0.22
        return float(val)

    s = str(val).strip().upper()
    if not s:
        return 0.4

    # Direct keyword matching
    if "154" in s:
        return 154.0
    if "22.9" in s or "22,9" in s:
        return 22.9
    if "6.6" in s:
        return 6.6
    if "3.3" in s:
        return 3.3
    if "380" in s:
        return 0.38
    if "0.4" in s or "400" in s:
        return 0.4
    if "220" in s or "0.22" in s:
        return 0.22
    if "384" in s:
        return 0.384

    # Extract digits with decimal
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)", s)
    if m:
        num = float(m.group(1))
        if "KV" in s:
            return num
        if "V" in s or num >= 100:
            if num >= 100 and num <= 200:
                return 154.0
            if num >= 20 and num <= 30:
                return 22.9
            if num >= 100:
                return round(num / 1000.0, 3)
            return num
        return num
    return 0.4


def parse_capacity_kva(val: Any) -> float:
    """Parse capacity string (e.g. '20MVA', '1000kVA', 500) to kVA float."""
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)

    s = str(val).strip().upper()
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)", s)
    if not m:
        return 0.0
    num = float(m.group(1))
    if "MVA" in s or "MW" in s:
        return num * 1000.0
    if "KVA" in s or "KW" in s:
        return num
    if "W" in s or "VA" in s:
        return num / 1000.0
    return num


class PowerSystemTopologyEngine:
    """
    Python Power System Topology & Diagnostic Engine.
    Parses JointJS graph JSON and performs comprehensive electrical analysis.
    """

    SOURCE_TYPES = {
        "GRID", "GENERATOR", "GEN", "SOLAR", "PV", "UPS",
        "BATTERY", "TRANSMISSION_TOWER", "POWER_SOURCE"
    }

    GROUND_TYPES = {
        "GROUND", "EARTH", "EARTH_SWITCH", "ES", "GROUND_SWITCH"
    }

    SWITCH_TYPES = {
        "CB_GCB", "CB_VCB", "CB_ACB", "CB_MCCB", "CB", "BREAKER",
        "DS", "DISCONNECTOR", "LBS", "LOAD_BREAK_SWITCH",
        "CONTACTOR", "FUSE", "ISOLATOR", "SWITCH"
    }

    TRANSFORMER_TYPES = {
        "TR_2W", "TR_3W", "TRANSFORMER", "TR",
        "sld.Transformer2W", "sld.Transformer3W"
    }

    LOAD_TYPES = {
        "MOTOR", "M", "LOAD", "FEEDER_OUT", "PUMP", "FAN",
        "HVAC", "EV_CHARGER", "CAPACITOR", "HEATER", "LIGHTING"
    }

    def __init__(self, schema_data: Any):
        self.raw_schema = schema_data
        self.cells = []
        self.elements: Dict[str, Dict[str, Any]] = {}
        self.links: List[Dict[str, Any]] = []
        self.adjacency: Dict[str, List[Dict[str, Any]]] = {}

        self._parse_schema()

    def _parse_schema(self):
        """Extract elements and links from v2.0 compact schema."""
        if not isinstance(self.raw_schema, dict):
            return

        raw_elements = self.raw_schema.get("elements", [])
        for el in raw_elements:
            el_id = el.get("id")
            if not el_id:
                continue
            sld_data = el.get("data") or el.get("sldData") or {}
            el_type = el.get("type", "")
            self.elements[el_id] = {
                "id": el_id,
                "type": f"sld.{el_type}" if not el_type.startswith("sld.") else el_type,
                "sldData": sld_data
            }
            self.adjacency[el_id] = []
            self.links.append(link)
            src = link.get("from") or link.get("source") or {}
            tgt = link.get("to") or link.get("target") or {}
            src_id = src.get("id")
            tgt_id = tgt.get("id")
            src_port = src.get("port")
            tgt_port = tgt.get("port")
            link_id = link.get("id", f"{src_id}_{tgt_id}")

            if src_id in self.adjacency and tgt_id in self.adjacency:
                edge_info_fwd = {
                self.adjacency[src_id].append(edge_info_fwd)
                self.adjacency[tgt_id].append(edge_info_rev)

        # Build adjacency graph
        for link in self.links:
            src = link.get("source", {})
            tgt = link.get("target", {})
            src_id = src.get("id")
            tgt_id = tgt.get("id")
            src_port = src.get("port")
            tgt_port = tgt.get("port")
            link_id = link.get("id", f"{src_id}_{tgt_id}")

            if src_id in self.adjacency and tgt_id in self.adjacency:
                edge_info_fwd = {
                    "link_id": link_id,
                    "target_id": tgt_id,
                    "src_port": src_port,
                    "tgt_port": tgt_port,
                self.adjacency[tgt_id].append(edge_info_rev)

    def _is_conducting(self, el_id: str) -> bool:
        """Check if an element currently conducts electricity."""
        el = self.elements.get(el_id, {})
        sld_data = el.get("sldData", {})
        issues: List[Dict[str, Any]] = []

        # Initialize node default states
        for el_id, el in self.elements.items():
            sld_data = el.get("sldData", {})
            name = sld_data.get("name") or el_id
            raw_voltage = (
                sld_data.get("voltage") or
                sld_data.get("priVoltage") or
                sld_data.get("voltageLevel") or 0.4
            )
            v_val = parse_voltage_value(raw_voltage)

            node_states[el_id] = {
                "id": el_id,
                "name": name,
                "type": sld_data.get("type") or el.get("type", "UNKNOWN"),
                "state": "DEAD",
                "voltage_kv": v_val,
                "is_source": False,
                "is_ground": False,
                "is_conducting": self._is_conducting(el_id),
                "connected_load_kw": 0.0,
            }

        # ----------------------------------------------------
        # 1. Ground Propagation (BFS)
        # ----------------------------------------------------
        ground_queue = deque()
        grounded_nodes: Set[str] = set()
        grounded_links: Set[str] = set()

        for el_id, el in self.elements.items():
            sld_data = el.get("sldData", {})
            el_type = (sld_data.get("type") or el.get("type") or "").upper()
            state = (sld_data.get("state") or "").upper()

            is_ground = (
                any(g in el_type for g in self.GROUND_TYPES) or
                state in ["GROUNDED", "GROUND", "EARTH"]
            )
            if is_ground:
                node_states[el_id]["is_ground"] = True
                node_states[el_id]["state"] = "GROUNDED"
                grounded_nodes.add(el_id)
                ground_queue.append(el_id)

        while ground_queue:
            curr_id = ground_queue.popleft()
            for edge in self.adjacency.get(curr_id, []):
                nxt_id = edge["target_id"]
                nxt_el = self.elements.get(nxt_id, {})
                nxt_data = nxt_el.get("sldData", {})
                nxt_type = (nxt_data.get("type") or nxt_el.get("type") or "").upper()

                # Transformers block direct ground traversal to opposite windings
                is_tr = any(t in nxt_type for t in self.TRANSFORMER_TYPES)
                if is_tr:
                    continue

                if self._is_conducting(nxt_id) and nxt_id not in grounded_nodes:
                    grounded_nodes.add(nxt_id)
                    grounded_links.add(edge["link_id"])
                    node_states[nxt_id]["state"] = "GROUNDED"
                    ground_queue.append(nxt_id)

        # ----------------------------------------------------
        # 2. Live Power & Voltage Propagation (BFS)
        # ----------------------------------------------------
        live_queue = deque()
        live_nodes: Set[str] = set()
        live_links: Set[str] = set()

        for el_id, el in self.elements.items():
            sld_data = el.get("sldData", {})
            el_type = (sld_data.get("type") or el.get("type") or "").upper()
            state = (sld_data.get("state") or "LIVE").upper()

            is_src = (
                any(s in el_type for s in self.SOURCE_TYPES) or
                sld_data.get("isSource", False)
            )
            if is_src and state != "DEAD" and state != "OPEN":
                node_states[el_id]["is_source"] = True
                node_states[el_id]["state"] = "LIVE"
                live_nodes.add(el_id)
                v_kv = parse_voltage_value(sld_data.get("voltage", 154.0))
                node_states[el_id]["voltage_kv"] = v_kv
                live_queue.append((el_id, v_kv))

        while live_queue:
            curr_id, curr_v = live_queue.popleft()
            curr_el = self.elements.get(curr_id, {})
            curr_data = curr_el.get("sldData", {})
            curr_type = (curr_data.get("type") or curr_el.get("type") or "").upper()

            for edge in self.adjacency.get(curr_id, []):
                nxt_id = edge["target_id"]
                nxt_el = self.elements.get(nxt_id, {})
                nxt_data = nxt_el.get("sldData", {})
                nxt_type = (nxt_data.get("type") or nxt_el.get("type") or "").upper()
                link_id = edge["link_id"]

                # Check transformer stepped voltage
                next_v = curr_v
                is_curr_tr = any(t in curr_type for t in self.TRANSFORMER_TYPES)
                is_nxt_tr = any(t in nxt_type for t in self.TRANSFORMER_TYPES)

                if is_curr_tr:
                    src_port = edge.get("src_port")
                    if src_port == "sec":
                        next_v = parse_voltage_value(curr_data.get("secVoltage", 22.9))
                    elif src_port == "tert":
                        next_v = parse_voltage_value(curr_data.get("tertVoltage", 6.6))
                    elif src_port == "pri":
                        next_v = parse_voltage_value(curr_data.get("priVoltage", 154.0))

                elif is_nxt_tr:
                    tgt_port = edge.get("tgt_port")
                    if tgt_port == "pri":
                        next_v = parse_voltage_value(nxt_data.get("priVoltage", curr_v))
                    elif tgt_port == "sec":
                        next_v = parse_voltage_value(nxt_data.get("secVoltage", 22.9))
                    elif tgt_port == "tert":
                        next_v = parse_voltage_value(nxt_data.get("tertVoltage", 6.6))
                    else:
                        next_v = parse_voltage_value(nxt_data.get("priVoltage", curr_v))

                # If next node is a grounded node, we detect a SHORT CIRCUIT / GROUND FAULT
                if nxt_id in grounded_nodes:
                    issues.append({
                        "severity": "CRITICAL",
                        "code": "SHORT_CIRCUIT_GROUND_FAULT",
                        "message": f"단락/지락 위험 감지: 활선(Live) 노드 '{node_states[curr_id]['name']}'와 접지 노드 '{node_states[nxt_id]['name']}'가 직결되었습니다.",
                        "element_ids": [curr_id, nxt_id],
                        "link_id": link_id
                    })
                    continue

                if not self._is_conducting(nxt_id):
                    # Switch is OPEN: The switch itself receives voltage on this terminal, but stops propagation
                    node_states[nxt_id]["state"] = "OPEN"
                    node_states[nxt_id]["voltage_kv"] = next_v
                    continue

                if nxt_id not in live_nodes:
                    live_nodes.add(nxt_id)
                    live_links.add(link_id)
                    node_states[nxt_id]["state"] = "LIVE"
                    node_states[nxt_id]["voltage_kv"] = next_v
                    live_queue.append((nxt_id, next_v))

        # ----------------------------------------------------
        # 3. Voltage Mismatch & Loop Detection
        # ----------------------------------------------------
        for edge_list in self.adjacency.values():
            for edge in edge_list:
                src_id = edge.get("src_port") and edge["link"].get("source", {}).get("id")
                tgt_id = edge.get("tgt_port") and edge["link"].get("target", {}).get("id")
                if not src_id or not tgt_id or src_id == tgt_id:
                    continue

                src_state = node_states.get(src_id, {})
                tgt_state = node_states.get(tgt_id, {})

                # If both are LIVE and neither is a transformer, check voltage mismatch
                src_is_tr = any(t in src_state.get("type", "").upper() for t in self.TRANSFORMER_TYPES)
                tgt_is_tr = any(t in tgt_state.get("type", "").upper() for t in self.TRANSFORMER_TYPES)

                if (src_state.get("state") == "LIVE" and
                        tgt_state.get("state") == "LIVE" and
                        not src_is_tr and not tgt_is_tr):
                    v1 = src_state.get("voltage_kv", 0)
                    v2 = tgt_state.get("voltage_kv", 0)
                    if abs(v1 - v2) > 0.05 and v1 > 0 and v2 > 0:
                        # Avoid duplicate issue reporting
                        pair_key = tuple(sorted([src_id, tgt_id]))
                        if not any(iss.get("code") == "VOLTAGE_MISMATCH" and set(iss.get("element_ids", [])) == set(pair_key) for iss in issues):
                            issues.append({
                                "severity": "WARNING",
                                "code": "VOLTAGE_MISMATCH",
                                "message": f"전압 레벨 불일치 경고: '{src_state['name']}' ({v1}kV)와 '{tgt_state['name']}' ({v2}kV)가 변압기 없이 연결되어 있습니다.",
                                "element_ids": [src_id, tgt_id],
                                "link_id": edge["link_id"]
                            })

        # ----------------------------------------------------
        # 4. Dead / Isolated Equipment Detection
        # ----------------------------------------------------
        for el_id, nstate in node_states.items():
            if nstate["state"] == "DEAD" and not nstate["is_ground"]:
                el_type = nstate["type"].upper()
                is_load = any(l in el_type for l in self.LOAD_TYPES)
                if is_load:
                    issues.append({
                        "severity": "INFO",
                        "code": "ISOLATED_LOAD",
                        "message": f"미통전 부하: '{nstate['name']}' 설비에 전원이 공급되지 않고 있습니다 (차단기 개방 또는 미연결).",
                        "element_ids": [el_id]
                    })

        # ----------------------------------------------------
        # 5. Transformer Loading & Capacity Calculation
        # ----------------------------------------------------
        tr_reports = []
        for el_id, el in self.elements.items():
            sld_data = el.get("sldData", {})
            el_type = (sld_data.get("type") or el.get("type") or "").upper()
            if any(t in el_type for t in self.TRANSFORMER_TYPES):
                cap_kva = parse_capacity_kva(sld_data.get("capacity", "1000kVA"))
                tr_name = sld_data.get("name") or el_id

                # Aggregate downstream connected loads (DFS/BFS through sec port)
                connected_load_kw = 0.0
                visited_downstream = set([el_id])
                ds_queue = deque()

                # Find edges connected to sec/tert ports
                for edge in self.adjacency.get(el_id, []):
                    if edge.get("src_port") in ["sec", "tert"] or edge.get("tgt_port") in ["sec", "tert"]:
                        ds_queue.append(edge["target_id"])

                while ds_queue:
                    curr_ds = ds_queue.popleft()
                    if curr_ds in visited_downstream:
                        continue
                    visited_downstream.add(curr_ds)

                    ds_el = self.elements.get(curr_ds, {})
                    ds_data = ds_el.get("sldData", {})
                    ds_type = (ds_data.get("type") or ds_el.get("type") or "").upper()

                    # Add load if it's a load element
                    if any(l in ds_type for l in self.LOAD_TYPES):
                        raw_kw = ds_data.get("power") or ds_data.get("capacity") or 50.0
                        connected_load_kw += parse_capacity_kva(raw_kw)

                    # Propagate downstream if conducting and not another transformer
                    if self._is_conducting(curr_ds) and not any(t in ds_type for t in self.TRANSFORMER_TYPES):
                        for nxt_edge in self.adjacency.get(curr_ds, []):
                            if nxt_edge["target_id"] not in visited_downstream:
                                ds_queue.append(nxt_edge["target_id"])

                loading_percent = round((connected_load_kw / cap_kva * 100.0), 1) if cap_kva > 0 else 0.0
                status = "NORMAL"
                if loading_percent >= 100.0:
                    status = "OVERLOAD"
                    issues.append({
                        "severity": "CRITICAL",
                        "code": "TRANSFORMER_OVERLOAD",
                        "message": f"변압기 과부하 경고: '{tr_name}' 정격({cap_kva}kVA) 대비 연결 부하({connected_load_kw}kW, {loading_percent}%)가 초과되었습니다.",
                        "element_ids": [el_id]
                    })
                elif loading_percent >= 80.0:
                    status = "WARNING"
                    issues.append({
                        "severity": "WARNING",
                        "code": "TRANSFORMER_HIGH_LOAD",
                        "message": f"변압기 부하율 주의: '{tr_name}' 부하율이 {loading_percent}% ({connected_load_kw}kW/{cap_kva}kVA)에 도달했습니다.",
                        "element_ids": [el_id]
                    })

                tr_reports.append({
                    "id": el_id,
                    "name": tr_name,
                    "capacity_kva": cap_kva,
                    "connected_load_kw": round(connected_load_kw, 1),
                    "loading_percent": loading_percent,
                    "status": status,
                    "pri_voltage": parse_voltage_value(sld_data.get("priVoltage", 154)),
                    "sec_voltage": parse_voltage_value(sld_data.get("secVoltage", 22.9)),
                })

        # ----------------------------------------------------
        # 6. Overall Summary
        # ----------------------------------------------------
        total_elements = len(self.elements)
        total_links = len(self.links)
        live_count = len(live_nodes)
        ground_count = len(grounded_nodes)
        dead_count = total_elements - live_count - ground_count

        return {
            "summary": {
                "total_elements": total_elements,
                "total_links": total_links,
                "live_nodes_count": live_count,
                "grounded_nodes_count": ground_count,
                "dead_nodes_count": max(0, dead_count),
                "critical_faults": sum(1 for i in issues if i["severity"] == "CRITICAL"),
                "warnings": sum(1 for i in issues if i["severity"] == "WARNING"),
                "infos": sum(1 for i in issues if i["severity"] == "INFO"),
            },
            "node_states": node_states,
            "issues": issues,
            "transformers": tr_reports,
        }
