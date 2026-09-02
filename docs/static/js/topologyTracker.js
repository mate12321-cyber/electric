/**
 * Power System Topology Tracker
 * Real-time BFS graph traversal engine for power system state evaluation.
 * Evaluates Grounded / Live / Dead states across breakers, transformers, busbars, and feeders.
 */

function resolveVoltageInfo(valOrKey) {
  const presets =
    (typeof window !== "undefined" &&
      (window.VOLTAGE_PRESETS || window.DEFAULT_VOLTAGE_PRESETS)) ||
    {};

  if (!valOrKey) return { voltage: 0.4, color: "#059669" };

  if (typeof valOrKey === "string") {
    // 1. Direct key match (e.g. "154kV", "22.9kV", "6.6kV", "3.3kV", "0.4kV", "0.22kV", "DC384V")
    if (presets[valOrKey]) {
      return {
        voltage: presets[valOrKey].value,
        color: presets[valOrKey].color,
      };
    }
    const cleanKey = valOrKey.replace(/\s+/g, "");
    for (const [k, v] of Object.entries(presets)) {
      if (k.toLowerCase() === cleanKey.toLowerCase()) {
        return { voltage: v.value, color: v.color };
      }
    }
    // 2. Direct hex/rgb color
    if (valOrKey.startsWith("#") || valOrKey.startsWith("rgb")) {
      for (const [k, v] of Object.entries(presets)) {
        if (v.color.toLowerCase() === valOrKey.toLowerCase()) {
          return { voltage: v.value, color: v.color };
        }
      }
      return { voltage: 0.4, color: valOrKey };
    }
    // 3. Parse numbers from string
    const num = parseFloat(valOrKey.replace(/[^0-9.]/g, ""));
    if (!isNaN(num)) {
      if (num >= 100 && num <= 200)
        return { voltage: 154, color: presets["154kV"]?.color || "#E53935" };
      if (num >= 20 && num <= 30)
        return { voltage: 22.9, color: presets["22.9kV"]?.color || "#9C27B0" };
      if (num >= 6 && num <= 7)
        return { voltage: 6.6, color: presets["6.6kV"]?.color || "#1E88E5" };
      if (num >= 3 && num <= 4)
        return { voltage: 3.3, color: presets["3.3kV"]?.color || "#0284C7" };
      if (num === 0.4 || num === 380)
        return { voltage: 0.4, color: presets["0.4kV"]?.color || "#059669" };
      if (num === 0.22 || num === 220)
        return { voltage: 0.22, color: presets["0.22kV"]?.color || "#EAB308" };
      if (num >= 300 && num <= 400 && valOrKey.toUpperCase().includes("DC"))
        return { voltage: 384, color: presets["DC384V"]?.color || "#EA580C" };
    }
  } else if (typeof valOrKey === "number") {
    if (valOrKey >= 100 && valOrKey <= 200)
      return { voltage: 154, color: presets["154kV"]?.color || "#E53935" };
    if (valOrKey >= 20 && valOrKey <= 30)
      return { voltage: 22.9, color: presets["22.9kV"]?.color || "#9C27B0" };
    if (valOrKey >= 6 && valOrKey <= 7)
      return { voltage: 6.6, color: presets["6.6kV"]?.color || "#1E88E5" };
    if (valOrKey >= 3 && valOrKey <= 4)
      return { voltage: 3.3, color: presets["3.3kV"]?.color || "#0284C7" };
    if (valOrKey === 0.4 || valOrKey === 380)
      return { voltage: 0.4, color: presets["0.4kV"]?.color || "#059669" };
    if (valOrKey === 0.22 || valOrKey === 220)
      return { voltage: 0.22, color: presets["0.22kV"]?.color || "#EAB308" };
    if (valOrKey === 384)
      return { voltage: 384, color: presets["DC384V"]?.color || "#EA580C" };
  }

  return { voltage: 0.4, color: presets["0.4kV"]?.color || "#059669" };
}

class PowerSystemTopologyTracker {
  constructor(graph) {
    this.graph = graph;
  }

  /**
   * Resolve an element's nominal or active voltage color
   */
  getElementVoltageColor(el) {
    if (!el || !el.isElement || !el.isElement()) return "#377DFF";
    const sldData = el.get("sldData") || {};
    const { nodeStatus } = this.evaluate();
    const status = nodeStatus.get(el.id);
    if (status && status.voltageColor && status.state === "LIVE") {
      return status.voltageColor;
    }
    const vInfo = resolveVoltageInfo(
      sldData.voltage || sldData.voltageLevel || sldData.color || sldData.name,
    );
    return vInfo.color;
  }

