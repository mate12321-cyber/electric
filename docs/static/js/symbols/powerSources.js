/**
 * symbols/powerSources.js
 * 전원, 변환, 에너지 저장 및 부하 설비 심볼 정의 (Hybrid SVG Stamp Engine):
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

  const fmtName = (str) =>
    typeof window !== "undefined" &&
    typeof window.formatSymbolLabel === "function"
      ? window.formatSymbolLabel(str, 5)
      : str;

  const getLblAttrs = (opts) =>
    typeof window.getSymbolLabelAttrs === "function"
      ? window.getSymbolLabelAttrs(opts)
      : {
          nameAttrs: { text: opts.nameText },
          specAttrs: { text: opts.specText },
        };

  // 1. Emergency Generator (비상 발전기: Stamp + Dynamic Labels)
  joint.shapes.sld.Generator = joint.dia.Element.define(
    "sld.Generator",
    {
      size: { width: 44, height: 44 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-gen",
            "xlink:href": "#sld-sym-gen",
          },
        },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-gen",
          xlinkHref: "#sld-sym-gen",
          color: "#94a3b8",
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
        const state = (
          (typeof effectiveState === "string" ? effectiveState : baseState) ||
          "DEAD"
        ).toUpperCase();
        const isLive = state === "LIVE" || state === "CLOSED";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        const mainColor = data.color || "#E65100";
        let strokeColor = isGrounded
          ? "#84CC16"
          : isLive
            ? mainColor
            : "#94a3b8";

        const formattedName = fmtName(data.name || "비상 발전기");
        const specText = data.capacity || "";
        const sz = this.get("size") || { width: 44, height: 44 };
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: formattedName,
          specText: specText,
        });

        this.attr({
          stamp: { color: strokeColor },
          nameLabel: lbls.nameAttrs,
          specLabel: lbls.specAttrs,
        });

        const ports = this.getPorts() || [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", strokeColor);
        });
      },
    },
  );

  // 2. Motor (전동기 모터: Stamp + Dynamic Label)
  joint.shapes.sld.Motor = joint.dia.Element.define(
    "sld.Motor",
    {
      size: { width: 42, height: 42 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-motor",
            "xlink:href": "#sld-sym-motor",
          },
        },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-motor",
          xlinkHref: "#sld-sym-motor",
          color: "#377DFF",
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
    },
    {
      initialize: function () {
        joint.dia.Element.prototype.initialize.apply(this, arguments);
        this.updateVisual();
        this.on("change:sldData", this.updateVisual, this);
      },
      updateVisual: function (effectiveState, voltageColor) {
        const data = this.get("sldData") || {};
        const state = (
          (typeof effectiveState === "string" ? effectiveState : data.state) ||
          "LIVE"
        ).toUpperCase();
        const isLive = state === "LIVE" || state === "CLOSED";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";
        const strokeColor = isGrounded
          ? "#84CC16"
          : isLive
            ? voltageColor || data.color || "#377DFF"
            : "#94a3b8";
        const sz = this.get("size") || { width: 42, height: 42 };
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: fmtName(data.name || "모터"),
        });

        this.attr({
          stamp: { color: strokeColor },
          nameLabel: lbls.nameAttrs,
        });

        const ports = this.getPorts ? this.getPorts() || [] : [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", strokeColor);
        });
      },
    },
  );

  // 3. Load (일반 부하: Stamp + Dynamic Label)
  joint.shapes.sld.Load = joint.dia.Element.define(
    "sld.Load",
    {
      size: { width: 34, height: 36 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-load",
            "xlink:href": "#sld-sym-load",
          },
        },
        { tagName: "text", selector: "nameLabel" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-load",
          xlinkHref: "#sld-sym-load",
          color: "#64748b",
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
        this.on("change:size", this.updateVisual, this);
      },
      updateVisual: function (effectiveState, voltageColor) {
        const data = this.get("sldData") || {};
        const state = (
          (typeof effectiveState === "string" ? effectiveState : data.state) ||
          "LIVE"
        ).toUpperCase();
        const isLive = state === "LIVE" || state === "CLOSED";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";
        const strokeColor = isGrounded
          ? "#84CC16"
          : isLive
            ? voltageColor || data.color || "#64748b"
            : "#94a3b8";
        const sz = this.get("size") || { width: 34, height: 36 };
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: fmtName(data.name || "부하"),
        });

        this.attr({
          stamp: { color: strokeColor },
          nameLabel: lbls.nameAttrs,
        });

        const ports = this.getPorts ? this.getPorts() || [] : [];
        ports.forEach((p) => {
          this.portProp(p.id, "attrs/circle/stroke", strokeColor);
        });
      },
    },
  );

  // 4. Ground (대지 접지: Stamp + Label)
  joint.shapes.sld.Ground = joint.dia.Element.define("sld.Ground", {
    size: { width: 28, height: 28 },
    markup: [
      {
        tagName: "use",
        selector: "stamp",
        attributes: {
          href: "#sld-sym-ground",
          "xlink:href": "#sld-sym-ground",
        },
      },
      { tagName: "text", selector: "label" },
    ],
    attrs: {
      stamp: {
        href: "#sld-sym-ground",
        xlinkHref: "#sld-sym-ground",
        color: "#52c41a",
      },
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

  // 5. UPS (무정전 전원장치: Stamp + Dynamic Label)
  joint.shapes.sld.UPS = joint.dia.Element.define(
    "sld.UPS",
    {
      size: { width: 56, height: 48 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-ups",
            "xlink:href": "#sld-sym-ups",
          },
        },
        { tagName: "text", selector: "label" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-ups",
          xlinkHref: "#sld-sym-ups",
          color: "#DC2626",
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
        const state = (
          (typeof effectiveState === "string" ? effectiveState : baseState) ||
          "LIVE"
        ).toUpperCase();
        const isLive = state === "LIVE" || state === "CLOSED" || state === "ON";
        const isGrounded =
          state === "GROUNDED" || state === "GROUND" || state === "EARTH";

        let strokeColor, labelColor;

        if (isGrounded) {
          strokeColor = "#84CC16";
          labelColor = "#4D7C0F";
        } else if (isLive) {
          strokeColor = "#DC2626";
          labelColor = "#B91C1C";
        } else {
          strokeColor = "#94A3B8";
          labelColor = "#64748B";
        }

        this.attr({
          stamp: { color: strokeColor },
          label: {
            text: fmtName(data.name || "UPS"),
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

  // 6. Rectifier (정류기 / 인버터: Stamp + Dynamic Label)
  joint.shapes.sld.Rectifier = joint.dia.Element.define(
    "sld.Rectifier",
    {
      size: { width: 50, height: 40 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-rectifier",
            "xlink:href": "#sld-sym-rectifier",
          },
        },
        { tagName: "text", selector: "label" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-rectifier",
          xlinkHref: "#sld-sym-rectifier",
          color: "#2E7D32",
        },
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
    },
    {
      initialize: function () {
        joint.dia.Element.prototype.initialize.apply(this, arguments);
        this.updateVisual();
        this.on("change:sldData", this.updateVisual, this);
      },
      updateVisual: function () {
        const data = this.get("sldData") || {};
        const strokeColor = data.color || "#2E7D32";
        this.attr({
          stamp: { color: strokeColor },
          label: { text: fmtName(data.name || "정류기"), fill: strokeColor },
        });
      },
    },
  );

  // 7. Battery Bank (축전지: Stamp + Dynamic Labels)
  joint.shapes.sld.Battery = joint.dia.Element.define(
    "sld.Battery",
    {
      size: { width: 52, height: 34 },
      markup: [
        {
          tagName: "use",
          selector: "stamp",
          attributes: {
            href: "#sld-sym-battery",
            "xlink:href": "#sld-sym-battery",
          },
        },
        { tagName: "text", selector: "nameLabel" },
        { tagName: "text", selector: "specLabel" },
      ],
      attrs: {
        stamp: {
          href: "#sld-sym-battery",
          xlinkHref: "#sld-sym-battery",
          color: "#00838F",
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
        const strokeColor = data.color || "#00838F";
        const formattedName = fmtName(data.name || "배터리 뱅크");
        const specText = data.capacity || "384V DC";
        const sz = this.get("size") || { width: 52, height: 34 };
        const lbls = getLblAttrs({
          angle: data.angle,
          width: sz.width,
          height: sz.height,
          nameText: formattedName,
          specText: specText,
        });

        this.attr({
          stamp: { color: strokeColor },
          nameLabel: lbls.nameAttrs,
          specLabel: lbls.specAttrs,
        });
      },
    },
  );
})();
