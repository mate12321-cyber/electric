/**
 * symbols/stampRegistry.js
 * Hybrid SVG Symbol Stamp Registry for Power System SLD
 *
 * Provides reusable SVG <symbol>/<g> template stamps injected once into Paper <defs>.
 * Enables high-performance rendering by letting symbol instances reference
 * static geometric paths via <use href="#sld-sym-..."> while dynamic state overlays
 * (blades, badges, labels, ports) remain fully interactive and reactive.
 */
(function () {
  if (typeof window === "undefined") return;

  const STAMPS = {
    "sld-sym-tower": `
      <g id="sld-sym-tower">
        <rect width="56" height="56" rx="4" fill="#ffffff" stroke="#94a3b8" stroke-width="1"/>
        <path d="M 28 6 L 14 44 L 42 44 Z M 28 16 L 38 44 M 28 16 L 18 44 M 10 26 L 46 26 M 14 34 L 42 34" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </g>`,

    "sld-sym-la": `
      <g id="sld-sym-la">
        <path d="M 16 0 L 16 8 M 16 36 L 16 44" stroke="currentColor" stroke-width="2"/>
        <path d="M 11 8 h 10 l -5 8 h 6 l -8 10 h 6 l -5 10" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      </g>`,

    "sld-sym-pf": `
      <g id="sld-sym-pf">
        <rect x="9" y="6" width="14" height="32" rx="1" ry="1" stroke="currentColor" stroke-width="2" fill="#ffffff"/>
        <path d="M 16 0 L 16 44" stroke="currentColor" stroke-width="2"/>
      </g>`,

    "sld-sym-relay": `
      <g id="sld-sym-relay">
        <circle cx="19" cy="19" r="17" stroke="currentColor" stroke-width="2" fill="#ffffff"/>
        <text x="19" y="19" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="bold" fill="currentColor" font-family="Pretendard, -apple-system, sans-serif">51</text>
      </g>`,

    "sld-sym-ct": `
      <g id="sld-sym-ct">
        <path d="M 17 0 L 17 38" stroke="currentColor" stroke-width="2"/>
        <circle cx="17" cy="14" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="17" cy="24" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
      </g>`,

    "sld-sym-pt": `
      <g id="sld-sym-pt">
        <path d="M 17 0 L 17 8 M 17 36 L 17 44" stroke="currentColor" stroke-width="2"/>
        <circle cx="17" cy="16" r="8" stroke="currentColor" stroke-width="2" fill="#ffffff"/>
        <circle cx="17" cy="28" r="8" stroke="currentColor" stroke-width="2" fill="#ffffff"/>
      </g>`,

    "sld-sym-ground": `
      <g id="sld-sym-ground">
        <path d="M 14 0 L 14 10" stroke="currentColor" stroke-width="2"/>
        <path d="M 4 10 L 24 10" stroke="currentColor" stroke-width="2.5"/>
        <path d="M 8 15 L 20 15" stroke="currentColor" stroke-width="2"/>
        <path d="M 11 20 L 17 20" stroke="currentColor" stroke-width="1.5"/>
      </g>`,

    "sld-sym-motor": `
      <g id="sld-sym-motor">
        <path d="M 21 0 L 21 4" stroke="currentColor" stroke-width="2"/>
        <circle cx="21" cy="21" r="17" stroke="currentColor" stroke-width="2" fill="#ffffff"/>
        <text x="21" y="25" text-anchor="middle" font-size="14" font-weight="bold" fill="currentColor" font-family="Pretendard, -apple-system, sans-serif">M</text>
      </g>`,

    "sld-sym-gen": `
      <g id="sld-sym-gen">
        <path d="M 22 0 L 22 4" stroke="currentColor" stroke-width="2"/>
        <circle cx="22" cy="22" r="18" stroke="currentColor" stroke-width="2" fill="#f8fafc"/>
        <text x="22" y="26" text-anchor="middle" font-size="14" font-weight="bold" fill="currentColor" font-family="Pretendard, -apple-system, sans-serif">G</text>
      </g>`,

    "sld-sym-load": `
      <g id="sld-sym-load">
        <path d="M 17 0 L 17 8" stroke="currentColor" stroke-width="2"/>
        <rect x="2" y="8" width="30" height="26" rx="2" fill="#ffffff" stroke="currentColor" stroke-width="1.5"/>
      </g>`,

    "sld-sym-battery": `
      <g id="sld-sym-battery">
        <rect width="52" height="34" rx="3" fill="#ffffff" stroke="currentColor" stroke-width="2"/>
        <path d="M 11 17 H 19 M 15 13 V 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M 33 17 H 41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </g>`,

    "sld-sym-switchgear": `
      <g id="sld-sym-switchgear">
        <rect width="44" height="60" rx="2" fill="#ffffff" stroke="currentColor" stroke-width="2"/>
        <path d="M 6 18 L 38 18 M 6 30 L 38 30 M 6 42 L 38 42" stroke="#94a3b8" stroke-width="1.2"/>
        <path d="M 10 10 h 2 M 10 24 h 2 M 10 36 h 2 M 10 48 h 2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </g>`,

    "sld-sym-panelboard": `
      <g id="sld-sym-panelboard">
        <rect width="40" height="50" rx="2" fill="#ffffff" stroke="currentColor" stroke-width="2"/>
        <rect x="6" y="6" width="28" height="38" fill="#f8fafc" stroke="currentColor" stroke-width="1"/>
      </g>`,

    "sld-sym-rectifier": `
      <g id="sld-sym-rectifier">
        <rect width="50" height="40" rx="3" fill="#ffffff" stroke="currentColor" stroke-width="2"/>
        <path d="M 0 40 L 50 0" stroke="currentColor" stroke-width="1"/>
        <path d="M 8 16 Q 12 10 16 16 T 24 16" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M 32 30 L 44 30" stroke="currentColor" stroke-width="2"/>
      </g>`,

    "sld-sym-ups": `
      <g id="sld-sym-ups">
        <rect width="56" height="48" rx="3" fill="#FEE2E2" stroke="currentColor" stroke-width="2"/>
        <path d="M 0 48 L 56 0" stroke="currentColor" stroke-width="1.2"/>
        <path d="M 10 20 Q 14 12 18 20 T 26 20" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M 36 32 L 46 32 M 36 36 L 46 36" stroke="currentColor" stroke-width="1.5"/>
      </g>`,

    "sld-sym-acb-crescent": `
      <g id="sld-sym-acb-crescent">
        <path d="M 17 6 C 22 12, 22 28, 17 34 C 33 30, 33 10, 17 6 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="#000000"/>
        <circle cx="14" cy="6" r="3.5" fill="#000000" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="14" cy="34" r="3.5" fill="#000000" stroke="currentColor" stroke-width="1.5"/>
      </g>`,

    "sld-sym-mccb-crescent": `
      <g id="sld-sym-mccb-crescent">
        <path d="M 14 0 L 14 6 M 14 34 L 14 40" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M 14 6 C 21 12, 21 28, 14 34 C 31 30, 31 10, 14 6 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="#000000"/>
      </g>`,

    "sld-sym-ds-base": `
      <g id="sld-sym-ds-base">
        <path d="M 14 0 L 14 6 M 14 34 L 14 40" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="14" cy="6" r="4.5" stroke="currentColor" stroke-width="2" fill="#ffffff"/>
        <circle cx="14" cy="34" r="4.5" stroke="currentColor" stroke-width="2" fill="#ffffff"/>
      </g>`,

    "sld-sym-ds3p-base": `
      <g id="sld-sym-ds3p-base">
        <path d="M 14 34 L 14 48 M 14 0 L 14 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="14" cy="10" r="4.5" stroke="currentColor" stroke-width="2" fill="#ffffff"/>
        <circle cx="14" cy="34" r="4.5" stroke="currentColor" stroke-width="2" fill="#ffffff"/>
        <circle cx="14" cy="34" r="2" fill="currentColor"/>
        <circle cx="38" cy="34" r="4.5" stroke="#94a3b8" stroke-width="2" fill="#ffffff"/>
        <path d="M 38 38.5 L 38 42 M 32 42 L 44 42 M 34 44.5 L 42 44.5 M 36 47 L 40 47" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
      </g>`
  };

  const SymbolStampRegistry = {
    STAMPS: STAMPS,

    /**
     * Injects stamp definitions into paper SVG defs
     * @param {joint.dia.Paper|SVGElement} paperOrSvg
     */
    injectDefs: function (paperOrSvg) {
      if (!paperOrSvg) return;
      const svgElem = paperOrSvg.svg || paperOrSvg;
      if (!svgElem || typeof svgElem.querySelector !== "function") return;

      let defs = svgElem.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        if (svgElem.firstChild) {
          svgElem.insertBefore(defs, svgElem.firstChild);
        } else {
          svgElem.appendChild(defs);
        }
      }

      if (defs.querySelector("#sld-stamp-defs")) {
        return;
      }

      try {
        const parser = new DOMParser();
        const xml = `<svg xmlns="http://www.w3.org/2000/svg"><defs id="sld-stamp-defs">${Object.values(STAMPS).join("\n")}</defs></svg>`;
        const doc = parser.parseFromString(xml, "image/svg+xml");
        const importedDefs = doc.getElementById("sld-stamp-defs");
        if (importedDefs) {
          defs.appendChild(document.importNode(importedDefs, true));
        }
      } catch (e) {
        console.warn("SymbolStampRegistry: injectDefs fallback", e);
        const container = document.createElementNS("http://www.w3.org/2000/svg", "g");
        container.setAttribute("id", "sld-stamp-defs");
        container.innerHTML = Object.values(STAMPS).join("\n");
        defs.appendChild(container);
      }
    },

    /**
     * Returns serialized defs markup for SVG/PNG export
     */
    getDefsMarkup: function () {
      return `<defs id="sld-stamp-defs">${Object.values(STAMPS).join("\n")}</defs>`;
    }
  };

  window.SymbolStampRegistry = SymbolStampRegistry;
})();
