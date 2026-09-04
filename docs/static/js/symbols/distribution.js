/**
 * symbols/distribution.js
 * 배전 설비 및 다이어그램 구조/주석 심볼 정의 (Hybrid SVG Stamp Engine):
 * - Busbar (모선)
 * - Switchgear (수배전반)
 * - Panelboard (분전반)
 * - Junction (접속 노드 / T-분기점)
 * - TextLabel (텍스트 라벨 주석)
 * - GroupBox (영역 점선 박스)
 */
(function () {
  if (typeof joint === "undefined") return;
  joint.shapes.sld = joint.shapes.sld || {};

  const fmtName = (str) =>
    typeof window !== "undefined" &&
    typeof window.formatSymbolLabel === "function"
      ? window.formatSymbolLabel(str, 5)
      : str;

  // 1. Busbar (모선: Dynamic Sizing & Reactive Coloring)
  joint.shapes.sld.Busbar = joint.dia.Element.define(
    "sld.Busbar",
    {
      size: { width: 500, height: 12 },
      markup: [
        { tagName: "rect", selector: "body" },
        { tagName: "text", selector: "label" },
      ],
      attrs: {
        body: {
          refWidth: "100%",
          refHeight: "100%",
          rx: 3,
          ry: 3,
          fill: "#9C27B0",
          stroke: "#7A1C8E",
          strokeWidth: 1.5,
          cursor: "move",
          magnet: "passive",
        },
        label: {
          text: "22.9kV 모선",
          refX: "50%",
          refY: -14,
          textAnchor: "middle",
          fontSize: 11,
          fontWeight: "bold",
          fill: "#9C27B0",
          fontFamily: "Pretendard, -apple-system, sans-serif",
        },
      },
      ports: {
        groups: {
          "bus-ports": {
            position: { name: "absolute" },
            attrs: {
              circle: {
                r: 3.5,
                magnet: false,
                fill: "#ffffff",
                stroke: "#9C27B0",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [],
      },
    },
    {
      initialize: function () {
        joint.dia.Element.prototype.initialize.apply(this, arguments);
        this.on("change:sldData", this.updateFromSldData, this);
        this.updateFromSldData();
      },
      updateFromSldData: function (effectiveState, effectiveColor) {
        const data = this.get("sldData") || {};
        const vUnit = data.voltageUnit || "kV";
        const getVColor =
          typeof window.getVoltageColor === "function"
            ? window.getVoltageColor
            : (v) => data.color || "#9C27B0";

        const baseState = (data.state || "LIVE").toUpperCase();
        const state = (effectiveState || baseState).toUpperCase();
        const isDead = state === "DEAD" || state === "OPEN";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        let color;
        if (isDead) {
          color = "#94a3b8";
        } else if (isGrounded) {
          color = "#84CC16";
        } else {
          color =
            effectiveColor ||
            getVColor(data.voltage, vUnit) ||
            data.color ||
            "#059669";
        }

        const name = data.name || "모선";
        this.attr({
          body: { fill: color, stroke: color },
          label: { text: name, fill: color },
        });

        const ports = this.getPorts() || [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", color);
        });
      },
    },
  );

  // 2. Switchgear (수배전반: Stamp + Dynamic Label)
  joint.shapes.sld.Switchgear = joint.dia.Element.define(
    "sld.Switchgear",
    {
      size: { width: 44, height: 60 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-switchgear",
            "xlink:href": "#sld-sym-switchgear",
          },
        },
        { tagName: "text", selector: "label" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-switchgear",
          xlinkHref: "#sld-sym-switchgear",
          color: "#377DFF",
        },
        label: {
          text: "배전반",
          refX: "50%",
          refY: -10,
          textAnchor: "middle",
          fontSize: 10,
          fontWeight: "bold",
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
        items: [
          { id: "in", group: "ports", args: { x: 22, y: 0 } },
          { id: "out1", group: "ports", args: { x: 12, y: 60 } },
          { id: "out2", group: "ports", args: { x: 32, y: 60 } },
        ],
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
        const strokeColor = data.color || "#377DFF";
        this.attr({
          stamp: { color: strokeColor },
          label: { text: fmtName(data.name || "배전반") },
        });
      },
    },
  );

  // 3. Panelboard (분전반: Stamp + Dynamic Label)
  joint.shapes.sld.Panelboard = joint.dia.Element.define(
    "sld.Panelboard",
    {
      size: { width: 40, height: 50 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-panelboard",
            "xlink:href": "#sld-sym-panelboard",
          },
        },
        { tagName: "text", selector: "label" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-panelboard",
          xlinkHref: "#sld-sym-panelboard",
          color: "#2B6CB0",
        },
        label: {
          text: "분전반",
          refX: "50%",
          refY: -10,
          textAnchor: "middle",
          fontSize: 10,
          fontWeight: "bold",
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
                stroke: "#2B6CB0",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [
          { id: "in", group: "ports", args: { x: 20, y: 0 } },
          { id: "out1", group: "ports", args: { x: 12, y: 50 } },
          { id: "out2", group: "ports", args: { x: 28, y: 50 } },
        ],
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
        const strokeColor = data.color || "#2B6CB0";
        this.attr({
          stamp: { color: strokeColor },
          label: { text: fmtName(data.name || "분전반") },
        });
      },
    },
  );

  // 4. Junction Node (접속 노드 / T-분기점)
  joint.shapes.sld.Junction = joint.dia.Element.define(
    "sld.Junction",
    {
      size: { width: 14, height: 14 },
      markup: [
        { tagName: "circle", selector: "halo" },
        { tagName: "circle", selector: "circle" },
      ],
      attrs: {
        halo: {
          cx: 7,
          cy: 7,
          r: 10,
          fill: "transparent",
          cursor: "move",
        },
        circle: {
          cx: 7,
          cy: 7,
          r: 4.5,
          fill: "#377DFF",
          stroke: "#ffffff",
          strokeWidth: 1.5,
          cursor: "move",
        },
      },
      ports: {
        groups: {
          ports: {
            position: { name: "absolute" },
            attrs: {
              circle: {
                r: 7,
                magnet: "passive",
                fill: "transparent",
                opacity: 0,
                cursor: "move",
              },
            },
          },
        },
        items: [{ id: "p1", group: "ports", args: { x: 7, y: 7 } }],
      },
    },
    {
      updateVisual: function (state, voltageColor) {
        const sldData = this.get("sldData") || {};
        const color =
          state === "LIVE"
            ? voltageColor || sldData.color || "#377DFF"
            : state === "GROUNDED"
              ? "#84CC16"
              : "#595959";
        this.attr("circle/fill", color);
      },
    },
  );

  // 5. Text Label (텍스트 주석)
  joint.shapes.sld.TextLabel = joint.dia.Element.define("sld.TextLabel", {
    size: { width: 140, height: 26 },
    markup: [{ tagName: "text", selector: "text" }],
    attrs: {
      text: {
        text: "텍스트 라벨",
        refX: 0,
        refY: "50%",
        textAnchor: "start",
        textVerticalAnchor: "middle",
        fontSize: 12,
        fontWeight: "bold",
        fill: "#1e293b",
        fontFamily: "Pretendard, -apple-system, sans-serif",
      },
    },
  });

  // 6. Group Box (영역 점선 박스)
  joint.shapes.sld.GroupBox = joint.dia.Element.define("sld.GroupBox", {
    size: { width: 440, height: 220 },
    markup: [
      { tagName: "rect", selector: "box" },
      { tagName: "text", selector: "title" },
    ],
    attrs: {
      box: {
        refWidth: "100%",
        refHeight: "100%",
        rx: 6,
        ry: 6,
        fill: "rgba(55, 125, 255, 0.02)",
        stroke: "#377DFF",
        strokeWidth: 1.5,
        strokeDasharray: "6,4",
        pointerEvents: "none",
      },
      title: {
        text: "중요 부하 (무정전 전원 계통)",
        x: 16,
        y: 20,
        fontSize: 12,
        fontWeight: "bold",
        fill: "#377DFF",
        fontFamily: "Pretendard, -apple-system, sans-serif",
      },
    },
  });
})();
