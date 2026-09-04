/**
 * symbols/substation.js
 * 수전 및 변전 설비 심볼 정의:
 * - TransmissionTower (송전철탑 154kV 수전)
 * - Transformer2W / Transformer3W (2권선 / 3권선 변압기)
 * - SurgeArrester (피뢰기 LA)
 * - Disconnector (단로기 DS)
 */
(function () {
  if (typeof joint === "undefined") return;
  joint.shapes.sld = joint.shapes.sld || {};

  const fmtName = (str) =>
    typeof window.formatSymbolLabel === "function"
      ? window.formatSymbolLabel(str)
      : str;

  const getLblAttrs = (opts) =>
    typeof window.getSymbolLabelAttrs === "function"
      ? window.getSymbolLabelAttrs(opts)
      : {
          nameAttrs: { text: opts.nameText },
          specAttrs: { text: opts.specText },
        };

  // 1. Transmission Tower (송전철탑)
  joint.shapes.sld.TransmissionTower = joint.dia.Element.define(
    "sld.TransmissionTower",
    {
      size: { width: 56, height: 56 },
      markup: [
        { tagName: "rect", selector: "bodyBox" },
        { tagName: "path", selector: "towerPath" },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        bodyBox: {
          refWidth: "100%",
          refHeight: "100%",
          fill: "#ffffff",
          stroke: "#94a3b8",
          strokeWidth: 1,
          rx: 4,
        },
        towerPath: {
          d: "M 28 6 L 14 44 L 42 44 Z M 28 16 L 38 44 M 28 16 L 18 44 M 10 26 L 46 26 M 14 34 L 42 34",
          stroke: "#7A3E9D",
          strokeWidth: 1.5,
          fill: "none",
          strokeLinecap: "round",
        },
        nameLabel: {
          text: "154kV 수전",
          refX: "50%",
          refY: -10,
          textAnchor: "middle",
          fontSize: 12,
          fontWeight: "bold",
          fill: "#7A3E9D",
        },
      },
      ports: {
        groups: {
          ports: {
            position: { name: "absolute" },
            attrs: {
              circle: {
                r: 3.5,
                magnet: true,
                fill: "#fff",
                stroke: "#7A3E9D",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [{ id: "out", group: "ports", args: { x: 28, y: 56 } }],
      },
    },
    {
      initialize: function () {
        joint.dia.Element.prototype.initialize.apply(this, arguments);
        this.updateVisual();
        this.on("change:sldData", this.updateVisual, this);
      },
      updateVisual: function () {
        const data = this.get("sldData") || {};
        this.attr("nameLabel/text", fmtName(data.name || "154kV 수전"));
      },
    },
  );

  // 2. Disconnector (DS - 단로기: 상/하단 원형 링 + 우측 외곽 접선 연결선 디자인)
  joint.shapes.sld.Disconnector = joint.dia.Element.define(
    "sld.Disconnector",
    {
      size: { width: 28, height: 40 },
      markup: [
        { tagName: "path", selector: "inLine" },
        { tagName: "path", selector: "outLine" },
        { tagName: "path", selector: "blade" },
        { tagName: "circle", selector: "topNode" },
        { tagName: "circle", selector: "botNode" },
        { tagName: "text", selector: "groundSymbol" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        inLine: {
          d: "M 14 0 L 14 6",
          stroke: "#7A3E9D",
          strokeWidth: 2,
          strokeLinecap: "round",
        },
        outLine: {
          d: "M 14 34 L 14 40",
          stroke: "#7A3E9D",
          strokeWidth: 2,
          strokeLinecap: "round",
        },
        blade: {
          d: "M 18.5 6 L 18.5 34",
          stroke: "#7A3E9D",
          strokeWidth: 2.5,
          strokeLinecap: "round",
          cursor: "pointer",
        },
        topNode: {
          cx: 14,
          cy: 6,
          r: 4.5,
          stroke: "#7A3E9D",
          strokeWidth: 2,
          fill: "#ffffff",
        },
        botNode: {
          cx: 14,
          cy: 34,
          r: 4.5,
          stroke: "#7A3E9D",
          strokeWidth: 2,
          fill: "#ffffff",
        },
        groundSymbol: {
          text: "⏚",
          x: 5,
          y: 20,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          fontSize: 13,
          fontWeight: "bold",
          fill: "#84CC16",
          display: "none",
          pointerEvents: "none",
        },
        nameLabel: {
          text: "154kV DS",
          refX: 28,
          refY: "25%",
          textAnchor: "start",
          textVerticalAnchor: "middle",
          fontSize: 9.5,
          fontWeight: "600",
          fill: "#1e293b",
        },
        specLabel: {
          text: "2000A",
          refX: 28,
          refY: "65%",
          textAnchor: "start",
          textVerticalAnchor: "middle",
          fontSize: 8.5,
          fill: "#64748b",
        },
      },
      ports: {
        groups: {
          ports: {
            position: { name: "absolute" },
            attrs: {
              circle: {
                r: 3.5,
                magnet: true,
                fill: "#fff",
                stroke: "#7A3E9D",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [
          { id: "in", group: "ports", args: { x: 14, y: 0 } },
          { id: "out", group: "ports", args: { x: 14, y: 40 } },
        ],
      },
    },
    {
      initialize: function () {
        joint.dia.Element.prototype.initialize.apply(this, arguments);
        this.updateContactVisual();
        this.on("change:sldData", this.updateContactVisual, this);
        this.on("change:size", this.updateContactVisual, this);
      },
      updateContactVisual: function (
        effectiveState,
        topologyState,
        activeVoltageColor,
      ) {
        const data = this.get("sldData") || {};
        const contactState = (
          effectiveState ||
          data.state ||
          "CLOSED"
        ).toUpperCase();
        const topState = (
          topologyState || (contactState === "OPEN" ? "DEAD" : "LIVE")
        ).toUpperCase();

        const isContactClosed =
          contactState === "CLOSED" ||
          contactState === "LIVE" ||
          contactState === "ON";
        const isGrounded =
          topState === "GROUNDED" ||
          contactState === "GROUNDED" ||
          contactState === "GROUND" ||
          contactState === "EARTH";
        const isDead = topState === "DEAD" || !isContactClosed;

        const baseColor = activeVoltageColor || data.color || "#7A3E9D";
        let strokeColor = isGrounded
          ? "#84CC16"
          : isDead
            ? "#94a3b8"
            : baseColor;
        let bladeD = isContactClosed
          ? "M 18.5 6 L 18.5 34"
          : "M 18.5 6 L 26 30";
        let showGround = isGrounded ? "block" : "none";

        const formattedName = fmtName(data.name || "DS");
        const specText = data.current ? data.current + "A" : "";
        const sz = this.get("size") || { width: 28, height: 40 };
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: formattedName,
          specText: specText,
        });

        this.attr({
          inLine: { stroke: strokeColor },
          outLine: { stroke: strokeColor },
          topNode: { stroke: strokeColor, fill: "#ffffff" },
          botNode: { stroke: strokeColor, fill: "#ffffff" },
          blade: { d: bladeD, stroke: strokeColor },
          groundSymbol: { display: showGround, fill: "#84CC16" },
          nameLabel: lbls.nameAttrs,
          specLabel: lbls.specAttrs,
        });

        const ports = this.getPorts ? this.getPorts() || [] : [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", strokeColor);
        });
      },
    },
  );

  // 2-1. 3-Position Disconnector (3로 단로기: DS + 접지 ES 일체형 3위치 단로기)
  joint.shapes.sld.Disconnector3P = joint.dia.Element.define(
    "sld.Disconnector3P",
    {
      size: { width: 44, height: 48 },
      markup: [
        { tagName: "path", selector: "inLine" },
        { tagName: "path", selector: "outLine" },
        { tagName: "circle", selector: "topNode" },
        { tagName: "circle", selector: "pivotNode" },
        { tagName: "circle", selector: "pivotDot" },
        { tagName: "path", selector: "blade" },
        { tagName: "circle", selector: "earthNode" },
        { tagName: "path", selector: "earthSymbol" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
        { tagName: "text", selector: "earthNameLabel" },
        { tagName: "text", selector: "earthSpecLabel" },
      ],
      attrs: {
        inLine: {
          d: "M 14 34 L 14 48",
          stroke: "#7A3E9D",
          strokeWidth: 2,
          strokeLinecap: "round",
        },
        outLine: {
          d: "M 14 0 L 14 10",
          stroke: "#7A3E9D",
          strokeWidth: 2,
          strokeLinecap: "round",
        },
        topNode: {
          cx: 14,
          cy: 10,
          r: 4.5,
          stroke: "#7A3E9D",
          strokeWidth: 2,
          fill: "#ffffff",
        },
        pivotNode: {
          cx: 14,
          cy: 34,
          r: 4.5,
          stroke: "#7A3E9D",
          strokeWidth: 2,
          fill: "#ffffff",
        },
        pivotDot: {
          cx: 14,
          cy: 34,
          r: 2,
          fill: "#7A3E9D",
        },
        blade: {
          d: "M 18.5 34 L 18.5 10",
          stroke: "#7A3E9D",
          strokeWidth: 2.5,
          strokeLinecap: "round",
          cursor: "pointer",
        },
        earthNode: {
          cx: 38,
          cy: 34,
          r: 4.5,
          stroke: "#94a3b8",
          strokeWidth: 2,
          fill: "#ffffff",
        },
        earthSymbol: {
          d: "M 38 38.5 L 38 42 M 32 42 L 44 42 M 34 44.5 L 42 44.5 M 36 47 L 40 47",
          stroke: "#94a3b8",
          strokeWidth: 1.5,
          strokeLinecap: "round",
        },
        nameLabel: {
          text: "154kV DS",
          x: 4,
          y: 16,
          textAnchor: "end",
          textVerticalAnchor: "middle",
          fontSize: 9.5,
          fontWeight: "600",
          fill: "#1e293b",
        },
        specLabel: {
          text: "2000A",
          x: 4,
          y: 28,
          textAnchor: "end",
          textVerticalAnchor: "middle",
          fontSize: 8.5,
          fill: "#64748b",
        },
        earthNameLabel: {
          text: "154kV ES",
          x: 48,
          y: 30,
          textAnchor: "start",
          textVerticalAnchor: "middle",
          fontSize: 9.5,
          fontWeight: "600",
          fill: "#64748b",
        },
        earthSpecLabel: {
          text: "",
          x: 48,
          y: 42,
          textAnchor: "start",
          textVerticalAnchor: "middle",
          fontSize: 8.5,
          fill: "#64748b",
        },
      },
      ports: {
        groups: {
          ports: {
            position: { name: "absolute" },
            attrs: {
              circle: {
                r: 3.5,
                magnet: true,
                fill: "#fff",
                stroke: "#7A3E9D",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [
          { id: "in", group: "ports", args: { x: 14, y: 48 } },
          { id: "out", group: "ports", args: { x: 14, y: 0 } },
          { id: "earth", group: "ports", args: { x: 38, y: 48 } },
        ],
      },
    },
    {
      initialize: function () {
        joint.dia.Element.prototype.initialize.apply(this, arguments);
        this.updateContactVisual();
        this.on("change:sldData", this.updateContactVisual, this);
        this.on("change:size", this.updateContactVisual, this);
      },
      updateContactVisual: function (
        effectiveState,
        topologyState,
        activeVoltageColor,
      ) {
        const data = this.get("sldData") || {};
        const contactState = (
          effectiveState ||
          data.state ||
          "CLOSED"
        ).toUpperCase();

        const isClosed =
          contactState === "CLOSED" ||
          contactState === "LIVE" ||
          contactState === "ON";
        const isEarth = contactState === "EARTH" || contactState === "GROUND";
        const isOpen = !isClosed && !isEarth;

        const baseColor = activeVoltageColor || data.color || "#7A3E9D";

        // 접지 상태(EARTH)일 때 하단 인입선(in) 및 피벗 노드는 접지색(#84CC16)
        // 상단 인출선(out) 및 상단 노드(topNode)는 반드시 절연 회색(#94a3b8) 유지
        const isGrounded =
          isEarth || (topologyState === "GROUNDED" && isClosed);
        const inColor = isGrounded ? "#84CC16" : isOpen ? "#94a3b8" : baseColor;

        const outColor = isClosed
          ? topologyState === "GROUNDED"
            ? "#84CC16"
            : topologyState === "DEAD"
              ? "#94a3b8"
              : baseColor
          : "#94a3b8"; // EARTH 또는 OPEN일 때 상단 노드는 절대 접지색으로 바뀌지 않음

        const earthColor = isEarth ? "#84CC16" : "#94a3b8";

        let bladeD = "M 18.5 34 L 18.5 10"; // CLOSED
        let bladeStroke = isClosed
          ? topologyState === "GROUNDED"
            ? "#84CC16"
            : baseColor
          : "#94a3b8";
        if (isOpen) {
          bladeD = "M 18.5 34 L 35.5 17"; // 45 deg OPEN
          bladeStroke = "#94a3b8";
        } else if (isEarth) {
          bladeD = "M 18.5 34 L 42.5 34"; // EARTH
          bladeStroke = "#84CC16";
        }

        const formattedName = fmtName(data.name || "DS");
        const nameLines = formattedName
          ? String(formattedName).split("\n").length
          : 1;
        const nameY = 16 - (nameLines - 1) * 6;
        const specY = nameY + (nameLines - 1) * 12 + 14;

        const formattedEarthName = fmtName(data.earthName || "ES");
        const earthNameLines = formattedEarthName
          ? String(formattedEarthName).split("\n").length
          : 1;
        const earthNameY = 30 - (earthNameLines - 1) * 6;
        const earthSpecY = earthNameY + (earthNameLines - 1) * 12 + 14;

        this.attr({
          inLine: { stroke: inColor },
          outLine: { stroke: outColor },
          topNode: { stroke: outColor, fill: "#ffffff" },
          pivotNode: { stroke: inColor, fill: "#ffffff" },
          pivotDot: { fill: inColor },
          blade: { d: bladeD, stroke: bladeStroke },
          earthNode: { stroke: earthColor, fill: "#ffffff" },
          earthSymbol: { stroke: earthColor },
          nameLabel: {
            text: formattedName,
            y: nameY,
            fill: isClosed ? "#1e293b" : "#64748b",
          },
          specLabel: { text: data.current ? data.current + "A" : "", y: specY },
          earthNameLabel: {
            text: formattedEarthName,
            y: earthNameY,
            fill: isEarth ? "#84CC16" : "#64748b",
          },
          earthSpecLabel: { text: isEarth ? "접지" : "", y: earthSpecY },
        });

        const ports = this.getPorts ? this.getPorts() || [] : [];
        ports.forEach((p) => {
          let pColor = inColor;
          if (p.id === "out") pColor = outColor;
          else if (p.id === "earth") pColor = earthColor;
          this.portProp(p.id, "attrs/circle/stroke", pColor);
        });
      },
    },
  );

  // 3. Transformer 2W (2권선 & 3권선 동적 결선 변압기)
  joint.shapes.sld.Transformer2W = joint.dia.Element.define(
    "sld.Transformer2W",
    {
      size: { width: 44, height: 64 },
      markup: [
        { tagName: "circle", selector: "topCircle" },
        { tagName: "circle", selector: "botCircle" },
        { tagName: "circle", selector: "tertCircle" },
        { tagName: "path", selector: "topLead" },
        { tagName: "path", selector: "botLead" },
        { tagName: "path", selector: "tertLead" },
        { tagName: "text", selector: "topVectorLabel" },
        { tagName: "text", selector: "botVectorLabel" },
        { tagName: "text", selector: "tertVectorLabel" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        topCircle: {
          cx: 22,
          cy: 22,
          r: 16,
          stroke: "#2E7D32",
          strokeWidth: 2,
          fill: "#ffffff",
        },
        botCircle: {
          cx: 22,
          cy: 42,
          r: 16,
          stroke: "#2E7D32",
          strokeWidth: 2,
          fill: "#ffffff",
        },
        tertCircle: {
          cx: 38,
          cy: 32,
          r: 16,
          stroke: "#2E7D32",
          strokeWidth: 2,
          fill: "#ffffff",
          display: "none",
        },
        topLead: { d: "M 22 0 L 22 6", stroke: "#2E7D32", strokeWidth: 2 },
        botLead: { d: "M 22 58 L 22 64", stroke: "#2E7D32", strokeWidth: 2 },
        tertLead: {
          d: "M 54 32 L 60 32",
          stroke: "#2E7D32",
          strokeWidth: 2,
          display: "none",
        },
        topVectorLabel: {
          text: "Δ",
          x: 22,
          y: 22,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          fontSize: 12,
          fontWeight: "bold",
          fill: "#2E7D32",
          fontFamily: "Pretendard, -apple-system, sans-serif",
          pointerEvents: "none",
        },
        botVectorLabel: {
          text: "Y",
          x: 22,
          y: 42,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          fontSize: 12,
          fontWeight: "bold",
          fill: "#2E7D32",
          fontFamily: "Pretendard, -apple-system, sans-serif",
          pointerEvents: "none",
        },
        tertVectorLabel: {
          text: "Δ",
          x: 38,
          y: 32,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          fontSize: 12,
          fontWeight: "bold",
          fill: "#2E7D32",
          fontFamily: "Pretendard, -apple-system, sans-serif",
          pointerEvents: "none",
          display: "none",
        },
        nameLabel: {
          text: "TR",
          refX: 46,
          refY: "35%",
          textAnchor: "start",
          fontSize: 10.5,
          fontWeight: "600",
          fill: "#1e293b",
        },
        specLabel: {
          text: "",
          refX: 46,
          refY: "60%",
          textAnchor: "start",
          fontSize: 8.5,
          fill: "#64748b",
        },
      },
      ports: {
        groups: {
          ports: {
            position: { name: "absolute" },
            attrs: {
              circle: {
                r: 3.5,
                magnet: true,
                fill: "#fff",
                stroke: "#2E7D32",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [
          { id: "pri", group: "ports", args: { x: 22, y: 0 } },
          { id: "sec", group: "ports", args: { x: 22, y: 64 } },
        ],
      },
    },
    {
      initialize: function () {
        joint.dia.Element.prototype.initialize.apply(this, arguments);
        this.updateVisual();
        this.on("change:sldData", this.updateVisual, this);
        this.on("change:size", this.updateVisual, this);
      },
      updateVisual: function (effectiveState) {
        const data = this.get("sldData") || {};
        const vUnit = data.voltageUnit || "kV";
        const getVColor =
          typeof window.getVoltageColor === "function"
            ? window.getVoltageColor
            : (v) => data.color || "#2E7D32";

        const baseState = (data.state || "LIVE").toUpperCase();
        const state = (effectiveState || baseState).toUpperCase();
        const isDead = state === "DEAD" || state === "OPEN";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        const priV =
          data.priVoltage !== undefined
            ? data.priVoltage
            : data.voltage !== undefined
              ? data.voltage
              : 154;
        const secV = data.secVoltage !== undefined ? data.secVoltage : 22.9;
        const tertV = data.tertVoltage !== undefined ? data.tertVoltage : 6.6;

        let priColor, secColor, tertColor;
        let priFill, secFill, tertFill;
        let labelFill = "#ffffff";

        if (isDead) {
          priColor = "#94a3b8";
          secColor = "#94a3b8";
          tertColor = "#94a3b8";
          priFill = "#94a3b8";
          secFill = "#94a3b8";
          tertFill = "#94a3b8";
          labelFill = "#ffffff";
        } else if (isGrounded) {
          priColor = "#84CC16";
          secColor = "#84CC16";
          tertColor = "#84CC16";
          priFill = "#84CC16";
          secFill = "#84CC16";
          tertFill = "#84CC16";
          labelFill = "#ffffff";
        } else {
          priColor = getVColor(priV, vUnit);
          secColor = getVColor(secV, vUnit);
          tertColor = getVColor(tertV, vUnit);
          priFill = priColor;
          secFill = secColor;
          tertFill = tertColor;
          labelFill = "#ffffff";
        }

        let parts = [];
        if (data.connection) {
          parts = data.connection
            .split(/[-/]/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
        const is3W =
          parts.length >= 3 ||
          (data.connection && data.connection.includes("3권선"));

        if (is3W) {
          const v1 = parts[0] || "Y";
          const v2 = parts[1] || "Y";
          const v3 = parts[2] || "Δ";

          const formattedName = fmtName(data.name || "TR-3W");
          const defaultCap =
            priV >= 100
              ? "80/100MVA"
              : priV >= 21.9
                ? "20MVA"
                : priV > 1.0
                  ? "3MVA"
                  : "1000kVA";
          const specText =
            data.capacity !== undefined && data.capacity !== ""
              ? data.capacity
              : defaultCap;
          const lbls = getLblAttrs({
            angle: data.angle,
            width: 60,
            height: 64,
            nameText: formattedName,
            specText: specText,
            rightRefX: 62,
            leftRefX: -6,
            baseNameRefY: 20,
          });

          this.attr({
            topCircle: {
              cx: 22,
              cy: 22,
              r: 16,
              stroke: priColor,
              strokeWidth: 2,
              fill: priFill,
              display: "block",
            },
            botCircle: {
              cx: 22,
              cy: 42,
              r: 16,
              stroke: secColor,
              strokeWidth: 2,
              fill: secFill,
              display: "block",
            },
            tertCircle: {
              cx: 38,
              cy: 32,
              r: 16,
              stroke: tertColor,
              strokeWidth: 2,
              fill: tertFill,
              display: "block",
            },
            topLead: {
              d: "M 22 0 L 22 6",
              stroke: priColor,
              strokeWidth: 2,
              display: "block",
            },
            botLead: {
              d: "M 22 58 L 22 64",
              stroke: secColor,
              strokeWidth: 2,
              display: "block",
            },
            tertLead: {
              d: "M 54 32 L 60 32",
              stroke: tertColor,
              strokeWidth: 2,
              display: "block",
            },
            topVectorLabel: {
              text: v1,
              x: 18,
              y: 19,
              textAnchor: "middle",
              textVerticalAnchor: "middle",
              fill: labelFill,
              fontSize: 12,
              fontWeight: "bold",
              display: "block",
            },
            botVectorLabel: {
              text: v2,
              x: 18,
              y: 42,
              textAnchor: "middle",
              textVerticalAnchor: "middle",
              fill: labelFill,
              fontSize: 12,
              fontWeight: "bold",
              display: "block",
            },
            tertVectorLabel: {
              text: v3,
              x: 38,
              y: 32,
              textAnchor: "middle",
              textVerticalAnchor: "middle",
              fill: labelFill,
              fontSize: 12,
              fontWeight: "bold",
              display: "block",
            },
            nameLabel: lbls.nameAttrs,
            specLabel: lbls.specAttrs,
          });

          const curSize = this.get("size") || {};
          if (curSize.width !== 60) {
            this.resize(60, 64);
          }
          this.prop("ports/items", [
            { id: "pri", group: "ports", args: { x: 22, y: 0 } },
            { id: "sec", group: "ports", args: { x: 22, y: 64 } },
            { id: "tert", group: "ports", args: { x: 60, y: 32 } },
          ]);
        } else {
          let priVector = data.priVector || parts[0] || "";
          let secVector = data.secVector || parts[1] || "";
          if (!priVector && !secVector) {
            priVector = priV >= 100 || priV === 154 ? "Y" : "Δ";
            secVector = priV >= 100 || priV === 154 ? "Δ" : "Y";
          }

          const formattedName = fmtName(data.name || "TR");
          const defaultCap =
            priV >= 100
              ? "80/100MVA"
              : priV >= 21.9
                ? "20MVA"
                : priV > 1.0
                  ? "3MVA"
                  : "1000kVA";
          const specText =
            data.capacity !== undefined && data.capacity !== ""
              ? data.capacity
              : defaultCap;
          const lbls = getLblAttrs({
            angle: data.angle,
            width: 44,
            height: 64,
            nameText: formattedName,
            specText: specText,
            rightRefX: 46,
            leftRefX: -6,
            baseNameRefY: 20,
          });

          this.attr({
            topCircle: {
              cx: 22,
              cy: 22,
              r: 16,
              stroke: priColor,
              strokeWidth: 2,
              fill: priFill,
              display: "block",
            },
            botCircle: {
              cx: 22,
              cy: 42,
              r: 16,
              stroke: secColor,
              strokeWidth: 2,
              fill: secFill,
              display: "block",
            },
            tertCircle: { display: "none" },
            topLead: {
              d: "M 22 0 L 22 6",
              stroke: priColor,
              strokeWidth: 2,
              display: "block",
            },
            botLead: {
              d: "M 22 58 L 22 64",
              stroke: secColor,
              strokeWidth: 2,
              display: "block",
            },
            tertLead: { display: "none" },
            topVectorLabel: {
              text: priVector,
              x: 22,
              y: 19,
              textAnchor: "middle",
              textVerticalAnchor: "middle",
              fill: labelFill,
              fontSize: 12,
              fontWeight: "bold",
              display: "block",
            },
            botVectorLabel: {
              text: secVector,
              x: 22,
              y: 42,
              textAnchor: "middle",
              textVerticalAnchor: "middle",
              fill: labelFill,
              fontSize: 12,
              fontWeight: "bold",
              display: "block",
            },
            tertVectorLabel: { display: "none" },
            nameLabel: lbls.nameAttrs,
            specLabel: lbls.specAttrs,
          });

          const curSize = this.get("size") || {};
          if (curSize.width !== 44) {
            this.resize(44, 64);
          }
          this.prop("ports/items", [
            { id: "pri", group: "ports", args: { x: 22, y: 0 } },
            { id: "sec", group: "ports", args: { x: 22, y: 64 } },
          ]);
        }
      },
    },
  );

  // 4. Transformer 3W (3권선 변압기)
  joint.shapes.sld.Transformer3W = joint.shapes.sld.Transformer2W;

  // 5. Surge Arrester (LA - 피뢰기)
  joint.shapes.sld.SurgeArrester = joint.dia.Element.define(
    "sld.SurgeArrester",
    {
      size: { width: 32, height: 44 },
      markup: [
        { tagName: "path", selector: "lead" },
        { tagName: "path", selector: "zig" },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        lead: {
          d: "M 16 0 L 16 8 M 16 36 L 16 44",
          stroke: "#7A3E9D",
          strokeWidth: 2,
        },
        zig: {
          d: "M 11 8 h 10 l -5 8 h 6 l -8 10 h 6 l -5 10",
          stroke: "#7A3E9D",
          strokeWidth: 1.8,
          fill: "none",
          strokeLinecap: "round",
        },
        nameLabel: {
          text: "LA",
          refX: 34,
          refY: "50%",
          textAnchor: "start",
          fontSize: 11,
          fontWeight: "600",
          fill: "#7A3E9D",
        },
      },
      ports: {
        groups: {
          ports: {
            position: { name: "absolute" },
            attrs: {
              circle: {
                r: 3.5,
                magnet: true,
                fill: "#fff",
                stroke: "#7A3E9D",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [
          { id: "in", group: "ports", args: { x: 16, y: 0 } },
          { id: "ground", group: "ports", args: { x: 16, y: 44 } },
        ],
      },
    },
    {
      initialize: function () {
        joint.dia.Element.prototype.initialize.apply(this, arguments);
        this.updateVisual();
        this.on("change:sldData", this.updateVisual, this);
        this.on("change:size", this.updateVisual, this);
      },
      updateVisual: function () {
        const data = this.get("sldData") || {};
        const sz = this.get("size") || { width: 32, height: 44 };
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: fmtName(data.name || "LA"),
        });
        this.attr({
          nameLabel: lbls.nameAttrs,
        });
      },
    },
  );
})();
