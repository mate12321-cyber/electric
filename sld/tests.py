from django.test import TestCase, Client
from django.urls import reverse
import json

from sld.models import SingleLineDiagram
from sld.seed_data import get_default_sld_schema
from sld.services.topology_engine import (
    PowerSystemTopologyEngine,
    parse_voltage_value,
    parse_capacity_kva,
    parse_transformer_capacity,
    classify_voltage_level,
)


class TopologyEngineTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.default_schema = get_default_sld_schema()
        self.diagram = SingleLineDiagram.objects.create(
            diagram_id="test-substation-01",
            title="테스트 154kV 변전소",
            schema_data=self.default_schema
        )

    def test_voltage_and_capacity_parsers(self):
        self.assertEqual(parse_voltage_value("154kV"), 154.0)
        self.assertEqual(parse_voltage_value("22.9kV"), 22.9)
        self.assertEqual(parse_voltage_value("380V"), 0.38)
        self.assertEqual(parse_voltage_value(220), 0.22)
        self.assertEqual(parse_capacity_kva("20MVA"), 20000.0)
        self.assertEqual(parse_capacity_kva("80/100MVA"), 80000.0)
        self.assertEqual(parse_capacity_kva("1000kVA"), 1000.0)
        self.assertEqual(parse_capacity_kva("50kW"), 50.0)

    def test_voltage_classification(self):
        self.assertEqual(classify_voltage_level(154), "UHV")
        self.assertEqual(classify_voltage_level(345), "UHV")
        self.assertEqual(classify_voltage_level(100), "UHV")
        self.assertEqual(classify_voltage_level(22.9), "EHV")
        self.assertEqual(classify_voltage_level(66), "EHV")
        self.assertEqual(classify_voltage_level(21.9), "EHV")
        self.assertEqual(classify_voltage_level(6.6), "HV")
        self.assertEqual(classify_voltage_level(3.3), "HV")
        self.assertEqual(classify_voltage_level(0.4), "LV")
        self.assertEqual(classify_voltage_level(0.22), "LV")

    def test_dual_transformer_capacity(self):
        dual = parse_transformer_capacity("80/100MVA")
        self.assertTrue(dual["is_dual"])
        self.assertEqual(dual["base_kva"], 80000.0)
        self.assertEqual(dual["forced_kva"], 100000.0)

        single = parse_transformer_capacity("3MVA")
        self.assertFalse(single["is_dual"])
        self.assertEqual(single["base_kva"], 3000.0)
        self.assertEqual(single["forced_kva"], 3000.0)

    def test_default_diagram_analysis(self):
        engine = PowerSystemTopologyEngine(self.default_schema)
        result = engine.analyze()

        summary = result["summary"]
        self.assertGreater(summary["total_elements"], 10)
        self.assertGreater(summary["live_nodes_count"], 5)
        self.assertEqual(summary["critical_faults"], 0)

        # Verify 154kV source and stepped down voltages
        node_states = result["node_states"]
        self.assertEqual(node_states["tower-154"]["state"], "LIVE")
        self.assertEqual(node_states["tower-154"]["voltage_kv"], 154.0)
        self.assertEqual(node_states["bus-22-9"]["voltage_kv"], 22.9)

        # Verify transformers report
        tr_reports = result["transformers"]
        self.assertTrue(any(tr["id"] == "tr-1" for tr in tr_reports))
        self.assertTrue(any(tr["id"] == "tr-2" for tr in tr_reports))

    def test_short_circuit_detection(self):
        schema = {
            "cells": [
                {
                    "id": "gen-1",
                    "type": "sld.Generator",
                    "sldData": {"type": "GENERATOR", "name": "발전기 1", "voltage": 22.9, "state": "LIVE"}
                },
                {
                    "id": "gnd-1",
                    "type": "sld.Ground",
                    "sldData": {"type": "GROUND", "name": "접지 단자", "state": "GROUNDED"}
                },
                {
                    "id": "link-fault",
                    "type": "standard.Link",
                    "source": {"id": "gen-1", "port": "out"},
                    "target": {"id": "gnd-1", "port": "in"}
                }
            ]
        }
        engine = PowerSystemTopologyEngine(schema)
        result = engine.analyze()

        self.assertGreaterEqual(result["summary"]["critical_faults"], 1)
        critical_issues = [i for i in result["issues"] if i["severity"] == "CRITICAL"]
        self.assertTrue(any(i["code"] == "SHORT_CIRCUIT_GROUND_FAULT" for i in critical_issues))

    def test_transformer_overload_detection(self):
        schema = {
            "cells": [
                {
                    "id": "src",
                    "type": "sld.Grid",
                    "sldData": {"type": "GRID", "name": "계통 전원", "voltage": 22.9, "state": "LIVE"}
                },
                {
                    "id": "tr-small",
                    "type": "sld.Transformer2W",
                    "sldData": {
                        "type": "TR_2W",
                        "name": "소형 TR",
                        "capacity": "100kVA",
                        "priVoltage": 22.9,
                        "secVoltage": 0.4
                    }
                },
                {
                    "id": "load-heavy",
                    "type": "sld.Motor",
                    "sldData": {"type": "MOTOR", "name": "대형 모터", "capacity": "250kW", "voltage": 0.4}
                },
                {
                    "id": "link-1",
                    "type": "standard.Link",
                    "source": {"id": "src", "port": "out"},
                    "target": {"id": "tr-small", "port": "pri"}
                },
                {
                    "id": "link-2",
                    "type": "standard.Link",
                    "source": {"id": "tr-small", "port": "sec"},
                    "target": {"id": "load-heavy", "port": "in"}
                }
            ]
        }
        engine = PowerSystemTopologyEngine(schema)
        result = engine.analyze()

        self.assertGreaterEqual(result["summary"]["critical_faults"], 1)
        overload_issues = [i for i in result["issues"] if i["code"] == "TRANSFORMER_OVERLOAD"]
        self.assertEqual(len(overload_issues), 1)
        self.assertEqual(result["transformers"][0]["loading_percent"], 250.0)

    def test_analyze_api_endpoint(self):
        url = reverse("analyze_diagram", kwargs={"diagram_id": self.diagram.diagram_id})
        response = self.client.post(
            url,
            data=json.dumps({"schema_data": self.default_schema}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("summary", data)
        self.assertIn("issues", data)
        self.assertIn("node_states", data)
