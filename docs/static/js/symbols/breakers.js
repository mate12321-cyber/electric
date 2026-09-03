/**
 * symbols/breakers.js
 * 차단기 및 보호/계측 설비 심볼 정의:
 * - Breaker (표준 차단기: VCB, GCB)
 * - ACB (기중차단기)
 * - MCCB (배선용차단기)
 * - TieBreakerHV / TieBreakerLV (특고압/저압 모선 연계 차단기)
 * - Fuse (파워 퓨즈)
 * - Relay (보호계전기 OCR/UVR)
 * - CT (변류기) / PT (계기용변압기)
 * - GroundSwitch (접지단로기 ES)
 */
(function () {
  if (typeof joint === "undefined") return;
  joint.shapes.sld = joint.shapes.sld || {};

  // 1. Circuit Breaker (표준 차단기 - VCB, GCB)
  joint.shapes.sld.Breaker = joint.dia.Element.define(
    "sld.Breaker",
    {
      size: { width: 28, height: 40 },
      markup: [
        { tagName: "rect", selector: "box" },
        { tagName: "text", selector: "groundSymbol" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        box: {
          width: 28,
          height: 40,
          rx: 3,
          ry: 3,
          fill: "#000000",
          stroke: "#377DFF",
          strokeWidth: 2,
        },
        groundSymbol: {
          text: "⏚",
          x: 14,
          y: 20,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          fontSize: 14,
          fontWeight: "bold",
          fill: "#ffffff",
          display: "none",
          pointerEvents: "none",
        },
        nameLabel: {
          text: "CB",
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
        const state = (data.state || "LIVE").toUpperCase();
        const color = data.color || "#377DFF";
        const sz = this.get("size") || { width: 28, height: 40 };

        const isLive = state === "LIVE" || state === "CLOSED";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        let boxFill = "#000000";
        let boxStroke = color;
        let showGround = "none";

        if (isGrounded) {
          boxFill = "#84CC16";
          boxStroke = "#84CC16";
          showGround = "block";
        } else if (!isLive) {
          boxFill = "#94a3b8";
          boxStroke = "#94a3b8";
        }

        this.attr({
          box: {
            fill: boxFill,
            stroke: boxStroke,
            width: sz.width,
            height: sz.height,
          },
          groundSymbol: { display: showGround, fill: "#ffffff" },
          nameLabel: { text: data.name || "CB" },
          specLabel: { text: data.current ? data.current + "A" : "" },
        });
      },
    },
  );

  // 2. Air Circuit Breaker (ACB - 기중차단기)
  joint.shapes.sld.ACB = joint.dia.Element.define(
    "sld.ACB",
    {
      size: { width: 28, height: 40 },
      markup: [
        { tagName: "path", selector: "crescent" },
        { tagName: "circle", selector: "topNode" },
        { tagName: "circle", selector: "botNode" },
        { tagName: "text", selector: "groundSymbol" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        crescent: {
          d: "M 17 6 C 22 12, 22 28, 17 34 C 33 30, 33 10, 17 6 Z",
          stroke: "#377DFF",
          strokeWidth: 1.5,
          strokeLinejoin: "round",
          fill: "#000000",
        },
        topNode: {
          cx: 14,
          cy: 6,
          r: 3.5,
          fill: "#000000",
          stroke: "#377DFF",
          strokeWidth: 1.5,
        },
        botNode: {
          cx: 14,
          cy: 34,
          r: 3.5,
          fill: "#000000",
          stroke: "#377DFF",
          strokeWidth: 1.5,
        },
        groundSymbol: {
          text: "⏚",
          x: 23,
          y: 20,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          fontSize: 12,
          fontWeight: "bold",
          fill: "#ffffff",
          display: "none",
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
          text: "4000A",
          refX: 34,
          refY: "65%",
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
        const state = (data.state || "LIVE").toUpperCase();
        const color = data.color || "#377DFF";

        const isLive = state === "LIVE" || state === "CLOSED";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        let fillColor = "#000000";
        let strokeColor = color;
        let showGround = "none";

        if (isGrounded) {
          fillColor = "#84CC16";
          strokeColor = "#84CC16";
          showGround = "block";
        } else if (!isLive) {
          fillColor = "#94a3b8";
          strokeColor = "#94a3b8";
        }

        this.attr({
          crescent: { fill: fillColor, stroke: strokeColor },
          topNode: { stroke: strokeColor, fill: fillColor },
          botNode: { stroke: strokeColor, fill: fillColor },
          groundSymbol: { display: showGround, fill: "#ffffff" },
          nameLabel: { text: data.name || "ACB" },
          specLabel: { text: data.current ? data.current + "A" : "" },
        });
      },
    },
  );

  // 3. Molded Case Circuit Breaker (MCCB - 배선용차단기)
  joint.shapes.sld.MCCB = joint.dia.Element.define(
    "sld.MCCB",
    {
      size: { width: 28, height: 40 },
      markup: [
        { tagName: "path", selector: "crescent" },
        { tagName: "path", selector: "topLead" },
        { tagName: "path", selector: "botLead" },
        { tagName: "text", selector: "groundSymbol" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        topLead: {
          d: "M 14 0 L 14 6",
          stroke: "#377DFF",
          strokeWidth: 2,
          strokeLinecap: "round",
        },
        botLead: {
          d: "M 14 34 L 14 40",
          stroke: "#377DFF",
          strokeWidth: 2,
          strokeLinecap: "round",
        },
        crescent: {
          d: "M 14 6 C 21 12, 21 28, 14 34 C 31 30, 31 10, 14 6 Z",
          stroke: "#377DFF",
          strokeWidth: 1.5,
          strokeLinejoin: "round",
          fill: "#000000",
        },
        groundSymbol: {
          text: "⏚",
          x: 22,
          y: 20,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          fontSize: 12,
          fontWeight: "bold",
          fill: "#ffffff",
          display: "none",
          pointerEvents: "none",
        },
        nameLabel: {
          text: "MCCB",
          refX: 34,
          refY: "25%",
          textAnchor: "start",
          fontSize: 9.5,
          fontWeight: "600",
          fill: "#1e293b",
        },
        specLabel: {
          text: "225A",
          refX: 34,
          refY: "65%",
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
        const state = (data.state || "LIVE").toUpperCase();
        const color = data.color || "#377DFF";

        const isLive = state === "LIVE" || state === "CLOSED";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        let fillColor = "#000000";
        let strokeColor = color;
        let showGround = "none";

        if (isGrounded) {
          fillColor = "#84CC16";
          strokeColor = "#84CC16";
          showGround = "block";
        } else if (!isLive) {
          fillColor = "#94a3b8";
          strokeColor = "#94a3b8";
        }

        this.attr({
          topLead: { stroke: strokeColor },
          botLead: { stroke: strokeColor },
          crescent: { fill: fillColor, stroke: strokeColor },
          groundSymbol: { display: showGround, fill: "#ffffff" },
          nameLabel: { text: data.name || "MCCB" },
          specLabel: { text: data.current ? data.current + "A" : "" },
        });
      },
    },
  );

  // 4. Tie Breaker HV (특고압 가로형 모선 타이 차단기)
  joint.shapes.sld.TieBreakerHV = joint.dia.Element.define(
    "sld.TieBreakerHV",
    {
      size: { width: 40, height: 28 },
      markup: [
        { tagName: "rect", selector: "box" },
        { tagName: "text", selector: "groundSymbol" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        box: {
          width: 40,
          height: 28,
          rx: 3,
          ry: 3,
          fill: "#000000",
          stroke: "#377DFF",
          strokeWidth: 2,
        },
        groundSymbol: {
          text: "⏚",
          x: 20,
          y: 14,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          fontSize: 14,
          fontWeight: "bold",
          fill: "#ffffff",
          display: "none",
          pointerEvents: "none",
        },
        nameLabel: {
          text: "TIE CB",
          refX: "50%",
          refY: -10,
          textAnchor: "middle",
          fontSize: 9.5,
          fontWeight: "bold",
          fill: "#1e293b",
        },
        specLabel: {
          text: "2000A",
          refX: "50%",
          refY: 34,
          textAnchor: "middle",
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
                stroke: "#377DFF",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [
          { id: "in", group: "ports", args: { x: 0, y: 14 } },
          { id: "out", group: "ports", args: { x: 40, y: 14 } },
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
        const color = data.color || "#377DFF";
        const sz = this.get("size") || { width: 40, height: 28 };

        const isLive = state === "LIVE" || state === "CLOSED";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        let boxFill = "#000000";
        let boxStroke = color;
        let showGround = "none";

        if (isGrounded) {
          boxFill = "#84CC16";
          boxStroke = "#84CC16";
          showGround = "block";
        } else if (!isLive) {
          boxFill = "#94a3b8";
          boxStroke = "#94a3b8";
        }

        this.attr({
          box: {
            fill: boxFill,
            stroke: boxStroke,
            width: sz.width,
            height: sz.height,
          },
          groundSymbol: { display: showGround, fill: "#ffffff" },
          nameLabel: { text: data.name || "TIE CB" },
          specLabel: { text: data.current ? data.current + "A" : "" },
        });
      },
    },
  );

  // 5. Tie Breaker LV (저압 가로형 모선 타이 ACB)
  joint.shapes.sld.TieBreakerLV = joint.dia.Element.define(
    "sld.TieBreakerLV",
    {
      size: { width: 40, height: 28 },
      markup: [
        { tagName: "path", selector: "crescent" },
        { tagName: "circle", selector: "leftNode" },
        { tagName: "circle", selector: "rightNode" },
        { tagName: "text", selector: "groundSymbol" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        crescent: {
          d: "M 6 11 C 12 16, 28 16, 34 11 C 30 27, 10 27, 6 11 Z",
          stroke: "#377DFF",
          strokeWidth: 1.5,
          strokeLinejoin: "round",
          fill: "#000000",
        },
        leftNode: {
          cx: 6,
          cy: 14,
          r: 3.5,
          fill: "#000000",
          stroke: "#377DFF",
          strokeWidth: 1.5,
        },
        rightNode: {
          cx: 34,
          cy: 14,
          r: 3.5,
          fill: "#000000",
          stroke: "#377DFF",
          strokeWidth: 1.5,
        },
        groundSymbol: {
          text: "⏚",
          x: 20,
          y: 20,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          fontSize: 12,
          fontWeight: "bold",
          fill: "#ffffff",
          display: "none",
          pointerEvents: "none",
        },
        nameLabel: {
          text: "LV TIE",
          refX: "50%",
          refY: -10,
          textAnchor: "middle",
          fontSize: 9.5,
          fontWeight: "bold",
          fill: "#1e293b",
        },
        specLabel: {
          text: "3200A",
          refX: "50%",
          refY: 34,
          textAnchor: "middle",
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
                stroke: "#377DFF",
                strokeWidth: 1.5,
              },
            },
          },
        },
        items: [
          { id: "in", group: "ports", args: { x: 0, y: 14 } },
          { id: "out", group: "ports", args: { x: 40, y: 14 } },
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
        const color = data.color || "#377DFF";

        const isLive = state === "LIVE" || state === "CLOSED";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        let fillColor = "#000000";
        let strokeColor = color;
        let showGround = "none";

        if (isGrounded) {
          fillColor = "#84CC16";
          strokeColor = "#84CC16";
          showGround = "block";
        } else if (!isLive) {
          fillColor = "#94a3b8";
          strokeColor = "#94a3b8";
        }

        this.attr({
          crescent: { fill: fillColor, stroke: strokeColor },
          leftNode: { stroke: strokeColor, fill: fillColor },
          rightNode: { stroke: strokeColor, fill: fillColor },
          groundSymbol: { display: showGround, fill: "#ffffff" },
          nameLabel: { text: data.name || "LV TIE" },
          specLabel: { text: data.current ? data.current + "A" : "" },
        });
      },
    },
  );

  // 6. Power Fuse (PF - 퓨즈)
  joint.shapes.sld.Fuse = joint.dia.Element.define("sld.Fuse", {
    size: { width: 32, height: 44 },
    markup: [
      { tagName: "rect", selector: "body" },
      { tagName: "path", selector: "line" },
      { tagName: "text", selector: "nameLabel" },
    ],
    attrs: {
      body: {
        width: 14,
        height: 32,
        x: 9,
        y: 6,
        rx: 1,
        ry: 1,
        stroke: "#377DFF",
        strokeWidth: 2,
        fill: "#ffffff",
      },
      line: {
        d: "M 16 0 L 16 44",
        stroke: "#377DFF",
        strokeWidth: 2,
      },
      nameLabel: {
        text: "PF",
        refX: 34,
        refY: "50%",
        textAnchor: "start",
        fontSize: 11,
        fontWeight: "600",
        fill: "#377DFF",
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
        { id: "in", group: "ports", args: { x: 16, y: 0 } },
        { id: "out", group: "ports", args: { x: 16, y: 44 } },
      ],
    },
  });

  // 7. Protective Relay (OCR/UVR - 보호계전기)
  joint.shapes.sld.Relay = joint.dia.Element.define("sld.Relay", {
    size: { width: 38, height: 38 },
    markup: [
      { tagName: "circle", selector: "body" },
      { tagName: "text", selector: "label" },
      { tagName: "text", selector: "nameLabel" },
    ],
    attrs: {
      body: {
        cx: 19,
        cy: 19,
        r: 17,
        stroke: "#E53935",
        strokeWidth: 2,
        fill: "#ffffff",
      },
      label: {
        text: "51",
        x: 19,
        y: 19,
        textAnchor: "middle",
        textVerticalAnchor: "middle",
        fontSize: 12,
        fontWeight: "bold",
        fill: "#E53935",
        fontFamily: "Pretendard, -apple-system, sans-serif",
      },
      nameLabel: {
        text: "OCR",
        refX: 42,
        refY: "50%",
        textAnchor: "start",
        fontSize: 11,
        fontWeight: "600",
        fill: "#E53935",
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
              stroke: "#E53935",
              strokeWidth: 1.5,
            },
          },
        },
      },
      items: [
        { id: "in", group: "ports", args: { x: 19, y: 0 } },
        { id: "out", group: "ports", args: { x: 19, y: 38 } },
      ],
    },
  });

  // 8. Current Transformer (CT - 변류기)
  joint.shapes.sld.CT = joint.dia.Element.define("sld.CT", {
    size: { width: 34, height: 38 },
    markup: [
      { tagName: "circle", selector: "topCircle" },
      { tagName: "circle", selector: "botCircle" },
      { tagName: "path", selector: "lead" },
      { tagName: "text", selector: "nameLabel" },
    ],
    attrs: {
      lead: { d: "M 17 0 L 17 38", stroke: "#00897B", strokeWidth: 2 },
      topCircle: {
        cx: 17,
        cy: 14,
        r: 7,
        stroke: "#00897B",
        strokeWidth: 2,
        fill: "none",
      },
      botCircle: {
        cx: 17,
        cy: 24,
        r: 7,
        stroke: "#00897B",
        strokeWidth: 2,
        fill: "none",
      },
      nameLabel: {
        text: "CT",
        refX: 38,
        refY: "50%",
        textAnchor: "start",
        fontSize: 11,
        fontWeight: "600",
        fill: "#00897B",
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
              stroke: "#00897B",
              strokeWidth: 1.5,
            },
          },
        },
      },
      items: [
        { id: "in", group: "ports", args: { x: 17, y: 0 } },
        { id: "out", group: "ports", args: { x: 17, y: 38 } },
      ],
    },
  });

  // 9. Potential Transformer (PT - 계기용변압기)
  joint.shapes.sld.PT = joint.dia.Element.define("sld.PT", {
    size: { width: 34, height: 44 },
    markup: [
      { tagName: "circle", selector: "c1" },
      { tagName: "circle", selector: "c2" },
      { tagName: "path", selector: "topLead" },
      { tagName: "path", selector: "botLead" },
      { tagName: "text", selector: "nameLabel" },
    ],
    attrs: {
      topLead: { d: "M 17 0 L 17 8", stroke: "#00897B", strokeWidth: 2 },
      botLead: { d: "M 17 36 L 17 44", stroke: "#00897B", strokeWidth: 2 },
      c1: {
        cx: 17,
        cy: 16,
        r: 8,
        stroke: "#00897B",
        strokeWidth: 2,
        fill: "#ffffff",
      },
      c2: {
        cx: 17,
        cy: 28,
        r: 8,
        stroke: "#00897B",
        strokeWidth: 2,
        fill: "#ffffff",
      },
      nameLabel: {
        text: "PT",
        refX: 38,
        refY: "50%",
        textAnchor: "start",
        fontSize: 11,
        fontWeight: "600",
        fill: "#00897B",
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
              stroke: "#00897B",
              strokeWidth: 1.5,
            },
          },
        },
      },
      items: [
        { id: "in", group: "ports", args: { x: 17, y: 0 } },
        { id: "ground", group: "ports", args: { x: 17, y: 44 } },
      ],
    },
  });

  // 10. Ground Switch (ES - 접지단로기)
  joint.shapes.sld.GroundSwitch = joint.dia.Element.define(
    "sld.GroundSwitch",
    {
      size: { width: 32, height: 44 },
      markup: [
        { tagName: "path", selector: "inLine" },
        { tagName: "path", selector: "contact" },
        { tagName: "path", selector: "groundSymbol" },
        { tagName: "circle", selector: "node" },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        inLine: { d: "M 16 0 L 16 12", stroke: "#5C6BC0", strokeWidth: 2 },
        node: {
          cx: 16,
          cy: 12,
          r: 3,
          stroke: "#5C6BC0",
          strokeWidth: 2,
          fill: "#ffffff",
        },
        contact: {
          d: "M 16 12 L 16 28",
          stroke: "#5C6BC0",
          strokeWidth: 2,
          strokeLinecap: "round",
          cursor: "pointer",
        },
        groundSymbol: {
          d: "M 8 28 L 24 28 M 11 32 L 21 32 M 14 36 L 18 36",
          stroke: "#5C6BC0",
          strokeWidth: 2,
          strokeLinecap: "round",
        },
        nameLabel: {
          text: "ES",
          refX: 34,
          refY: "40%",
          textAnchor: "start",
          fontSize: 11,
          fontWeight: "600",
          fill: "#5C6BC0",
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
                stroke: "#5C6BC0",
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
        this.on("change:size", this.updateContactVisual, this);
      },
      updateContactVisual: function () {
        const data = this.get("sldData") || {};
        const state = (data.state || "OPEN").toUpperCase();
        const isOpen = state === "OPEN" || state === "DEAD" || state === "LIVE";
        const contactD = isOpen ? "M 16 12 L 24 22" : "M 16 12 L 16 28";
        const strokeColor = isOpen ? "#94a3b8" : "#84CC16";

        this.attr({
          contact: { d: contactD, stroke: strokeColor },
          inLine: { stroke: strokeColor },
          node: { stroke: strokeColor },
          groundSymbol: { stroke: strokeColor },
          nameLabel: { text: data.name || "ES" },
        });
      },
    },
  );
})();
