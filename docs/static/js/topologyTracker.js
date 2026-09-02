/**
 * Power System Topology Tracker
 * Real-time BFS graph traversal engine for power system state evaluation.
 * Evaluates Grounded / Live / Dead states across breakers, transformers, busbars, and feeders.
 */

class PowerSystemTopologyTracker {
  constructor(graph) {
    this.graph = graph;
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
      const st = (sldData.state || "LIVE").toUpperCase();

      if (catalog.isEnergizedSource && st !== "DEAD" && st !== "OPEN") {
        // If it is generator/UPS, check if switched on (default on)
        const isOnline = sldData.isOnline !== false;
        if (isOnline) {
          liveQueue.push({
            id: el.id,
            voltage: sldData.voltage || 154,
            color: sldData.color || "#7A3E9D",
          });
          liveNodes.add(el.id);
          nodeVoltages.set(el.id, {
            voltage: sldData.voltage || 154,
            color: sldData.color || "#7A3E9D",
          });
        }
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

        if (neighborSldData.type === "TR_2W") {
          // Transformer step down/up
          if (edge.portTo === "sec") {
            nextVoltage = neighborSldData.secVoltage || 22.9;
            nextColor = neighborSldData.secColor || "#9C27B0";
          } else {
            nextVoltage = neighborSldData.priVoltage || 154;
            nextColor = neighborSldData.color || "#2E7D32";
          }
        } else if (neighborSldData.type === "BUSBAR") {
          if (neighborSldData.color) nextColor = neighborSldData.color;
          if (neighborSldData.voltage) nextVoltage = neighborSldData.voltage;
        } else if (neighborSldData.color) {
          nextColor = neighborSldData.color;
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
        color = "#52c41a";
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
        linkStatus.set(link.id, { state: "GROUNDED", voltageColor: "#52c41a" });
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
      if (!view) return;

      if (status.state === "LIVE") {
        link.attr({
          line: {
            stroke: status.voltageColor,
            strokeWidth: 2.5,
            strokeDasharray: "none",
            class: "link-live",
            targetMarker: { type: "none" },
            sourceMarker: { type: "none" },
          },
        });
        if (view.el) {
          view.el.classList.add("link-live");
          view.el.classList.remove("link-dead", "link-grounded");
          const paths = view.el.querySelectorAll("path");
          paths.forEach((p) => {
            p.removeAttribute("marker-end");
            p.removeAttribute("marker-start");
          });
        }
      } else if (status.state === "GROUNDED") {
        link.attr({
          line: {
            stroke: "#52c41a",
            strokeWidth: 2.5,
            strokeDasharray: "none",
            class: "link-grounded",
            targetMarker: { type: "none" },
            sourceMarker: { type: "none" },
          },
        });
        if (view.el) {
          view.el.classList.add("link-grounded");
          view.el.classList.remove("link-live", "link-dead");
          const paths = view.el.querySelectorAll("path");
          paths.forEach((p) => {
            p.removeAttribute("marker-end");
            p.removeAttribute("marker-start");
          });
        }
      } else {
        link.attr({
          line: {
            stroke: "#595959",
            strokeWidth: 2.5,
            strokeDasharray: "none",
            class: "link-dead",
            targetMarker: { type: "none" },
            sourceMarker: { type: "none" },
          },
        });
        if (view.el) {
          view.el.classList.add("link-dead");
          view.el.classList.remove("link-live", "link-grounded");
          const paths = view.el.querySelectorAll("path");
          paths.forEach((p) => {
            p.removeAttribute("marker-end");
            p.removeAttribute("marker-start");
          });
        }
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
    });

    return { nodeStatus, linkStatus };
  }
}

window.PowerSystemTopologyTracker = PowerSystemTopologyTracker;