  /**
   * Run full BFS topology evaluation
   * @returns {Object} { nodeStatus: Map, linkStatus: Map, summary: Object }
   */
  evaluate() {
    if (!this.graph) return { nodeStatus: new Map(), linkStatus: new Map() };

    const elements = this.graph.getElements();
    const links = this.graph.getLinks();

    const nodeStatus = new Map(); // elementId -> { state: 'LIVE'|'DEAD'|'GROUNDED', voltage: number, voltageColor: string }
    const linkStatus = new Map(); // linkId -> { state: 'LIVE'|'DEAD'|'GROUNDED', voltageColor: string }

    // Build adjacency map: elementId -> Array of { link, neighborId, portFrom, portTo }
    const adj = new Map();
    elements.forEach((el) => adj.set(el.id, []));

    links.forEach((link) => {
      const src = link.get("source");
      const tgt = link.get("target");
      if (src && src.id && tgt && tgt.id) {
        if (adj.has(src.id)) {
          adj.get(src.id).push({
            link,
            neighborId: tgt.id,
            portFrom: src.port,
            portTo: tgt.port,
          });
        }
        if (adj.has(tgt.id)) {
          adj.get(tgt.id).push({
            link,
            neighborId: src.id,
            portFrom: tgt.port,
            portTo: src.port,
          });
        }
      }
    });

    // Helper: Check if an element conducts power
    const isElementConducting = (el) => {
      const sldData = el.get("sldData") || {};
      const catalog = window.EQUIPMENT_CATALOG[sldData.type] || {};

      const st = (sldData.state || "LIVE").toUpperCase();
      if (st === "DEAD" || st === "OPEN") return false;
      if (st === "GROUNDED" || st === "GROUND" || st === "EARTH") return true;
      if (catalog.subCategory === "SWITCH") {
        return st === "LIVE" || st === "CLOSED";
      }
      return true;
    };

    // --- Priority 1: Grounded BFS ---
    const groundQueue = [];
    const groundedNodes = new Set();
    const groundedLinks = new Set();

    elements.forEach((el) => {
      const sldData = el.get("sldData") || {};
      const catalog = window.EQUIPMENT_CATALOG[sldData.type] || {};
      const st = (sldData.state || "").toUpperCase();

      // Ground source (Direct Ground or Ground Switch or element set to GROUNDED)
      if (
        catalog.isGroundSource ||
        sldData.type === "GROUND" ||
        st === "GROUNDED" ||
        st === "GROUND" ||
        st === "EARTH"
      ) {
        groundQueue.push(el.id);
        groundedNodes.add(el.id);
      } else if (
        sldData.type === "GROUND_SWITCH" &&
        (st === "CLOSED" || st === "LIVE")
      ) {
        groundQueue.push(el.id);
        groundedNodes.add(el.id);
      }
    });

    while (groundQueue.length > 0) {
      const currentId = groundQueue.shift();
      const neighbors = adj.get(currentId) || [];

      for (const edge of neighbors) {
        const neighborEl = this.graph.getCell(edge.neighborId);
        if (!neighborEl) continue;

        const conducting = isElementConducting(neighborEl);
        groundedLinks.add(edge.link.id);

        if (!groundedNodes.has(edge.neighborId) && conducting) {
          groundedNodes.add(edge.neighborId);
          groundQueue.push(edge.neighborId);
        }
      }
    }

    // --- Priority 2: Live / Energized BFS ---
    const liveQueue = [];
    const liveNodes = new Set();
    const liveLinks = new Set();
    const nodeVoltages = new Map();

    elements.forEach((el) => {
      // If already grounded, it cannot be safely energized live
      if (groundedNodes.has(el.id)) return;

      const sldData = el.get("sldData") || {};
      const catalog = window.EQUIPMENT_CATALOG[sldData.type] || {};
      const defaultState = catalog.type === "GENERATOR" ? "DEAD" : "LIVE";
      const st = (sldData.state || defaultState).toUpperCase();

      // 1. Grid/Generator Sources (Transmission Tower, Generator, UPS, Battery)
      if (catalog.isEnergizedSource && st !== "DEAD" && st !== "OPEN") {
        const isOnline = sldData.isOnline !== false;
        if (isOnline) {
          const vInfo = resolveVoltageInfo(
            sldData.voltage ||
              sldData.voltageLevel ||
              sldData.color ||
              (sldData.type === "TRANSMISSION_TOWER" ? 154 : 154),
          );
          liveQueue.push({
            id: el.id,
            voltage: vInfo.voltage,
            color: sldData.color || vInfo.color,
          });
          liveNodes.add(el.id);
          nodeVoltages.set(el.id, {
            voltage: vInfo.voltage,
            color: sldData.color || vInfo.color,
          });
        }
      }
      // 2. Live Busbars (Any Busbar set to LIVE acts as an energized bus source)
      else if (
        (sldData.type === "BUSBAR" || el.get("type") === "sld.Busbar") &&
        st !== "DEAD" &&
        st !== "OPEN"
      ) {
        const vInfo = resolveVoltageInfo(
          sldData.voltage || sldData.color || sldData.name,
        );
        liveQueue.push({
          id: el.id,
          voltage: vInfo.voltage,
          color: sldData.color || vInfo.color,
        });
        liveNodes.add(el.id);
        nodeVoltages.set(el.id, {
          voltage: vInfo.voltage,
          color: sldData.color || vInfo.color,
        });
      }
      // 3. Standalone Live equipment with designated nominal voltage
      else if (st === "LIVE" && sldData.voltage && !liveNodes.has(el.id)) {
        const vInfo = resolveVoltageInfo(sldData.voltage);
        liveQueue.push({
          id: el.id,
          voltage: vInfo.voltage,
          color: sldData.color || vInfo.color,
        });
        liveNodes.add(el.id);
        nodeVoltages.set(el.id, {
          voltage: vInfo.voltage,
          color: sldData.color || vInfo.color,
        });
      }
    });

    while (liveQueue.length > 0) {
      const {
        id: currentId,
        voltage: currentVoltage,
        color: currentColor,
      } = liveQueue.shift();
      const currentEl = this.graph.getCell(currentId);
      const currentSldData = currentEl ? currentEl.get("sldData") || {} : {};

      const neighbors = adj.get(currentId) || [];

      for (const edge of neighbors) {
        if (groundedNodes.has(edge.neighborId)) continue; // Don't bridge to grounded

        const neighborEl = this.graph.getCell(edge.neighborId);
        if (!neighborEl) continue;

        const neighborSldData = neighborEl.get("sldData") || {};
        const conducting = isElementConducting(neighborEl);

        if (!conducting) {
          // Switch is OPEN: edge leading to it is energized, but cannot pass through to neighbor
          liveLinks.add(edge.link.id);
          linkStatus.set(edge.link.id, {
            state: "LIVE",
            voltageColor: currentColor,
          });
          continue;
        }

        // Voltage propagation & Transformation logic
        let nextVoltage = currentVoltage;
        let nextColor = currentColor;

        if (
          neighborSldData.type === "TR_2W" ||
          neighborSldData.type === "TR_3W" ||
          neighborEl.get("type") === "sld.Transformer2W" ||
          neighborEl.get("type") === "sld.Transformer3W"
        ) {
          // Transformer step down/up
          if (edge.portTo === "sec") {
            nextVoltage =
              neighborSldData.secVoltage ||
              (currentVoltage === 154 ? 22.9 : 0.4);
            const preset =
              window.DEFAULT_VOLTAGE_PRESETS &&
              Object.values(window.DEFAULT_VOLTAGE_PRESETS).find(
                (p) => p.value === nextVoltage,
              );
            nextColor =
              neighborSldData.secColor ||
              (preset
                ? preset.color
                : currentVoltage === 154
                  ? "#9C27B0"
                  : "#059669");
          } else {
            nextVoltage = neighborSldData.priVoltage || currentVoltage;
            const preset =
              window.DEFAULT_VOLTAGE_PRESETS &&
              Object.values(window.DEFAULT_VOLTAGE_PRESETS).find(
                (p) => p.value === nextVoltage,
              );
            nextColor =
              neighborSldData.color || (preset ? preset.color : currentColor);
          }
        } else if (
          neighborSldData.type === "BUSBAR" ||
          neighborEl.get("type") === "sld.Busbar"
        ) {
          if (neighborSldData.color) nextColor = neighborSldData.color;
          if (neighborSldData.voltage) nextVoltage = neighborSldData.voltage;
        } else {
          // Pass-through equipment (JUNCTION, CB, DS, MCCB, ACB, FUSE, CT, PT, LOAD, etc.):
          // PRESERVE the incoming voltage and color!
          nextVoltage = currentVoltage;
          nextColor = currentColor;
        }

        liveLinks.add(edge.link.id);
        linkStatus.set(edge.link.id, {
          state: "LIVE",
          voltageColor: nextColor,
        });

        if (!liveNodes.has(edge.neighborId)) {
          liveNodes.add(edge.neighborId);
          nodeVoltages.set(edge.neighborId, {
            voltage: nextVoltage,
            color: nextColor,
          });
          liveQueue.push({
            id: edge.neighborId,
            voltage: nextVoltage,
            color: nextColor,
          });
        }
      }
    }

    // --- Priority 3: Assemble Status for all Elements & Links ---
    elements.forEach((el) => {
      const sldData = el.get("sldData") || {};
      let state = "DEAD";
      let color = "#595959";
      let voltage = sldData.voltage || 0;

      if (groundedNodes.has(el.id)) {
        state = "GROUNDED";
        color = "#84CC16";
      } else if (liveNodes.has(el.id)) {
        state = "LIVE";
        const vInfo = nodeVoltages.get(el.id);
        color = vInfo ? vInfo.color : sldData.color || "#377DFF";
        voltage = vInfo ? vInfo.voltage : sldData.voltage;
      }

      nodeStatus.set(el.id, { state, voltage, voltageColor: color });
    });

    links.forEach((link) => {
      if (groundedLinks.has(link.id)) {
        linkStatus.set(link.id, {
          state: "GROUNDED",
          voltageColor: "#84CC16",
        });
      } else if (liveLinks.has(link.id)) {
        const info = linkStatus.get(link.id) || {
          state: "LIVE",
          voltageColor: "#377DFF",
        };
        linkStatus.set(link.id, info);
      } else {
        linkStatus.set(link.id, { state: "DEAD", voltageColor: "#595959" });
      }
    });

    return { nodeStatus, linkStatus };
  }

