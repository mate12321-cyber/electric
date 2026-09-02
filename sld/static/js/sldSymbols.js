/**
 * JointJS Custom Shapes Definition for Power System SLD
 * Defines all joint.shapes.sld.* custom elements with accurate vector graphics,
 * explicit markup arrays, dynamic port distribution, open/close switch animations,
 * and voltage-coded styles.
 */

(function () {
  if (typeof joint === "undefined") return;

  joint.shapes.sld = {};

  // 1. Busbar (모선)
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
                magnet: true,
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
        this.distributePorts();
        this.on("change:size", this.distributePorts, this);
        this.on("change:sldData", this.updateFromSldData, this);
        this.updateFromSldData();
      },
      distributePorts: function () {
        const existing = this.prop("ports/items");
        if (existing && existing.length > 0) {
          return;
        }
        const width = this.get("size").width || 500;
        const height = this.get("size").height || 12;
        const count = 10;
        const items = [];
        for (let i = 1; i <= count; i++) {
          const x = (width / (count + 1)) * i;
          items.push({
            id: "p" + i,
            group: "bus-ports",
            args: { x: Math.round(x), y: height / 2 },
          });
        }
        this.prop("ports/items", items);
      },
      updateFromSldData: function () {
        const data = this.get("sldData") || {};
        const color = data.color || "#9C27B0";
        const name = data.name || "모선";
        this.attr({
          body: { fill: color, stroke: color },
          label: { text: name, fill: color },
        });
      },
    },
  );

  // 2. Breaker (VCB, ACB, MCCB, GCB)
  joint.shapes.sld.Breaker = joint.dia.Element.define(
    "sld.Breaker",
    {
      size: { width: 28, height: 40 },
      markup: [
        { tagName: "rect", selector: "box" },
        { tagName: "path", selector: "contactPath" },
        { tagName: "text", selector: "typeLabel" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
        { tagName: "rect", selector: "stateBadge" },
      ],
      attrs: {
        box: {
          refWidth: "100%",
          refHeight: "100%",
          rx: 3,
          ry: 3,
          fill: "#ffffff",
          stroke: "#377DFF",
          strokeWidth: 2,
          cursor: "pointer",
        },
        contactPath: {
          d: "M 14 5 L 14 35",
          stroke: "#377DFF",
          strokeWidth: 2.2,
          strokeLinecap: "round",
        },
        typeLabel: {
          text: "ACB",
          refX: "50%",
          refY: "50%",
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          fontSize: 8,
          fontWeight: "bold",
          fill: "#377DFF",
          pointerEvents: "none",
        },
        nameLabel: {
          text: "ACB",
          refX: 34,
          refY: "25%",
          textAnchor: "start",
          fontSize: 9.5,
          fontWeight: "600",
          fill: "#1e293b",
        },
        specLabel: {
          text: "3200A",
          refX: 34,
          refY: "65%",
          textAnchor: "start",
          fontSize: 8.5,
          fill: "#64748b",
        },
        stateBadge: {
          refX: -5,
          refY: -5,
          width: 12,
          height: 12,
          rx: 6,
          ry: 6,
          fill: "#52c41a",
          stroke: "#ffffff",
          strokeWidth: 1.5,
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
        const state = data.state || "CLOSED";
        const color = data.color || "#377DFF";
        const isClosed = state === "CLOSED";
        const sz = this.get("size") || { width: 28, height: 40 };
        const cx = Math.round(sz.width / 2);
        const topY = 5;
        const botY = sz.height - 5;

        this.attr({
          box: { stroke: color },
          typeLabel: {
            text:
              data.name || (data.type ? data.type.replace("CB_", "") : "CB"),
            fill: color,
          },
          nameLabel: { text: data.name || "CB" },
          specLabel: { text: data.current ? data.current + "A" : "" },
          contactPath: {
            d: isClosed
              ? `M ${cx} ${topY} L ${cx} ${botY}`
              : `M ${cx} ${topY} L ${cx + 8} ${botY - 4}`,
            stroke: isClosed ? color : "#ff4d4f",
          },
          stateBadge: {
            fill: isClosed ? "#52c41a" : "#ff4d4f",
          },
        });
      },
    },
  );

  // 3. Disconnector (DS - 단로기)
  joint.shapes.sld.Disconnector = joint.dia.Element.define(
    "sld.Disconnector",
    {
      size: { width: 30, height: 40 },
      markup: [
        { tagName: "path", selector: "inLine" },
        { tagName: "path", selector: "outLine" },
        { tagName: "circle", selector: "topNode" },
        { tagName: "circle", selector: "botNode" },
        { tagName: "path", selector: "blade" },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        inLine: { d: "M 15 0 L 15 12", stroke: "#7A3E9D", strokeWidth: 2 },
        outLine: { d: "M 15 28 L 15 40", stroke: "#7A3E9D", strokeWidth: 2 },
        topNode: { cx: 15, cy: 12, r: 2.5, fill: "#7A3E9D" },
        botNode: { cx: 15, cy: 28, r: 2.5, fill: "#7A3E9D" },
        blade: {
          d: "M 15 12 L 15 28",
          stroke: "#7A3E9D",
          strokeWidth: 2.5,
          strokeLinecap: "round",
          cursor: "pointer",
        },
        nameLabel: {
          text: "154kV DS",
          refX: 34,
          refY: "50%",
          textAnchor: "start",
          textVerticalAnchor: "middle",
          fontSize: 11,
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
                stroke: "#7A3E9D",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [
          { id: "in", group: "ports", args: { x: 15, y: 0 } },
          { id: "out", group: "ports", args: { x: 15, y: 40 } },
        ],
      },
    },
    {
      initialize: function () {
        joint.dia.Element.prototype.initialize.apply(this, arguments);
        this.updateContactVisual();
        this.on("change:sldData", this.updateContactVisual, this);
      },
      updateContactVisual: function () {
        const data = this.get("sldData") || {};
        const state = data.state || "CLOSED";
        const color = data.color || "#7A3E9D";
        const isClosed = state === "CLOSED";

        this.attr({
          inLine: { stroke: color },
          outLine: { stroke: color },
          topNode: { fill: color },
          botNode: { fill: color },
          blade: {
            d: isClosed ? "M 15 12 L 15 28" : "M 15 12 L 26 24",
            stroke: isClosed ? color : "#ff4d4f",
          },
          nameLabel: { text: data.name || "DS" },
        });
      },
    },
  );

  // 4. Transformer 2W (2권선 & 3권선 동적 결선 변압기)
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
      updateVisual: function () {
        const data = this.get("sldData") || {};
        const color = data.color || "#2E7D32";

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
              stroke: color,
              fill: "#ffffff",
              display: "block",
            },
            botCircle: {
              cx: 22,
              cy: 42,
              r: 16,
              stroke: color,
              fill: "#ffffff",
              display: "block",
            },
            tertCircle: {
              cx: 38,
              cy: 32,
              r: 16,
              stroke: color,
              fill: "#ffffff",
              display: "block",
            },
            topLead: {
              d: "M 22 0 L 22 6",
              stroke: color,
              strokeWidth: 2,
              display: "block",
            },
            botLead: {
              d: "M 22 58 L 22 64",
              stroke: color,
              strokeWidth: 2,
              display: "block",
            },
            tertLead: {
              d: "M 54 32 L 60 32",
              stroke: color,
              strokeWidth: 2,
              display: "block",
            },
            topVectorLabel: {
              text: v1,
              x: 22,
              y: 22,
              fill: color,
              fontSize: 12,
              display: "block",
            },
            botVectorLabel: {
              text: v2,
              x: 22,
              y: 42,
              fill: color,
              fontSize: 12,
              display: "block",
            },
            tertVectorLabel: {
              text: v3,
              x: 38,
              y: 32,
              fill: color,
              fontSize: 12,
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
          // 2-Winding mode
          let priVector = data.priVector || parts[0] || "";
          let secVector = data.secVector || parts[1] || "";
          if (!priVector && !secVector) {
            priVector =
              data.priVoltage === 154 || data.voltage === 154 ? "Y" : "Δ";
            secVector =
              data.priVoltage === 154 || data.voltage === 154 ? "Δ" : "Y";
          }

          this.attr({
            topCircle: {
              cx: 22,
              cy: 22,
              r: 16,
              stroke: color,
              fill: "#ffffff",
              display: "block",
            },
            botCircle: {
              cx: 22,
              cy: 42,
              r: 16,
              stroke: color,
              fill: "#ffffff",
              display: "block",
            },
            tertCircle: { display: "none" },
            topLead: {
              d: "M 22 0 L 22 6",
              stroke: color,
              strokeWidth: 2,
              display: "block",
            },
            botLead: {
              d: "M 22 58 L 22 64",
              stroke: color,
              strokeWidth: 2,
              display: "block",
            },
            tertLead: { display: "none" },
            topVectorLabel: {
              text: priVector,
              x: 22,
              y: 22,
              fill: color,
              fontSize: 12,
              display: "block",
            },
            botVectorLabel: {
              text: secVector,
              x: 22,
              y: 42,
              fill: color,
              fontSize: 12,
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

  // 5. Transformer 3W (3권선 변압기 - 2W 클래스와 동일한 동적 구조 사용)
  joint.shapes.sld.Transformer3W = joint.shapes.sld.Transformer2W;

  // 6. Transmission Tower (송전철탑)
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

  // 7. Surge Arrester (LA - 피뢰기)
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

  // 8. Power Fuse (PF - 퓨즈)
  joint.shapes.sld.Fuse = joint.dia.Element.define("sld.Fuse", {
    size: { width: 32, height: 44 },
    markup: [
      { tagName: "path", selector: "topLead" },
      { tagName: "path", selector: "botLead" },
      { tagName: "rect", selector: "box" },
      { tagName: "path", selector: "line" },
      { tagName: "text", selector: "nameLabel" },
    ],
    attrs: {
      topLead: { d: "M 16 0 L 16 8", stroke: "#E65100", strokeWidth: 2 },
      botLead: { d: "M 16 36 L 16 44", stroke: "#E65100", strokeWidth: 2 },
      box: {
        x: 6,
        y: 8,
        width: 20,
        height: 28,
        rx: 2,
        fill: "#ffffff",
        stroke: "#E65100",
        strokeWidth: 2,
      },
      line: { d: "M 16 8 L 16 36", stroke: "#E65100", strokeWidth: 2 },
      nameLabel: {
        text: "PF",
        refX: 34,
        refY: "50%",
        textAnchor: "start",
        fontSize: 11,
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
              stroke: "#E65100",
              strokeWidth: 1.5,
            },
          },
        },
      },
      items: [
        { id: "in", group: "ports", args: { x: 16, y: 0 } },
        { id: "out", group: "ports", args: { x: 16, y: 44 } },
      ],
    },
  });

  // 9. Relay (보호계전기 OCR)
  joint.shapes.sld.Relay = joint.dia.Element.define("sld.Relay", {
    size: { width: 38, height: 38 },
    markup: [
      { tagName: "rect", selector: "box" },
      { tagName: "text", selector: "text" },
      { tagName: "text", selector: "nameLabel" },
    ],
    attrs: {
      box: {
        refWidth: "100%",
        refHeight: "100%",
        rx: 4,
        fill: "#ffffff",
        stroke: "#2E7D32",
        strokeWidth: 2,
      },
      text: {
        text: "51",
        x: 19,
        y: 24,
        textAnchor: "middle",
        fontSize: 12,
        fontWeight: "bold",
        fill: "#2E7D32",
      },
      nameLabel: {
        text: "OCR",
        refX: 44,
        refY: "50%",
        textAnchor: "start",
        fontSize: 11,
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
              stroke: "#2E7D32",
              strokeWidth: 1.5,
            },
          },
        },
      },
      items: [
        { id: "in", group: "ports", args: { x: 19, y: 0 } },
        { id: "signal", group: "ports", args: { x: 19, y: 38 } },
      ],
    },
  });

  // 10. CT (변류기)
  joint.shapes.sld.CT = joint.dia.Element.define("sld.CT", {
    size: { width: 34, height: 38 },
    markup: [
      { tagName: "path", selector: "line" },
      { tagName: "circle", selector: "circle" },
      { tagName: "text", selector: "nameLabel" },
    ],
    attrs: {
      line: { d: "M 17 0 L 17 38", stroke: "#00838F", strokeWidth: 2 },
      circle: {
        cx: 17,
        cy: 19,
        r: 11,
        fill: "none",
        stroke: "#00838F",
        strokeWidth: 2,
      },
      nameLabel: {
        text: "CT",
        refX: 38,
        refY: "50%",
        textAnchor: "start",
        fontSize: 11,
        fontWeight: "600",
        fill: "#00838F",
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
      items: [
        { id: "in", group: "ports", args: { x: 17, y: 0 } },
        { id: "out", group: "ports", args: { x: 17, y: 38 } },
        { id: "sec", group: "ports", args: { x: 28, y: 19 } },
      ],
    },
  });

  // 11. PT (계기용변압기)
  joint.shapes.sld.PT = joint.dia.Element.define("sld.PT", {
    size: { width: 34, height: 44 },
    markup: [
      { tagName: "circle", selector: "c1" },
      { tagName: "circle", selector: "c2" },
      { tagName: "path", selector: "lead" },
      { tagName: "text", selector: "nameLabel" },
    ],
    attrs: {
      c1: {
        cx: 17,
        cy: 14,
        r: 10,
        fill: "none",
        stroke: "#00838F",
        strokeWidth: 2,
      },
      c2: {
        cx: 17,
        cy: 30,
        r: 10,
        fill: "none",
        stroke: "#00838F",
        strokeWidth: 2,
      },
      lead: { d: "M 17 0 L 17 4", stroke: "#00838F", strokeWidth: 2 },
      nameLabel: {
        text: "PT",
        refX: 38,
        refY: "50%",
        textAnchor: "start",
        fontSize: 11,
        fontWeight: "600",
        fill: "#00838F",
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
      items: [
        { id: "pri", group: "ports", args: { x: 17, y: 0 } },
        { id: "sec", group: "ports", args: { x: 17, y: 44 } },
      ],
    },
  });

  // 12. Ground Switch (접지 단로기)
  joint.shapes.sld.GroundSwitch = joint.dia.Element.define(
    "sld.GroundSwitch",
    {
      size: { width: 32, height: 44 },
      markup: [
        { tagName: "path", selector: "lead" },
        { tagName: "circle", selector: "topNode" },
        { tagName: "path", selector: "blade" },
        { tagName: "path", selector: "gndLine" },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        lead: { d: "M 16 0 L 16 10", stroke: "#52c41a", strokeWidth: 2 },
        topNode: { cx: 16, cy: 10, r: 2.5, fill: "#52c41a" },
        blade: {
          d: "M 16 10 L 26 22",
          stroke: "#ff4d4f",
          strokeWidth: 2.5,
          strokeLinecap: "round",
          cursor: "pointer",
        },
        gndLine: {
          d: "M 16 28 L 16 34 M 8 34 L 24 34 M 11 38 L 21 38 M 13 42 L 19 42",
          stroke: "#52c41a",
          strokeWidth: 2,
        },
        nameLabel: {
          text: "ES",
          refX: 34,
          refY: "50%",
          textAnchor: "start",
          fontSize: 11,
          fontWeight: "600",
          fill: "#52c41a",
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
                stroke: "#52c41a",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [{ id: "in", group: "ports", args: { x: 16, y: 0 } }],
      },
    },
    {
      initialize: function () {
        joint.dia.Element.prototype.initialize.apply(this, arguments);
        this.updateContactVisual();
        this.on("change:sldData", this.updateContactVisual, this);
      },
      updateContactVisual: function () {
        const data = this.get("sldData") || {};
        const isClosed = data.state === "CLOSED";
        this.attr({
          blade: {
            d: isClosed ? "M 16 10 L 16 28" : "M 16 10 L 26 22",
            stroke: isClosed ? "#52c41a" : "#ff4d4f",
          },
        });
      },
    },
  );

  // 13. Generator (발전기)
  joint.shapes.sld.Generator = joint.dia.Element.define("sld.Generator", {
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
        stroke: "#E65100",
        strokeWidth: 2,
        fill: "#ffffff",
      },
      lead: { d: "M 22 0 L 22 4", stroke: "#E65100", strokeWidth: 2 },
      text: {
        text: "G",
        x: 22,
        y: 26,
        textAnchor: "middle",
        fontSize: 14,
        fontWeight: "bold",
        fill: "#E65100",
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
              stroke: "#E65100",
              strokeWidth: 1.5,
            },
          },
        },
      },
      items: [{ id: "out", group: "ports", args: { x: 22, y: 0 } }],
    },
  });

  // 14. Motor (전동기)
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

  // 15. Load (부하)
  joint.shapes.sld.Load = joint.dia.Element.define("sld.Load", {
    size: { width: 34, height: 36 },
    markup: [
      { tagName: "path", selector: "lead" },
      { tagName: "rect", selector: "box" },
      { tagName: "text", selector: "text" },
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
      text: {
        text: "부하",
        x: 17,
        y: 24,
        textAnchor: "middle",
        fontSize: 9,
        fontWeight: "bold",
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
  });

  // 16. Ground (대지 접지)
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

  // 17. UPS (무정전 전원장치)
  joint.shapes.sld.UPS = joint.dia.Element.define("sld.UPS", {
    size: { width: 56, height: 48 },
    markup: [
      { tagName: "rect", selector: "box" },
      { tagName: "path", selector: "diag" },
      { tagName: "path", selector: "acSymbol" },
      { tagName: "text", selector: "dcSymbol" },
      { tagName: "text", selector: "label" },
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
      diag: { d: "M 0 48 L 56 0", stroke: "#00838F", strokeWidth: 1 },
      acSymbol: {
        d: "M 10 20 Q 14 12 18 20 T 26 20",
        stroke: "#00838F",
        strokeWidth: 1.5,
        fill: "none",
      },
      dcSymbol: {
        text: "=",
        x: 42,
        y: 38,
        fontSize: 13,
        fontWeight: "bold",
        fill: "#00838F",
      },
      label: {
        text: "UPS",
        refX: "50%",
        refY: 54,
        textAnchor: "middle",
        fontSize: 10,
        fontWeight: "bold",
        fill: "#00838F",
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
      items: [
        { id: "ac_in", group: "ports", args: { x: 0, y: 24 } },
        { id: "dc_bat", group: "ports", args: { x: 28, y: 48 } },
        { id: "ac_out", group: "ports", args: { x: 56, y: 24 } },
      ],
    },
  });

  // 18. Rectifier (정류기)
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

  // 19. Battery (축전지)
  joint.shapes.sld.Battery = joint.dia.Element.define("sld.Battery", {
    size: { width: 52, height: 34 },
    markup: [
      { tagName: "rect", selector: "box" },
      { tagName: "text", selector: "plus" },
      { tagName: "text", selector: "minus" },
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
        text: "+",
        x: 14,
        y: 22,
        textAnchor: "middle",
        fontSize: 14,
        fontWeight: "bold",
        fill: "#00838F",
      },
      minus: {
        text: "-",
        x: 38,
        y: 22,
        textAnchor: "middle",
        fontSize: 16,
        fontWeight: "bold",
        fill: "#00838F",
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

  // 20. Switchgear (배전반)
  joint.shapes.sld.Switchgear = joint.dia.Element.define("sld.Switchgear", {
    size: { width: 44, height: 60 },
    markup: [
      { tagName: "rect", selector: "box" },
      { tagName: "path", selector: "divider1" },
      { tagName: "path", selector: "dots" },
      { tagName: "text", selector: "label" },
    ],
    attrs: {
      box: {
        refWidth: "100%",
        refHeight: "100%",
        rx: 2,
        fill: "#ffffff",
        stroke: "#377DFF",
        strokeWidth: 2,
      },
      divider1: {
        d: "M 6 18 L 38 18 M 6 30 L 38 30 M 6 42 L 38 42",
        stroke: "#94a3b8",
        strokeWidth: 1.2,
      },
      dots: {
        d: "M 10 10 h 2 M 10 24 h 2 M 10 36 h 2 M 10 48 h 2",
        stroke: "#377DFF",
        strokeWidth: 3,
        strokeLinecap: "round",
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
  });

  // 21. Panelboard (분전반)
  joint.shapes.sld.Panelboard = joint.dia.Element.define("sld.Panelboard", {
    size: { width: 40, height: 50 },
    markup: [
      { tagName: "rect", selector: "box" },
      { tagName: "rect", selector: "inner" },
      { tagName: "text", selector: "label" },
    ],
    attrs: {
      box: {
        refWidth: "100%",
        refHeight: "100%",
        rx: 2,
        fill: "#ffffff",
        stroke: "#2B6CB0",
        strokeWidth: 2,
      },
      inner: {
        x: 6,
        y: 6,
        width: 28,
        height: 38,
        fill: "#f8fafc",
        stroke: "#2B6CB0",
        strokeWidth: 1,
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
  });

  // 22. Junction Node (접속점)
  joint.shapes.sld.Junction = joint.dia.Element.define("sld.Junction", {
    size: { width: 12, height: 12 },
    markup: [{ tagName: "circle", selector: "circle" }],
    attrs: {
      circle: {
        cx: 6,
        cy: 6,
        r: 5,
        fill: "#377DFF",
        stroke: "#ffffff",
        strokeWidth: 1.5,
      },
    },
    ports: {
      groups: {
        ports: {
          position: { name: "absolute" },
          attrs: {
            circle: { r: 4, magnet: true, fill: "#377DFF", opacity: 0 },
          },
        },
      },
      items: [{ id: "p1", group: "ports", args: { x: 6, y: 6 } }],
    },
  });

  // 23. Text Label (텍스트 주석)
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

  // 24. Group Box (영역 점선 박스)
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

  // 25. Custom CAD SLD Orthogonal Router (Guarantees pure straight line on vertical/horizontal alignments)
  if (joint.routers) {
    joint.routers.sldOrthogonal = function (vertices, opt, linkView) {
      const src =
        (linkView && (linkView.sourceAnchor || linkView.sourcePoint)) ||
        (opt && opt.sourcePoint);
      const tgt =
        (linkView && (linkView.targetAnchor || linkView.targetPoint)) ||
        (opt && opt.targetPoint);

      if (!src || !tgt) return vertices || [];

      const sx = Math.round(src.x);
      const sy = Math.round(src.y);
      const tx = Math.round(tgt.x);
      const ty = Math.round(tgt.y);

      const dx = Math.abs(sx - tx);
      const dy = Math.abs(sy - ty);

      // If user has manually placed intermediate vertices, preserve them
      if (vertices && vertices.length > 0) {
        return vertices;
      }

      // 1. Vertical column alignment (tolerance 30px / 3 grid units) or short vertical segment (dy <= 80px with dx <= 45px):
      // Force 100% pure straight vertical line (0 bend points)!
      if (dx <= 30 || (dy <= 80 && dx <= 45)) {
        return [];
      }

      // 2. Horizontal row alignment (tolerance 30px / 3 grid units) or short horizontal segment (dx <= 80px with dy <= 45px):
      // Force 100% pure straight horizontal line (0 bend points)!
      if (dy <= 30 || (dx <= 80 && dy <= 45)) {
        return [];
      }

      // 3. Short angled gap (dy <= 60px or dx <= 60px): Single clean L-turn instead of double-turn zigzag
      if (dy <= 60) {
        return [{ x: sx, y: ty }];
      }
      if (dx <= 60) {
        return [{ x: tx, y: sy }];
      }

      // 4. Normal long distance orthogonal step: Snap midpoint Y to 10px grid
      const midY = Math.round((sy + ty) / 2 / 10) * 10;
      return [
        { x: sx, y: midY },
        { x: tx, y: midY },
      ];
    };
  }
})();
