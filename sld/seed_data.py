import uuid
from sld.models import SingleLineDiagram

def get_default_sld_schema():
    """Generates JointJS graph JSON for the default 154kV Substation & UPS System diagram."""
    cells = []

    def make_cell(cid, ctype, x, y, width, height, sld_data, extra_attrs=None):
        cell = {
            'type': ctype,
            'id': cid,
            'position': {'x': x, 'y': y},
            'size': {'width': width, 'height': height},
            'sldData': sld_data,
            'attrs': extra_attrs or {}
        }
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
                    'targetMarker': {'type': 'none'}
                }
            }
        }

    # 1. 154kV Receiving Line
    cells.append(make_cell(
        'tower-154', 'sld.TransmissionTower', 490, 40, 56, 56,
        {'type': 'TRANSMISSION_TOWER', 'name': '154kV 수전', 'voltage': 154, 'voltageUnit': 'kV', 'color': '#7A3E9D'}
    ))

    cells.append(make_cell(
        'cb-154', 'sld.Breaker', 500, 130, 36, 44,
        {'type': 'CB_GCB', 'name': '154kV CB', 'state': 'CLOSED', 'voltage': 154, 'current': 2000, 'poles': '3P', 'color': '#7A3E9D', 'memo': '154kV 수전 주 차단기'}
    ))

    cells.append(make_cell(
        'ds-154', 'sld.Disconnector', 503, 205, 30, 40,
        {'type': 'DS', 'name': '154kV DS', 'state': 'CLOSED', 'voltage': 154, 'current': 2000, 'color': '#7A3E9D', 'memo': '154kV 수전 단로기'}
    ))

    cells.append(make_cell(
        'tr-1', 'sld.Transformer2W', 496, 275, 44, 64,
        {'type': 'TR_2W', 'name': '154/22.9kV TR#1', 'priVoltage': 154, 'secVoltage': 22.9, 'capacity': '20MVA', 'color': '#2E7D32', 'memo': '154kV / 22.9kV 20MVA 변압기'}
    ))

    # Links 154kV
    cells.append(make_link('link-tower-cb', 'tower-154', 'out', 'cb-154', 'in', '#7A3E9D'))
    cells.append(make_link('link-cb-ds', 'cb-154', 'out', 'ds-154', 'in', '#7A3E9D'))
    cells.append(make_link('link-ds-tr1', 'ds-154', 'out', 'tr-1', 'pri', '#7A3E9D'))

    # 2. 22.9kV Main Busbar
    cells.append(make_cell(
        'bus-22-9', 'sld.Busbar', 240, 370, 640, 12,
        {'type': 'BUSBAR', 'name': '22.9kV 모선', 'voltage': 22.9, 'voltageUnit': 'kV', 'color': '#9C27B0'}
    ))
    cells.append(make_link('link-tr1-bus22', 'tr-1', 'sec', 'bus-22-9', 'p5', '#9C27B0'))

    # 3. Feeder A (22.9/0.4kV TR#2 & 0.4kV Bus A)
    cells.append(make_cell(
        'vcb-a', 'sld.Breaker', 260, 410, 36, 44,
        {'type': 'CB_VCB', 'name': 'VCB', 'state': 'CLOSED', 'voltage': 22.9, 'current': 630, 'color': '#9C27B0', 'location': '22.9kV 모선'}
    ))
    cells.append(make_cell(
        'tr-2', 'sld.Transformer2W', 256, 480, 44, 64,
        {'type': 'TR_2W', 'name': '22.9/0.4kV TR#2', 'priVoltage': 22.9, 'secVoltage': 0.4, 'capacity': '1000kVA', 'color': '#2E7D32'}
    ))
    cells.append(make_cell(
        'bus-04-a', 'sld.Busbar', 190, 575, 180, 10,
        {'type': 'BUSBAR', 'name': '0.4kV 모선 (A)', 'voltage': 0.4, 'voltageUnit': 'kV', 'color': '#2E7D32'}
    ))

    cells.append(make_link('link-bus22-vcba', 'bus-22-9', 'p2', 'vcb-a', 'in', '#9C27B0'))
    cells.append(make_link('link-vcba-tr2', 'vcb-a', 'out', 'tr-2', 'pri', '#9C27B0'))
    cells.append(make_link('link-tr2-bus04a', 'tr-2', 'sec', 'bus-04-a', 'p5', '#2E7D32'))

    # Sub-loads on 0.4kV Bus A
    cells.append(make_cell(
        'acb-a1', 'sld.Breaker', 200, 615, 36, 44,
        {'type': 'CB_ACB', 'name': 'ACB', 'state': 'CLOSED', 'voltage': 0.4, 'current': 1600, 'color': '#377DFF', 'location': '0.4kV 모선 (A)'}
    ))
    cells.append(make_cell('load-a1', 'sld.Load', 201, 680, 34, 36, {'type': 'LOAD', 'name': '부하'}))
    cells.append(make_link('link-busa-acba1', 'bus-04-a', 'p2', 'acb-a1', 'in', '#2E7D32'))
    cells.append(make_link('link-acba1-loada1', 'acb-a1', 'out', 'load-a1', 'in', '#377DFF'))

    cells.append(make_cell(
        'mccb-a2', 'sld.Breaker', 250, 615, 36, 44,
        {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'CLOSED', 'voltage': 0.4, 'current': 225, 'color': '#377DFF'}
    ))
    cells.append(make_cell('load-a2', 'sld.Load', 251, 680, 34, 36, {'type': 'LOAD', 'name': '부하'}))
    cells.append(make_link('link-busa-mccba2', 'bus-04-a', 'p5', 'mccb-a2', 'in', '#2E7D32'))
    cells.append(make_link('link-mccba2-loada2', 'mccb-a2', 'out', 'load-a2', 'in', '#377DFF'))

    cells.append(make_cell(
        'mccb-a3', 'sld.Breaker', 300, 615, 36, 44,
        {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'CLOSED', 'voltage': 0.4, 'current': 225, 'color': '#377DFF'}
    ))
    cells.append(make_cell('load-a3', 'sld.Load', 301, 680, 34, 36, {'type': 'LOAD', 'name': '부하'}))
    cells.append(make_link('link-busa-mccba3', 'bus-04-a', 'p8', 'mccb-a3', 'in', '#2E7D32'))
    cells.append(make_link('link-mccba3-loada3', 'mccb-a3', 'out', 'load-a3', 'in', '#377DFF'))

    # 4. Feeder B (22.9/0.4kV TR#3 & 0.4kV Bus B)
    cells.append(make_cell(
        'vcb-b', 'sld.Breaker', 470, 410, 36, 44,
        {'type': 'CB_VCB', 'name': 'VCB', 'state': 'CLOSED', 'voltage': 22.9, 'current': 630, 'color': '#9C27B0'}
    ))
    cells.append(make_cell(
        'tr-3', 'sld.Transformer2W', 466, 480, 44, 64,
        {'type': 'TR_2W', 'name': '22.9/0.4kV TR#3', 'priVoltage': 22.9, 'secVoltage': 0.4, 'capacity': '1000kVA', 'color': '#2E7D32'}
    ))
    cells.append(make_cell(
        'bus-04-b', 'sld.Busbar', 410, 575, 180, 10,
        {'type': 'BUSBAR', 'name': '0.4kV 모선 (B)', 'voltage': 0.4, 'voltageUnit': 'kV', 'color': '#2B6CB0'}
    ))

    cells.append(make_link('link-bus22-vcbb', 'bus-22-9', 'p5', 'vcb-b', 'in', '#9C27B0'))
    cells.append(make_link('link-vcbb-tr3', 'vcb-b', 'out', 'tr-3', 'pri', '#9C27B0'))
    cells.append(make_link('link-tr3-bus04b', 'tr-3', 'sec', 'bus-04-b', 'p5', '#2B6CB0'))

    # Sub-loads on Bus B
    cells.append(make_cell('mccb-b1', 'sld.Breaker', 420, 615, 36, 44, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'CLOSED', 'voltage': 0.4, 'color': '#2B6CB0'}))
    cells.append(make_cell('load-b1', 'sld.Load', 421, 680, 34, 36, {'type': 'LOAD', 'name': '부하'}))
    cells.append(make_link('link-busb-mccbb1', 'bus-04-b', 'p2', 'mccb-b1', 'in', '#2B6CB0'))
    cells.append(make_link('link-mccbb1-loadb1', 'mccb-b1', 'out', 'load-b1', 'in', '#2B6CB0'))

    cells.append(make_cell('mccb-b2', 'sld.Breaker', 470, 615, 36, 44, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'CLOSED', 'voltage': 0.4, 'color': '#2B6CB0'}))
    cells.append(make_cell('load-b2', 'sld.Load', 471, 680, 34, 36, {'type': 'LOAD', 'name': '부하'}))
    cells.append(make_link('link-busb-mccbb2', 'bus-04-b', 'p5', 'mccb-b2', 'in', '#2B6CB0'))
    cells.append(make_link('link-mccbb2-loadb2', 'mccb-b2', 'out', 'load-b2', 'in', '#2B6CB0'))

    cells.append(make_cell('mccb-b3', 'sld.Breaker', 520, 615, 36, 44, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'CLOSED', 'voltage': 0.4, 'color': '#2B6CB0'}))
    cells.append(make_cell('load-b3', 'sld.Load', 521, 680, 34, 36, {'type': 'LOAD', 'name': '부하'}))
    cells.append(make_link('link-busb-mccbb3', 'bus-04-b', 'p8', 'mccb-b3', 'in', '#2B6CB0'))
    cells.append(make_link('link-mccbb3-loadb3', 'mccb-b3', 'out', 'load-b3', 'in', '#2B6CB0'))

    # 5. Feeder C (22.9/0.4kV TR#4 & 0.4kV Bus C)
    cells.append(make_cell(
        'vcb-c', 'sld.Breaker', 680, 410, 36, 44,
        {'type': 'CB_VCB', 'name': 'VCB', 'state': 'CLOSED', 'voltage': 22.9, 'current': 630, 'color': '#9C27B0'}
    ))
    cells.append(make_cell(
        'tr-4', 'sld.Transformer2W', 676, 480, 44, 64,
        {'type': 'TR_2W', 'name': '22.9/0.4kV TR#4', 'priVoltage': 22.9, 'secVoltage': 0.4, 'capacity': '1000kVA', 'color': '#2E7D32'}
    ))
    cells.append(make_cell(
        'bus-04-c', 'sld.Busbar', 620, 575, 180, 10,
        {'type': 'BUSBAR', 'name': '0.4kV 모선 (C)', 'voltage': 0.4, 'voltageUnit': 'kV', 'color': '#E65100'}
    ))

    cells.append(make_link('link-bus22-vcbc', 'bus-22-9', 'p8', 'vcb-c', 'in', '#9C27B0'))
    cells.append(make_link('link-vcbc-tr4', 'vcb-c', 'out', 'tr-4', 'pri', '#9C27B0'))
    cells.append(make_link('link-tr4-bus04c', 'tr-4', 'sec', 'bus-04-c', 'p5', '#E65100'))

    # Sub-loads on Bus C
    cells.append(make_cell('mccb-c1', 'sld.Breaker', 630, 615, 36, 44, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'CLOSED', 'voltage': 0.4, 'color': '#E65100'}))
    cells.append(make_cell('load-c1', 'sld.Load', 631, 680, 34, 36, {'type': 'LOAD', 'name': '부하'}))
    cells.append(make_link('link-busc-mccbc1', 'bus-04-c', 'p2', 'mccb-c1', 'in', '#E65100'))
    cells.append(make_link('link-mccbc1-loadc1', 'mccb-c1', 'out', 'load-c1', 'in', '#E65100'))

    cells.append(make_cell('mccb-c2', 'sld.Breaker', 680, 615, 36, 44, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'CLOSED', 'voltage': 0.4, 'color': '#E65100'}))
    cells.append(make_cell('load-c2', 'sld.Load', 681, 680, 34, 36, {'type': 'LOAD', 'name': '부하'}))
    cells.append(make_link('link-busc-mccbc2', 'bus-04-c', 'p5', 'mccb-c2', 'in', '#E65100'))
    cells.append(make_link('link-mccbc2-loadc2', 'mccb-c2', 'out', 'load-c2', 'in', '#E65100'))

    cells.append(make_cell('mccb-c3', 'sld.Breaker', 730, 615, 36, 44, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'CLOSED', 'voltage': 0.4, 'color': '#E65100'}))
    cells.append(make_cell('load-c3', 'sld.Load', 731, 680, 34, 36, {'type': 'LOAD', 'name': '부하'}))
    cells.append(make_link('link-busc-mccbc3', 'bus-04-c', 'p8', 'mccb-c3', 'in', '#E65100'))
    cells.append(make_link('link-mccbc3-loadc3', 'mccb-c3', 'out', 'load-c3', 'in', '#E65100'))

    # 6. Emergency Generator
    cells.append(make_cell(
        'gen-1', 'sld.Generator', 820, 540, 44, 44,
        {'type': 'GENERATOR', 'name': '비상 발전기', 'capacity': '500kVA', 'voltage': 22.9, 'color': '#E65100'}
    ))
    cells.append(make_cell(
        'acb-gen', 'sld.Breaker', 824, 440, 36, 44,
        {'type': 'CB_ACB', 'name': 'ACB', 'state': 'CLOSED', 'voltage': 22.9, 'current': 800, 'color': '#9C27B0'}
    ))
    cells.append(make_link('link-gen-acb', 'gen-1', 'out', 'acb-gen', 'out', '#E65100'))
    cells.append(make_link('link-acbgen-bus22', 'acb-gen', 'in', 'bus-22-9', 'p10', '#9C27B0'))

    # 7. Important Load (Uninterruptible Power Supply Group Box)
    cells.append(make_cell(
        'group-ups', 'sld.GroupBox', 190, 740, 490, 240,
        {'type': 'GROUP_BOX', 'title': '중요 부하 (무정전 전원 계통)'}
    ))

    # UPS & Battery Subsystem
    cells.append(make_cell(
        'text-comm-power', 'sld.TextLabel', 210, 780, 130, 30,
        {'type': 'TEXT_LABEL', 'text': '상용 전원 AC 3Φ 4W 380/220V', 'color': '#1e293b'}
    ))
    cells.append(make_cell(
        'acb-ups-in', 'sld.Breaker', 300, 785, 36, 44,
        {'type': 'CB_ACB', 'name': 'ACB', 'state': 'CLOSED', 'voltage': 0.38, 'color': '#377DFF'}
    ))
    cells.append(make_cell(
        'ups-1', 'sld.UPS', 370, 780, 56, 48,
        {'type': 'UPS', 'name': 'UPS', 'capacity': '100kVA', 'color': '#00838F'}
    ))
    cells.append(make_cell(
        'battery-1', 'sld.Battery', 372, 885, 52, 34,
        {'type': 'BATTERY', 'name': '배터리 뱅크', 'voltage': 384, 'voltageUnit': 'V DC', 'color': '#00838F'}
    ))
    cells.append(make_cell(
        'swg-ups', 'sld.Switchgear', 480, 775, 44, 60,
        {'type': 'SWITCHGEAR', 'name': 'UPS 배전반', 'color': '#377DFF'}
    ))
    cells.append(make_cell('mccb-ups1', 'sld.Breaker', 550, 785, 36, 44, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'CLOSED', 'voltage': 0.38, 'color': '#377DFF'}))
    cells.append(make_cell('load-ups1', 'sld.Load', 551, 860, 34, 36, {'type': 'LOAD', 'name': '중요 부하'}))
    cells.append(make_cell('mccb-ups2', 'sld.Breaker', 605, 785, 36, 44, {'type': 'CB_MCCB', 'name': 'MCCB', 'state': 'CLOSED', 'voltage': 0.38, 'color': '#377DFF'}))
    cells.append(make_cell('load-ups2', 'sld.Load', 606, 860, 34, 36, {'type': 'LOAD', 'name': '중요 부하'}))

    # UPS Links
    cells.append(make_link('link-acbups-ups', 'acb-ups-in', 'out', 'ups-1', 'ac_in', '#377DFF'))
    cells.append(make_link('link-bat-ups', 'battery-1', 'out', 'ups-1', 'dc_bat', '#00838F'))
    cells.append(make_link('link-ups-swg', 'ups-1', 'ac_out', 'swg-ups', 'in', '#377DFF'))
    cells.append(make_link('link-swg-mccb1', 'swg-ups', 'out', 'mccb-ups1', 'in', '#377DFF'))
    cells.append(make_link('link-mccb1-loadups1', 'mccb-ups1', 'out', 'load-ups1', 'in', '#377DFF'))
    cells.append(make_link('link-swg-mccb2', 'swg-ups', 'out', 'mccb-ups2', 'in', '#377DFF'))
    cells.append(make_link('link-mccb2-loadups2', 'mccb-ups2', 'out', 'load-ups2', 'in', '#377DFF'))

    # 8. Rectifier & 110V Battery Subsystem
    cells.append(make_cell(
        'text-ac220', 'sld.TextLabel', 710, 745, 90, 20,
        {'type': 'TEXT_LABEL', 'text': 'AC 220V', 'color': '#D32F2F'}
    ))
    cells.append(make_cell(
        'rect-1', 'sld.Rectifier', 690, 785, 50, 40,
        {'type': 'RECTIFIER', 'name': '정류기', 'inputVoltage': '220V', 'outputVoltage': '110V DC', 'color': '#2E7D32'}
    ))
    cells.append(make_cell(
        'battery-110', 'sld.Battery', 689, 885, 52, 34,
        {'type': 'BATTERY', 'name': '배터리', 'voltage': 110, 'voltageUnit': 'V DC', 'color': '#2E7D32'}
    ))
    cells.append(make_link('link-rect-bat110', 'rect-1', 'dc_out', 'battery-110', 'out', '#2E7D32'))

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