  /**
   * Apply the evaluated styles and classes directly to JointJS views
   */
  applyStyles(paper) {
    const { nodeStatus, linkStatus } = this.evaluate();

    // Update Links
    linkStatus.forEach((status, linkId) => {
      const link = this.graph.getCell(linkId);
      if (!link || !link.isLink()) return;

      const view = paper.findViewByModel(link);
      const isLive = status.state === "LIVE";
      const isGrounded = status.state === "GROUNDED";
      const strokeColor = isLive
        ? status.voltageColor || "#377DFF"
        : isGrounded
          ? "#84CC16"
          : "#595959";

      link.attr({
        line: {
          stroke: strokeColor,
          strokeWidth: 2.5,
          strokeDasharray: "none",
          class: isLive
            ? "link-live"
            : isGrounded
              ? "link-grounded"
              : "link-dead",
          targetMarker: { type: "none" },
          sourceMarker: { type: "none" },
        },
      });

      if (view && view.el) {
        view.el.classList.toggle("link-live", isLive);
        view.el.classList.toggle("link-grounded", isGrounded);
        view.el.classList.toggle("link-dead", !isLive && !isGrounded);

        const paths = view.el.querySelectorAll("path");
        paths.forEach((p) => {
          p.removeAttribute("marker-end");
          p.removeAttribute("marker-start");
          p.setAttribute("stroke", strokeColor);
          p.style.stroke = strokeColor;
        });
      }
    });

    // Update Elements (Status styling & Open/Close contact arm update & Transformer visual)
    nodeStatus.forEach((status, elId) => {
      const el = this.graph.getCell(elId);
      if (!el || !el.isElement()) return;

      const sldData = el.get("sldData") || {};
      const view = paper.findViewByModel(el);

      if (view && view.el) {
        view.el.dataset.topologyState = status.state;
      }

      // If it is a switch/breaker, update visual contact state
      if (typeof el.updateContactVisual === "function") {
        el.updateContactVisual(sldData.state, status.state);
      }
      // If it is a transformer, update visual based on topological state
      if (
        typeof el.updateVisual === "function" &&
        (sldData.type === "TR_2W" ||
          sldData.type === "TR_3W" ||
          el.get("type") === "sld.Transformer2W" ||
          el.get("type") === "sld.Transformer3W")
      ) {
        el.updateVisual(status.state);
      }
      // If it is a busbar, update visual based on topological state and voltage color
      if (
        typeof el.updateFromSldData === "function" &&
        (sldData.type === "BUSBAR" || el.get("type") === "sld.Busbar")
      ) {
        el.updateFromSldData(status.state, status.voltageColor);
      }
      // If it is a generator, update visual based on its state
      if (
        typeof el.updateVisual === "function" &&
        (sldData.type === "GENERATOR" || el.get("type") === "sld.Generator")
      ) {
        el.updateVisual(sldData.state || "DEAD");
      }
      // If it is a junction node, update visual based on topological state
      if (sldData.type === "JUNCTION" || el.get("type") === "sld.Junction") {
        const fillColor =
          status.state === "LIVE"
            ? status.voltageColor || "#377DFF"
            : status.state === "GROUNDED"
              ? "#84CC16"
              : "#595959";
        el.attr("circle/fill", fillColor);
        if (typeof el.updateVisual === "function") {
          el.updateVisual(status.state, status.voltageColor);
        }
      }
    });

    return { nodeStatus, linkStatus };
  }
}

window.PowerSystemTopologyTracker = PowerSystemTopologyTracker;
