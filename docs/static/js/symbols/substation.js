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
          refX: 34,
          refY: "25%",
          textAnchor: "start",
          textVerticalAnchor: "middle",
          fontSize: 9.5,
          fontWeight: "600",
          fill: "#1e293b",
        },
        specLabel: {
          text: "2000A",
          refX: 34,
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
      updateContactVisual: function () {
        const data = this.get("sldData") || {};
        const state = (data.state || "LIVE").toUpperCase();
        const color = data.color || "#7A3E9D";

        const isLive = state === "LIVE" || state === "CLOSED";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        let strokeColor = color;
        let bladeD = "M 18.5 6 L 18.5 34";
        let showGround = "none";

        if (isGrounded) {
          strokeColor = "#84CC16";
          showGround = "block";
        } else if (!isLive) {
          strokeColor = "#94a3b8";
          bladeD = "M 18.5 6 L 26 30";
        }

        this.attr({
          inLine: { stroke: strokeColor },
          outLine: { stroke: strokeColor },
          topNode: { stroke: strokeColor, fill: "#ffffff" },
          botNode: { stroke: strokeColor, fill: "#ffffff" },
          blade: { d: bladeD, stroke: strokeColor },
          groundSymbol: { display: showGround, fill: "#84CC16" },
          nameLabel: { text: data.name || "DS" },
          specLabel: { text: data.current ? data.current + "A" : "" },
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
            nameLabel: { text: data.name || "TR-3W", refX: 64, refY: "35%" },
            specLabel: { text: data.capacity || "", refX: 64, refY: "60%" },
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
            nameLabel: { text: data.name || "TR", refX: 46, refY: "35%" },
            specLabel: { text: data.capacity || "", refX: 46, refY: "60%" },
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
  );
})();
