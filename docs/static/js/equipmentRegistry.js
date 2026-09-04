/**
 * Equipment Metadata Registry for Power System Single-Line Diagram
 * Follows Metadata Registry Pattern for scalable power equipment definitions.
 */

const DEFAULT_VOLTAGE_PRESETS = {
  "154kV": {
    key: "154kV",
    name: "154kV",
    value: 154,
    unit: "kV",
    color: "#E53935",
    label: "154kV (초고압 ≥100kV)",
  },
  "22.9kV": {
    key: "22.9kV",
    name: "22.9kV",
    value: 22.9,
    unit: "kV",
    color: "#9C27B0",
    label: "22.9kV (특고압 ≥21.9kV)",
  },
  "6.6kV": {
    key: "6.6kV",
    name: "6.6kV",
    value: 6.6,
    unit: "kV",
    color: "#1E88E5",
    label: "6.6kV (고압)",
  },
  "3.3kV": {
    key: "3.3kV",
    name: "3.3kV",
    value: 3.3,
    unit: "kV",
    color: "#0284C7",
    label: "3.3kV (고압)",
  },
  "0.4kV": {
    key: "0.4kV",
    name: "0.4kV (380V)",
    value: 0.4,
    unit: "kV",
    color: "#059669",
    label: "0.4kV / 380V (저압)",
  },
  "0.22kV": {
    key: "0.22kV",
    name: "220V",
    value: 0.22,
    unit: "kV",
    color: "#EAB308",
    label: "220V (상용 저압)",
  },
  DC384V: {
    key: "DC384V",
    name: "DC 384V",
    value: 384,
    unit: "V",
    color: "#EA580C",
    label: "384V DC (배터리/UPS)",
  },
  DC110V: {
    key: "DC110V",
    name: "DC 110V",
    value: 110,
    unit: "V",
    color: "#F97316",
    label: "110V DC (제어전원)",
  },
};

function loadVoltageColors() {
  try {
    const saved = localStorage.getItem("sld_voltage_colors");
    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = JSON.parse(JSON.stringify(DEFAULT_VOLTAGE_PRESETS));
      Object.keys(parsed).forEach((k) => {
        if (merged[k]) {
          merged[k].color = parsed[k];
        }
      });
      return merged;
    }
  } catch (e) {
    console.warn("Failed to load voltage colors from localStorage", e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_VOLTAGE_PRESETS));
}

let VOLTAGE_PRESETS = loadVoltageColors();

function getVoltageColor(voltage, unit = "kV") {
  if (voltage === undefined || voltage === null) return "#059669";
  const num = parseFloat(voltage);
  if (isNaN(num)) return "#059669";

  const presets = window.VOLTAGE_PRESETS || VOLTAGE_PRESETS;

  // Check 154kV (초고압 - 붉은 계열)
  if (num >= 100 && (unit === "kV" || num === 154)) {
    return presets["154kV"] ? presets["154kV"].color : "#E53935";
  }
  // Check 22.9kV (특고압 - 자주 계열)
  if (num >= 20 && num <= 30) {
    return presets["22.9kV"] ? presets["22.9kV"].color : "#9C27B0";
  }
  // Check 6.6kV (고압 - 파란 계열)
  if (num >= 6 && num <= 10) {
    return presets["6.6kV"] ? presets["6.6kV"].color : "#1E88E5";
  }
  // Check 3.3kV (고압 - 파란 계열)
  if (num >= 3 && num < 6) {
    return presets["3.3kV"] ? presets["3.3kV"].color : "#0284C7";
  }
  // Check 0.4kV / 380V (저압 - 에메랄드 청록 계열)
  if (
    num === 0.4 ||
    num === 0.38 ||
    num === 380 ||
    (num > 0.25 && num <= 0.6)
  ) {
    return presets["0.4kV"] ? presets["0.4kV"].color : "#059669";
  }
  // Check 0.22kV / 220V (상용 - 노란 계열)
  if (num === 0.22 || num === 220 || (num > 0.1 && num <= 0.25)) {
    return presets["0.22kV"] ? presets["0.22kV"].color : "#EAB308";
  }
  // Check DC 384V / battery (주황 계열)
  if (num === 384 || (num > 300 && unit === "V")) {
    return presets["DC384V"] ? presets["DC384V"].color : "#EA580C";
  }
  // Check DC 110V (주황 계열)
  if (num === 110 || (num >= 100 && num <= 125 && unit === "V")) {
    return presets["DC110V"] ? presets["DC110V"].color : "#F97316";
  }

  // Default fallback (저압 에메랄드 청록 계열)
  return presets["0.4kV"] ? presets["0.4kV"].color : "#059669";
}

