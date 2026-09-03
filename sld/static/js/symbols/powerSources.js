/**
 * symbols/powerSources.js
 * 전원, 변환, 에너지 저장 및 부하 설비 심볼 정의:
 * - Generator (비상 발전기 G)
 * - Motor (전동기 모터 M)
 * - Load (일반/동력 부하)
 * - Ground (대지 접지 PE)
 * - UPS (무정전 전원장치)
 * - Rectifier (정류기 / 인버터)
 * - Battery (축전지 배터리 뱅크 DC)
 */
(function () {
  if (typeof joint === "undefined") return;
  joint.shapes.sld = joint.shapes.sld || {};

  // 1. Emergency Generator (비상 발전기)
  joint.shapes.sld.Generator = joint.dia.Element.define(
    "sld.Generator",
    {
      size: { width: 44, height: 44 },
      markup: [
        { tagName: "circle", selector: "circle" },
        { tagName: "path", selector: "lead" },
        { tagName: "text", selector: "text" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        circle: {
          cx: 22,
          cy: 22,
          r: 18,
          stroke: "#94a3b8",
          strokeWidth: 2,
          fill: "#f8fafc",
        },
        lead: { d: "M 22 0 L 22 4", stroke: "#94a3b8", strokeWidth: 2 },
        text: {
          text: "G",
          x: 22,
          y: 26,
          textAnchor: "middle",
          fontSize: 14,
          fontWeight: "bold",
          fill: "#94a3b8",
        },
        nameLabel: {
          text: "비상 발전기",
          refX: "50%",
          refY: 48,
          textAnchor: "middle",
          fontSize: 10,
          fontWeight: "600",
          fill: "#1e293b",
        },
        specLabel: {
          text: "500kVA",
          refX: "50%",
          refY: 60,
          textAnchor: "middle",
          fontSize: 9,
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
                stroke: "#94a3b8",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [{ id: "out", group: "ports", args: { x: 22, y: 0 } }],
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
        const baseState = (data.state || "DEAD").toUpperCase();
        const state = (effectiveState || baseState).toUpperCase();
        const isLive = state === "LIVE" || state === "CLOSED";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        let circleStroke, circleFill, textFill, leadStroke;
        const mainColor = data.color || "#E65100";

        if (isGrounded) {
          circleStroke = "#84CC16";
          circleFill = "#84CC16";
          textFill = "#ffffff";
          leadStroke = "#84CC16";
        } else if (isLive) {
          circleStroke = mainColor;
          circleFill = mainColor;
          textFill = "#ffffff";
          leadStroke = mainColor;
        } else {
          circleStroke = "#94a3b8";
          circleFill = "#f8fafc";
          textFill = "#94a3b8";
          leadStroke = "#94a3b8";
        }

        this.attr({
          circle: {
            stroke: circleStroke,
            fill: circleFill,
          },
          lead: { stroke: leadStroke },
          text: { fill: textFill },
          nameLabel: { text: data.name || "비상 발전기" },
          specLabel: { text: data.capacity || "" },
        });

        const ports = this.getPorts() || [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", circleStroke);
        });
      },
    },
  );

  // 2. Motor (전동기 모터)
  joint.shapes.sld.Motor = joint.dia.Element.define("sld.Motor", {
    size: { width: 42, height: 42 },
    markup: [
      { tagName: "circle", selector: "circle" },
      { tagName: "path", selector: "lead" },
      { tagName: "text", selector: "text" },
      { tagName: "text", selector: "nameLabel" },
    ],
    attrs: {
      circle: {
        cx: 21,
        cy: 21,
        r: 17,
        stroke: "#377DFF",
        strokeWidth: 2,
        fill: "#ffffff",
      },
      lead: { d: "M 21 0 L 21 4", stroke: "#377DFF", strokeWidth: 2 },
      text: {
        text: "M",
        x: 21,
        y: 25,
        textAnchor: "middle",
        fontSize: 14,
        fontWeight: "bold",
        fill: "#377DFF",
      },
      nameLabel: {
        text: "모터",
        refX: "50%",
        refY: 46,
        textAnchor: "middle",
        fontSize: 10,
        fontWeight: "600",
        fill: "#1e293b",
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
              stroke: "#377DFF",
              strokeWidth: 1.5,
            },
          },
        },
      },
      items: [{ id: "in", group: "ports", args: { x: 21, y: 0 } }],
    },
  });

  // 3. Load (일반 부하)
  joint.shapes.sld.Load = joint.dia.Element.define(
    "sld.Load",
    {
      size: { width: 34, height: 36 },
      markup: [
        { tagName: "path", selector: "lead" },
        { tagName: "rect", selector: "box" },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        lead: { d: "M 17 0 L 17 8", stroke: "#64748b", strokeWidth: 2 },
        box: {
          x: 2,
          y: 8,
          width: 30,
          height: 26,
          rx: 2,
          fill: "#ffffff",
          stroke: "#64748b",
          strokeWidth: 1.5,
        },
        nameLabel: {
          text: "부하",
          refX: "50%",
          refY: 40,
          textAnchor: "middle",
          fontSize: 9.5,
          fontWeight: "500",
          fill: "#475569",
        },
      },
      ports: {
        groups: {
          ports: {
            position: { name: "absolute" },
            attrs: {
              circle: {
                r: 3,
                magnet: true,
                fill: "#fff",
                stroke: "#64748b",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [{ id: "in", group: "ports", args: { x: 17, y: 0 } }],
      },
    },
    {
      initialize: function () {
        joint.dia.Element.prototype.initialize.apply(this, arguments);
        this.updateVisual();
        this.on("change:sldData", this.updateVisual, this);
      },
      updateVisual: function (effectiveState, voltageColor) {
        const data = this.get("sldData") || {};
        const state = (effectiveState || data.state || "LIVE").toUpperCase();
        const isLive = state === "LIVE" || state === "CLOSED";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";
        const strokeColor = isGrounded
          ? "#84CC16"
          : isLive
            ? voltageColor || data.color || "#64748b"
            : "#94a3b8";

        this.attr({
          lead: { stroke: strokeColor },
          box: { stroke: strokeColor },
          nameLabel: { text: data.name || "부하" },
        });

        const ports = this.getPorts ? this.getPorts() || [] : [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", strokeColor);
        });
      },
    },
  );

  // 4. Ground (대지 접지)
  joint.shapes.sld.Ground = joint.dia.Element.define("sld.Ground", {
    size: { width: 28, height: 28 },
    markup: [
      { tagName: "path", selector: "lead" },
      { tagName: "path", selector: "bar1" },
      { tagName: "path", selector: "bar2" },
      { tagName: "path", selector: "bar3" },
      { tagName: "text", selector: "label" },
    ],
    attrs: {
      lead: { d: "M 14 0 L 14 10", stroke: "#52c41a", strokeWidth: 2 },
      bar1: { d: "M 4 10 L 24 10", stroke: "#52c41a", strokeWidth: 2.5 },
      bar2: { d: "M 8 15 L 20 15", stroke: "#52c41a", strokeWidth: 2 },
      bar3: { d: "M 11 20 L 17 20", stroke: "#52c41a", strokeWidth: 1.5 },
      label: {
        text: "접지",
        refX: 28,
        refY: "50%",
        textAnchor: "start",
        fontSize: 9,
        fill: "#52c41a",
      },
    },
    ports: {
      groups: {
        ports: {
          position: { name: "absolute" },
          attrs: {
            circle: {
              r: 3,
              magnet: true,
              fill: "#fff",
              stroke: "#52c41a",
              strokeWidth: 1.5,
            },
          },
        },
      },
      items: [{ id: "in", group: "ports", args: { x: 14, y: 0 } }],
    },
  });

  // 5. UPS (무정전 전원장치)
  joint.shapes.sld.UPS = joint.dia.Element.define(
    "sld.UPS",
    {
      size: { width: 56, height: 48 },
      markup: [
        { tagName: "rect", selector: "box" },
        { tagName: "path", selector: "diag" },
        { tagName: "path", selector: "acSymbol" },
        { tagName: "path", selector: "dcSymbol" },
        { tagName: "text", selector: "label" },
      ],
      attrs: {
        box: {
          refWidth: "100%",
          refHeight: "100%",
          rx: 3,
          fill: "#FEE2E2",
          stroke: "#DC2626",
          strokeWidth: 2,
        },
        diag: { d: "M 0 48 L 56 0", stroke: "#DC2626", strokeWidth: 1.2 },
        acSymbol: {
          d: "M 10 20 Q 14 12 18 20 T 26 20",
          stroke: "#DC2626",
          strokeWidth: 1.5,
          fill: "none",
        },
        dcSymbol: {
          d: "M 36 32 L 46 32 M 36 36 L 46 36",
          stroke: "#DC2626",
          strokeWidth: 1.5,
        },
        label: {
          text: "UPS",
          refX: "50%",
          refY: 54,
          textAnchor: "middle",
          fontSize: 10,
          fontWeight: "bold",
          fill: "#DC2626",
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
                stroke: "#DC2626",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [
          { id: "ac_in", group: "ports", args: { x: 0, y: 24 } },
          { id: "dc_bat", group: "ports", args: { x: 28, y: 48 } },
          { id: "ac_out", group: "ports", args: { x: 56, y: 24 } },
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
        const baseState = (data.state || "LIVE").toUpperCase();
        const state = (effectiveState || baseState).toUpperCase();
        const isLive = state === "LIVE" || state === "CLOSED" || state === "ON";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        let fillColor, strokeColor, labelColor;

        if (isGrounded) {
          fillColor = "#F7FEE7";
          strokeColor = "#84CC16";
          labelColor = "#4D7C0F";
        } else if (isLive) {
          // 투입 시: 빨간 계열 (Red tone)
          fillColor = "#FEE2E2";
          strokeColor = "#DC2626";
          labelColor = "#B91C1C";
        } else {
          // 개방 시: 회색 계열 (Grey tone)
          fillColor = "#F1F5F9";
          strokeColor = "#94A3B8";
          labelColor = "#64748B";
        }

        const size = this.size() || { width: 56, height: 48 };
        const w = size.width;
        const h = size.height;

        this.attr({
          box: {
            fill: fillColor,
            stroke: strokeColor,
          },
          diag: {
            d: `M 0 ${h} L ${w} 0`,
            stroke: strokeColor,
          },
          acSymbol: {
            stroke: strokeColor,
          },
          dcSymbol: {
            stroke: strokeColor,
          },
          label: {
            text: data.name || "UPS",
            fill: labelColor,
          },
        });

        const ports = this.getPorts() || [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", strokeColor);
        });
      },
    },
  );

  // 6. Rectifier (정류기 / 인버터)
  joint.shapes.sld.Rectifier = joint.dia.Element.define("sld.Rectifier", {
    size: { width: 50, height: 40 },
    markup: [
      { tagName: "rect", selector: "box" },
      { tagName: "path", selector: "diag" },
      { tagName: "path", selector: "acSymbol" },
      { tagName: "path", selector: "dcLine" },
      { tagName: "text", selector: "label" },
    ],
    attrs: {
      box: {
        refWidth: "100%",
        refHeight: "100%",
        rx: 3,
        fill: "#ffffff",
        stroke: "#2E7D32",
        strokeWidth: 2,
      },
      diag: { d: "M 0 40 L 50 0", stroke: "#2E7D32", strokeWidth: 1 },
      acSymbol: {
        d: "M 8 16 Q 12 10 16 16 T 24 16",
        stroke: "#2E7D32",
        strokeWidth: 1.5,
        fill: "none",
      },
      dcLine: { d: "M 32 30 L 44 30", stroke: "#2E7D32", strokeWidth: 2 },
      label: {
        text: "정류기",
        refX: 56,
        refY: "50%",
        textAnchor: "start",
        textVerticalAnchor: "middle",
        fontSize: 10,
        fontWeight: "bold",
        fill: "#2E7D32",
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
        { id: "ac_in", group: "ports", args: { x: 25, y: 0 } },
        { id: "dc_out", group: "ports", args: { x: 25, y: 40 } },
      ],
    },
  });

  // 7. Battery Bank (축전지)
  joint.shapes.sld.Battery = joint.dia.Element.define("sld.Battery", {
    size: { width: 52, height: 34 },
    markup: [
      { tagName: "rect", selector: "box" },
      { tagName: "path", selector: "plus" },
      { tagName: "path", selector: "minus" },
      { tagName: "text", selector: "nameLabel" },
      { tagName: "text", selector: "specLabel" },
    ],
    attrs: {
      box: {
        refWidth: "100%",
        refHeight: "100%",
        rx: 3,
        fill: "#ffffff",
        stroke: "#00838F",
        strokeWidth: 2,
      },
      plus: {
        d: "M 11 17 H 19 M 15 13 V 21",
        stroke: "#00838F",
        strokeWidth: 1.8,
        strokeLinecap: "round",
      },
      minus: {
        d: "M 33 17 H 41",
        stroke: "#00838F",
        strokeWidth: 1.8,
        strokeLinecap: "round",
      },
      nameLabel: {
        text: "배터리 뱅크",
        refX: "50%",
        refY: 40,
        textAnchor: "middle",
        fontSize: 10,
        fontWeight: "600",
        fill: "#1e293b",
      },
      specLabel: {
        text: "384V DC",
        refX: "50%",
        refY: 52,
        textAnchor: "middle",
        fontSize: 9,
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
              stroke: "#00838F",
              strokeWidth: 1.5,
            },
          },
        },
      },
      items: [{ id: "out", group: "ports", args: { x: 26, y: 0 } }],
    },
  });
})();
