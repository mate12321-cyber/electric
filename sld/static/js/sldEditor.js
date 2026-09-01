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

    this.paper = new joint.dia.Paper({
      el: this.container,
      model: this.graph,
      width: "100%",
      height: "100%",
      gridSize: this.options.gridSize,
      drawGrid: { name: "dot", args: { color: "#cbd5e1", thickness: 1 } },
      snapLinks: { radius: 20 },
      linkPinning: false,
      markAvailable: true,
      defaultLink: new joint.shapes.standard.Link({
        router: { name: "manhattan", args: { step: 10, padding: 10 } },
        connector: { name: "rounded", args: { radius: 4 } },
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
    const bbox = this.paper.getContentBBox();
    if (bbox.width === 0 || bbox.height === 0) return;

    const rect = this.container.getBoundingClientRect();
    const padding = 60;
    const scaleX = (rect.width - padding * 2) / bbox.width;
    const scaleY = (rect.height - padding * 2) / bbox.height;
    const newScale = Math.min(Math.max(0.4, Math.min(scaleX, scaleY)), 1.5);

    this.scale = Math.round(newScale * 10) / 10;
    this.paper.scale(this.scale, this.scale);

    const centerX = rect.width / 2 - (bbox.x + bbox.width / 2) * this.scale;
    const centerY = rect.height / 2 - (bbox.y + bbox.height / 2) * this.scale;
    this.origin = { x: centerX, y: centerY };
    this.paper.setOrigin(this.origin.x, this.origin.y);

    const zoomBadge = document.getElementById("zoom-percentage");
    if (zoomBadge) zoomBadge.innerText = Math.round(this.scale * 100) + "%";
    this.updateMinimap();
  }

  setupCellInteractions() {
    // Element Pointer Down (Select or Breaker Toggle)
    this.paper.on("element:pointerdown", (elementView, evt) => {
      const el = elementView.model;
      const sldData = el.get("sldData") || {};
      const catalog = window.EQUIPMENT_CATALOG[sldData.type] || {};

      // If clicked on contact blade or breaker box, toggle OPEN/CLOSED state
      const targetTag = evt.target.tagName
        ? evt.target.tagName.toLowerCase()
        : "";
      const isBreakerOrSwitch =
        catalog.subCategory === "SWITCH" || sldData.type === "GROUND_SWITCH";

      if (
        isBreakerOrSwitch &&
        (evt.target.getAttribute("cursor") === "pointer" || evt.shiftKey)
      ) {
        const currentState = sldData.state || "CLOSED";
        const newState = currentState === "CLOSED" ? "OPEN" : "CLOSED";
        el.set("sldData", Object.assign({}, sldData, { state: newState }));
        this.topologyTracker.applyStyles(this.paper);
        this.populateProperties(el);
        return;
      }

      this.selectCell(el);
    });

    this.paper.on("link:pointerdown", (linkView) => {
      this.selectCell(linkView.model);
    });
  }

  selectCell(cell) {
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
    this.clearProperties();
  }

  deleteSelected() {
    if (this.selectedCell) {
      this.selectedCell.remove();
      this.deselectAll();
      this.topologyTracker.applyStyles(this.paper);
    }
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
    paletteItems.forEach((item) => {
      item.setAttribute("draggable", "true");

      item.addEventListener("dragstart", (e) => {
        const type = item.getAttribute("data-symbol-type");
        e.dataTransfer.setData("text/plain", type);
        e.dataTransfer.setData("text", type);
        e.dataTransfer.effectAllowed = "copy";
        window.__draggedSymbolType = type;
      });

      item.addEventListener("dragend", () => {
        window.__draggedSymbolType = null;
      });

      // Click to add at center of visible canvas
      item.addEventListener("click", () => {
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

    const canvasWrapper = document.querySelector(".sld-canvas-wrapper");
    const dropTargets = [canvasWrapper, this.container, this.paper.el].filter(
      Boolean,
    );

    dropTargets.forEach((target) => {
      target.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = "copy";
        }
      });

      target.addEventListener("dragenter", (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = "copy";
        }
      });

      target.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();

        let type = null;
        if (e.dataTransfer) {
          type =
            e.dataTransfer.getData("text/plain") ||
            e.dataTransfer.getData("text");
        }
        if (!type) {
          type = window.__draggedSymbolType;
        }
        if (!type) return;

        const p = this.getPaperPoint(e.clientX, e.clientY);
        this.createElement(type, p.x - 20, p.y - 20);
        window.__draggedSymbolType = null;
      });
    });
  }

  createElement(type, x, y) {
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
        width = 56;
        height = 60;
        break;
      case "CB_ACB":
      case "CB_VCB":
      case "CB_MCCB":
      case "CB_GCB":
        width = 36;
        height = 44;
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
        break;
    }

    const element = new shapeClass({
      position: { x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 },
      size: { width: width, height: height },
      sldData: defaultProps,
    });

    this.graph.addCell(element);
    this.selectCell(element);
    this.topologyTracker.applyStyles(this.paper);
    return element;
  }

  setupPropertiesPanel() {
    const bindInput = (id, propKey, isNumber = false) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener("input", (e) => {
        if (!this.selectedCell) return;
        const sldData = this.selectedCell.get("sldData") || {};
        let val = e.target.value;
        if (isNumber) val = parseFloat(val) || 0;
        sldData[propKey] = val;
        this.selectedCell.set("sldData", Object.assign({}, sldData));

        // Update JointJS labels if name changed
        if (propKey === "name" || propKey === "color") {
          if (typeof this.selectedCell.updateFromSldData === "function") {
            this.selectedCell.updateFromSldData();
          } else if (typeof this.selectedCell.updateVisual === "function") {
            this.selectedCell.updateVisual();
          } else if (
            typeof this.selectedCell.updateContactVisual === "function"
          ) {
            this.selectedCell.updateContactVisual();
          }
        }
        this.topologyTracker.applyStyles(this.paper);
      });
    };

    bindInput("prop-name", "name");
    bindInput("prop-desc", "desc");
    bindInput("prop-voltage", "voltage", true);
    bindInput("prop-current", "current", true);
    bindInput("prop-poles", "poles");
    bindInput("prop-location", "location");
    bindInput("prop-memo", "memo");
    bindInput("prop-symbol-color", "color");
    bindInput("prop-line-color", "lineColor");

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

    setValue("prop-name", sldData.name || catalog.nameKo || "설비");
    setValue("prop-desc", sldData.desc || catalog.descKo || "");
    setValue("prop-voltage", sldData.voltage || sldData.priVoltage || "");
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

    const isLive = sldData.state !== "OPEN";
    if (vEl) vEl.innerText = (sldData.voltage || 22.9) + " kV";
    if (iEl) iEl.innerText = (sldData.current || 240) + " A";
    if (pEl)
      pEl.innerText =
        Math.round(
          ((sldData.voltage || 22.9) * (sldData.current || 240) * 1.732) / 100,
        ) /
          10 +
        " MW";
    if (statusBadge) {
      statusBadge.innerText = isLive ? "정상 통전 (LIVE)" : "차단 (OPEN)";
      statusBadge.className = isLive
        ? "telemetry-badge-live"
        : "telemetry-badge-open";
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
    fetch("/api/sld/" + diagramId + "/")
      .then((res) => res.json())
      .then((data) => {
        if (data.schema_data && data.schema_data.cells) {
          this.isHistoryTracking = false;
          this.graph.fromJSON(data.schema_data);
          this.topologyTracker.applyStyles(this.paper);
          this.isHistoryTracking = true;
          this.pushHistory();
          setTimeout(() => this.zoomToFit(), 100);
        }
      })
      .catch((err) => {
        console.warn(
          "Failed to load diagram from API, loading fallback default",
          err,
        );
      });
  }

  saveDiagram() {
    const data = {
      schema_data: this.graph.toJSON(),
    };

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
      .then((res) => res.json())
      .then((res) => {
        const autoSaveBadge = document.getElementById("auto-save-status");
        if (autoSaveBadge) {
          const now = new Date();
          const timeStr = now.toTimeString().split(" ")[0];
          autoSaveBadge.innerHTML =
            "☁️ 저장 완료 " + timeStr + ' <span style="color:#52c41a">✓</span>';
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
}

window.SLDEditor = SLDEditor;