function saveVoltageColors(colorMap) {
  const presets = window.VOLTAGE_PRESETS || VOLTAGE_PRESETS;
  const simpleMap = {};
  Object.keys(colorMap).forEach((k) => {
    if (presets[k]) {
      presets[k].color = colorMap[k];
      simpleMap[k] = colorMap[k];
    }
  });
  try {
    localStorage.setItem("sld_voltage_colors", JSON.stringify(simpleMap));
  } catch (e) {
    console.warn("Failed to save voltage colors to localStorage", e);
  }
  window.VOLTAGE_PRESETS = presets;
}

function resetVoltageColors() {
  try {
    localStorage.removeItem("sld_voltage_colors");
  } catch (e) {}
  window.VOLTAGE_PRESETS = JSON.parse(JSON.stringify(DEFAULT_VOLTAGE_PRESETS));
  return window.VOLTAGE_PRESETS;
}

/**
 * 심볼 명칭 텍스트 자동 줄바꿈 포맷터:
 * - 5글자 초과 시 줄바꿈 ('.' 문자는 글자 수 카운트에서 제외)
 * - '-', '#', '_', 공백 기호 위치에서 구분하여 줄바꿈
 * - 각 줄의 앞뒤 공백 및 구분 기호를 정리하여 완벽한 좌측 정렬(Left-align) 유지
 */
