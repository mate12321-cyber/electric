/**
 * SLD Editor Main Engine (JointJS + Manhattan Router + Interactive Canvas)
 * Handles Pan/Zoom, Drag-and-Drop, Breaker Toggle, Properties Inspector, and Real-time Topology Evaluation.
 */

class SLDEditor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = Object.assign(
      {
        diagramId: "default-154kv-substation",
        gridSize: 10,
        snapToGrid: true,
        readOnly: false,
      },
      options,
    );

    this.scale = 1;
    this.origin = { x: 0, y: 0 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.activeTool = "select"; // 'select' | 'lasso' | 'wire' | 'busbar' | 'pen' | 'text' | 'group'
    this.selectedCell = null;
    this.history = [];
    this.historyIndex = -1;
    this.isHistoryTracking = true;

    this.init();
  }

  init() {
    if (!this.container) return;

    // 1. Initialize JointJS Graph & Paper
    this.graph = new joint.dia.Graph();
    this.topologyTracker = new PowerSystemTopologyTracker(this.graph);

    const rect = this.container.getBoundingClientRect();
    const paperWidth = rect.width || this.container.clientWidth || 2000;
    const paperHeight = rect.height || this.container.clientHeight || 1200;

    this.paper = new joint.dia.Paper({
      el: this.container,
      model: this.graph,
      width: paperWidth,
      height: paperHeight,
      async: false,
      gridSize: this.options.gridSize,
      drawGrid: { name: "dot", args: { color: "#cbd5e1", thickness: 1 } },
      snapLinks: { radius: 20 },
      linkPinning: false,
      markAvailable: true,
      defaultLink: new joint.shapes.standard.Link({
        router: { name: "sldOrthogonal" },
        connector: { name: "normal" },
        attrs: {
          line: {
            stroke: "#377DFF",
            strokeWidth: 2.5,
            strokeDasharray: "8,4",
            class: "link-live",
            targetMarker: { type: "none" },
          },
        },
      }),
      validateConnection: function (
        cellViewS,
        magnetS,
        cellViewT,
        magnetT,
        end,
        linkView,
      ) {
        // Prevent connecting to self or without magnets
        if (cellViewS === cellViewT) return false;
        if (!magnetS || !magnetT) return false;
        return true;
      },
      interactive: (cellView) => {
        if (this.activeTool === "pan") return false;
        return true;
      },
    });

    // 2. Setup Events
    this.setupCanvasEvents();
    this.setupPaletteDragDrop();
    this.setupCellInteractions();
    this.setupPropertiesPanel();
    this.setupToolbar();
    this.setupKeyboardShortcuts();
    this.setupVoltageColorsModal();

    // 3. Load Diagram Data from Server or Seed Data
    this.loadDiagram(this.options.diagramId);

    // 4. Setup Minimap
    this.initMinimap();
  }

  setupCanvasEvents() {
    const paperEl = this.paper.el;
    let isSpacePressed = false;

    window.addEventListener("keydown", (e) => {
      if (
        e.code === "Space" &&
        e.target.tagName !== "INPUT" &&
        e.target.tagName !== "TEXTAREA"
      ) {
        isSpacePressed = true;
        paperEl.style.cursor = "grab";
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        isSpacePressed = false;
        paperEl.style.cursor = "default";
      }
    });

    // Mouse Move -> Update Status Bar Coordinates
    paperEl.addEventListener("mousemove", (e) => {
      const rect = paperEl.getBoundingClientRect();
      const p = this.paper.clientToLocalPoint({ x: e.clientX, y: e.clientY });

      const coordEl = document.getElementById("status-coord");
      if (coordEl) {
        coordEl.innerText = "X: " + Math.round(p.x) + ", Y: " + Math.round(p.y);
      }

      // Pan drag handling
      if (this.isPanning) {
        const dx = e.clientX - this.panStart.x;
        const dy = e.clientY - this.panStart.y;
        this.origin.x += dx;
        this.origin.y += dy;
        this.panStart = { x: e.clientX, y: e.clientY };
        this.paper.setOrigin(this.origin.x, this.origin.y);
        this.updateMinimap();
      }
    });

    // Pan Start (Right Click, Middle Click, Space+Click, or Pan Tool)
    paperEl.addEventListener("mousedown", (e) => {
      if (
        e.button === 2 ||
        e.button === 1 ||
        isSpacePressed ||
        this.activeTool === "pan" ||
        (e.target.tagName === "svg" && e.button === 0 && !this.selectedCell)
      ) {
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
        paperEl.style.cursor = "grabbing";
      }
    });

    window.addEventListener("mouseup", () => {
      if (this.isPanning) {
        this.isPanning = false;
        paperEl.style.cursor = isSpacePressed ? "grab" : "default";
      }
    });

    paperEl.addEventListener("contextmenu", (e) => e.preventDefault());

    // Mouse Wheel Zoom
    paperEl.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.zoom(delta, { x: e.clientX, y: e.clientY });
      },
      { passive: false },
    );

    // Blank Click -> Deselect
    this.paper.on("blank:pointerdown", () => {
      this.deselectAll();
    });

    // Graph Change -> Run Topology Tracker & History Push
    this.graph.on(
      "change:position change:size add remove change:sldData",
      () => {
        this.topologyTracker.applyStyles(this.paper);
        this.updateMinimap();
        this.pushHistory();
        this.scheduleAutoSave();
      },
    );
  }

  zoom(delta, clientPoint) {
    const oldScale = this.scale;
    let newScale = Math.min(Math.max(0.3, this.scale + delta), 2.5);
    newScale = Math.round(newScale * 10) / 10;
    if (newScale === oldScale) return;

    const paperEl = this.paper.el;
    const rect = paperEl.getBoundingClientRect();
    const mouseX = clientPoint ? clientPoint.x - rect.left : rect.width / 2;
    const mouseY = clientPoint ? clientPoint.y - rect.top : rect.height / 2;

    const p = this.paper.clientToLocalPoint({
      x: mouseX + rect.left,
      y: mouseY + rect.top,
    });

    this.scale = newScale;
    this.paper.scale(this.scale, this.scale);

    // Adjust origin to keep zoom centered
    this.origin.x = mouseX - p.x * this.scale;
    this.origin.y = mouseY - p.y * this.scale;
    this.paper.setOrigin(this.origin.x, this.origin.y);

    const zoomBadge = document.getElementById("zoom-percentage");
    if (zoomBadge) zoomBadge.innerText = Math.round(this.scale * 100) + "%";

    this.updateMinimap();
  }

  setZoom(value) {
    this.scale = value;
    this.paper.scale(this.scale, this.scale);
    const zoomBadge = document.getElementById("zoom-percentage");
    if (zoomBadge) zoomBadge.innerText = Math.round(this.scale * 100) + "%";
    this.updateMinimap();
  }

  zoomToFit() {
    // 1. Get invariant model bounding box from graph
    let bbox = null;
    if (this.graph && typeof this.graph.getBBox === "function") {
      bbox = this.graph.getBBox();
    }

    if (!bbox || bbox.width === 0 || bbox.height === 0) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      this.graph.getElements().forEach((el) => {
        const pos = el.position();
        const sz = el.size();
        if (pos.x < minX) minX = pos.x;
        if (pos.y < minY) minY = pos.y;
        if (pos.x + sz.width > maxX) maxX = pos.x + sz.width;
        if (pos.y + sz.height > maxY) maxY = pos.y + sz.height;
      });
      if (minX !== Infinity) {
        bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }
    }

    if (!bbox || bbox.width === 0 || bbox.height === 0) return;

    const rect = this.container.getBoundingClientRect();
    const containerWidth = rect.width || this.container.clientWidth || 1000;
    const containerHeight = rect.height || this.container.clientHeight || 700;

    const padding = 50;
    const scaleX = (containerWidth - padding * 2) / bbox.width;
    const scaleY = (containerHeight - padding * 2) / bbox.height;
    const newScale = Math.min(Math.max(0.45, Math.min(scaleX, scaleY)), 1.15);

    this.scale = Math.round(newScale * 100) / 100;
    this.paper.scale(this.scale, this.scale);

    const modelCenterX = bbox.x + bbox.width / 2;
    const modelCenterY = bbox.y + bbox.height / 2;

    this.origin = {
      x: containerWidth / 2 - modelCenterX * this.scale,
      y: containerHeight / 2 - modelCenterY * this.scale,
    };
    this.paper.setOrigin(this.origin.x, this.origin.y);

    const zoomBadge = document.getElementById("zoom-percentage");
    if (zoomBadge) zoomBadge.innerText = Math.round(this.scale * 100) + "%";
    this.updateMinimap();
  }

  setupCellInteractions() {
    // Element Pointer Down (Select and optionally toggle Breaker)
    this.paper.on("element:pointerdown", (elementView, evt) => {
      const el = elementView.model;
      const sldData = el.get("sldData") || {};
      const catalog = window.EQUIPMENT_CATALOG[sldData.type] || {};

      // ALWAYS select the cell first
      this.selectCell(el);

      // If clicked on contact blade or with shiftKey on a switch/breaker, toggle OPEN/CLOSED state
      const isBreakerOrSwitch =
        catalog.subCategory === "SWITCH" || sldData.type === "GROUND_SWITCH";

      const targetSel = evt.target
        ? evt.target.getAttribute("data-selector")
        : "";
      const isClickOnBlade =
        targetSel === "blade" ||
        targetSel === "contactPath" ||
        targetSel === "stateBadge" ||
        evt.shiftKey;

      if (isBreakerOrSwitch && isClickOnBlade) {
        const currentState = sldData.state || "CLOSED";
        const newState = currentState === "CLOSED" ? "OPEN" : "CLOSED";
        el.set("sldData", Object.assign({}, sldData, { state: newState }));
        this.topologyTracker.applyStyles(this.paper);
        this.populateProperties(el);
      }
    });

    this.paper.on("link:pointerdown", (linkView) => {
      this.selectCell(linkView.model);
    });
  }

  selectCell(cell) {
    if (!cell) return;
    this.deselectAll();
    this.selectedCell = cell;

    const view = this.paper.findViewByModel(cell);
    if (view && view.el) {
      view.el.classList.add("sld-selected");
    }

    this.populateProperties(cell);
  }

  deselectAll() {
    if (this.selectedCell) {
      const view = this.paper.findViewByModel(this.selectedCell);
      if (view && view.el) {
        view.el.classList.remove("sld-selected");
      }
      this.selectedCell = null;
    }

    // Clean up any stray selection classes
    const selectedDoms = document.querySelectorAll(".sld-selected");
    selectedDoms.forEach((d) => d.classList.remove("sld-selected"));

    this.clearProperties();
  }

  deleteSelected() {
    if (!this.selectedCell) return;

    const targetCell = this.selectedCell;
    const view = this.paper.findViewByModel(targetCell);
    if (view && view.el) {
      view.el.classList.remove("sld-selected");
    }

    this.selectedCell = null;
    targetCell.remove();
    this.clearProperties();
    this.topologyTracker.applyStyles(this.paper);
    this.updateMinimap();
    this.pushHistory();
    this.scheduleAutoSave();
  }

  getPaperPoint(clientX, clientY) {
    if (this.paper && typeof this.paper.clientToLocalPoint === "function") {
      try {
        const pt = this.paper.clientToLocalPoint({ x: clientX, y: clientY });
        if (pt && typeof pt.x === "number" && !isNaN(pt.x)) return pt;
      } catch (err) {}
      try {
        const pt = this.paper.clientToLocalPoint(clientX, clientY);
        if (pt && typeof pt.x === "number" && !isNaN(pt.x)) return pt;
      } catch (err) {}
    }
    const rect = this.container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.origin.x) / this.scale,
      y: (clientY - rect.top - this.origin.y) / this.scale,
    };
  }

  setupPaletteDragDrop() {
    const paletteItems = document.querySelectorAll(".palette-item");
    let isItemDragging = false;

    paletteItems.forEach((item) => {
      item.setAttribute("draggable", "true");

      item.addEventListener("dragstart", (e) => {
        isItemDragging = true;
        const type = item.getAttribute("data-symbol-type");
        e.dataTransfer.setData("text/plain", type);
        e.dataTransfer.setData("text", type);
        e.dataTransfer.effectAllowed = "copy";
        window.__draggedSymbolType = type;
      });

      item.addEventListener("dragend", () => {
        setTimeout(() => {
          isItemDragging = false;
          window.__draggedSymbolType = null;
        }, 150);
      });

      // Click to add at center of visible canvas (only when NOT dragged)
      item.addEventListener("click", (e) => {
        if (isItemDragging) return;
        const type = item.getAttribute("data-symbol-type");
        if (!type) return;
        const rect = this.container.getBoundingClientRect();
        const center = this.getPaperPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        this.createElement(type, center.x - 20, center.y - 20);
      });
    });

    const dropArea =
      document.querySelector(".sld-canvas-wrapper") || this.container;

    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    });

    dropArea.addEventListener("dragenter", (e) => {
      e.preventDefault();
    });

    dropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();

      let type = null;
      if (e.dataTransfer) {
        type =
          e.dataTransfer.getData("text/plain") ||
          e.dataTransfer.getData("text") ||
          e.dataTransfer.getData("text/sld-type");
      }
      if (!type) {
        type = window.__draggedSymbolType;
      }
      if (!type) return;

      const p = this.getPaperPoint(e.clientX, e.clientY);
      this.createElement(type, p.x - 20, p.y - 20);
      window.__draggedSymbolType = null;
    });

    // Palette Search Filter
    const searchInput = document.getElementById("symbol-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase().trim();
        items.forEach((item) => {
          const text = item.innerText.toLowerCase();
          const type = (item.getAttribute("data-type") || "").toLowerCase();
          if (!q || text.includes(q) || type.includes(q)) {
            item.style.display = "flex";
          } else {
            item.style.display = "none";
          }
        });
      });
    }
  }

  createElement(type, x, y) {
    // Prevent duplicate placement within 200ms
    const now = Date.now();
    if (
      this._lastCreated &&
      now - this._lastCreated.time < 200 &&
      this._lastCreated.type === type
    ) {
      return null;
    }
    this._lastCreated = { time: now, type: type };

    const catalog = window.EQUIPMENT_CATALOG[type];
    if (!catalog) {
      console.warn("Unknown symbol type:", type);
      return null;
    }

    const shapeType = catalog.jointType || "standard.Rectangle";
    const shapeName = shapeType.replace("sld.", "");
    let shapeClass = joint.shapes.sld ? joint.shapes.sld[shapeName] : null;
    if (!shapeClass) shapeClass = joint.shapes.standard.Rectangle;

    const defaultProps = Object.assign({}, catalog.defaultProps, {
      type: type,
    });

    // Auto-assign default color based on configured voltage preset
    const itemVoltage = defaultProps.voltage || defaultProps.priVoltage;
    if (
      itemVoltage !== undefined &&
      typeof window.getVoltageColor === "function"
    ) {
      const vColor = window.getVoltageColor(
        itemVoltage,
        defaultProps.voltageUnit || "kV",
      );
      defaultProps.color = vColor;
      defaultProps.lineColor = vColor;
    }

    // Calculate size based on type
    let width = 40;
    let height = 40;
    switch (type) {
      case "BUSBAR":
        width = defaultProps.width || 400;
        height = 12;
        break;
      case "TR_2W":
        width = 44;
        height = 64;
        break;
      case "TR_3W":
        width = 60;
        height = 64;
        break;
      case "CB_ACB":
        width = 30;
        height = 44;
        break;
      case "CB_VCB":
      case "CB_MCCB":
      case "CB_GCB":
        width = 28;
        height = 40;
        break;
      case "DS":
        width = 30;
        height = 40;
        break;
      case "LA":
      case "FUSE":
        width = 32;
        height = 44;
        break;
      case "RELAY":
        width = 38;
        height = 38;
        break;
      case "CT":
        width = 34;
        height = 38;
        break;
      case "PT":
        width = 34;
        height = 44;
        break;
      case "GROUND_SWITCH":
        width = 32;
        height = 44;
        break;
      case "GENERATOR":
        width = 44;
        height = 44;
        break;
      case "MOTOR":
        width = 42;
        height = 42;
        break;
      case "LOAD":
        width = 34;
        height = 36;
        break;
      case "GROUND":
        width = 28;
        height = 28;
        break;
      case "UPS":
        width = 56;
        height = 48;
        break;
      case "RECTIFIER":
        width = 50;
        height = 40;
        break;
      case "BATTERY":
        width = 52;
        height = 34;
        break;
      case "SWITCHGEAR":
        width = 44;
        height = 60;
        break;
      case "PANELBOARD":
        width = 40;
        height = 50;
        break;
      case "JUNCTION":
        width = 12;
        height = 12;
        break;
      case "TEXT_LABEL":
        width = 140;
        height = 26;
        break;
      case "GROUP_BOX":
        width = 440;
        height = 220;
        break;
      case "TRANSMISSION_TOWER":
        width = 56;
        height = 56;
        break;
      default:
        width = 40;
        height = 40;
    }

    // Snap to grid (10px)
    const gridX = Math.round(x / 10) * 10;
    const gridY = Math.round(y / 10) * 10;

    const cell = new shapeClass({
      position: { x: gridX, y: gridY },
      size: { width: width, height: height },
      sldData: defaultProps,
    });

    this.graph.addCell(cell);
    this.selectCell(cell);
    this.topologyTracker.applyStyles(this.paper);
    this.updateMinimap();
    this.scheduleAutoSave();
    return cell;
  }

  setupPropertiesPanel() {
    const bindInput = (id, propKey, isNumber = false) => {
      const input = document.getElementById(id);
      if (!input) return;
      const handler = (e) => {
        if (!this.selectedCell) return;
        const sldData = this.selectedCell.get("sldData") || {};
        let val = e.target.value;
        if (isNumber) val = parseFloat(val) || 0;
        sldData[propKey] = val;

        // When voltage changes, automatically update color to matching voltage preset
        if (
          propKey === "voltage" &&
          typeof window.getVoltageColor === "function"
        ) {
          const autoColor = window.getVoltageColor(
            val,
            sldData.voltageUnit || "kV",
          );
          sldData.color = autoColor;
          sldData.lineColor = autoColor;
          const colorInput = document.getElementById("prop-symbol-color");
          const lineInput = document.getElementById("prop-line-color");
          if (colorInput) colorInput.value = autoColor;
          if (lineInput) lineInput.value = autoColor;
        }

        this.selectedCell.set("sldData", Object.assign({}, sldData));

        // Always trigger symbol-specific visual updates immediately
        if (typeof this.selectedCell.updateFromSldData === "function") {
          this.selectedCell.updateFromSldData();
        }
        if (typeof this.selectedCell.updateVisual === "function") {
          this.selectedCell.updateVisual();
        }
        if (typeof this.selectedCell.updateContactVisual === "function") {
          this.selectedCell.updateContactVisual();
        }

        this.topologyTracker.applyStyles(this.paper);
        this.updateMinimap();
        this.scheduleAutoSave();
      };

      input.addEventListener("input", handler);
      input.addEventListener("change", handler);
    };

    bindInput("prop-name", "name");
    bindInput("prop-desc", "desc");
    bindInput("prop-state", "state");
    bindInput("prop-voltage", "voltage", true);
    bindInput("prop-pri-voltage", "priVoltage", true);
    bindInput("prop-sec-voltage", "secVoltage", true);
    bindInput("prop-tert-voltage", "tertVoltage", true);
    bindInput("prop-connection", "connection");
    bindInput("prop-capacity", "capacity");
    bindInput("prop-current", "current", true);
    bindInput("prop-poles", "poles");
    bindInput("prop-location", "location");
    bindInput("prop-memo", "memo");
    bindInput("prop-symbol-color", "color");
    bindInput("prop-line-color", "lineColor");

    const stateBtns = document.querySelectorAll(".state-toggle-btn");
    stateBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!this.selectedCell) return;
        const targetState = btn.getAttribute("data-state");
        const sldData = this.selectedCell.get("sldData") || {};
        sldData.state = targetState;
        this.selectedCell.set("sldData", Object.assign({}, sldData));

        stateBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const stateSelect = document.getElementById("prop-state");
        if (stateSelect) stateSelect.value = targetState;

        if (typeof this.selectedCell.updateContactVisual === "function") {
          this.selectedCell.updateContactVisual();
        }
        if (typeof this.selectedCell.updateVisual === "function") {
          this.selectedCell.updateVisual();
        }
        this.topologyTracker.applyStyles(this.paper);
        this.populateProperties(this.selectedCell);
        this.updateMinimap();
        this.scheduleAutoSave();
      });
    });

    const delBtn = document.getElementById("btn-delete-element");
    if (delBtn) {
      delBtn.addEventListener("click", () => this.deleteSelected());
    }

    // Color Quick Palette in Property Style Tab
    const paletteColors = document.querySelectorAll(".prop-color-picker");
    paletteColors.forEach((cp) => {
      cp.addEventListener("click", () => {
        const color = cp.getAttribute("data-color");
        if (this.selectedCell) {
          const sldData = this.selectedCell.get("sldData") || {};
          sldData.color = color;
          this.selectedCell.set("sldData", Object.assign({}, sldData));
          const colorInput = document.getElementById("prop-symbol-color");
          if (colorInput) colorInput.value = color;
          this.topologyTracker.applyStyles(this.paper);
        }
      });
    });
  }

  populateProperties(cell) {
    if (!cell) return;
    const sldData = cell.get("sldData") || {};
    const catalog = window.EQUIPMENT_CATALOG[sldData.type] || {};

    const setValue = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : "";
    };

    const isTransformer = sldData.type === "TR_2W" || sldData.type === "TR_3W";
    const groupConn = document.getElementById("group-prop-connection");
    const groupCap = document.getElementById("group-prop-capacity");
    const groupVolt = document.getElementById("group-prop-voltage");
    const groupTrVolt = document.getElementById("group-prop-tr-voltages");
    const groupTertVolt = document.getElementById("group-prop-tert-voltage");

    if (groupConn) groupConn.style.display = isTransformer ? "block" : "none";
    if (groupCap) groupCap.style.display = isTransformer ? "block" : "none";
    if (groupVolt) groupVolt.style.display = isTransformer ? "none" : "block";
    if (groupTrVolt)
      groupTrVolt.style.display = isTransformer ? "block" : "none";
    if (groupTertVolt) {
      groupTertVolt.style.display =
        sldData.type === "TR_3W" ||
        (sldData.connection && sldData.connection.includes("3권선"))
          ? "block"
          : "none";
    }

    let defConn = "Δ-Y";
    if (sldData.type === "TR_3W") defConn = "Y-Y-Δ";
    else if (sldData.priVoltage === 154 || sldData.voltage === 154)
      defConn = "Y-Δ";

    const curState = (sldData.state || "LIVE").toUpperCase();
    const mappedState =
      curState === "CLOSED" ? "LIVE" : curState === "OPEN" ? "DEAD" : curState;

    const stateBtns = document.querySelectorAll(".state-toggle-btn");
    stateBtns.forEach((b) => {
      const bState = b.getAttribute("data-state");
      b.classList.toggle("active", bState === mappedState);
    });

    setValue("prop-name", sldData.name || catalog.nameKo || "설비");
    setValue("prop-desc", sldData.desc || catalog.descKo || "");
    setValue("prop-state", mappedState);
    setValue("prop-voltage", sldData.voltage || sldData.priVoltage || "");
    setValue(
      "prop-pri-voltage",
      sldData.priVoltage !== undefined
        ? sldData.priVoltage
        : sldData.voltage || 154,
    );
    setValue(
      "prop-sec-voltage",
      sldData.secVoltage !== undefined ? sldData.secVoltage : 22.9,
    );
    setValue(
      "prop-tert-voltage",
      sldData.tertVoltage !== undefined ? sldData.tertVoltage : 6.6,
    );
    setValue("prop-connection", sldData.connection || defConn);
    setValue("prop-capacity", sldData.capacity || "");
    setValue("prop-current", sldData.current || "");
    setValue("prop-poles", sldData.poles || "3P");
    setValue("prop-location", sldData.location || "");
    setValue("prop-symbol-color", sldData.color || "#377DFF");
    setValue(
      "prop-line-color",
      sldData.lineColor || sldData.color || "#377DFF",
    );
    setValue("prop-memo", sldData.memo || "");

    // Update Tab 3 (Telemetry / Real-time data)
    const vEl = document.getElementById("telemetry-v");
    const iEl = document.getElementById("telemetry-i");
    const pEl = document.getElementById("telemetry-p");
    const statusBadge = document.getElementById("telemetry-status-badge");

    const isLive = mappedState === "LIVE";
    const isGrounded = mappedState === "GROUNDED";
    if (vEl) vEl.innerText = (isLive ? sldData.voltage || 22.9 : 0) + " kV";
    if (iEl) iEl.innerText = (isLive ? sldData.current || 240 : 0) + " A";
    if (pEl)
      pEl.innerText = isLive
        ? Math.round(
            ((sldData.voltage || 22.9) * (sldData.current || 240) * 1.732) /
              100,
          ) /
            10 +
          " MW"
        : "0.0 MW";
    if (statusBadge) {
      if (isLive) {
        statusBadge.innerText = "⚡ 활선 (LIVE)";
        statusBadge.className = "telemetry-badge-live";
      } else if (isGrounded) {
        statusBadge.innerText = "⏚ 접지 (GROUNDED)";
        statusBadge.className = "telemetry-badge-grounded";
      } else {
        statusBadge.innerText = "⚪ 사선 (DEAD)";
        statusBadge.className = "telemetry-badge-dead";
      }
    }
  }

  clearProperties() {
    const ids = [
      "prop-name",
      "prop-desc",
      "prop-voltage",
      "prop-current",
      "prop-memo",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  }

  setupToolbar() {
    // Zoom buttons
    const btnZoomIn = document.getElementById("btn-zoom-in");
    const btnZoomOut = document.getElementById("btn-zoom-out");
    const btnZoomFit = document.getElementById("btn-zoom-fit");

    if (btnZoomIn) btnZoomIn.addEventListener("click", () => this.zoom(0.1));
    if (btnZoomOut) btnZoomOut.addEventListener("click", () => this.zoom(-0.1));
    if (btnZoomFit)
      btnZoomFit.addEventListener("click", () => this.zoomToFit());

    // Tool selection buttons
    const toolBtns = document.querySelectorAll(".tool-btn[data-tool]");
    toolBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        toolBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeTool = btn.getAttribute("data-tool");
      });
    });

    // Toolbar Delete button
    const btnDeleteToolbar = document.getElementById("btn-delete-toolbar");
    if (btnDeleteToolbar) {
      btnDeleteToolbar.addEventListener("click", () => this.deleteSelected());
    }

    // Save & Export buttons
    const btnSave = document.getElementById("btn-save-project");
    if (btnSave) btnSave.addEventListener("click", () => this.saveDiagram());

    const btnExportSvg = document.getElementById("btn-export-svg");
    const btnExportPng = document.getElementById("btn-export-png");
    const btnExportJson = document.getElementById("btn-export-json");

    if (btnExportSvg)
      btnExportSvg.addEventListener("click", () => SLDExport.toSVG(this.paper));
    if (btnExportPng)
      btnExportPng.addEventListener("click", () => SLDExport.toPNG(this.paper));
    if (btnExportJson)
      btnExportJson.addEventListener("click", () =>
        SLDExport.toJSON(this.graph, { id: this.options.diagramId }),
      );

    // Grid & Snap toggles
    const snapToggle = document.getElementById("status-snap-toggle");
    if (snapToggle) {
      snapToggle.addEventListener("click", () => {
        this.options.snapToGrid = !this.options.snapToGrid;
        snapToggle.innerText = this.options.snapToGrid
          ? "스냅: 켜짐"
          : "스냅: 꺼짐";
        snapToggle.classList.toggle("active", this.options.snapToGrid);
      });
    }
  }

  setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      if (e.key === "Delete" || e.key === "Backspace") {
        this.deleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        this.undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.shiftKey && e.key === "Z"))
      ) {
        e.preventDefault();
        this.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        this.saveDiagram();
      }
    });
  }

  pushHistory() {
    if (!this.isHistoryTracking) return;
    const json = this.graph.toJSON();
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(JSON.stringify(json));
    this.historyIndex++;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.isHistoryTracking = false;
      this.graph.fromJSON(JSON.parse(this.history[this.historyIndex]));
      this.topologyTracker.applyStyles(this.paper);
      this.isHistoryTracking = true;
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.isHistoryTracking = false;
      this.graph.fromJSON(JSON.parse(this.history[this.historyIndex]));
      this.topologyTracker.applyStyles(this.paper);
      this.isHistoryTracking = true;
    }
  }

  loadDiagram(diagramId) {
    try {
      localStorage.removeItem("sld_diagram_" + diagramId);
      localStorage.removeItem("sld_diagram_v1_" + diagramId);
      localStorage.removeItem("sld_diagram_v2_" + diagramId);
      localStorage.removeItem("sld_diagram_v3_" + diagramId);
    } catch (e) {}

    const cacheKey = "sld_diagram_v4_" + diagramId;

    fetch("/api/sld/" + diagramId + "/")
      .then((res) => {
        if (!res.ok) throw new Error("API not available");
        return res.json();
      })
      .then((data) => {
        if (
          data.schema_data &&
          data.schema_data.cells &&
          data.schema_data.cells.length > 0
        ) {
          this.applyLoadedSchema(data.schema_data);
        } else if (window.DEFAULT_SLD_SCHEMA) {
          this.applyLoadedSchema(window.DEFAULT_SLD_SCHEMA);
        }
      })
      .catch(() => {
        console.info(
          "Static mode or offline: loading from LocalStorage or default schema",
        );
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const schema = JSON.parse(cached);
            if (schema && schema.cells && schema.cells.length > 0) {
              this.applyLoadedSchema(schema);
              this.startStaticTelemetrySimulation();
              return;
            }
          } catch (e) {}
        }
        if (window.DEFAULT_SLD_SCHEMA) {
          this.applyLoadedSchema(window.DEFAULT_SLD_SCHEMA);
        } else {
          fetch("./static/data/default_schema.json")
            .then((r) => r.json())
            .then((schema) => this.applyLoadedSchema(schema))
            .catch(() => {});
        }
        this.startStaticTelemetrySimulation();
      });
  }

  applyLoadedSchema(schema) {
    if (schema && schema.cells) {
      schema.cells.forEach((cell) => {
        if (cell.type === "standard.Link" || cell.type === "link") {
          cell.router = { name: "sldOrthogonal" };
          cell.connector = { name: "normal" };
        }
      });
    }
    this.isHistoryTracking = false;
    this.graph.fromJSON(schema);
    this.topologyTracker.applyStyles(this.paper);
    this.isHistoryTracking = true;
    this.pushHistory();
    this.updateMinimap();
    this.zoomToFit();
    setTimeout(() => this.zoomToFit(), 100);
    setTimeout(() => this.zoomToFit(), 400);
  }

  startStaticTelemetrySimulation() {
    if (this._telemetrySimTimer) return;
    const updateValues = () => {
      const vEl = document.getElementById("telemetry-v");
      const iEl = document.getElementById("telemetry-i");
      const pEl = document.getElementById("telemetry-p");
      const freq = (59.98 + Math.random() * 0.04).toFixed(2);
      const mw = (18.2 + (Math.random() - 0.5) * 0.6).toFixed(1);
      const pf = (97.2 + (Math.random() - 0.5) * 0.4).toFixed(1);
      const curr = Math.round(480 + (Math.random() - 0.5) * 20);

      const statusFreq = document.getElementById("status-freq");
      const statusP = document.getElementById("status-total-p");
      const statusPf = document.getElementById("status-pf");
      if (statusFreq) statusFreq.innerText = "주파수: " + freq + " Hz";
      if (statusP) statusP.innerText = "유효전력: " + mw + " MW";
      if (statusPf) statusPf.innerText = "역률: " + pf + "%";

      if (this.selectedCell) {
        const sldData = this.selectedCell.get("sldData") || {};
        if (vEl) vEl.innerText = (sldData.voltage || 22.9) + " kV";
        if (iEl) iEl.innerText = (sldData.current || curr) + " A";
        if (pEl)
          pEl.innerText =
            (sldData.voltage ? Math.round(sldData.voltage * 0.8) : 18.5) +
            " MW";
      }
    };
    updateValues();
    this._telemetrySimTimer = setInterval(updateValues, 10000);
  }

  saveDiagram() {
    const schemaData = this.graph.toJSON();
    const data = {
      schema_data: schemaData,
    };

    try {
      localStorage.setItem(
        "sld_diagram_v4_" + this.options.diagramId,
        JSON.stringify(schemaData),
      );
    } catch (e) {}

    const csrfToken =
      document.querySelector("[name=csrfmiddlewaretoken]")?.value || "";

    fetch("/api/sld/" + this.options.diagramId + "/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify(data),
    })
      .then((res) => {
        if (!res.ok) throw new Error("API unavailable");
        return res.json();
      })
      .then(() => {
        const autoSaveBadge = document.getElementById("auto-save-status");
        if (autoSaveBadge) {
          const now = new Date();
          const timeStr = now.toTimeString().split(" ")[0];
          autoSaveBadge.innerHTML =
            "☁️ 서버 저장 완료 " +
            timeStr +
            ' <span style="color:#52c41a">✓</span>';
        }
      })
      .catch(() => {
        const autoSaveBadge = document.getElementById("auto-save-status");
        if (autoSaveBadge) {
          const now = new Date();
          const timeStr = now.toTimeString().split(" ")[0];
          autoSaveBadge.innerHTML =
            "💾 로컬 저장 완료 " +
            timeStr +
            ' <span style="color:#52c41a">✓</span>';
        }
      });
  }

  scheduleAutoSave() {
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.saveDiagram();
    }, 5000);
  }

  initMinimap() {
    const boxContainer = document.getElementById("minimap-box-container");
    if (!boxContainer) return;

    let isMinimapDragging = false;

    const handleMinimapNav = (e) => {
      const rect = boxContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      if (!this._minimapBounds || !this._minimapScale) return;

      // Convert minimap coordinates to paper coordinates
      const targetPaperX = this._minimapBounds.x + clickX / this._minimapScale;
      const targetPaperY = this._minimapBounds.y + clickY / this._minimapScale;

      // Center viewport around targetPaperX, targetPaperY
      const viewportWidth = this.container.clientWidth / this.scale;
      const viewportHeight = this.container.clientHeight / this.scale;

      this.origin.x = -(targetPaperX - viewportWidth / 2) * this.scale;
      this.origin.y = -(targetPaperY - viewportHeight / 2) * this.scale;
      this.paper.setOrigin(this.origin.x, this.origin.y);
      this.updateMinimap();
    };

    boxContainer.addEventListener("mousedown", (e) => {
      isMinimapDragging = true;
      handleMinimapNav(e);
    });

    window.addEventListener("mousemove", (e) => {
      if (isMinimapDragging) {
        handleMinimapNav(e);
      }
    });

    window.addEventListener("mouseup", () => {
      isMinimapDragging = false;
    });

    this.updateMinimap();
  }

  updateMinimap() {
    const minimapContent = document.getElementById("minimap-content");
    const viewportBox = document.getElementById("minimap-viewport");
    if (!minimapContent || !viewportBox || !this.graph) return;

    const elements = this.graph.getElements();
    const links = this.graph.getLinks();

    if (elements.length === 0 && links.length === 0) {
      minimapContent.innerHTML = "";
      viewportBox.setAttribute("width", "0");
      return;
    }

    // Calculate bounding box of all elements in the diagram
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    elements.forEach((el) => {
      const pos = el.position();
      const size = el.size();
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + size.width > maxX) maxX = pos.x + size.width;
      if (pos.y + size.height > maxY) maxY = pos.y + size.height;
    });

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 1200;
      maxY = 800;
    }

    const padding = 50;
    const bounds = {
      x: minX - padding,
      y: minY - padding,
      width: Math.max(900, maxX - minX + padding * 2),
      height: Math.max(600, maxY - minY + padding * 2),
    };

    const mmW = 200;
    const mmH = 90;
    const scaleX = mmW / bounds.width;
    const scaleY = mmH / bounds.height;
    const mmScale = Math.min(scaleX, scaleY);

    this._minimapBounds = bounds;
    this._minimapScale = mmScale;

    // Render miniature SVG shapes
    let svgHtml = "";

    // 1. Render Links
    links.forEach((link) => {
      const src = link.get("source");
      const tgt = link.get("target");
      if (!src || !src.id || !tgt || !tgt.id) return;

      const srcEl = this.graph.getCell(src.id);
      const tgtEl = this.graph.getCell(tgt.id);
      if (!srcEl || !tgtEl) return;

      const sp = srcEl.position();
      const ss = srcEl.size();
      const tp = tgtEl.position();
      const ts = tgtEl.size();

      const x1 = (sp.x + ss.width / 2 - bounds.x) * mmScale;
      const y1 = (sp.y + ss.height / 2 - bounds.y) * mmScale;
      const x2 = (tp.x + ts.width / 2 - bounds.x) * mmScale;
      const y2 = (tp.y + ts.height / 2 - bounds.y) * mmScale;

      const strokeColor = link.attr("line/stroke") || "#377DFF";
      svgHtml += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${strokeColor}" stroke-width="1" opacity="0.6" />`;
    });

    // 2. Render Elements
    elements.forEach((el) => {
      const pos = el.position();
      const size = el.size();
      const sldData = el.get("sldData") || {};
      const type = sldData.type || "";
      const color = sldData.color || "#377DFF";

      const x = (pos.x - bounds.x) * mmScale;
      const y = (pos.y - bounds.y) * mmScale;
      const w = Math.max(2, size.width * mmScale);
      const h = Math.max(2, size.height * mmScale);

      if (type === "BUSBAR") {
        svgHtml += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(2.5, h).toFixed(1)}" rx="1" fill="${color}" />`;
      } else if (type === "TR_2W" || type === "TR_3W") {
        const r = Math.max(1.5, w * 0.35);
        svgHtml += `<circle cx="${(x + w / 2).toFixed(1)}" cy="${(y + h * 0.35).toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="1" /><circle cx="${(x + w / 2).toFixed(1)}" cy="${(y + h * 0.65).toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="1" />`;
      } else if (type === "GENERATOR" || type === "MOTOR") {
        svgHtml += `<circle cx="${(x + w / 2).toFixed(1)}" cy="${(y + h / 2).toFixed(1)}" r="${(w / 2).toFixed(1)}" fill="#ffffff" stroke="${color}" stroke-width="1" />`;
      } else if (type === "GROUP_BOX") {
        svgHtml += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="rgba(55,125,255,0.06)" stroke="#377DFF" stroke-width="0.8" stroke-dasharray="2,1" />`;
      } else if (type === "TEXT_LABEL") {
        // Skip text labels or render faint bar
      } else {
        // Breakers, Switches, Loads, Batteries, UPS, Transmission Tower, etc.
        svgHtml += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${color}" stroke="${color}" stroke-width="0.5" />`;
      }
    });

    minimapContent.innerHTML = svgHtml;

    // 3. Update Viewport Rectangle
    const vpW = (this.container.clientWidth / this.scale) * mmScale;
    const vpH = (this.container.clientHeight / this.scale) * mmScale;
    const vpX = (-this.origin.x / this.scale - bounds.x) * mmScale;
    const vpY = (-this.origin.y / this.scale - bounds.y) * mmScale;

    viewportBox.setAttribute("x", Math.max(0, vpX).toFixed(1));
    viewportBox.setAttribute("y", Math.max(0, vpY).toFixed(1));
    viewportBox.setAttribute(
      "width",
      Math.max(6, Math.min(mmW, vpW)).toFixed(1),
    );
    viewportBox.setAttribute(
      "height",
      Math.max(6, Math.min(mmH, vpH)).toFixed(1),
    );
  }

  setupVoltageColorsModal() {
    const modal = document.getElementById("modal-voltage-colors");
    const openBtn = document.getElementById("btn-voltage-colors-modal");
    const closeBtn = document.getElementById("btn-close-voltage-modal");
    const cancelBtn = document.getElementById("btn-cancel-voltage-colors");
    const saveBtn = document.getElementById("btn-save-voltage-colors");
    const resetBtn = document.getElementById("btn-reset-voltage-colors");
    const listContainer = document.getElementById("voltage-color-list");

    if (!modal) return;

    const renderList = () => {
      if (!listContainer) return;
      const presets =
        window.VOLTAGE_PRESETS || window.DEFAULT_VOLTAGE_PRESETS || {};
      listContainer.innerHTML = "";

      Object.keys(presets).forEach((key) => {
        const item = presets[key];
        const row = document.createElement("div");
        row.className = "voltage-color-row";
        row.style.cssText =
          "display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; gap:12px;";

        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <div class="voltage-color-preview" id="preview-${key}" style="width:24px; height:24px; border-radius:6px; background:${item.color}; border:2px solid #ffffff; box-shadow:0 0 0 1px #cbd5e1; flex-shrink:0;"></div>
            <div>
              <div style="font-weight:700; font-size:13px; color:#1e293b;">${item.label || item.name}</div>
              <div style="font-size:11px; color:#64748b;">기준: ${item.name} (${item.value} ${item.unit})</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="color" class="voltage-color-input" data-key="${key}" value="${item.color}" style="width:36px; height:32px; padding:0; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; background:#fff;">
            <input type="text" class="sld-input voltage-hex-input" data-key="${key}" value="${item.color}" style="width:80px; font-family:monospace; font-size:11px; text-transform:uppercase; text-align:center;">
          </div>
        `;

        const colorInput = row.querySelector(".voltage-color-input");
        const hexInput = row.querySelector(".voltage-hex-input");
        const preview = row.querySelector(".voltage-color-preview");

        colorInput.addEventListener("input", (e) => {
          hexInput.value = e.target.value.toUpperCase();
          preview.style.background = e.target.value;
        });

        hexInput.addEventListener("input", (e) => {
          let v = e.target.value;
          if (!v.startsWith("#")) v = "#" + v;
          if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
            colorInput.value = v;
            preview.style.background = v;
          }
        });

        listContainer.appendChild(row);
      });
    };

    if (openBtn) {
      openBtn.addEventListener("click", () => {
        renderList();
        modal.style.display = "flex";
      });
    }

    const closeModal = () => {
      modal.style.display = "none";
    };

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const colorInputs = modal.querySelectorAll(".voltage-color-input");
        const newColorMap = {};
        colorInputs.forEach((inp) => {
          const key = inp.getAttribute("data-key");
          newColorMap[key] = inp.value;
        });

        if (typeof window.saveVoltageColors === "function") {
          window.saveVoltageColors(newColorMap);
        }
        this.applyVoltageColorsToAllElements();
        closeModal();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (confirm("전압별 색상을 기본 표준 설정으로 복원하시겠습니까?")) {
          if (typeof window.resetVoltageColors === "function") {
            window.resetVoltageColors();
          }
          renderList();
          this.applyVoltageColorsToAllElements();
        }
      });
    }
  }

  applyVoltageColorsToAllElements() {
    this.graph.getElements().forEach((el) => {
      const sldData = el.get("sldData") || {};
      const v = sldData.voltage || sldData.priVoltage;
      if (v !== undefined && typeof window.getVoltageColor === "function") {
        const newColor = window.getVoltageColor(v, sldData.voltageUnit || "kV");
        sldData.color = newColor;
        sldData.lineColor = newColor;
        el.set("sldData", Object.assign({}, sldData));

        if (typeof el.updateVisual === "function") el.updateVisual();
        if (typeof el.updateContactVisual === "function")
          el.updateContactVisual();
        if (typeof el.updateFromSldData === "function") el.updateFromSldData();
      }
    });

    this.graph.getLinks().forEach((link) => {
      const srcEl = this.graph.getCell(link.get("source").id);
      if (srcEl) {
        const sldData = srcEl.get("sldData") || {};
        const v = sldData.voltage || sldData.priVoltage;
        if (v !== undefined && typeof window.getVoltageColor === "function") {
          const newColor = window.getVoltageColor(
            v,
            sldData.voltageUnit || "kV",
          );
          link.attr("line/stroke", newColor);
        }
      }
    });

    this.topologyTracker.applyStyles(this.paper);
    this.updateMinimap();
    this.scheduleAutoSave();
  }
}

window.SLDEditor = SLDEditor;
