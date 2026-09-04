/**
 * symbols/breakers.js
 * 차단기 및 보호/계측 설비 심볼 정의 (Hybrid SVG Stamp Engine):
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
      updateContactVisual: function (
        effectiveState,
        topologyState,
        activeVoltageColor,
      ) {
        const data = this.get("sldData") || {};
        const contactState = (
          (typeof effectiveState === "string" ? effectiveState : data.state) ||
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

        const baseColor = activeVoltageColor || data.color || "#377DFF";
        const sz = this.get("size") || { width: 28, height: 40 };

        let boxFill = isGrounded ? "#84CC16" : isDead ? "#94a3b8" : "#000000";
        let boxStroke = isGrounded ? "#84CC16" : isDead ? "#94a3b8" : baseColor;
        let showGround = isGrounded ? "block" : "none";

        const formattedName = fmtName(data.name || "CB");
        const specText = data.current ? data.current + "A" : "";
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: formattedName,
          specText: specText,
        });

        this.attr({
          box: {
            fill: boxFill,
            stroke: boxStroke,
            width: sz.width,
            height: sz.height,
          },
          groundSymbol: {
            display: showGround,
            fill: "#ffffff",
            transform: data.angle ? `rotate(${-data.angle}, 23, 20)` : "",
          },
          nameLabel: lbls.nameAttrs,
          specLabel: lbls.specAttrs,
        });

        const ports = this.getPorts ? this.getPorts() || [] : [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", boxStroke);
        });
      },
    },
  );

  // 2. Air Circuit Breaker (ACB - 기중차단기: Stamp + Dynamic Ground/Labels)
  joint.shapes.sld.ACB = joint.dia.Element.define(
    "sld.ACB",
    {
      size: { width: 28, height: 40 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-acb-crescent",
            "xlink:href": "#sld-sym-acb-crescent",
          },
        },
        { tagName: "text", selector: "groundSymbol" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-acb-crescent",
          xlinkHref: "#sld-sym-acb-crescent",
          color: "#377DFF",
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
      updateContactVisual: function (
        effectiveState,
        topologyState,
        activeVoltageColor,
      ) {
        const data = this.get("sldData") || {};
        const contactState = (
          (typeof effectiveState === "string" ? effectiveState : data.state) ||
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

        const baseColor = activeVoltageColor || data.color || "#377DFF";
        let strokeColor = isGrounded
          ? "#84CC16"
          : isDead
            ? "#94a3b8"
            : baseColor;
        let showGround = isGrounded ? "block" : "none";

        const formattedName = fmtName(data.name || "ACB");
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
          stamp: { color: strokeColor },
          groundSymbol: {
            display: showGround,
            fill: "#ffffff",
            transform: data.angle ? `rotate(${-data.angle}, 23, 20)` : "",
          },
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

  // 3. Molded Case Circuit Breaker (MCCB - 배선용차단기: Stamp + Dynamic Ground/Labels)
  joint.shapes.sld.MCCB = joint.dia.Element.define(
    "sld.MCCB",
    {
      size: { width: 28, height: 40 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-mccb-crescent",
            "xlink:href": "#sld-sym-mccb-crescent",
          },
        },
        { tagName: "text", selector: "groundSymbol" },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-mccb-crescent",
          xlinkHref: "#sld-sym-mccb-crescent",
          color: "#377DFF",
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
      updateContactVisual: function (
        effectiveState,
        topologyState,
        activeVoltageColor,
      ) {
        const data = this.get("sldData") || {};
        const contactState = (
          (typeof effectiveState === "string" ? effectiveState : data.state) ||
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

        const baseColor = activeVoltageColor || data.color || "#377DFF";
        const sz = this.get("size") || { width: 28, height: 40 };
        let strokeColor = isGrounded
          ? "#84CC16"
          : isDead
            ? "#94a3b8"
            : baseColor;
        let showGround = isGrounded ? "block" : "none";

        const formattedName = fmtName(data.name || "MCCB");
        const specText = data.current ? data.current + "A" : "";
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: formattedName,
          specText: specText,
        });

        this.attr({
          stamp: { color: strokeColor },
          groundSymbol: {
            display: showGround,
            fill: "#ffffff",
            transform: data.angle ? `rotate(${-data.angle}, 23, 20)` : "",
          },
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

        const formattedName = fmtName(data.name || "TIE CB");
        const nameLines = formattedName
          ? String(formattedName).split("\n").length
          : 1;
        const nameY = -10 - (nameLines - 1) * 12;

        this.attr({
          box: {
            fill: boxFill,
            stroke: boxStroke,
            width: sz.width,
            height: sz.height,
          },
          groundSymbol: { display: showGround, fill: "#ffffff" },
          nameLabel: {
            text: formattedName,
            x: sz.width / 2,
            y: nameY,
            refX: null,
            refY: null,
            textAnchor: "middle",
          },
          specLabel: {
            text: data.current ? data.current + "A" : "",
            x: sz.width / 2,
            y: 34,
            refX: null,
            refY: null,
            textAnchor: "middle",
          },
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

        const formattedName = fmtName(data.name || "LV TIE");
        const nameLines = formattedName
          ? String(formattedName).split("\n").length
          : 1;
        const nameY = -10 - (nameLines - 1) * 12;

        this.attr({
          crescent: { fill: fillColor, stroke: strokeColor },
          leftNode: { stroke: strokeColor, fill: fillColor },
          rightNode: { stroke: strokeColor, fill: fillColor },
          groundSymbol: { display: showGround, fill: "#ffffff" },
          nameLabel: {
            text: formattedName,
            x: 20,
            y: nameY,
            refX: null,
            refY: null,
            textAnchor: "middle",
          },
          specLabel: {
            text: data.current ? data.current + "A" : "",
            x: 20,
            y: 34,
            refX: null,
            refY: null,
            textAnchor: "middle",
          },
        });
      },
    },
  );

  // 6. Power Fuse (PF - 퓨즈: Stamp + Dynamic Label)
  joint.shapes.sld.Fuse = joint.dia.Element.define(
    "sld.Fuse",
    {
      size: { width: 32, height: 44 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-pf",
            "xlink:href": "#sld-sym-pf",
          },
        },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-pf",
          xlinkHref: "#sld-sym-pf",
          color: "#377DFF",
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
        const strokeColor = data.color || "#377DFF";
        const sz = this.get("size") || { width: 32, height: 44 };
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: fmtName(data.name || "PF"),
        });
        this.attr({
          stamp: { color: strokeColor },
          nameLabel: Object.assign({}, lbls.nameAttrs, { fill: strokeColor }),
        });
        const ports = this.getPorts ? this.getPorts() || [] : [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", strokeColor);
        });
      },
    },
  );

  // 7. Protective Relay (OCR/UVR - 보호계전기: Stamp + Dynamic Label)
  joint.shapes.sld.Relay = joint.dia.Element.define(
    "sld.Relay",
    {
      size: { width: 38, height: 38 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-relay",
            "xlink:href": "#sld-sym-relay",
          },
        },
        { tagName: "text", selector: "symbolText" },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-relay",
          xlinkHref: "#sld-sym-relay",
          color: "#E53935",
        },
        symbolText: {
          text: "51",
          x: 19,
          y: 19,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          fontSize: 12,
          fontWeight: "bold",
          fontFamily: "Pretendard, -apple-system, sans-serif",
          fill: "#E53935",
          pointerEvents: "none",
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
        const strokeColor = data.color || "#E53935";
        const sz = this.get("size") || { width: 38, height: 38 };
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: fmtName(data.name || "OCR"),
        });
        const angle = ((Math.round(data.angle || 0) % 360) + 360) % 360;
        const cx = sz.width / 2;
        const cy = sz.height / 2;
        this.attr({
          stamp: { color: strokeColor },
          symbolText: {
            text: data.relayCode || "51",
            fill: strokeColor,
            transform: angle ? `rotate(${-angle}, ${cx}, ${cy})` : "",
          },
          nameLabel: Object.assign({}, lbls.nameAttrs, { fill: strokeColor }),
        });
        const ports = this.getPorts ? this.getPorts() || [] : [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", strokeColor);
        });
      },
    },
  );

  // 8. Current Transformer (CT - 변류기: Stamp + Dynamic Label)
  joint.shapes.sld.CT = joint.dia.Element.define(
    "sld.CT",
    {
      size: { width: 34, height: 38 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-ct",
            "xlink:href": "#sld-sym-ct",
          },
        },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-ct",
          xlinkHref: "#sld-sym-ct",
          color: "#00897B",
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
        const strokeColor = data.color || "#00897B";
        const sz = this.get("size") || { width: 34, height: 38 };
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: fmtName(data.name || "CT"),
        });
        this.attr({
          stamp: { color: strokeColor },
          nameLabel: Object.assign({}, lbls.nameAttrs, { fill: strokeColor }),
        });
        const ports = this.getPorts ? this.getPorts() || [] : [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", strokeColor);
        });
      },
    },
  );

  // 9. Potential Transformer (PT - 계기용변압기: Stamp + Dynamic Label)
  joint.shapes.sld.PT = joint.dia.Element.define(
    "sld.PT",
    {
      size: { width: 34, height: 44 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-pt",
            "xlink:href": "#sld-sym-pt",
          },
        },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-pt",
          xlinkHref: "#sld-sym-pt",
          color: "#00897B",
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
        const strokeColor = data.color || "#00897B";
        const sz = this.get("size") || { width: 34, height: 44 };
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: fmtName(data.name || "PT"),
        });
        this.attr({
          stamp: { color: strokeColor },
          nameLabel: Object.assign({}, lbls.nameAttrs, { fill: strokeColor }),
        });
        const ports = this.getPorts ? this.getPorts() || [] : [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", strokeColor);
        });
      },
    },
  );

  // 10. Ground Switch (ES - 접지단로기: Interactive Contact + Ground Symbol)
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
        const sz = this.get("size") || { width: 32, height: 44 };

        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: fmtName(data.name || "ES"),
        });

        this.attr({
          contact: { d: contactD, stroke: strokeColor },
          inLine: { stroke: strokeColor },
          node: { stroke: strokeColor },
          groundSymbol: { stroke: strokeColor },
          nameLabel: Object.assign({}, lbls.nameAttrs, { fill: strokeColor }),
        });

        const ports = this.getPorts ? this.getPorts() || [] : [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", strokeColor);
        });
      },
    },
  );
})();