function formatSymbolLabel(str, maxLen = 5) {
  if (!str || typeof str !== "string") return str || "";
  if (str.includes("\n")) {
    return str
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n");
  }

  const spaceChunks = str.split(/\s+/).filter(Boolean);
  const rawTokens = [];
  for (let i = 0; i < spaceChunks.length; i++) {
    let chunk = spaceChunks[i];
    if (
      (chunk === "-" || chunk === "_" || chunk === "#") &&
      i + 1 < spaceChunks.length
    ) {
      spaceChunks[i + 1] = chunk + spaceChunks[i + 1];
      continue;
    }
    rawTokens.push(chunk);
  }

  const tokens = [];
  rawTokens.forEach((chunk) => {
    const subTokens = chunk.split(/(?=[-#_])/).filter(Boolean);
    tokens.push(...subTokens);
  });

  const lines = [];
  tokens.forEach((token) => {
    token = token.trim();
    if (!token) return;
    const effectiveLen = token.replace(/\./g, "").length;
    if (effectiveLen <= maxLen) {
      lines.push(token);
    } else {
      let currentChunk = "";
      let count = 0;
      for (let i = 0; i < token.length; i++) {
        const ch = token[i];
        if (ch !== ".") {
          if (count >= maxLen && currentChunk.trim().length > 0) {
            lines.push(currentChunk.trim());
            currentChunk = "";
            count = 0;
          }
          count++;
        }
        currentChunk += ch;
      }
      if (currentChunk.trim().length > 0) {
        lines.push(currentChunk.trim());
      }
    }
  });

  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * 심볼의 회전 각도(0, 90, 180, 270) 및 줄 수에 따른 nameLabel / specLabel 위치 및 회전 속성 계산
 * - 0°: 심볼 세로(0°), 텍스트 우측 (좌측 정렬 start)
 * - 90°: 심볼 가로(90°), 텍스트 하단 (중앙 정렬 middle, transform: rotate(-90))
 * - 180°: 심볼 세로(0°), 텍스트 좌측 (우측 정렬 end)
 * - 270°: 심볼 가로(90°), 텍스트 상단 (중앙 정렬 middle, transform: rotate(-90))
 *
 * 이름의 마지막 줄 바닥과 정격(전류/용량) 사이의 행간은 1줄일 때와 여러 줄일 때 완전히 동일하게 유지됨.
 */
function getSymbolLabelAttrs(options) {
  const angle = ((Math.round(options.angle || 0) % 360) + 360) % 360;
  const w = options.width || 28;
  const h = options.height || 40;
  const cx = w / 2;
  const cy = h / 2;
  const nameText = options.nameText || "";
  const specText = options.specText || "";
  const nameLines = nameText ? String(nameText).split("\n").length : 1;

  const lineHeight = options.lineHeight || 12;
  const gap = options.gap || 14;

  let nameAttrs = {};
  let specAttrs = {};

  if (angle === 90) {
    // 가로 심볼 (90도 물리 회전), 텍스트 하단 (Screen Bottom)
    const baseScreenY =
      cy + w / 2 + (options.bottomPad !== undefined ? options.bottomPad : 10);
    const nameX = baseScreenY - (cy - cx);
    const specX = nameX + (nameLines - 1) * lineHeight + gap;

    nameAttrs = {
      text: nameText,
      refX: null,
      refY: null,
      x: nameX,
      y: cy,
      textAnchor: "middle",
      transform: `rotate(-90, ${nameX}, ${cy})`,
    };
    specAttrs = {
      text: specText,
      refX: null,
      refY: null,
      x: specX,
      y: cy,
      textAnchor: "middle",
      transform: `rotate(-90, ${specX}, ${cy})`,
    };
  } else if (angle === 180) {
    // 세로 심볼 (180도 물리 회전), 텍스트 좌측 (Screen Left)
    const baseNameRefY =
      options.baseNameRefY !== undefined
        ? options.baseNameRefY
        : Math.round(cy - 10);
    const nameRefY = baseNameRefY - (nameLines - 1) * 6;
    const specRefY = nameRefY + (nameLines - 1) * lineHeight + gap;
    const rightRefX =
      options.rightRefX !== undefined ? options.rightRefX : w + 6;

    nameAttrs = {
      text: nameText,
      refX: null,
      refY: null,
      x: rightRefX,
      y: nameRefY,
      textAnchor: "end",
      transform: `rotate(-180, ${rightRefX}, ${nameRefY})`,
    };
    specAttrs = {
      text: specText,
      refX: null,
      refY: null,
      x: rightRefX,
      y: specRefY,
      textAnchor: "end",
      transform: `rotate(-180, ${rightRefX}, ${specRefY})`,
    };
  } else if (angle === 270) {
    // 가로 심볼 (270도 물리 회전), 텍스트 상단 (Screen Top)
    const topLimitScreenY =
      cy - w / 2 - (options.topPad !== undefined ? options.topPad : 6);
    const specScreenY = topLimitScreenY;
    const nameScreenY = specScreenY - gap - (nameLines - 1) * lineHeight;
    const nameX = nameScreenY - (cy - cx);
    const specX = nameX + (nameLines - 1) * lineHeight + gap;

    nameAttrs = {
      text: nameText,
      refX: null,
      refY: null,
      x: nameX,
      y: cy,
      textAnchor: "middle",
      transform: `rotate(-270, ${nameX}, ${cy})`,
    };
    specAttrs = {
      text: specText,
      refX: null,
      refY: null,
      x: specX,
      y: cy,
      textAnchor: "middle",
      transform: `rotate(-270, ${specX}, ${cy})`,
    };
  } else {
    // 0도 (세로 심볼, 텍스트 우측 Screen Right)
    const baseNameRefY =
      options.baseNameRefY !== undefined
        ? options.baseNameRefY
        : Math.round(cy - 10);
    const nameRefY = baseNameRefY - (nameLines - 1) * 6;
    const specRefY = nameRefY + (nameLines - 1) * lineHeight + gap;
    const rightRefX =
      options.rightRefX !== undefined ? options.rightRefX : w + 6;

    nameAttrs = {
      text: nameText,
      refX: null,
      refY: null,
      x: rightRefX,
      y: nameRefY,
      textAnchor: "start",
      transform: "",
    };
    specAttrs = {
      text: specText,
      refX: null,
      refY: null,
      x: rightRefX,
      y: specRefY,
      textAnchor: "start",
      transform: "",
    };
  }

  return { nameAttrs, specAttrs, angle, nameLines };
}

window.DEFAULT_VOLTAGE_PRESETS = DEFAULT_VOLTAGE_PRESETS;
window.VOLTAGE_PRESETS = VOLTAGE_PRESETS;
window.getVoltageColor = getVoltageColor;
window.saveVoltageColors = saveVoltageColors;
window.resetVoltageColors = resetVoltageColors;
window.formatSymbolLabel = formatSymbolLabel;
window.getSymbolLabelAttrs = getSymbolLabelAttrs;

const EQUIPMENT_CATALOG = {
  // 1. 수전 설비 (Receiving Equipment)
  TRANSMISSION_TOWER: {
    type: "TRANSMISSION_TOWER",
    jointType: "sld.TransmissionTower",
    category: "RECEIVING",
    nameKo: "송전선로",
    descKo: "154kV 수전 철탑 선로",
    isEnergizedSource: true,
    defaultProps: {
      name: "154kV 수전",
      voltage: 154,
      voltageUnit: "kV",
      color: "#7A3E9D",
      memo: "한국전력 154kV 수전 인입점",
    },
    ports: ["out"],
    iconSvg:
      '<path d="M12 2L4 22h16L12 2zm0 6l5 12H7l5-12zM2 14h20M5 18h14" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  },
  TR_2W: {
    type: "TR_2W",
    jointType: "sld.Transformer2W",
    category: "RECEIVING",
    nameKo: "변압기 (2권선)",
    descKo: "154/22.9kV 또는 22.9/0.4kV 전력용 변압기",
    defaultProps: {
      name: "TR#1",
      priVoltage: 154,
      secVoltage: 22.9,
      voltageUnit: "kV",
      capacity: "80/100MVA",
      color: "#2E7D32",
      memo: "154/22.9kV 80/100MVA (자냉/풍랭) 주 변압기",
    },
    ports: ["pri", "sec"],
    iconSvg:
      '<circle cx="12" cy="8" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="16" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  },
  TR_3W: {
    type: "TR_3W",
    jointType: "sld.Transformer3W",
    category: "RECEIVING",
    nameKo: "3권선 변압기",
    descKo: "1차/2차/3차 3권선 변압기",
    defaultProps: {
      name: "TR-3W",
      priVoltage: 154,
      secVoltage: 22.9,
      tertVoltage: 6.6,
      voltageUnit: "kV",
      capacity: "80/100MVA",
      color: "#2E7D32",
      memo: "154/22.9/6.6kV 80/100MVA (자냉/풍랭) 3권선 변압기",
    },
    ports: ["pri", "sec", "tert"],
    iconSvg:
      '<circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="7" cy="16" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="17" cy="16" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  },
  CB_GCB: {
    type: "CB_GCB",
    jointType: "sld.Breaker",
    category: "RECEIVING",
    subCategory: "SWITCH",
    nameKo: "가스차단기 (GCB)",
    descKo: "154kV SF6 가스 차단기",
    defaultProps: {
      name: "154kV CB",
      state: "CLOSED", // 'OPEN' | 'CLOSED'
      voltage: 154,
      current: 2000,
      poles: "3P",
      color: "#7A3E9D",
      memo: "154kV 수전용 메인 GCB",
    },
    ports: ["in", "out"],
    iconSvg:
      '<rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 4v4M12 16v4M8 12h8" stroke="currentColor" stroke-width="1.5"/>',
  },
  DS: {
    type: "DS",
    jointType: "sld.Disconnector",
    category: "RECEIVING",
    subCategory: "SWITCH",
    nameKo: "단로기 (DS)",
    descKo: "154kV 무부하 개폐용 단로기",
    defaultProps: {
      name: "154kV DS",
      state: "CLOSED", // 'OPEN' | 'CLOSED'
      voltage: 154,
      current: 2000,
      poles: "3P",
      color: "#7A3E9D",
      memo: "154kV 수전 단로기",
    },
    ports: ["in", "out"],
    iconSvg:
      '<path d="M12 2v4M12 18v4M15 6v12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="12" cy="6" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="12" cy="18" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/>',
  },
  DS_3P: {
    type: "DS_3P",
    jointType: "sld.Disconnector3P",
    category: "RECEIVING",
    subCategory: "SWITCH",
    nameKo: "3로 단로기 (3-DS)",
    descKo: "154kV 3위치 단로기 (투입/개방/접지 겸용 단로기)",
    defaultProps: {
      name: "154kV DS",
      earthName: "154kV ES",
      state: "CLOSED", // 'CLOSED' | 'OPEN' | 'EARTH'
      voltage: 154,
      current: 2000,
      poles: "3P",
      color: "#7A3E9D",
      memo: "154kV 수전용 3위치 단로기 (투입/개방/접지)",
    },
    ports: ["in", "out", "earth"],
    iconSvg:
      '<path d="M7 2v4M7 18v4M10 6v12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="7" cy="6" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="7" cy="18" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="17" cy="18" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M17 21v3M14 24h6M15 26h4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>',
  },
  LA: {
    type: "LA",
    jointType: "sld.SurgeArrester",
    category: "RECEIVING",
    nameKo: "피뢰기 (LA)",
    descKo: "이상전압 억제 피뢰기 (Surge Arrester)",
    defaultProps: {
      name: "LA",
      voltage: 154,
      dischargeCurrent: "10kA",
      color: "#7A3E9D",
    },
    ports: ["in", "ground"],
    iconSvg:
      '<path d="M12 2v6M9 8h6l-3 4h4l-5 6h4l-3 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  },

  // 2. 보호 / 차단 설비 (Protection / Circuit Breaker)
  CB_ACB: {
    type: "CB_ACB",
    jointType: "sld.ACB",
    category: "PROTECTION",
    subCategory: "SWITCH",
    nameKo: "기중차단기 (ACB)",
    descKo: "저압 주 배전용 기중차단기 (호/접점형)",
    defaultProps: {
      name: "ACB",
      state: "CLOSED",
      voltage: 0.4,
      current: 3200,
      poles: "3P",
      location: "0.4kV 모선 (A)",
      color: "#377DFF",
      memo: "주 배전 차단용 ACB",
    },
    ports: ["in", "out"],
    iconSvg:
      '<circle cx="12" cy="5" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="12" cy="19" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M14 5 C 17 8, 17 16, 14 19 C 23 17, 23 7, 14 5 Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round" fill="currentColor"/>',
  },
  CB_VCB: {
    type: "CB_VCB",
    jointType: "sld.Breaker",
    category: "PROTECTION",
    subCategory: "SWITCH",
    nameKo: "진공차단기 (VCB)",
    descKo: "22.9kV 특고압 진공차단기",
    defaultProps: {
      name: "VCB",
      state: "CLOSED",
      voltage: 22.9,
      current: 1250,
      poles: "3P",
      location: "22.9kV 모선",
      color: "#9C27B0",
      memo: "22.9kV 피더용 VCB",
    },
    ports: ["in", "out"],
    iconSvg:
      '<rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><text x="12" y="14" text-anchor="middle" font-size="7" font-weight="bold" fill="currentColor">VCB</text>',
  },
  CB_MCCB: {
    type: "CB_MCCB",
    jointType: "sld.MCCB",
    category: "PROTECTION",
    subCategory: "SWITCH",
    nameKo: "배선용차단기 (MCCB)",
    descKo: "저압 분기선로 보호 배선용차단기",
    defaultProps: {
      name: "MCCB",
      state: "CLOSED",
      voltage: 0.4,
      current: 225,
      poles: "3P",
      color: "#2B6CB0",
      memo: "부하 분기용 MCCB",
    },
    ports: ["in", "out"],
    iconSvg:
      '<circle cx="12" cy="5" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="12" cy="19" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M14 5 C 17 8, 17 16, 14 19 C 23 17, 23 7, 14 5 Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round" fill="currentColor"/>',
  },
  CB_TIE_HV: {
    type: "CB_TIE_HV",
    jointType: "sld.TieBreakerHV",
    category: "PROTECTION",
    subCategory: "SWITCH",
    isTieBreaker: true,
    nameKo: "고압 TIE 차단기",
    descKo: "특고압/고압 모선간 연계용 TIE 차단기 (가로형 VCB / ATO 연동)",
    defaultProps: {
      name: "TIE VCB",
      state: "OPEN",
      voltage: 22.9,
      current: 1250,
      poles: "3P",
      color: "#9C27B0",
      memo: "모선간 연계 TIE 차단기",
      isTie: true,
      atoEnabled: true,
      interlockCb1: "",
      interlockCb2: "",
      relay51: "",
      interlockMode: "UV_ATO",
    },
    ports: ["in", "out"],
    iconSvg:
      '<rect x="4" y="7" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  },
  CB_TIE_LV: {
    type: "CB_TIE_LV",
    jointType: "sld.TieBreakerLV",
    category: "PROTECTION",
    subCategory: "SWITCH",
    isTieBreaker: true,
    nameKo: "저압 TIE 차단기",
    descKo: "저압 모선간 연계용 TIE 차단기 (가로형 ACB / ATO 연동)",
    defaultProps: {
      name: "TIE ACB",
      state: "OPEN",
      voltage: 0.4,
      current: 2000,
      poles: "3P",
      color: "#377DFF",
      memo: "저압 모선간 연계 TIE 차단기",
      isTie: true,
      atoEnabled: true,
      interlockCb1: "",
      interlockCb2: "",
      relay51: "",
      interlockMode: "UV_ATO",
    },
    ports: ["in", "out"],
    iconSvg:
      '<circle cx="5" cy="12" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="19" cy="12" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M5 11 C 8 8, 16 8, 19 11 C 17 3, 7 3, 5 11 Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round" fill="currentColor"/>',
  },
  FUSE: {
    type: "FUSE",
    jointType: "sld.Fuse",
    category: "PROTECTION",
    subCategory: "SWITCH",
    nameKo: "파워 퓨즈 (PF)",
    descKo: "특고압 한류형 파워 퓨즈",
    defaultProps: {
      name: "PF",
      state: "CLOSED",
      voltage: 22.9,
      current: 100,
      color: "#E65100",
    },
    ports: ["in", "out"],
    iconSvg:
      '<path d="M12 3v4M12 17v4" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="7" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 7v10" stroke="currentColor" stroke-width="1.5"/>',
  },
  RELAY: {
    type: "RELAY",
    jointType: "sld.Relay",
    category: "PROTECTION",
    nameKo: "계전기 (OCR)",
    descKo: "디지털 보호계전기 (과전류/지락/부족전압)",
    defaultProps: {
      name: "OCR",
      functionCode: "50/51",
      color: "#2E7D32",
    },
    ports: ["in", "signal"],
    iconSvg:
      '<rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><text x="12" y="14" text-anchor="middle" font-size="6.5" font-weight="bold" fill="currentColor">51</text>',
  },
  CT: {
    type: "CT",
    jointType: "sld.CT",
    category: "PROTECTION",
    nameKo: "변류기 (CT)",
    descKo: "계측 및 보호용 변류기 (Current Transformer)",
    defaultProps: {
      name: "CT",
      ratio: "400/5A",
      color: "#00838F",
    },
    ports: ["in", "out", "sec"],
    iconSvg:
      '<circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M6 12h12M12 3v3M12 18v3" stroke="currentColor" stroke-width="1.5"/>',
  },
  PT: {
    type: "PT",
    jointType: "sld.PT",
    category: "PROTECTION",
    nameKo: "계기용변압기 (PT)",
    descKo: "계측용 전압 변성기 (Potential Transformer)",
    defaultProps: {
      name: "PT",
      ratio: "22900/110V",
      color: "#00838F",
    },
    ports: ["pri", "sec"],
    iconSvg:
      '<circle cx="12" cy="9" r="4.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="15" r="4.5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  },
  GROUND_SWITCH: {
    type: "GROUND_SWITCH",
    jointType: "sld.GroundSwitch",
    category: "PROTECTION",
    subCategory: "SWITCH",
    nameKo: "접지 단로기 (ES)",
    descKo: "선로/모선 점검용 접지 스위치",
    isGroundSource: true,
    defaultProps: {
      name: "ES",
      state: "OPEN", // 접지 스위치는 기본 열림(OPEN)
      color: "#52c41a",
    },
    ports: ["in"],
    iconSvg:
      '<path d="M12 3v6M12 9l5 4M12 15v3M7 18h10M9 20h6M11 22h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
  },

  // 3. 배전 설비 (Distribution Equipment)
  BUSBAR: {
    type: "BUSBAR",
    jointType: "sld.Busbar",
    category: "DISTRIBUTION",
    nameKo: "모선 (Busbar)",
    descKo: "전력 집중 및 배전용 모선 (다중 피더 접속)",
    defaultProps: {
      name: "22.9kV 모선",
      voltage: 22.9,
      voltageUnit: "kV",
      color: "#9C27B0",
      width: 500,
      height: 10,
      orientation: "horizontal", // 'horizontal' | 'vertical'
    },
    ports: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"],
    iconSvg:
      '<rect x="2" y="10" width="20" height="4" rx="1" fill="currentColor"/><circle cx="5" cy="12" r="1.5" fill="#fff"/><circle cx="12" cy="12" r="1.5" fill="#fff"/><circle cx="19" cy="12" r="1.5" fill="#fff"/>',
  },
  SWITCHGEAR: {
    type: "SWITCHGEAR",
    jointType: "sld.Switchgear",
    category: "DISTRIBUTION",
    nameKo: "배전반 (Switchgear)",
    descKo: "수배전반 큐비클 및 패널",
    defaultProps: {
      name: "배전반",
      voltage: 0.4,
      color: "#2E7D32",
    },
    ports: ["in", "out1", "out2", "out3"],
    iconSvg:
      '<rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="4" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="4" y1="16" x2="20" y2="16" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="6.5" r="1" fill="currentColor"/><circle cx="8" cy="13" r="1" fill="currentColor"/>',
  },
  PANELBOARD: {
    type: "PANELBOARD",
    jointType: "sld.Panelboard",
    category: "DISTRIBUTION",
    nameKo: "분전반 (Panelboard)",
    descKo: "조명 및 동력 분전반",
    defaultProps: {
      name: "분전반",
      voltage: 0.22,
      color: "#2B6CB0",
    },
    ports: ["in", "out1", "out2"],
    iconSvg:
      '<rect x="5" y="4" width="14" height="16" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="8" y="7" width="8" height="10" stroke="currentColor" stroke-width="1" fill="none"/>',
  },
  MOTOR: {
    type: "MOTOR",
    jointType: "sld.Motor",
    category: "DISTRIBUTION",
    nameKo: "전동기 (Motor)",
    descKo: "3상 유도 전동기 / 펌프 모터",
    defaultProps: {
      name: "모터 (M)",
      voltage: 0.38,
      capacity: "75kW",
      color: "#377DFF",
    },
    ports: ["in"],
    iconSvg:
      '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><text x="12" y="15" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor">M</text>',
  },
  LOAD: {
    type: "LOAD",
    jointType: "sld.Load",
    category: "DISTRIBUTION",
    nameKo: "일반 부하 (Load)",
    descKo: "일반 전력 수용가 부하",
    defaultProps: {
      name: "부하",
      voltage: 0.38,
      capacity: "50kW",
      color: "#374151",
    },
    ports: ["in"],
    iconSvg:
      '<rect x="5" y="7" width="14" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 2v5M12 17v5" stroke="currentColor" stroke-width="1.5"/><text x="12" y="14.5" text-anchor="middle" font-size="6" font-weight="bold" fill="currentColor">부하</text>',
  },

  // 4. 전원 설비 (Power Source Equipment)
  UPS: {
    type: "UPS",
    jointType: "sld.UPS",
    category: "POWER_SOURCE",
    nameKo: "무정전 전원장치 (UPS)",
    descKo: "AC-DC-AC 무순단 전원공급 시스템",
    isEnergizedSource: true,
    defaultProps: {
      name: "UPS",
      capacity: "100kVA",
      inputVoltage: "380V",
      outputVoltage: "380/220V",
      color: "#00838F",
      memo: "전산/통신실 무정전 전원용",
    },
    ports: ["ac_in", "dc_bat", "ac_out"],
    iconSvg:
      '<rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="3" y1="19" x2="21" y2="5" stroke="currentColor" stroke-width="1"/><path d="M6 10q2-3 4 0t4 0" stroke="currentColor" stroke-width="1.2" fill="none"/><text x="15" y="16" font-size="6" font-weight="bold" fill="currentColor">=</text>',
  },
  RECTIFIER: {
    type: "RECTIFIER",
    jointType: "sld.Rectifier",
    category: "POWER_SOURCE",
    nameKo: "정류기 / 충전기",
    descKo: "AC -> DC 정류 및 배터리 충전기",
    defaultProps: {
      name: "정류기",
      inputVoltage: "220V",
      outputVoltage: "110V DC",
      color: "#2E7D32",
    },
    ports: ["ac_in", "dc_out"],
    iconSvg:
      '<rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="4" y1="19" x2="20" y2="5" stroke="currentColor" stroke-width="1"/><path d="M7 10q1.5-2 3 0t3 0" stroke="currentColor" stroke-width="1" fill="none"/><line x1="14" y1="14" x2="17" y2="14" stroke="currentColor" stroke-width="1.2"/>',
  },
  BATTERY: {
    type: "BATTERY",
    jointType: "sld.Battery",
    category: "POWER_SOURCE",
    nameKo: "축전지 (Battery)",
    descKo: "비상용 연축전지 / 리튬 배터리 뱅크",
    isEnergizedSource: true,
    defaultProps: {
      name: "배터리 뱅크",
      voltage: 384,
      voltageUnit: "V DC",
      capacity: "200Ah",
      color: "#00838F",
      memo: "384V DC 무정전 전원 백업용",
    },
    ports: ["out"],
    iconSvg:
      '<rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="7" y="4" width="3" height="2" fill="currentColor"/><rect x="14" y="4" width="3" height="2" fill="currentColor"/><text x="8.5" y="14.5" text-anchor="middle" font-size="7" font-weight="bold" fill="currentColor">+</text><text x="15.5" y="14.5" text-anchor="middle" font-size="7" font-weight="bold" fill="currentColor">-</text>',
  },
  GENERATOR: {
    type: "GENERATOR",
    jointType: "sld.Generator",
    category: "POWER_SOURCE",
    nameKo: "비상 발전기 (Generator)",
    descKo: "디젤 비상 발전기 (Emergency Gen)",
    isEnergizedSource: true,
    defaultProps: {
      name: "비상 발전기",
      state: "DEAD",
      capacity: "500kVA",
      voltage: 0.4,
      voltageUnit: "kV",
      color: "#E65100",
      memo: "디젤 비상 발전기 500kVA",
    },
    ports: ["out"],
    iconSvg:
      '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><text x="12" y="15" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor">G</text>',
  },

  // 5. 기타 및 영역 (Others / Annotation / Group)
  GROUND: {
    type: "GROUND",
    jointType: "sld.Ground",
    category: "OTHER",
    nameKo: "접지 (Earth)",
    descKo: "대지 접지 단자 (PE/GND)",
    isGroundSource: true,
    defaultProps: {
      name: "접지",
      color: "#2E7D32",
    },
    ports: ["in"],
    iconSvg:
      '<path d="M12 4v8M6 12h12M8 15h8M10 18h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
  },
  JUNCTION: {
    type: "JUNCTION",
    jointType: "sld.Junction",
    category: "OTHER",
    nameKo: "연결점 (Node)",
    descKo: "전기 접속점 / 분기 노드",
    defaultProps: {
      name: "",
      color: "#377DFF",
    },
    ports: ["p1", "p2", "p3", "p4"],
    iconSvg:
      '<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="1.5"/>',
  },
  TEXT_LABEL: {
    type: "TEXT_LABEL",
    jointType: "sld.TextLabel",
    category: "OTHER",
    nameKo: "텍스트 라벨",
    descKo: "설명 및 주석 텍스트",
    defaultProps: {
      text: "22.9kV 모선",
      fontSize: 13,
      fontWeight: "600",
      color: "#9C27B0",
    },
    ports: [],
    iconSvg:
      '<path d="M5 5h14M12 5v14M8 19h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  },
  GROUP_BOX: {
    type: "GROUP_BOX",
    jointType: "sld.GroupBox",
    category: "OTHER",
    nameKo: "영역 그룹 박스",
    descKo: "중요부하 계통 점선 테두리 컨테이너",
    defaultProps: {
      title: "중요 부하 (무정전 전원 계통)",
      strokeColor: "#377DFF",
      strokeDasharray: "6,4",
      fillColor: "rgba(55, 125, 255, 0.03)",
      width: 480,
      height: 240,
    },
    ports: [],
    iconSvg:
      '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2" fill="none"/><path d="M6 7h8" stroke="currentColor" stroke-width="1.2"/>',
  },
};

window.EQUIPMENT_CATALOG = EQUIPMENT_CATALOG;
window.VOLTAGE_PRESETS = VOLTAGE_PRESETS;
