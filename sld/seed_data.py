import uuid
from sld.models import SingleLineDiagram

def get_default_sld_schema():
    """Generates JointJS graph JSON for the default 154kV Substation & UPS System diagram with exact CAD alignment."""
    cells = []

    def make_cell(cid, ctype, x, y, width, height, sld_data, extra_attrs=None, ports_config=None):
        cell = {
            'type': ctype,
            'id': cid,
            'position': {'x': x, 'y': y},
            'size': {'width': width, 'height': height},
            'sldData': sld_data,
            'attrs': extra_attrs or {}
        }
        if ports_config:
            cell['ports'] = ports_config
        return cell

    def make_link(lid, src_id, src_port, tgt_id, tgt_port, color='#7A3E9D', stroke_width=2.5):
        return {
            'type': 'standard.Link',
            'id': lid,
            'source': {'id': src_id, 'port': src_port},
            'target': {'id': tgt_id, 'port': tgt_port},
            'router': {'name': 'sldOrthogonal'},
            'connector': {'name': 'normal'},
            'attrs': {
                'line': {
                    'stroke': color,
                    'strokeWidth': stroke_width,
                    'strokeDasharray': '8,4',
                    'class': 'link-live',
                    'targetMarker': {'name': 'none'}
                }
            }
        }

    # 1. 154kV Receiving Line (Center Column X = 520)
    cells.append(make_cell(
        'tower-154', 'sld.TransmissionTower', 492, 40, 56, 56,
        {'type': 'TRANSMISSION_TOWER', 'name': '154kV 수전', 'voltage': 154, 'voltageUnit': 'kV', 'color': '#E53935'}
    ))

    cells.append(make_cell(
        'cb-154', 'sld.Breaker', 506, 130, 28, 40,
        {'type': 'CB_GCB', 'name': '154kV CB', 'state': 'LIVE', 'voltage': 154, 'current': 2000, 'poles': '3P', 'color': '#E53935', 'memo': '154kV 수전 주 차단기'}
    ))

    cells.append(make_cell(
        'ds-154', 'sld.Disconnector', 506, 205, 28, 40,
        {'type': 'DS', 'name': '154kV DS', 'state': 'LIVE', 'voltage': 154, 'current': 2000, 'color': '#E53935', 'memo': '154kV 수전 단로기'}
    ))

    cells.append(make_cell(
        'tr-1', 'sld.Transformer2W', 498, 275, 44, 64,
        {'type': 'TR_2W', 'name': '154/22.9kV TR#1', 'priVoltage': 154, 'secVoltage': 22.9, 'connection': 'Y-Δ', 'capacity': '20MVA', 'color': '#E53935', 'memo': '154kV / 22.9kV 20MVA 변압기'}
    ))

    # Links 154kV (Pure Straight Vertical Line)
    cells.append(make_link('link-tower-cb', 'tower-154', 'out', 'cb-154', 'in', '#E53935'))
    cells.append(make_link('link-cb-ds', 'cb-154', 'out', 'ds-154', 'in', '#E53935'))
    cells.append(make_link('link-ds-tr1', 'ds-154', 'out', 'tr-1', 'pri', '#E53935'))

    # 2. 22.9kV Main Busbar (X = 200, width = 700)
    bus22_ports = {
        'groups': {
            'bus-ports': {
                'position': {'name': 'absolute'},
                'attrs': {'circle': {'r': 3.5, 'magnet': True, 'fill': '#ffffff', 'stroke': '#9C27B0', 'strokeWidth': 1.5}}
            }
        },
        'items': [
            {'id': 'p_f1', 'group': 'bus-ports', 'args': {'x': 80, 'y': 6}},
            {'id': 'p_f2', 'group': 'bus-ports', 'args': {'x': 290, 'y': 6}},
            {'id': 'p_in', 'group': 'bus-ports', 'args': {'x': 320, 'y': 6}},
            {'id': 'p_f3', 'group': 'bus-ports', 'args': {'x': 500, 'y': 6}},
            {'id': 'p_gen', 'group': 'bus-ports', 'args': {'x': 630, 'y': 6}},
        ]
    }
    cells.append(make_cell(
        'bus-22-9', 'sld.Busbar', 200, 370, 700, 12,
        {'type': 'BUSBAR', 'name': '22.9kV 모선', 'voltage': 22.9, 'voltageUnit': 'kV', 'color': '#9C27B0'},
        ports_config=bus22_ports
    ))
    cells.append(make_link('link-tr1-bus22', 'tr-1', 'sec', 'bus-22-9', 'p_in', '#9C27B0'))

    # 3. Feeder A (Column X = 280: 22.9/0.4kV TR#2 & 0.4kV Bus A)
    cells.append(make_cell(
        'vcb-a', 'sld.Breaker', 266, 410, 28, 40,
        {'type': 'CB_VCB', 'name': 'VCB', 'state': 'LIVE', 'voltage': 22.9, 'current': 630, 'color': '#9C27B0', 'location': '22.9kV 모선'}
    ))
    cells.append(make_cell(
        'tr-2', 'sld.Transformer2W', 258, 480, 44, 64,
        {'type': 'TR_2W', 'name': '22.9/0.4kV TR#2', 'priVoltage': 22.9, 'secVoltage': 0.4, 'connection': 'Δ-Y', 'capacity': '1000kVA', 'color': '#16A34A'}
    ))

    bus04a_ports = {
        'groups': {'bus-ports': {'position': {'name': 'absolute'}, 'attrs': {'circle': {'r': 3.5, 'magnet': True, 'fill': '#fff', 'stroke': '#16A34A', 'strokeWidth': 1.5}}}},
        'items': [
            {'id': 'p1', 'group': 'bus-ports', 'args': {'x': 40, 'y': 5}},
            {'id': 'p_tr', 'group': 'bus-ports', 'args': {'x': 100, 'y': 5}},
            {'id': 'p2', 'group': 'bus-ports', 'args': {'x': 100, 'y': 5}},
            {'id': 'p3', 'group': 'bus-ports', 'args': {'x': 160, 'y': 5}},
        ]
    }
    cells.append(make_cell(
        'bus-04-a', 'sld.Busbar', 180, 575, 200, 10,
        {'type': 'BUSBAR', 'name': '0.4kV 모선 (A)', 'voltage': 0.4, 'voltageUnit': 'kV', 'color': '#16A34A'},
        ports_config=bus04a_ports
    ))

    cells.append(make_link('link-bus22-vcba', 'bus-22-9', 'p_f1', 'vcb-a', 'in', '#9C27B0'))
    cells.append(make_link('link-vcba-tr2', 'vcb-a', 'out', 'tr-2', 'pri', '#9C27B0'))
    cells.append(make_link('link-tr2-bus04a', 'tr-2', 'sec', 'bus-04-a', 'p_tr', '#16A34A'))

    # Sub-loads on 0.4kV Bus A (Columns: 220, 280, 340)
    cells.append(make_cell('acb-a1', 'sld.ACB', 206, 615, 28, 40, {'type': 'CB_ACB', 'name': 'ACB', 'state': 'LIVE', 'voltage': 0.4, 'current': 1600, 'color': '#16A34A', 'location': '0.4kV 모선 (A)'}))
    cells.append(make_cell('load-a1', 'sld.Load', 203, 680, 34, 36, {'type': 'LOAD', 'name': '부하', 'color': '#16A34A'}))
    cells.append(make_link('link-busa-acba1', 'bus-04-a', 'p1', 'acb-a1', 'in', '#16A34A'))
    cells.append(make_link('link-acba1-loada1', 'acb-a1', 'out', 'load-a1', 'in', '#16A34A'))

    cells.append(make_cell('mccb-a2', 'sld.MCCB', 266, 615, 28, 40, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'LIVE', 'voltage': 0.4, 'current': 225, 'color': '#16A34A'}))
    cells.append(make_cell('load-a2', 'sld.Load', 263, 680, 34, 36, {'type': 'LOAD', 'name': '부하', 'color': '#16A34A'}))
    cells.append(make_link('link-busa-mccba2', 'bus-04-a', 'p2', 'mccb-a2', 'in', '#16A34A'))
    cells.append(make_link('link-mccba2-loada2', 'mccb-a2', 'out', 'load-a2', 'in', '#16A34A'))

    cells.append(make_cell('mccb-a3', 'sld.MCCB', 326, 615, 28, 40, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'LIVE', 'voltage': 0.4, 'current': 225, 'color': '#16A34A'}))
    cells.append(make_cell('load-a3', 'sld.Load', 323, 680, 34, 36, {'type': 'LOAD', 'name': '부하', 'color': '#16A34A'}))
    cells.append(make_link('link-busa-mccba3', 'bus-04-a', 'p3', 'mccb-a3', 'in', '#16A34A'))
    cells.append(make_link('link-mccba3-loada3', 'mccb-a3', 'out', 'load-a3', 'in', '#16A34A'))

    # 4. Feeder B (Column X = 490: 22.9/0.4kV TR#3 & 0.4kV Bus B)
    cells.append(make_cell(
        'vcb-b', 'sld.Breaker', 476, 410, 28, 40,
        {'type': 'CB_VCB', 'name': 'VCB', 'state': 'LIVE', 'voltage': 22.9, 'current': 630, 'color': '#9C27B0'}
    ))
    cells.append(make_cell(
        'tr-3', 'sld.Transformer2W', 468, 480, 44, 64,
        {'type': 'TR_2W', 'name': '22.9/0.4kV TR#3', 'priVoltage': 22.9, 'secVoltage': 0.4, 'connection': 'Δ-Y', 'capacity': '1000kVA', 'color': '#16A34A'}
    ))

    bus04b_ports = {
        'groups': {'bus-ports': {'position': {'name': 'absolute'}, 'attrs': {'circle': {'r': 3.5, 'magnet': True, 'fill': '#fff', 'stroke': '#16A34A', 'strokeWidth': 1.5}}}},
        'items': [
            {'id': 'p1', 'group': 'bus-ports', 'args': {'x': 40, 'y': 5}},
            {'id': 'p_tr', 'group': 'bus-ports', 'args': {'x': 100, 'y': 5}},
            {'id': 'p2', 'group': 'bus-ports', 'args': {'x': 100, 'y': 5}},
            {'id': 'p3', 'group': 'bus-ports', 'args': {'x': 160, 'y': 5}},
        ]
    }
    cells.append(make_cell(
        'bus-04-b', 'sld.Busbar', 390, 575, 200, 10,
        {'type': 'BUSBAR', 'name': '0.4kV 모선 (B)', 'voltage': 0.4, 'voltageUnit': 'kV', 'color': '#16A34A'},
        ports_config=bus04b_ports
    ))

    cells.append(make_link('link-bus22-vcbb', 'bus-22-9', 'p_f2', 'vcb-b', 'in', '#9C27B0'))
    cells.append(make_link('link-vcbb-tr3', 'vcb-b', 'out', 'tr-3', 'pri', '#9C27B0'))
    cells.append(make_link('link-tr3-bus04b', 'tr-3', 'sec', 'bus-04-b', 'p_tr', '#16A34A'))

    # Sub-loads on Bus B (Columns: 430, 490, 550)
    cells.append(make_cell('mccb-b1', 'sld.MCCB', 416, 615, 28, 40, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'LIVE', 'voltage': 0.4, 'color': '#16A34A'}))
    cells.append(make_cell('load-b1', 'sld.Load', 413, 680, 34, 36, {'type': 'LOAD', 'name': '부하', 'color': '#16A34A'}))
    cells.append(make_link('link-busb-mccbb1', 'bus-04-b', 'p1', 'mccb-b1', 'in', '#16A34A'))
    cells.append(make_link('link-mccbb1-loadb1', 'mccb-b1', 'out', 'load-b1', 'in', '#16A34A'))

    cells.append(make_cell('mccb-b2', 'sld.MCCB', 476, 615, 28, 40, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'LIVE', 'voltage': 0.4, 'color': '#16A34A'}))
    cells.append(make_cell('load-b2', 'sld.Load', 473, 680, 34, 36, {'type': 'LOAD', 'name': '부하', 'color': '#16A34A'}))
    cells.append(make_link('link-busb-mccbb2', 'bus-04-b', 'p2', 'mccb-b2', 'in', '#16A34A'))
    cells.append(make_link('link-mccbb2-loadb2', 'mccb-b2', 'out', 'load-b2', 'in', '#16A34A'))

    cells.append(make_cell('mccb-b3', 'sld.MCCB', 536, 615, 28, 40, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'LIVE', 'voltage': 0.4, 'color': '#16A34A'}))
    cells.append(make_cell('load-b3', 'sld.Load', 533, 680, 34, 36, {'type': 'LOAD', 'name': '부하', 'color': '#16A34A'}))
    cells.append(make_link('link-busb-mccbb3', 'bus-04-b', 'p3', 'mccb-b3', 'in', '#16A34A'))
    cells.append(make_link('link-mccbb3-loadb3', 'mccb-b3', 'out', 'load-b3', 'in', '#16A34A'))

    # 5. Feeder C (Column X = 700: 22.9/0.4kV TR#4 & 0.4kV Bus C)
    cells.append(make_cell(
        'vcb-c', 'sld.Breaker', 686, 410, 28, 40,
        {'type': 'CB_VCB', 'name': 'VCB', 'state': 'LIVE', 'voltage': 22.9, 'current': 630, 'color': '#9C27B0'}
    ))
    cells.append(make_cell(
        'tr-4', 'sld.Transformer2W', 678, 480, 44, 64,
        {'type': 'TR_2W', 'name': '22.9/0.4kV TR#4', 'priVoltage': 22.9, 'secVoltage': 0.4, 'connection': 'Δ-Y', 'capacity': '1000kVA', 'color': '#16A34A'}
    ))

    bus04c_ports = {
        'groups': {'bus-ports': {'position': {'name': 'absolute'}, 'attrs': {'circle': {'r': 3.5, 'magnet': True, 'fill': '#fff', 'stroke': '#16A34A', 'strokeWidth': 1.5}}}},
        'items': [
            {'id': 'p1', 'group': 'bus-ports', 'args': {'x': 40, 'y': 5}},
            {'id': 'p_tr', 'group': 'bus-ports', 'args': {'x': 100, 'y': 5}},
            {'id': 'p2', 'group': 'bus-ports', 'args': {'x': 100, 'y': 5}},
            {'id': 'p3', 'group': 'bus-ports', 'args': {'x': 160, 'y': 5}},
        ]
    }
    cells.append(make_cell(
        'bus-04-c', 'sld.Busbar', 600, 575, 200, 10,
        {'type': 'BUSBAR', 'name': '0.4kV 모선 (C)', 'voltage': 0.4, 'voltageUnit': 'kV', 'color': '#16A34A'},
        ports_config=bus04c_ports
    ))

    cells.append(make_link('link-bus22-vcbc', 'bus-22-9', 'p_f3', 'vcb-c', 'in', '#9C27B0'))
    cells.append(make_link('link-vcbc-tr4', 'vcb-c', 'out', 'tr-4', 'pri', '#9C27B0'))
    cells.append(make_link('link-tr4-bus04c', 'tr-4', 'sec', 'bus-04-c', 'p_tr', '#16A34A'))

    # Sub-loads on Bus C (Columns: 640, 700, 760)
    cells.append(make_cell('mccb-c1', 'sld.MCCB', 626, 615, 28, 40, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'LIVE', 'voltage': 0.4, 'color': '#16A34A'}))
    cells.append(make_cell('load-c1', 'sld.Load', 623, 680, 34, 36, {'type': 'LOAD', 'name': '부하', 'color': '#16A34A'}))
    cells.append(make_link('link-busc-mccbc1', 'bus-04-c', 'p1', 'mccb-c1', 'in', '#16A34A'))
    cells.append(make_link('link-mccbc1-loadc1', 'mccb-c1', 'out', 'load-c1', 'in', '#16A34A'))

    cells.append(make_cell('mccb-c2', 'sld.MCCB', 686, 615, 28, 40, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'LIVE', 'voltage': 0.4, 'color': '#16A34A'}))
    cells.append(make_cell('load-c2', 'sld.Load', 683, 680, 34, 36, {'type': 'LOAD', 'name': '부하', 'color': '#16A34A'}))
    cells.append(make_link('link-busc-mccbc2', 'bus-04-c', 'p2', 'mccb-c2', 'in', '#16A34A'))
    cells.append(make_link('link-mccbc2-loadc2', 'mccb-c2', 'out', 'load-c2', 'in', '#16A34A'))

    cells.append(make_cell('mccb-c3', 'sld.MCCB', 746, 615, 28, 40, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'LIVE', 'voltage': 0.4, 'color': '#16A34A'}))
    cells.append(make_cell('load-c3', 'sld.Load', 743, 680, 34, 36, {'type': 'LOAD', 'name': '부하', 'color': '#16A34A'}))
    cells.append(make_link('link-busc-mccbc3', 'bus-04-c', 'p3', 'mccb-c3', 'in', '#16A34A'))
    cells.append(make_link('link-mccbc3-loadc3', 'mccb-c3', 'out', 'load-c3', 'in', '#16A34A'))

    # 6. Emergency Generator (Column X = 830)
    cells.append(make_cell(
        'gen-1', 'sld.Generator', 808, 520, 44, 44,
        {'type': 'GENERATOR', 'name': '비상 발전기', 'capacity': '500kVA', 'voltage': 22.9, 'color': '#E65100'}
    ))
    cells.append(make_cell(
        'acb-gen', 'sld.ACB', 816, 430, 28, 40,
        {'type': 'CB_ACB', 'name': 'ACB', 'state': 'LIVE', 'voltage': 22.9, 'current': 800, 'color': '#9C27B0'}
    ))
    cells.append(make_link('link-gen-acb', 'gen-1', 'out', 'acb-gen', 'out', '#E65100'))
    cells.append(make_link('link-acbgen-bus22', 'acb-gen', 'in', 'bus-22-9', 'p_gen', '#9C27B0'))

    # 7. Important Load (Uninterruptible Power Supply Group Box)
    cells.append(make_cell(
        'group-ups', 'sld.GroupBox', 180, 750, 680, 240,
        {'type': 'GROUP_BOX', 'title': '중요 부하 (무정전 전원 계통)'}
    ))

    # UPS & Battery Subsystem (Y-axis aligned on Y=832)
    cells.append(make_cell(
        'text-comm-power', 'sld.TextLabel', 200, 775, 140, 26,
        {'type': 'TEXT_LABEL', 'text': '상용 전원 AC 3Φ 380V', 'color': '#16A34A'}
    ))
    cells.append(make_cell(
        'acb-ups-in', 'sld.ACB', 206, 810, 28, 40,
        {'type': 'CB_ACB', 'name': 'ACB', 'state': 'LIVE', 'voltage': 0.38, 'color': '#16A34A'}
    ))
    cells.append(make_cell(
        'ups-1', 'sld.UPS', 312, 808, 56, 48,
        {'type': 'UPS', 'name': 'UPS', 'capacity': '100kVA', 'color': '#EA580C'}
    ))
    cells.append(make_cell(
        'battery-1', 'sld.Battery', 314, 905, 52, 34,
        {'type': 'BATTERY', 'name': '배터리 뱅크', 'voltage': 384, 'voltageUnit': 'V DC', 'color': '#EA580C'}
    ))
    cells.append(make_cell(
        'swg-ups', 'sld.Switchgear', 428, 802, 44, 60,
        {'type': 'SWITCHGEAR', 'name': 'UPS 배전반', 'color': '#16A34A'}
    ))

    # 0.4kV UPS Busbar
    bus_ups_ports = {
        'groups': {'bus-ports': {'position': {'name': 'absolute'}, 'attrs': {'circle': {'r': 3.5, 'magnet': True, 'fill': '#fff', 'stroke': '#16A34A', 'strokeWidth': 1.5}}}},
        'items': [
            {'id': 'p_in', 'group': 'bus-ports', 'args': {'x': 0, 'y': 4}},
            {'id': 'p1', 'group': 'bus-ports', 'args': {'x': 50, 'y': 8}},
            {'id': 'p2', 'group': 'bus-ports', 'args': {'x': 130, 'y': 8}},
        ]
    }
    cells.append(make_cell(
        'bus-ups', 'sld.Busbar', 520, 828, 170, 8,
        {'type': 'BUSBAR', 'name': 'UPS 모선 (380V)', 'voltage': 0.38, 'voltageUnit': 'kV', 'color': '#16A34A'},
        ports_config=bus_ups_ports
    ))

    # UPS Sub-loads (Columns: 570, 650)
    cells.append(make_cell('mccb-ups1', 'sld.MCCB', 556, 860, 28, 40, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'LIVE', 'voltage': 0.38, 'color': '#16A34A'}))
    cells.append(make_cell('load-ups1', 'sld.Load', 553, 925, 34, 36, {'type': 'LOAD', 'name': '중요 부하 1', 'color': '#16A34A'}))
    cells.append(make_cell('mccb-ups2', 'sld.MCCB', 636, 860, 28, 40, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'LIVE', 'voltage': 0.38, 'color': '#16A34A'}))
    cells.append(make_cell('load-ups2', 'sld.Load', 633, 925, 34, 36, {'type': 'LOAD', 'name': '중요 부하 2', 'color': '#16A34A'}))

    # UPS Links (All straight lines)
    cells.append(make_link('link-acbups-ups', 'acb-ups-in', 'out', 'ups-1', 'ac_in', '#16A34A'))
    cells.append(make_link('link-bat-ups', 'battery-1', 'out', 'ups-1', 'dc_bat', '#EA580C'))
    cells.append(make_link('link-ups-swg', 'ups-1', 'ac_out', 'swg-ups', 'in', '#16A34A'))
    cells.append(make_link('link-swg-busups', 'swg-ups', 'out', 'bus-ups', 'p_in', '#16A34A'))
    cells.append(make_link('link-busups-mccb1', 'bus-ups', 'p1', 'mccb-ups1', 'in', '#16A34A'))
    cells.append(make_link('link-mccb1-loadups1', 'mccb-ups1', 'out', 'load-ups1', 'in', '#16A34A'))
    cells.append(make_link('link-busups-mccb2', 'bus-ups', 'p2', 'mccb-ups2', 'in', '#16A34A'))
    cells.append(make_link('link-mccb2-loadups2', 'mccb-ups2', 'out', 'load-ups2', 'in', '#16A34A'))

    # 8. Rectifier & 110V Battery Subsystem (Column X = 770)
    cells.append(make_cell(
        'text-ac220', 'sld.TextLabel', 740, 775, 90, 20,
        {'type': 'TEXT_LABEL', 'text': 'AC 220V', 'color': '#EAB308'}
    ))
    cells.append(make_cell(
        'rect-1', 'sld.Rectifier', 745, 810, 50, 40,
        {'type': 'RECTIFIER', 'name': '정류기', 'inputVoltage': '220V', 'outputVoltage': '110V DC', 'color': '#F97316'}
    ))
    cells.append(make_cell(
        'battery-110', 'sld.Battery', 744, 905, 52, 34,
        {'type': 'BATTERY', 'name': '110V 축전지', 'voltage': 110, 'voltageUnit': 'V DC', 'color': '#F97316'}
    ))
    cells.append(make_link('link-rect-bat110', 'rect-1', 'dc_out', 'battery-110', 'out', '#F97316'))

    return {'cells': cells}


def init_default_diagram():
    """Initializes the database with the default diagram if not present."""
    if not SingleLineDiagram.objects.filter(is_default=True).exists():
        schema = get_default_sld_schema()
        diagram = SingleLineDiagram.objects.create(
            diagram_id='default-154kv-substation',
            title='프로젝트 01 - 154kV 수전 단선도',
            description='154kV 수전설비 및 22.9kV/0.4kV 배전 계통과 UPS 무정전 전원 계통 단선도',
            schema_data=schema,
            is_default=True
        )
        return diagram
    return SingleLineDiagram.objects.filter(is_default=True).first()
