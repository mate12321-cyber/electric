// Install Port-Aware Real-time Drag Snapping on JointJS ElementView
(function () {
  if (typeof joint !== "undefined" && joint.dia && joint.dia.ElementView) {
    joint.dia.ElementView.prototype.drag = function (evt, x, y) {
      const paper = this.paper;
      const gridSize = (paper && paper.options.gridSize) || 10;
      const model = this.model;
      const eventData = this.eventData(evt);
      const pointerOffset = eventData.pointerOffset || { x: 0, y: 0 };
      const restrictedArea = eventData.restrictedArea;
      let embedding = eventData.embedding;

      let snapOffset = { x: 0, y: 0 };
      if (
        window.sldEditor &&
        typeof window.sldEditor.getPrimaryPortOffset === "function"
      ) {
        const sldData = model.get("sldData") || {};
        const size = model.size();
        snapOffset = window.sldEditor.getPrimaryPortOffset(
          sldData.type,
          size.width,
          size.height,
          model,
        );
      } else if (
        typeof SLDEditor !== "undefined" &&
        typeof SLDEditor.prototype.getPrimaryPortOffset === "function"
      ) {
        const sldData = model.get("sldData") || {};
        const size = model.size();
        snapOffset = SLDEditor.prototype.getPrimaryPortOffset(
          sldData.type,
          size.width,
          size.height,
          model,
        );
      }

      const rawX = x + pointerOffset.x;
      const rawY = y + pointerOffset.y;

      const candidatePortX = rawX + snapOffset.x;
      const candidatePortY = rawY + snapOffset.y;

      const snappedPortX = Math.round(candidatePortX / gridSize) * gridSize;
      const snappedPortY = Math.round(candidatePortY / gridSize) * gridSize;

      const u = snappedPortX - snapOffset.x;
      const h = snappedPortY - snapOffset.y;

      model.position(u, h, {
        restrictedArea: restrictedArea,
        deep: true,
        ui: true,
      });

      if (paper.options.embeddingMode) {
        if (!embedding) {
          this.prepareEmbedding(eventData);
          embedding = true;
        }
        this.processEmbedding(eventData, evt, x, y);
      }
      this.eventData(evt, { embedding: embedding });
    };
  }
})();

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
    this.isSpacePressed = false;
    this.activeTool = "select"; // 'select' | 'lasso' | 'wire' | 'busbar' | 'pen' | 'text' | 'group'
    this.selectedCells = [];
    this.selectedCell = null;
    this.isAreaSelecting = false;
    this.areaSelectStart = { x: 0, y: 0 };
    this._clipboard = null;
    this._activeDrawingLink = null;
    this._wireSource = null;
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
      defaultLink: (cellView, magnet) => {
        let strokeColor = "#377DFF";
        if (cellView && cellView.model && this.topologyTracker) {
          strokeColor = this.topologyTracker.getElementVoltageColor(
            cellView.model,
          );
        }
        return new joint.shapes.standard.Link({
          router: { name: "sldOrthogonal" },
          connector: { name: "normal" },
          attrs: {
            line: {
              stroke: strokeColor,
              strokeWidth: 2.5,
              strokeDasharray: "none",
              class: "link-live",
              targetMarker: { type: "none" },
            },
          },
        });
      },
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
    window.addEventListener("keydown", (e) => {
      if (
        e.code === "Space" &&
        e.target.tagName !== "INPUT" &&
        e.target.tagName !== "TEXTAREA"
      ) {
        if (!this.selectedCells || this.selectedCells.length === 0) {
          this.isSpacePressed = true;
          paperEl.style.cursor = "grab";
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        this.isSpacePressed = false;
        if (!this.isPanning) {
          paperEl.style.cursor = "default";
        }
      }
    });

    // Mouse Move -> Status Coordinates & Pan Drag & Area Selection Drag
    paperEl.addEventListener("mousemove", (e) => {
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
      } else if (this.isAreaSelecting) {
        this.updateAreaSelection(e.clientX, e.clientY);
      }
    });

    // Mousedown -> Pan Start or Area Selection Start
    paperEl.addEventListener("mousedown", (e) => {
      const isPanTrigger =
        e.button === 2 ||
        e.button === 1 ||
        this.isSpacePressed ||
        this.activeTool === "pan";

      if (isPanTrigger) {
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
        this._panOriginStart = { x: e.clientX, y: e.clientY };
        paperEl.style.cursor = "grabbing";
        return;
      }

      if (e.button === 0) {
        const isSvgTarget =
          e.target.tagName === "svg" ||
          e.target.classList.contains("joint-paper") ||
          e.target.classList.contains("joint-paper-background") ||
          e.target.classList.contains("joint-paper-grid") ||
          e.target.tagName === "DIV";

        if (isSvgTarget) {
          if (this.activeTool === "lasso") {
            // Lasso / Area Selection Tool: start rubberband multi-selection box
            if (!e.shiftKey) {
              this.deselectAll();
            }
            this.startAreaSelection(e.clientX, e.clientY);
          } else if (this.activeTool === "select") {
            // Select Tool: empty canvas drag PANs the screen (화면 이동)
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            this._panOriginStart = { x: e.clientX, y: e.clientY };
            paperEl.style.cursor = "grabbing";
          }
        }
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        paperEl.style.cursor = this.isSpacePressed ? "grab" : "default";

        // If in 'select' mode and user just clicked on empty canvas without moving (< 4px), deselect
        if (this._panOriginStart) {
          const dist = Math.hypot(
            e.clientX - this._panOriginStart.x,
            e.clientY - this._panOriginStart.y,
          );
          if (dist < 4 && this.activeTool === "select" && !e.shiftKey) {
            this.deselectAll();
          }
          this._panOriginStart = null;
        }
      }
      if (this.isAreaSelecting) {
        this.finishAreaSelection(e.clientX, e.clientY, e.shiftKey);
      }
      if (this._isDraggingElement) {
        this._isDraggingElement = false;
        if (this._cleanupPivotDrag) {
          this._cleanupPivotDrag();
          this._cleanupPivotDrag = null;
        }
        this.topologyTracker.applyStyles(this.paper);
        this.updateSelectionOverlay();
        this.updateMinimap();
        this.pushHistory();
        this.scheduleAutoSave();
      }

      // Check if user was dragging a wire and dropped it over an existing wire line (T-Junction)
      const srcInfo =
        (this._activeDrawingLink && this._activeDrawingLink.get("source")) ||
        this._lastDrawingSource ||
        (this._pendingLinkDrop && Date.now() - this._pendingLinkDrop.time < 500
          ? this._pendingLinkDrop.source
          : null);

      if (srcInfo && srcInfo.id) {
        const linkToRemove = this._activeDrawingLink;
        this._activeDrawingLink = null;
        this._lastDrawingSource = null;
        this._pendingLinkDrop = null;

        const paperPt = this.paper.clientToLocalPoint({
          x: e.clientX,
          y: e.clientY,
        });
        const found = this.findLinkAtPoint(
          paperPt,
          35,
          linkToRemove ? linkToRemove.id : null,
        );
        if (
          found &&
          found.link.get("source")?.id !== srcInfo.id &&
          found.link.get("target")?.id !== srcInfo.id
        ) {
          if (linkToRemove) {
            linkToRemove.remove();
          }
          this.splitLinkAtPoint(found.link, found.projection, srcInfo);
          this.showToast("연결선에 분기 접속점(T-분기)이 연결되었습니다.");
        }
      } else {
        this._activeDrawingLink = null;
        this._lastDrawingSource = null;
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

    // Graph Real-time Transform -> Update Topology Tracker & Minimap (History pushed on drag completion)
    this.graph.on("change:position change:size", () => {
      this.topologyTracker.applyStyles(this.paper);
      this.updateMinimap();
      this.scheduleAutoSave();
    });

    this.graph.on("add remove change:sldData", () => {
      this.topologyTracker.applyStyles(this.paper);
      this.updateMinimap();
      this.pushHistory();
      this.scheduleAutoSave();
    });
  }

  startAreaSelection(clientX, clientY) {
    this.isAreaSelecting = true;
    this.areaSelectStart = this.paper.clientToLocalPoint({
      x: clientX,
      y: clientY,
    });

    const svgNS = "http://www.w3.org/2000/svg";
    let box = document.getElementById("sld-rubberband-box");
    if (!box) {
      box = document.createElementNS(svgNS, "rect");
      box.setAttribute("id", "sld-rubberband-box");
      box.setAttribute("class", "sld-rubberband-box");
      const viewport =
        this.paper.viewport ||
        (this.paper.svg
          ? this.paper.svg.querySelector(".joint-viewport") || this.paper.svg
          : null);
      if (viewport) viewport.appendChild(box);
    }
    box.setAttribute("x", this.areaSelectStart.x);
    box.setAttribute("y", this.areaSelectStart.y);
    box.setAttribute("width", 0);
    box.setAttribute("height", 0);
  }

  updateAreaSelection(clientX, clientY) {
    if (!this.isAreaSelecting) return;
    const p = this.paper.clientToLocalPoint({ x: clientX, y: clientY });
    const rx = Math.min(this.areaSelectStart.x, p.x);
    const ry = Math.min(this.areaSelectStart.y, p.y);
    const rw = Math.abs(p.x - this.areaSelectStart.x);
    const rh = Math.abs(p.y - this.areaSelectStart.y);

    const box = document.getElementById("sld-rubberband-box");
    if (box) {
      box.setAttribute("x", rx);
      box.setAttribute("y", ry);
      box.setAttribute("width", rw);
      box.setAttribute("height", rh);
    }

    // Real-time highlight preview of intersecting elements
    const elements = this.graph.getElements();
    const selRect = { x: rx, y: ry, width: rw, height: rh };

    elements.forEach((el) => {
      const bbox = el.getBBox();
      const intersects =
        bbox.x < selRect.x + selRect.width &&
        bbox.x + bbox.width > selRect.x &&
        bbox.y < selRect.y + selRect.height &&
        bbox.y + bbox.height > selRect.y;

      const view = this.paper.findViewByModel(el);
      if (view && view.el) {
        if (intersects && (rw > 5 || rh > 5)) {
          view.el.classList.add("sld-selected");
        } else if (!this.selectedCells.includes(el)) {
          view.el.classList.remove("sld-selected");
        }
      }
    });
  }

  finishAreaSelection(clientX, clientY, shiftKey) {
    if (!this.isAreaSelecting) return;
    this.isAreaSelecting = false;

    const p = this.paper.clientToLocalPoint({ x: clientX, y: clientY });
    const rx = Math.min(this.areaSelectStart.x, p.x);
    const ry = Math.min(this.areaSelectStart.y, p.y);
    const rw = Math.abs(p.x - this.areaSelectStart.x);
    const rh = Math.abs(p.y - this.areaSelectStart.y);

    const box = document.getElementById("sld-rubberband-box");
    if (box && box.parentNode) box.parentNode.removeChild(box);

    if (rw > 5 || rh > 5) {
      const selRect = { x: rx, y: ry, width: rw, height: rh };
      const elements = this.graph.getElements();
      const matched = elements.filter((el) => {
        const bbox = el.getBBox();
        return (
          bbox.x < selRect.x + selRect.width &&
          bbox.x + bbox.width > selRect.x &&
          bbox.y < selRect.y + selRect.height &&
          bbox.y + bbox.height > selRect.y
        );
      });

      if (matched.length > 0) {
        this.selectCells(matched, shiftKey);
        if (matched.length > 1) {
          this.showToast(`${matched.length}개 설비가 선택되었습니다.`);
        }
      } else if (!shiftKey) {
        this.deselectAll();
      }
    } else if (!shiftKey) {
      this.deselectAll();
    }
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
    let bbox = null;
    if (this.graph && typeof this.graph.getBBox === "function") {
      bbox = this.graph.getBBox();
    }

    if (
      !bbox ||
      !bbox.width ||
      !bbox.height ||
      bbox.width <= 0 ||
      bbox.height <= 0
    ) {
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
      if (minX !== Infinity && maxX > minX && maxY > minY) {
        bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }
    }

    if (
      !bbox ||
      !bbox.width ||
      !bbox.height ||
      bbox.width <= 0 ||
      bbox.height <= 0
    )
      return;

    const rect = this.container.getBoundingClientRect();
    const containerWidth = rect.width || this.container.clientWidth || 1000;
    const containerHeight = rect.height || this.container.clientHeight || 700;

    if (containerWidth < 100 || containerHeight < 100) return;

    const padding = 50;
    const scaleX = (containerWidth - padding * 2) / bbox.width;
    const scaleY = (containerHeight - padding * 2) / bbox.height;
    const newScale = Math.min(Math.max(0.45, Math.min(scaleX, scaleY)), 1.15);

    this.scale = Math.round(newScale * 100) / 100;
    this.paper.scale(this.scale, this.scale);

    const modelCenterX = bbox.x + bbox.width / 2;
    const modelCenterY = bbox.y + bbox.height / 2;

    this.origin = {
      x: Math.round(containerWidth / 2 - modelCenterX * this.scale),
      y: Math.round(containerHeight / 2 - modelCenterY * this.scale),
    };
    this.paper.setOrigin(this.origin.x, this.origin.y);

    const zoomBadge = document.getElementById("zoom-percentage");
    if (zoomBadge) zoomBadge.innerText = Math.round(this.scale * 100) + "%";
    this.updateMinimap();
  }

  setupCellInteractions() {
    // Element Pointer Down (Select, Shift Multi-Select, Multi-Drag, Wire Tool Connect)
    this.paper.on("element:pointerdown", (elementView, evt) => {
      const el = elementView.model;
      const sldData = el.get("sldData") || {};
      const catalog = window.EQUIPMENT_CATALOG[sldData.type] || {};

      // Wire Tool Click-to-Connect
      if (this.activeTool === "wire") {
        const target = evt.target;
        let portEl =
          target.closest("[port]") ||
          target.closest("[data-port]") ||
          target.closest(".joint-port");
        let portId = portEl
          ? portEl.getAttribute("port") ||
            portEl.getAttribute("data-port") ||
            portEl.getAttribute("joint-port")
          : null;

        if (!portId && typeof el.getPorts === "function") {
          const ports = el.getPorts() || [];
          if (ports.length > 0) {
            portId = this._wireSource ? "in" : "out";
            if (!ports.some((p) => p.id === portId)) portId = ports[0].id;
          }
        }

        if (!this._wireSource) {
          this._wireSource = { id: el.id, port: portId || "out" };
          this.showToast(
            "시작 포트가 선택되었습니다. 연결할 설비 포트 또는 연결선을 클릭하세요.",
          );
          return;
        } else {
          if (
            this._wireSource.id === el.id &&
            this._wireSource.port === portId
          ) {
            this._wireSource = null;
            return;
          }

          const srcCell = this.graph.getCell(this._wireSource.id);
          const wireColor =
            this.topologyTracker.getElementVoltageColor(srcCell);

          const link = new joint.shapes.standard.Link({
            source: { id: this._wireSource.id, port: this._wireSource.port },
            target: { id: el.id, port: portId || "in" },
            router: { name: "sldOrthogonal" },
            connector: { name: "normal" },
            attrs: {
              line: {
                stroke: wireColor,
                strokeWidth: 2.5,
                class: "link-live",
                targetMarker: { type: "none" },
              },
            },
          });
          this.graph.addCell(link);
          this._wireSource = null;
          this.topologyTracker.applyStyles(this.paper);
          this.pushHistory();
          this.scheduleAutoSave();
          this.showToast("연결선이 생성되었습니다.");
          return;
        }
      }

      this._isDraggingElement = true;

      if (evt.shiftKey) {
        // Shift+Click toggle in/out of selection
        if (this.selectedCells.includes(el)) {
          const remaining = this.selectedCells.filter((c) => c !== el);
          if (remaining.length > 0) {
            this.selectCells(remaining);
          } else {
            this.deselectAll();
          }
        } else {
          this.selectCells([el], true);
        }
        return;
      }

      // If clicked element is not part of current multi-selection, select it singly
      if (!this.selectedCells.includes(el)) {
        this.selectCell(el);
      }

      // Record starting positions for multi-drag
      if (this.selectedCells.length > 1) {
        this._multiDragStarts = this.selectedCells.map((c) => ({
          cell: c,
          pos: Object.assign({}, c.position()),
        }));
        this._multiDragPivotStart = Object.assign({}, el.position());
        this._isMultiDragging = true;

        const onPivotChange = () => {
          if (!this._isMultiDragging) return;
          const curPos = el.position();
          const dx = curPos.x - this._multiDragPivotStart.x;
          const dy = curPos.y - this._multiDragPivotStart.y;

          this._multiDragStarts.forEach((item) => {
            if (item.cell.id !== el.id) {
              item.cell.position(item.pos.x + dx, item.pos.y + dy);
            }
          });
        };

        el.on("change:position", onPivotChange);
        this._cleanupPivotDrag = () => {
          el.off("change:position", onPivotChange);
          this._isMultiDragging = false;
        };
      }

      // If clicked on contact blade or with shiftKey on a switch/breaker, toggle OPEN/CLOSED state
      const isBreakerOrSwitch =
        catalog.subCategory === "SWITCH" ||
        sldData.type === "GROUND_SWITCH" ||
        sldData.isTie ||
        catalog.isTieBreaker;

      const targetSel = evt.target
        ? evt.target.getAttribute("data-selector") ||
          evt.target.getAttribute("class") ||
          ""
        : "";
      const isClickOnBlade =
        targetSel === "blade" ||
        targetSel === "contactPath" ||
        targetSel === "stateBadge" ||
        targetSel === "crescent" ||
        targetSel === "box";

      if (
        isBreakerOrSwitch &&
        isClickOnBlade &&
        this.selectedCells.length <= 1
      ) {
        const currentState = sldData.state || "CLOSED";
        const newState = currentState === "CLOSED" ? "OPEN" : "CLOSED";
        el.set("sldData", Object.assign({}, sldData, { state: newState }));
        this.topologyTracker.applyStyles(this.paper);
        this.populateProperties(el);
      }
    });

    // Snap to port grid on drag release & sync busbar ports
    this.paper.on("element:pointerup", (elementView) => {
      if (this._cleanupPivotDrag) {
        this._cleanupPivotDrag();
        this._cleanupPivotDrag = null;
      }

      if (this.selectedCells.length > 1) {
        this.selectedCells.forEach((c) => {
          if (c.isElement && c.isElement()) {
            this.snapElementToPortGrid(c);
            this.syncConnectedBusbarPorts(c);
          }
        });
      } else {
        const el = elementView ? elementView.model : null;
        if (el && el.isElement && el.isElement()) {
          this.snapElementToPortGrid(el);
          this.syncConnectedBusbarPorts(el);
        }
      }

      this._isDraggingElement = false;

      this.topologyTracker.applyStyles(this.paper);
      this.updateSelectionOverlay();
      this.updateMinimap();
      this.pushHistory();
      this.scheduleAutoSave();
    });

    // Blank Click in Wire Tool -> T-junction if near wire
    this.paper.on("blank:pointerdown", (evt, x, y) => {
      if (this.activeTool === "wire" && this._wireSource) {
        const found = this.findLinkAtPoint({ x, y }, 35);
        if (
          found &&
          found.link.get("source")?.id !== this._wireSource.id &&
          found.link.get("target")?.id !== this._wireSource.id
        ) {
          this.splitLinkAtPoint(found.link, found.projection, this._wireSource);
          this._wireSource = null;
          this.showToast("연결선에 분기 접속점(T-분기)이 연결되었습니다.");
        }
      }
    });

    this.paper.on("link:pointerdown", (linkView, evt) => {
      // Wire Tool Click on Existing Link
      if (this.activeTool === "wire") {
        const paperPt = this.paper.clientToLocalPoint({
          x: evt.clientX,
          y: evt.clientY,
        });
        const found = this.findLinkAtPoint(paperPt, 35) || {
          link: linkView.model,
          projection: paperPt,
        };
        if (found) {
          if (this._wireSource) {
            if (
              found.link.get("source")?.id !== this._wireSource.id &&
              found.link.get("target")?.id !== this._wireSource.id
            ) {
              this.splitLinkAtPoint(
                found.link,
                found.projection,
                this._wireSource,
              );
              this._wireSource = null;
              this.showToast("연결선에 분기 접속점(T-분기)이 연결되었습니다.");
              return;
            }
          } else {
            const res = this.splitLinkAtPoint(found.link, found.projection);
            if (res && res.junction) {
              this._wireSource = { id: res.junction.id, port: "p1" };
              this.showToast(
                "분기 접속점(T-분기)이 생성되었습니다. 연결할 다른 설비를 클릭하세요.",
              );
              return;
            }
          }
        }
      }

      this.selectCell(linkView.model);
    });

    // Right-Click on Element Port Node (Port Disconnect)
    this.paper.on("element:contextmenu", (elementView, evt, x, y) => {
      evt.preventDefault();
      evt.stopPropagation();

      const el = elementView.model;
      const target = evt.target;

      let portEl =
        target.closest("[port]") ||
        target.closest("[data-port]") ||
        target.closest(".joint-port");

      let portId = null;
      if (portEl) {
        portId =
          portEl.getAttribute("port") ||
          portEl.getAttribute("data-port") ||
          portEl.getAttribute("joint-port");
      }

      // Check proximity to any port if not found directly
      if (!portId && el.getPorts) {
        const ports = el.getPorts() || [];
        const elPos = el.position();
        for (const p of ports) {
          const pArgs = p.args || {};
          const pAbsX = elPos.x + (pArgs.x || 0);
          const pAbsY = elPos.y + (pArgs.y || 0);
          const dist = Math.hypot(x - pAbsX, y - pAbsY);
          if (dist <= 18) {
            portId = p.id;
            break;
          }
        }
      }

      if (portId) {
        const connectedLinks = this.graph
          .getConnectedLinks(el)
          .filter((link) => {
            const s = link.get("source");
            const t = link.get("target");
            return (
              (s && s.id === el.id && s.port === portId) ||
              (t && t.id === el.id && t.port === portId)
            );
          });

        if (connectedLinks.length > 0) {
          connectedLinks.forEach((link) => link.remove());
          this.cleanupUnusedBusbarPorts();
          this.topologyTracker.applyStyles(this.paper);
          this.updateMinimap();
          this.pushHistory();
          this.scheduleAutoSave();
          this.showToast("연결선이 해제되었습니다.");
        }
      }
    });

    // Right-Click on Link directly (Link Delete)
    this.paper.on("link:contextmenu", (linkView, evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const link = linkView.model;
      link.remove();
      this.cleanupUnusedBusbarPorts();
      this.topologyTracker.applyStyles(this.paper);
      this.updateMinimap();
      this.pushHistory();
      this.scheduleAutoSave();
      this.showToast("연결선이 삭제되었습니다.");
    });

    // Dynamic Busbar Port Auto-Generation & Auto-Deletion
    this.paper.on("link:connect", (linkView) => {
      const link = linkView.model;
      this._activeDrawingLink = null;
      this.autoCreateBusbarPort(link);
      this.cleanupUnusedBusbarPorts();
      this.topologyTracker.applyStyles(this.paper);
      this.updateMinimap();
      this.scheduleAutoSave();
    });

    this.graph.on("add", (cell) => {
      if (cell.isLink && cell.isLink()) {
        const src = cell.get("source");
        const tgt = cell.get("target");
        if (src && src.id && (!tgt || !tgt.id)) {
          this._activeDrawingLink = cell;
          this._lastDrawingSource = Object.assign({}, src);
        }
        this.autoCreateBusbarPort(cell);
      }
    });

    this.graph.on("remove", (cell) => {
      if (cell.isLink && cell.isLink()) {
        if (this._activeDrawingLink === cell) {
          const src = cell.get("source");
          if (src && src.id) {
            this._pendingLinkDrop = {
              source: Object.assign({}, src),
              time: Date.now(),
            };
          }
          this._activeDrawingLink = null;
        }
        this.cleanupUnusedBusbarPorts();
      }
    });

    this.graph.on("change:source change:target", (link) => {
      if (link.isLink && link.isLink()) {
        this.autoCreateBusbarPort(link);
        this.cleanupUnusedBusbarPorts();
      }
    });

    this.graph.on("change:position", (element) => {
      if (element.isElement && element.isElement()) {
        this.syncConnectedBusbarPorts(element);
      }
    });
  }

  getLinkPoints(link) {
    if (!link || !this.paper) return null;
    const linkView = this.paper.findViewByModel(link);
    if (!linkView) return null;

    let srcPt = linkView.sourceAnchor || linkView.sourcePoint;
    let tgtPt = linkView.targetAnchor || linkView.targetPoint;

    if (!srcPt) {
      const src = link.get("source");
      if (src && src.id) {
        const srcEl = this.graph.getCell(src.id);
        if (srcEl) {
          const pos = srcEl.position();
          const size = srcEl.size();
          srcPt = { x: pos.x + size.width / 2, y: pos.y + size.height / 2 };
        }
      }
    }

    if (!tgtPt) {
      const tgt = link.get("target");
      if (tgt && tgt.id) {
        const tgtEl = this.graph.getCell(tgt.id);
        if (tgtEl) {
          const pos = tgtEl.position();
          const size = tgtEl.size();
          tgtPt = { x: pos.x + size.width / 2, y: pos.y + size.height / 2 };
        }
      }
    }

    if (!srcPt || !tgtPt) return null;

    const vertices = link.get("vertices") || [];
    let routePoints = [];
    if (linkView._route && linkView._route.length > 0) {
      routePoints = linkView._route;
    } else if (vertices.length > 0) {
      routePoints = vertices;
    }

    return [srcPt, ...routePoints, tgtPt];
  }

  findLinkAtPoint(
    paperPoint,
    maxDist = 25,
    excludeLinkId = null,
    excludeElementId = null,
  ) {
    if (!paperPoint || !this.graph) return null;

    const links = this.graph.getLinks();
    let bestLink = null;
    let bestDist = maxDist;
    let bestProjection = null;

    links.forEach((link) => {
      if (excludeLinkId && link.id === excludeLinkId) return;
      if (
        excludeElementId &&
        (link.get("source")?.id === excludeElementId ||
          link.get("target")?.id === excludeElementId)
      ) {
        return;
      }

      const pts = this.getLinkPoints(link);
      if (!pts || pts.length < 2) return;

      const srcPt = pts[0];
      const tgtPt = pts[pts.length - 1];

      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const l2 = dx * dx + dy * dy;
        if (l2 === 0) continue;

        let t = ((paperPoint.x - p1.x) * dx + (paperPoint.y - p1.y) * dy) / l2;
        t = Math.max(0, Math.min(1, t));

        const proj = {
          x: p1.x + t * dx,
          y: p1.y + t * dy,
        };

        // Do not split at the terminal endpoints (ports) of existing links!
        if (
          Math.hypot(proj.x - srcPt.x, proj.y - srcPt.y) < 22 ||
          Math.hypot(proj.x - tgtPt.x, proj.y - tgtPt.y) < 22
        ) {
          continue;
        }

        const dist = Math.hypot(paperPoint.x - proj.x, paperPoint.y - proj.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestLink = link;
          bestProjection = proj;
        }
      }
    });

    if (bestLink && bestProjection) {
      return {
        link: bestLink,
        projection: bestProjection,
        dist: bestDist,
      };
    }
    return null;
  }

  splitLinkAtPoint(targetLink, projPoint, newSourceInfo = null) {
    if (!targetLink || !projPoint) return null;

    // Do not split a link connected directly to the newSourceInfo itself
    if (newSourceInfo && newSourceInfo.id) {
      if (
        targetLink.get("source")?.id === newSourceInfo.id ||
        targetLink.get("target")?.id === newSourceInfo.id
      ) {
        return null;
      }
    }

    const pts = this.getLinkPoints(targetLink);
    if (pts && pts.length >= 2) {
      const srcPt = pts[0];
      const tgtPt = pts[pts.length - 1];
      if (
        Math.hypot(projPoint.x - srcPt.x, projPoint.y - srcPt.y) < 20 ||
        Math.hypot(projPoint.x - tgtPt.x, projPoint.y - tgtPt.y) < 20
      ) {
        return null;
      }
    }

    // Debounce duplicate rapid split calls
    const now = Date.now();
    if (
      this._lastSplitTime &&
      now - this._lastSplitTime < 250 &&
      this._lastSplitLink === targetLink.id
    ) {
      return null;
    }
    this._lastSplitTime = now;
    this._lastSplitLink = targetLink.id;

    const gridSize = this.options.gridSize || 10;
    let jx = Math.round(projPoint.x / gridSize) * gridSize;
    let jy = Math.round(projPoint.y / gridSize) * gridSize;

    // Smart Alignment: If branching from a source element, align junction coordinate with source port
    if (newSourceInfo && newSourceInfo.id) {
      const srcEl = this.graph.getCell(newSourceInfo.id);
      if (srcEl && srcEl.isElement && srcEl.isElement()) {
        const srcPos = srcEl.position();
        const srcSize = srcEl.size();
        let srcPortX = srcPos.x + srcSize.width / 2;
        let srcPortY = srcPos.y + srcSize.height / 2;

        if (typeof srcEl.getPorts === "function") {
          const ports = srcEl.getPorts() || [];
          const portObj = ports.find((p) => p.id === newSourceInfo.port);
          if (portObj && portObj.args) {
            srcPortX =
              srcPos.x +
              (portObj.args.x !== undefined
                ? portObj.args.x
                : srcSize.width / 2);
            srcPortY =
              srcPos.y +
              (portObj.args.y !== undefined
                ? portObj.args.y
                : srcSize.height / 2);
          }
        }

        const pts = this.getLinkPoints(targetLink);
        if (pts && pts.length >= 2) {
          const isHorizontal = Math.abs(pts[0].y - pts[pts.length - 1].y) < 10;
          const isVertical = Math.abs(pts[0].x - pts[pts.length - 1].x) < 10;

          if (isHorizontal) {
            const minX = Math.min(...pts.map((p) => p.x));
            const maxX = Math.max(...pts.map((p) => p.x));
            if (srcPortX >= minX - 10 && srcPortX <= maxX + 10) {
              jx = srcPortX;
              jy = pts[0].y;
            }
          } else if (isVertical) {
            const minY = Math.min(...pts.map((p) => p.y));
            const maxY = Math.max(...pts.map((p) => p.y));
            if (srcPortY >= minY - 10 && srcPortY <= maxY + 10) {
              jy = srcPortY;
              jx = pts[0].x;
            }
          }
        }
      }
    }

    // 1. Create Junction Node at (jx, jy)
    const junction = new joint.shapes.sld.Junction({
      position: { x: jx - 6, y: jy - 6 },
      size: { width: 12, height: 12 },
      sldData: {
        type: "JUNCTION",
        name: "분기점",
        state: "LIVE",
        color:
          targetLink.get("sldData")?.color ||
          targetLink.attr("line/stroke") ||
          "#377DFF",
      },
    });
    this.graph.addCell(junction);

    const origSource = Object.assign({}, targetLink.get("source"));
    const origTarget = Object.assign({}, targetLink.get("target"));
    const linkColor =
      targetLink.attr("line/stroke") ||
      targetLink.get("sldData")?.color ||
      "#377DFF";

    // 2. Re-route original link: origSource -> Junction
    targetLink.set("target", { id: junction.id, port: "p1" });

    // 3. Create second link: Junction -> origTarget
    const link2 = new joint.shapes.standard.Link({
      source: { id: junction.id, port: "p1" },
      target: origTarget,
      router: { name: "sldOrthogonal" },
      connector: { name: "normal" },
      attrs: {
        line: {
          stroke: linkColor,
          strokeWidth: 2.5,
          targetMarker: { type: "none" },
        },
      },
    });
    this.graph.addCell(link2);

    // 4. If a third incoming source was provided, create/connect: newSource -> Junction
    let branchLink = null;
    if (newSourceInfo && newSourceInfo.id) {
      branchLink = new joint.shapes.standard.Link({
        source: { id: newSourceInfo.id, port: newSourceInfo.port },
        target: { id: junction.id, port: "p1" },
        router: { name: "sldOrthogonal" },
        connector: { name: "normal" },
        attrs: {
          line: {
            stroke: linkColor,
            strokeWidth: 2.5,
            targetMarker: { type: "none" },
          },
        },
      });
      this.graph.addCell(branchLink);
    }

    this.topologyTracker.applyStyles(this.paper);
    this.updateMinimap();
    this.pushHistory();
    this.scheduleAutoSave();
    this.showToast("연결선에 분기 접속점(T-분기)이 연결되었습니다.");

    return { junction, link1: targetLink, link2, branchLink };
  }

  showToast(message) {
    let toast = document.getElementById("sld-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "sld-toast";
      toast.className = "sld-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 1800);
  }

  autoCreateBusbarPort(link) {
    if (!link || !link.isLink || !link.isLink()) return;

    const source = link.get("source");
    const target = link.get("target");

    if (!source || !target || !source.id || !target.id) return;

    const sourceCell = this.graph.getCell(source.id);
    const targetCell = this.graph.getCell(target.id);

    if (!sourceCell || !targetCell) return;

    const gridSize = this.options.gridSize || 10;
    const allLinks = this.graph.getLinks();

    // Case 1: Target is Busbar
    if (
      targetCell.get("type") === "sld.Busbar" ||
      targetCell.get("sldData")?.type === "BUSBAR"
    ) {
      const busbar = targetCell;
      const busPos = busbar.position();
      const busSize = busbar.size();

      const sourceSize = sourceCell.size();
      const sourceData = sourceCell.get("sldData") || {};
      const sourceOffset = this.getPrimaryPortOffset(
        sourceData.type,
        sourceSize.width,
        sourceSize.height,
        sourceCell,
      );
      const sourcePortAbsX = sourceCell.position().x + sourceOffset.x;
      const rawLocalX = sourcePortAbsX - busPos.x;
      let portX = Math.max(10, Math.min(busSize.width - 10, rawLocalX));
      portX = Math.round(portX / gridSize) * gridSize;

      let currentPortId = target.port;
      let currentPort = currentPortId ? busbar.getPort(currentPortId) : null;

      // Check if current port is already used by another link on this busbar
      const isPortShared =
        currentPortId &&
        allLinks.some(
          (l) =>
            l.id !== link.id &&
            ((l.get("source")?.id === busbar.id &&
              l.get("source")?.port === currentPortId) ||
              (l.get("target")?.id === busbar.id &&
                l.get("target")?.port === currentPortId)),
        );

      if (!currentPort || isPortShared) {
        const portId = "bus_p_" + Math.random().toString(36).substr(2, 9);
        const busColor = busbar.get("sldData")?.color || "#9C27B0";

        busbar.addPort({
          id: portId,
          group: "bus-ports",
          args: { x: portX, y: busSize.height / 2 },
          attrs: {
            circle: {
              r: 3.5,
              magnet: false,
              fill: "#ffffff",
              stroke: busColor,
              strokeWidth: 1.5,
            },
          },
        });

        link.prop("target", { id: busbar.id, port: portId });
      } else {
        busbar.portProp(currentPortId, "args/x", portX);
      }
    }

    // Case 2: Source is Busbar
    if (
      sourceCell.get("type") === "sld.Busbar" ||
      sourceCell.get("sldData")?.type === "BUSBAR"
    ) {
      const busbar = sourceCell;
      const busPos = busbar.position();
      const busSize = busbar.size();

      const targetSize = targetCell.size();
      const targetData = targetCell.get("sldData") || {};
      const targetOffset = this.getPrimaryPortOffset(
        targetData.type,
        targetSize.width,
        targetSize.height,
        targetCell,
      );
      const targetPortAbsX = targetCell.position().x + targetOffset.x;
      const rawLocalX = targetPortAbsX - busPos.x;
      let portX = Math.max(10, Math.min(busSize.width - 10, rawLocalX));
      portX = Math.round(portX / gridSize) * gridSize;

      let currentPortId = source.port;
      let currentPort = currentPortId ? busbar.getPort(currentPortId) : null;

      const isPortShared =
        currentPortId &&
        allLinks.some(
          (l) =>
            l.id !== link.id &&
            ((l.get("source")?.id === busbar.id &&
              l.get("source")?.port === currentPortId) ||
              (l.get("target")?.id === busbar.id &&
                l.get("target")?.port === currentPortId)),
        );

      if (!currentPort || isPortShared) {
        const portId = "bus_p_" + Math.random().toString(36).substr(2, 9);
        const busColor = busbar.get("sldData")?.color || "#9C27B0";

        busbar.addPort({
          id: portId,
          group: "bus-ports",
          args: { x: portX, y: busSize.height / 2 },
          attrs: {
            circle: {
              r: 3.5,
              magnet: false,
              fill: "#ffffff",
              stroke: busColor,
              strokeWidth: 1.5,
            },
          },
        });

        link.prop("source", { id: busbar.id, port: portId });
      } else {
        busbar.portProp(currentPortId, "args/x", portX);
      }
    }
  }

  cleanupUnusedBusbarPorts() {
    if (!this.graph) return;
    const busbars = this.graph
      .getElements()
      .filter(
        (el) =>
          el.get("type") === "sld.Busbar" ||
          el.get("sldData")?.type === "BUSBAR",
      );

    const allLinks = this.graph.getLinks();

    busbars.forEach((busbar) => {
      const usedPorts = new Set();
      allLinks.forEach((link) => {
        const s = link.get("source");
        const t = link.get("target");
        if (s && s.id === busbar.id && s.port) usedPorts.add(s.port);
        if (t && t.id === busbar.id && t.port) usedPorts.add(t.port);
      });

      const existingPorts = busbar.getPorts() || [];
      existingPorts.forEach((port) => {
        if (!usedPorts.has(port.id)) {
          busbar.removePort(port.id);
        }
      });
    });
  }

  syncConnectedBusbarPorts(element) {
    if (!element || !element.isElement || !element.isElement()) return;
    if (
      element.get("type") === "sld.Busbar" ||
      element.get("sldData")?.type === "BUSBAR"
    )
      return;

    const connectedLinks = this.graph.getConnectedLinks(element);
    const elemPos = element.position();
    const elemSize = element.size();
    const elemData = element.get("sldData") || {};
    const elemOffset = this.getPrimaryPortOffset(
      elemData.type,
      elemSize.width,
      elemSize.height,
      element,
    );
    const elemPortAbsX = elemPos.x + elemOffset.x;

    connectedLinks.forEach((link) => {
      const s = link.get("source");
      const t = link.get("target");

      if (s && s.id !== element.id) {
        const other = this.graph.getCell(s.id);
        if (
          other &&
          (other.get("type") === "sld.Busbar" ||
            other.get("sldData")?.type === "BUSBAR")
        ) {
          const busPos = other.position();
          const busSize = other.size();
          const localX = Math.max(
            10,
            Math.min(busSize.width - 10, elemPortAbsX - busPos.x),
          );
          const gridSize = this.options.gridSize || 10;
          const snappedX = Math.round(localX / gridSize) * gridSize;
          if (s.port && other.getPort(s.port)) {
            other.portProp(s.port, "args/x", snappedX);
          }
        }
      }

      if (t && t.id !== element.id) {
        const other = this.graph.getCell(t.id);
        if (
          other &&
          (other.get("type") === "sld.Busbar" ||
            other.get("sldData")?.type === "BUSBAR")
        ) {
          const busPos = other.position();
          const busSize = other.size();
          const localX = Math.max(
            10,
            Math.min(busSize.width - 10, elemPortAbsX - busPos.x),
          );
          const gridSize = this.options.gridSize || 10;
          const snappedX = Math.round(localX / gridSize) * gridSize;
          if (t.port && other.getPort(t.port)) {
            other.portProp(t.port, "args/x", snappedX);
          }
        }
      }
    });
  }

  selectCells(cells, append = false) {
    const validCells = (cells || []).filter((c) => c && typeof c === "object");
    if (validCells.length === 0) {
      if (!append) this.deselectAll();
      return;
    }

    if (!append) {
      this.deselectAll();
      this.selectedCells = [...validCells];
    } else {
      const set = new Set([...this.selectedCells, ...validCells]);
      this.selectedCells = Array.from(set);
    }

    this.selectedCell = this.selectedCells[0] || null;

    this.selectedCells.forEach((cell) => {
      if (!cell) return;
      const view = this.paper.findViewByModel(cell);
      if (view && view.el) {
        view.el.classList.add("sld-selected");
      }
      if (cell.isElement && cell.isElement()) {
        cell.off(
          "change:position change:size",
          this._onSelectedCellTransform,
          this,
        );
        cell.on(
          "change:position change:size",
          this._onSelectedCellTransform,
          this,
        );
      }
    });

    this.updateSelectionOverlay();
    this.populateProperties();
  }

  selectCell(cell, append = false) {
    if (!cell) return;
    this.selectCells([cell], append);
  }

  _onSelectedCellTransform() {
    this.updateSelectionOverlay();
  }

  updateSelectionOverlay() {
    this.removeSelectionOverlay();
    if (!this.selectedCells || this.selectedCells.length === 0 || !this.paper)
      return;

    const svgNS = "http://www.w3.org/2000/svg";
    const overlay = document.createElementNS(svgNS, "g");
    overlay.setAttribute("id", "sld-selection-overlay");
    overlay.setAttribute("class", "sld-selection-overlay");

    const pad = 5;
    const handleSize = 6;
    const handleOffset = handleSize / 2;

    this.selectedCells.forEach((cell) => {
      if (!cell.isElement || !cell.isElement()) return;
      const bbox = cell.getBBox();
      if (!bbox) return;

      const boxX = bbox.x - pad;
      const boxY = bbox.y - pad;
      const boxW = bbox.width + pad * 2;
      const boxH = bbox.height + pad * 2;

      // Bounding box rect
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("class", "sld-selection-box");
      rect.setAttribute("x", boxX);
      rect.setAttribute("y", boxY);
      rect.setAttribute("width", boxW);
      rect.setAttribute("height", boxH);
      rect.setAttribute("rx", "4");
      overlay.appendChild(rect);

      const sldData = cell.get("sldData") || {};
      const isBusbar =
        sldData.type === "BUSBAR" || cell.get("type") === "sld.Busbar";

      if (isBusbar && this.selectedCells.length === 1) {
        // Special West / East interactive drag handles for single Busbar
        const handleW = document.createElementNS(svgNS, "rect");
        handleW.setAttribute(
          "class",
          "sld-selection-handle sld-bus-resize-handle sld-handle-w",
        );
        handleW.setAttribute("x", boxX - 4);
        handleW.setAttribute("y", boxY + boxH / 2 - 8);
        handleW.setAttribute("width", "8");
        handleW.setAttribute("height", "16");
        handleW.setAttribute("rx", "3");
        overlay.appendChild(handleW);

        const handleE = document.createElementNS(svgNS, "rect");
        handleE.setAttribute(
          "class",
          "sld-selection-handle sld-bus-resize-handle sld-handle-e",
        );
        handleE.setAttribute("x", boxX + boxW - 4);
        handleE.setAttribute("y", boxY + boxH / 2 - 8);
        handleE.setAttribute("width", "8");
        handleE.setAttribute("height", "16");
        handleE.setAttribute("rx", "3");
        overlay.appendChild(handleE);

        const setupBusbarResizeHandle = (handleEl, direction) => {
          handleEl.style.cursor = "ew-resize";
          handleEl.style.pointerEvents = "all";

          handleEl.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();

            this._isResizingBusbar = true;

            const startPos = cell.position();
            const startSize = cell.size();
            const rightEdge = startPos.x + startSize.width;
            const gridSize = this.options.gridSize || 10;
            const busLengthInput = document.getElementById("prop-bus-length");

            // Gather all existing ports and their starting local coordinates
            const ports = cell.getPorts() || [];
            const initialPortOffsets = {};
            let minPortLocalX = Infinity;
            let maxPortLocalX = -Infinity;

            ports.forEach((p) => {
              const currentX = p.args && p.args.x !== undefined ? p.args.x : 0;
              initialPortOffsets[p.id] = currentX;
              if (currentX < minPortLocalX) minPortLocalX = currentX;
              if (currentX > maxPortLocalX) maxPortLocalX = currentX;
            });

            // Minimum 10px margin between port and busbar edge
            const pad = 10;

            const onMouseMove = (moveEvent) => {
              const paperPt = this.paper.clientToLocalPoint({
                x: moveEvent.clientX,
                y: moveEvent.clientY,
              });

              if (direction === "e") {
                // Right Handle: Keep left position fixed, guard right edge past ports
                const minAllowedW =
                  maxPortLocalX !== -Infinity
                    ? Math.max(40, maxPortLocalX + pad)
                    : 40;
                let newW =
                  Math.round((paperPt.x - startPos.x) / gridSize) * gridSize;
                newW = Math.max(minAllowedW, Math.min(3000, newW));
                cell.resize(newW, startSize.height);
                this.updateSelectionOverlay();
                if (busLengthInput) busLengthInput.value = newW;
              } else if (direction === "w") {
                // Left Handle: Anchor all ports to world coordinates and guard left edge before ports
                const maxAllowedX =
                  minPortLocalX !== Infinity
                    ? Math.min(rightEdge - 40, startPos.x + minPortLocalX - pad)
                    : rightEdge - 40;

                let newX = Math.round(paperPt.x / gridSize) * gridSize;
                newX = Math.min(maxAllowedX, Math.max(rightEdge - 3000, newX));
                const newW = rightEdge - newX;
                const dx = newX - startPos.x;

                // 1. Move and resize busbar
                cell.position(newX, startPos.y);
                cell.resize(newW, startSize.height);

                // 2. Adjust all port local coordinates so world position stays 100% stationary
                ports.forEach((p) => {
                  const origLocalX = initialPortOffsets[p.id];
                  const newLocalX = origLocalX - dx;
                  cell.portProp(p.id, "args/x", newLocalX);
                });

                this.updateSelectionOverlay();
                if (busLengthInput) busLengthInput.value = newW;
              }
            };

            const onMouseUp = () => {
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);
              this._isResizingBusbar = false;
              this.updateMinimap();
              this.pushHistory();
              this.scheduleAutoSave();
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
          });
        };

        setupBusbarResizeHandle(handleW, "w");
        setupBusbarResizeHandle(handleE, "e");
      } else if (this.selectedCells.length === 1) {
        // Corner handle positions for single element selection
        const corners = [
          { x: boxX - handleOffset, y: boxY - handleOffset }, // Top-Left
          { x: boxX + boxW - handleOffset, y: boxY - handleOffset }, // Top-Right
          { x: boxX - handleOffset, y: boxY + boxH - handleOffset }, // Bottom-Left
          { x: boxX + boxW - handleOffset, y: boxY + boxH - handleOffset }, // Bottom-Right
        ];

        corners.forEach((c) => {
          const handle = document.createElementNS(svgNS, "rect");
          handle.setAttribute("class", "sld-selection-handle");
          handle.setAttribute("x", c.x);
          handle.setAttribute("y", c.y);
          handle.setAttribute("width", handleSize);
          handle.setAttribute("height", handleSize);
          handle.setAttribute("rx", "1.5");
          overlay.appendChild(handle);
        });
      }
    });

    const viewport =
      this.paper.viewport ||
      (this.paper.svg
        ? this.paper.svg.querySelector(".joint-viewport") ||
          this.paper.svg.querySelector("g") ||
          this.paper.svg
        : null);
    if (viewport) {
      viewport.appendChild(overlay);
    }
  }

  removeSelectionOverlay() {
    const overlays = document.querySelectorAll(
      "#sld-selection-overlay, .sld-selection-overlay",
    );
    overlays.forEach((el) => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  deselectAll() {
    if (this.selectedCells && this.selectedCells.length > 0) {
      this.selectedCells.forEach((cell) => {
        if (cell.isElement && cell.isElement()) {
          cell.off(
            "change:position change:size",
            this._onSelectedCellTransform,
            this,
          );
        }
        const view = this.paper.findViewByModel(cell);
        if (view && view.el) {
          view.el.classList.remove("sld-selected");
        }
      });
    }
    this.selectedCells = [];
    this.selectedCell = null;

    this.removeSelectionOverlay();

    // Clean up any stray selection classes
    const selectedDoms = document.querySelectorAll(".sld-selected");
    selectedDoms.forEach((d) => d.classList.remove("sld-selected"));

    this.clearProperties();
  }

  deleteSelected() {
    if (!this.selectedCells || this.selectedCells.length === 0) {
      if (this.selectedCell) {
        this.selectedCells = [this.selectedCell];
      } else {
        return;
      }
    }

    const targets = [...this.selectedCells];
    const count = targets.length;

    targets.forEach((cell) => {
      if (cell.isElement && cell.isElement()) {
        cell.off(
          "change:position change:size",
          this._onSelectedCellTransform,
          this,
        );
      }
      const view = this.paper.findViewByModel(cell);
      if (view && view.el) {
        view.el.classList.remove("sld-selected");
      }
      cell.remove();
    });

    this.cleanupUnusedBusbarPorts();
    this.removeSelectionOverlay();
    this.selectedCells = [];
    this.selectedCell = null;
    this.clearProperties();
    this.topologyTracker.applyStyles(this.paper);
    this.updateMinimap();
    this.pushHistory();
    this.scheduleAutoSave();
    this.showToast(`${count}개 항목이 삭제되었습니다.`);
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
        this.createElement(type, center.x, center.y);
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
      this.createElement(type, p.x, p.y);
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
      case "CB_VCB":
      case "CB_MCCB":
      case "CB_GCB":
      case "DS":
        width = 28;
        height = 40;
        break;
      case "CB_TIE_HV":
      case "CB_TIE_LV":
        width = 40;
        height = 28;
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

    // Snap connection point (primary port) to grid (10px)
    const gridSize = this.options.gridSize || 10;
    const snapOffset = this.getPrimaryPortOffset(
      type,
      width,
      height,
      shapeClass,
    );
    const targetPortX = Math.round(x / gridSize) * gridSize;
    const targetPortY = Math.round(y / gridSize) * gridSize;

    const gridX = targetPortX - snapOffset.x;
    const gridY = targetPortY - snapOffset.y;

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

  getPrimaryPortOffset(type, width, height, cellOrClass) {
    // 1. Try to find from cell instance or shape definition
    if (cellOrClass) {
      if (typeof cellOrClass.getPorts === "function") {
        const ports = cellOrClass.getPorts();
        if (ports && ports.length > 0) {
          const priority = [
            "in",
            "pri",
            "p1",
            "p_in",
            "p_f1",
            "ac_in",
            "out",
            "sec",
          ];
          let targetPort =
            ports.find((p) => priority.includes(p.id)) || ports[0];
          const args = cellOrClass.portProp(targetPort.id, "args");
          if (
            args &&
            typeof args.x === "number" &&
            typeof args.y === "number"
          ) {
            return { x: args.x, y: args.y };
          }
        }
      } else if (
        cellOrClass.prototype &&
        cellOrClass.prototype.defaults &&
        cellOrClass.prototype.defaults.ports &&
        Array.isArray(cellOrClass.prototype.defaults.ports.items)
      ) {
        const items = cellOrClass.prototype.defaults.ports.items;
        if (items.length > 0) {
          const priority = [
            "in",
            "pri",
            "p1",
            "p_in",
            "p_f1",
            "ac_in",
            "out",
            "sec",
          ];
          let targetItem =
            items.find((p) => priority.includes(p.id)) || items[0];
          if (
            targetItem &&
            targetItem.args &&
            typeof targetItem.args.x === "number" &&
            typeof targetItem.args.y === "number"
          ) {
            return { x: targetItem.args.x, y: targetItem.args.y };
          }
        }
      }
    }

    // 2. Exact offsets based on equipment type
    switch (type) {
      case "BUSBAR":
        return { x: 0, y: 0 };
      case "TR_2W":
        return { x: 22, y: 0 };
      case "TR_3W":
        return { x: 30, y: 0 };
      case "CB_ACB":
      case "CB_VCB":
      case "CB_MCCB":
      case "CB_GCB":
      case "DS":
        return { x: 14, y: 0 };
      case "CB_TIE_HV":
      case "CB_TIE_LV":
        return { x: 0, y: 14 };
      case "LA":
      case "FUSE":
      case "GROUND_SWITCH":
        return { x: 16, y: 0 };
      case "RELAY":
        return { x: 19, y: 0 };
      case "CT":
      case "PT":
        return { x: 17, y: 0 };
      case "LOAD":
        return { x: 17, y: 0 };
      case "GENERATOR":
        return { x: 22, y: 0 };
      case "TRANSMISSION_TOWER":
        return { x: 28, y: 0 };
      case "UPS":
        return { x: 0, y: 24 };
      case "BATTERY":
        return { x: 26, y: 0 };
      case "RECTIFIER":
      case "INVERTER":
        return { x: 0, y: 24 };
      case "SWITCHGEAR":
        return { x: 22, y: 0 };
      case "PANELBOARD":
        return { x: 20, y: 0 };
      default:
        return { x: Math.round(width / 2), y: 0 };
    }
  }

  snapElementToPortGrid(el) {
    if (!el || !el.isElement || !el.isElement()) return;
    const pos = el.position();
    const size = el.size();
    const sldData = el.get("sldData") || {};
    const snapOffset = this.getPrimaryPortOffset(
      sldData.type,
      size.width,
      size.height,
      el,
    );

    const currentPortX = pos.x + snapOffset.x;
    const currentPortY = pos.y + snapOffset.y;

    const gridSize = this.options.gridSize || 10;
    const targetPortX = Math.round(currentPortX / gridSize) * gridSize;
    const targetPortY = Math.round(currentPortY / gridSize) * gridSize;

    const newX = targetPortX - snapOffset.x;
    const newY = targetPortY - snapOffset.y;

    if (pos.x !== newX || pos.y !== newY) {
      el.position(newX, newY);
    }
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

    // Busbar Length Binding
    const busLengthInput = document.getElementById("prop-bus-length");
    if (busLengthInput) {
      const handleBusLength = (e) => {
        if (!this.selectedCell) return;
        const sldData = this.selectedCell.get("sldData") || {};
        if (
          sldData.type !== "BUSBAR" &&
          this.selectedCell.get("type") !== "sld.Busbar"
        )
          return;

        const ports = this.selectedCell.getPorts() || [];
        let maxPortX = 0;
        ports.forEach((p) => {
          if (p.args && p.args.x !== undefined && p.args.x > maxPortX) {
            maxPortX = p.args.x;
          }
        });
        const minAllowedWidth = Math.max(40, maxPortX + 10);

        let val = parseFloat(e.target.value) || 200;
        val = Math.max(minAllowedWidth, Math.min(3000, val));
        const curSize = this.selectedCell.size();
        this.selectedCell.resize(val, curSize.height);
        this.updateSelectionOverlay();
        this.updateMinimap();
        this.scheduleAutoSave();
      };
      busLengthInput.addEventListener("input", handleBusLength);
      busLengthInput.addEventListener("change", handleBusLength);
    }

    // ATO Property bindings (TIE Breakers)
    const atoEnabledCb = document.getElementById("prop-ato-enabled");
    if (atoEnabledCb) {
      atoEnabledCb.addEventListener("change", () => {
        if (!this.selectedCell) return;
        const sldData = this.selectedCell.get("sldData") || {};
        sldData.atoEnabled = atoEnabledCb.checked;
        this.selectedCell.set("sldData", Object.assign({}, sldData));
        this.populateProperties(this.selectedCell);
        this.scheduleAutoSave();
      });
    }

    const bindAtoSelect = (id, propKey) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => {
          if (!this.selectedCell) return;
          const sldData = this.selectedCell.get("sldData") || {};
          sldData[propKey] = el.value;
          this.selectedCell.set("sldData", Object.assign({}, sldData));
          this.populateProperties(this.selectedCell);
          this.scheduleAutoSave();
        });
      }
    };

    bindAtoSelect("prop-ato-cb1", "interlockCb1");
    bindAtoSelect("prop-ato-cb2", "interlockCb2");
    bindAtoSelect("prop-ato-relay51", "relay51");
    bindAtoSelect("prop-ato-mode", "interlockMode");

    const stateBtns = document.querySelectorAll(".state-toggle-btn");
    stateBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetState = btn.getAttribute("data-state");
        this.toggleSelectedEquipmentState(targetState);
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
        if (this.selectedCells && this.selectedCells.length > 0) {
          this.selectedCells.forEach((cell) => {
            const sldData = cell.get("sldData") || {};
            sldData.color = color;
            cell.set("sldData", Object.assign({}, sldData));
          });
          const colorInput = document.getElementById("prop-symbol-color");
          if (colorInput) colorInput.value = color;
          this.topologyTracker.applyStyles(this.paper);
          this.scheduleAutoSave();
        }
      });
    });
  }

  populateProperties(cell) {
    if (!cell) {
      if (this.selectedCells && this.selectedCells.length > 0) {
        cell = this.selectedCells[0];
      } else {
        this.clearProperties();
        return;
      }
    }

    const sldData = cell.get("sldData") || {};
    const catalog = window.EQUIPMENT_CATALOG[sldData.type] || {};

    const setValue = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : "";
    };

    const isMulti = this.selectedCells && this.selectedCells.length > 1;
    const multiBanner = document.getElementById("group-prop-multi-selection");
    const countTitle = document.getElementById("prop-multi-count-title");
    const groupName = document.getElementById("group-prop-name");
    const groupDesc = document.getElementById("group-prop-desc");

    if (multiBanner) {
      multiBanner.style.display = isMulti ? "block" : "none";
      if (isMulti && countTitle) {
        countTitle.innerText = `다중 설비 선택됨 (${this.selectedCells.length}개)`;
      }
    }

    if (groupName) groupName.style.display = isMulti ? "none" : "block";
    if (groupDesc) groupDesc.style.display = isMulti ? "none" : "block";

    const isBusbar =
      !isMulti &&
      (sldData.type === "BUSBAR" || cell.get("type") === "sld.Busbar");
    const groupBusLen = document.getElementById("group-prop-bus-length");
    if (groupBusLen) groupBusLen.style.display = isBusbar ? "block" : "none";
    if (isBusbar) {
      setValue("prop-bus-length", Math.round(cell.size().width));
    }

    const isTransformer =
      !isMulti && (sldData.type === "TR_2W" || sldData.type === "TR_3W");
    const groupConn = document.getElementById("group-prop-connection");
    const groupCap = document.getElementById("group-prop-capacity");
    const groupVolt = document.getElementById("group-prop-voltage");
    const groupTrVolt = document.getElementById("group-prop-tr-voltages");
    const groupTertVolt = document.getElementById("group-prop-tert-voltage");

    if (groupConn) groupConn.style.display = isTransformer ? "block" : "none";
    if (groupCap) groupCap.style.display = isTransformer ? "block" : "none";
    if (groupVolt)
      groupVolt.style.display = isTransformer || isMulti ? "none" : "block";
    if (groupTrVolt)
      groupTrVolt.style.display = isTransformer ? "block" : "none";
    if (groupTertVolt) {
      groupTertVolt.style.display =
        sldData.type === "TR_3W" ||
        (sldData.connection && sldData.connection.includes("3권선"))
          ? "block"
          : "none";
    }

    // ATO (TIE Breakers)
    const isTie =
      sldData.type === "CB_TIE_HV" ||
      sldData.type === "CB_TIE_LV" ||
      sldData.isTie ||
      catalog.isTieBreaker;

    const groupAto = document.getElementById("group-prop-ato");
    if (groupAto) {
      groupAto.style.display = isTie ? "block" : "none";
      if (isTie) {
        const cb1Select = document.getElementById("prop-ato-cb1");
        const cb2Select = document.getElementById("prop-ato-cb2");
        const relaySelect = document.getElementById("prop-ato-relay51");
        const atoEnabledCb = document.getElementById("prop-ato-enabled");
        const atoModeSelect = document.getElementById("prop-ato-mode");
        const atoBadge = document.getElementById("prop-ato-status-badge");

        if (atoEnabledCb) atoEnabledCb.checked = sldData.atoEnabled !== false;

        const allElements = this.graph.getElements();
        const breakerElements = allElements.filter((el) => {
          if (el.id === cell.id) return false;
          const t = el.get("sldData")?.type || el.get("type") || "";
          return (
            t.includes("Breaker") ||
            t.includes("ACB") ||
            t.includes("VCB") ||
            t.includes("MCCB") ||
            t.includes("GCB") ||
            t.includes("Disconnector") ||
            t.startsWith("CB_") ||
            t === "DS"
          );
        });

        const relayElements = allElements.filter((el) => {
          const t = el.get("sldData")?.type || el.get("type") || "";
          return t.includes("Relay") || t === "RELAY" || t.includes("RELAY");
        });

        const buildOptions = (items, currentVal, defaultLabel) => {
          let html = `<option value="">${defaultLabel}</option>`;
          items.forEach((el) => {
            const d = el.get("sldData") || {};
            const label = d.name
              ? `${d.name} (${d.voltage ? d.voltage + "kV" : el.id})`
              : el.id;
            const selected = el.id === currentVal ? "selected" : "";
            html += `<option value="${el.id}" ${selected}>[${el.id}] ${label}</option>`;
          });
          return html;
        };

        if (cb1Select) {
          cb1Select.innerHTML = buildOptions(
            breakerElements,
            sldData.interlockCb1 || "",
            "(연계 주 차단기 1 선택)",
          );
        }
        if (cb2Select) {
          cb2Select.innerHTML = buildOptions(
            breakerElements,
            sldData.interlockCb2 || "",
            "(연계 주 차단기 2 선택)",
          );
        }
        if (relaySelect) {
          relaySelect.innerHTML = buildOptions(
            relayElements,
            sldData.relay51 || "",
            "(연동 51 계전기 선택 - 선택 사항)",
          );
        }
        if (atoModeSelect) {
          atoModeSelect.value = sldData.interlockMode || "UV_ATO";
        }

        if (atoBadge) {
          if (sldData.atoEnabled === false) {
            atoBadge.style.background = "#f1f5f9";
            atoBadge.style.color = "#64748b";
            atoBadge.innerText = "⏸️ ATO 기능 미사용 (Disabled)";
          } else if (sldData.interlockCb1 && sldData.interlockCb2) {
            atoBadge.style.background = "#dcfce7";
            atoBadge.style.color = "#15803d";
            atoBadge.innerText = `⚡ ATO / SOP 연계 구성 완료 (CB1 & CB2 연동)`;
          } else if (sldData.interlockCb1 || sldData.interlockCb2) {
            atoBadge.style.background = "#fef3c7";
            atoBadge.style.color = "#b45309";
            atoBadge.innerText = `⚠️ 1개 차단기만 지정됨 (양측 지정 권장)`;
          } else {
            atoBadge.style.background = "#e0f2fe";
            atoBadge.style.color = "#0369a1";
            atoBadge.innerText = `⚡ ATO 연계 대기 중 (연계 차단기 지정 필요)`;
          }
        }
      }
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
      "prop-ato-cb1",
      "prop-ato-cb2",
      "prop-ato-relay51",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    const groupAto = document.getElementById("group-prop-ato");
    if (groupAto) groupAto.style.display = "none";
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
        const tool = btn.getAttribute("data-tool");
        this.setActiveTool(tool);
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

  setActiveTool(toolName) {
    this.activeTool = toolName;
    const toolBtns = document.querySelectorAll(".tool-btn[data-tool]");
    toolBtns.forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-tool") === toolName);
    });
  }

  setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      // Tool shortcut keys
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "v" || e.key === "V") {
          this.setActiveTool("select");
          this.showToast("선택 도구 (V)");
          return;
        } else if (e.key === "l" || e.key === "L") {
          this.setActiveTool("lasso");
          this.showToast("영역 선택 도구 (L)");
          return;
        } else if (e.key === "w" || e.key === "W") {
          this.setActiveTool("wire");
          this.showToast("직교 배선 도구 (W)");
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        const allElements = this.graph.getElements();
        if (allElements.length > 0) {
          this.selectCells(allElements);
          this.showToast(`전체 ${allElements.length}개 설비가 선택되었습니다.`);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        this.copySelected();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        this.pasteCopied();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        this.copySelected();
        this.pasteCopied();
        return;
      }

      if (e.code === "Space") {
        if (this.selectedCells && this.selectedCells.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          this.toggleSelectedEquipmentState();
          return;
        }
      }

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

  copySelected() {
    if (!this.selectedCells || this.selectedCells.length === 0) {
      if (this.selectedCell) {
        this.selectedCells = [this.selectedCell];
      } else {
        return;
      }
    }

    const selectedElements = this.selectedCells.filter(
      (c) => c && c.isElement && c.isElement(),
    );
    if (selectedElements.length === 0) return;

    const selectedIds = new Set(selectedElements.map((el) => el.id));

    // Find internal links whose both source and target are in the selected set
    const internalLinks = this.graph.getLinks().filter((link) => {
      const srcId = link.get("source")?.id;
      const tgtId = link.get("target")?.id;
      return srcId && tgtId && selectedIds.has(srcId) && selectedIds.has(tgtId);
    });

    const elementsJson = selectedElements.map((el) => el.toJSON());
    const linksJson = internalLinks.map((l) => l.toJSON());

    this._clipboard = {
      elements: elementsJson,
      links: linksJson,
      pasteCount: 0,
    };

    this.showToast(`${selectedElements.length}개 설비가 복사되었습니다.`);
  }

  pasteCopied() {
    if (
      !this._clipboard ||
      !this._clipboard.elements ||
      this._clipboard.elements.length === 0
    ) {
      return;
    }

    this._clipboard.pasteCount = (this._clipboard.pasteCount || 0) + 1;
    const offset = this._clipboard.pasteCount * 40;
    const gridSize = this.options.gridSize || 10;
    const dx = Math.round(offset / gridSize) * gridSize;
    const dy = Math.round(offset / gridSize) * gridSize;

    const idMap = new Map();
    const newElements = [];

    // 1. Clone and instantiate Elements
    this._clipboard.elements.forEach((elJson) => {
      const clonedJson = JSON.parse(JSON.stringify(elJson));
      const oldId = clonedJson.id;
      const typePrefix = clonedJson.sldData?.type
        ? clonedJson.sldData.type.toLowerCase().replace(/_/g, "-")
        : "el";
      const newId = typePrefix + "_" + Math.random().toString(36).substr(2, 9);
      idMap.set(oldId, newId);

      clonedJson.id = newId;
      clonedJson.position = {
        x: Math.round((clonedJson.position.x + dx) / gridSize) * gridSize,
        y: Math.round((clonedJson.position.y + dy) / gridSize) * gridSize,
      };

      // Clone ports if present (e.g. Busbar or custom element)
      if (clonedJson.ports && clonedJson.ports.items) {
        clonedJson.ports.items = clonedJson.ports.items.map((p) => {
          const newPortId =
            p.id.startsWith("bus_p_") || p.id.startsWith("p_")
              ? "bus_p_" + Math.random().toString(36).substr(2, 9)
              : p.id;
          idMap.set(`${oldId}:${p.id}`, newPortId);
          return Object.assign({}, p, { id: newPortId });
        });
      }

      // Resolve Shape Constructor
      let shapeType = clonedJson.type;
      let shapeClass = null;
      if (shapeType && shapeType.startsWith("sld.") && joint.shapes.sld) {
        shapeClass = joint.shapes.sld[shapeType.replace("sld.", "")];
      }
      if (
        !shapeClass &&
        joint.util &&
        typeof joint.util.getByPath === "function"
      ) {
        shapeClass = joint.util.getByPath(joint.shapes, shapeType, ".");
      }
      if (!shapeClass) {
        shapeClass =
          joint.shapes.sld.Breaker || joint.shapes.standard.Rectangle;
      }

      const newEl = new shapeClass(clonedJson);
      this.graph.addCell(newEl);
      newElements.push(newEl);
    });

    // 2. Clone internal Links connecting the cloned elements
    this._clipboard.links.forEach((lJson) => {
      const clonedLink = JSON.parse(JSON.stringify(lJson));
      const oldSrcId = clonedLink.source?.id;
      const oldTgtId = clonedLink.target?.id;
      const newSrcId = idMap.get(oldSrcId);
      const newTgtId = idMap.get(oldTgtId);

      if (newSrcId && newTgtId) {
        clonedLink.id = "link_" + Math.random().toString(36).substr(2, 9);
        const oldSrcPort = clonedLink.source?.port;
        const oldTgtPort = clonedLink.target?.port;
        const newSrcPort =
          (oldSrcPort && idMap.get(`${oldSrcId}:${oldSrcPort}`)) || oldSrcPort;
        const newTgtPort =
          (oldTgtPort && idMap.get(`${oldTgtId}:${oldTgtPort}`)) || oldTgtPort;

        clonedLink.source = Object.assign({}, clonedLink.source, {
          id: newSrcId,
          port: newSrcPort,
        });
        clonedLink.target = Object.assign({}, clonedLink.target, {
          id: newTgtId,
          port: newTgtPort,
        });
        clonedLink.router = { name: "sldOrthogonal" };
        clonedLink.connector = { name: "normal" };

        const link = new joint.shapes.standard.Link(clonedLink);
        this.graph.addCell(link);
      }
    });

    // 3. Select all newly pasted elements
    this.selectCells(newElements);
    this.topologyTracker.applyStyles(this.paper);
    this.updateMinimap();
    this.pushHistory();
    this.scheduleAutoSave();
    this.showToast(`${newElements.length}개 설비가 붙여넣기되었습니다.`);
  }

  toggleSelectedEquipmentState(forcedState) {
    if (!this.selectedCells || this.selectedCells.length === 0) {
      if (this.selectedCell) {
        this.selectedCells = [this.selectedCell];
      } else {
        return;
      }
    }

    const targets = this.selectedCells.filter(
      (c) => c.isElement && c.isElement(),
    );
    if (targets.length === 0) return;

    let nextState = forcedState;
    if (!nextState) {
      const primaryCell = targets[0];
      const sldData = primaryCell.get("sldData") || {};
      const curState = (sldData.state || "LIVE").toUpperCase();
      const normState =
        curState === "CLOSED"
          ? "LIVE"
          : curState === "OPEN"
            ? "DEAD"
            : curState === "GROUND" || curState === "EARTH"
              ? "GROUNDED"
              : curState;

      // Cycle: LIVE (활선) -> DEAD (사선) -> GROUNDED (접지) -> LIVE (활선)
      nextState =
        normState === "LIVE"
          ? "DEAD"
          : normState === "DEAD"
            ? "GROUNDED"
            : "LIVE";
    }

    targets.forEach((cell) => {
      const sldData = cell.get("sldData") || {};
      sldData.state = nextState;
      cell.set("sldData", Object.assign({}, sldData));

      if (typeof cell.updateContactVisual === "function") {
        cell.updateContactVisual();
      }
      if (typeof cell.updateVisual === "function") {
        cell.updateVisual();
      }
    });

    const stateBtns = document.querySelectorAll(".state-toggle-btn");
    stateBtns.forEach((b) => {
      const bState = b.getAttribute("data-state");
      b.classList.toggle("active", bState === nextState);
    });

    const stateSelect = document.getElementById("prop-state");
    if (stateSelect) stateSelect.value = nextState;

    this.topologyTracker.applyStyles(this.paper);
    this.populateProperties();
    this.updateMinimap();
    this.pushHistory();
    this.scheduleAutoSave();

    const stateNames = {
      LIVE: "🔴 활선 (Live)",
      DEAD: "⚪ 사선 (Dead)",
      GROUNDED: "🟢 접지 (Ground)",
      GROUND: "🟢 접지 (Ground)",
    };
    if (targets.length > 1) {
      this.showToast(
        `선택된 ${targets.length}개 설비가 ${stateNames[nextState] || nextState} 상태로 변경되었습니다.`,
      );
    } else {
      this.showToast(`설비 상태: ${stateNames[nextState] || nextState}`);
    }
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
      const selectedIds = (this.selectedCells || [])
        .map((c) => c && c.id)
        .filter(Boolean);

      this.historyIndex--;
      this.isHistoryTracking = false;
      this.removeSelectionOverlay();
      this.graph.fromJSON(JSON.parse(this.history[this.historyIndex]));
      this.topologyTracker.applyStyles(this.paper);

      if (selectedIds.length > 0) {
        const newCells = selectedIds
          .map((id) => this.graph.getCell(id))
          .filter(Boolean);
        if (newCells.length > 0) {
          this.selectCells(newCells);
        } else {
          this.deselectAll();
        }
      } else {
        this.deselectAll();
      }

      this.updateMinimap();
      this.scheduleAutoSave();
      this.isHistoryTracking = true;
      this.showToast("실행취소 (Undo)");
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      const selectedIds = (this.selectedCells || [])
        .map((c) => c && c.id)
        .filter(Boolean);

      this.historyIndex++;
      this.isHistoryTracking = false;
      this.removeSelectionOverlay();
      this.graph.fromJSON(JSON.parse(this.history[this.historyIndex]));
      this.topologyTracker.applyStyles(this.paper);

      if (selectedIds.length > 0) {
        const newCells = selectedIds
          .map((id) => this.graph.getCell(id))
          .filter(Boolean);
        if (newCells.length > 0) {
          this.selectCells(newCells);
        } else {
          this.deselectAll();
        }
      } else {
        this.deselectAll();
      }

      this.updateMinimap();
      this.scheduleAutoSave();
      this.isHistoryTracking = true;
      this.showToast("다시실행 (Redo)");
    }
  }

  loadDiagram(diagramId) {
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("sld_diagram_") || k.startsWith("sld_current_")) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {}

    const cacheKey = "sld_diagram_v5_" + diagramId;

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
    if (!schema || !schema.cells || schema.cells.length === 0) return;

    // 1. Collect all non-link element IDs
    const elementIds = new Set();
    schema.cells.forEach((cell) => {
      if (cell.type !== "standard.Link" && cell.type !== "link") {
        if (cell.id) elementIds.add(cell.id);
      }
    });

    // 2. Validate, filter, and sanitize cells
    const validCells = [];
    schema.cells.forEach((cell) => {
      if (cell.type === "standard.Link" || cell.type === "link") {
        const srcId = cell.source?.id;
        const tgtId = cell.target?.id;
        if (
          !srcId ||
          !tgtId ||
          !elementIds.has(srcId) ||
          !elementIds.has(tgtId)
        ) {
          console.warn(
            "Skipping invalid link with missing endpoint:",
            cell.id,
            srcId,
            tgtId,
          );
          return;
        }
        cell.router = { name: "sldOrthogonal" };
        cell.connector = { name: "normal" };
        if (cell.attrs?.line?.targetMarker?.type === "none") {
          cell.attrs.line.targetMarker = { name: "none" };
        }
      } else {
        // Safety check: ensure shape type exists
        if (
          (cell.type === "sld.ACB" &&
            (!joint.shapes.sld || !joint.shapes.sld.ACB)) ||
          (cell.type === "sld.MCCB" &&
            (!joint.shapes.sld || !joint.shapes.sld.MCCB))
        ) {
          cell.type = "sld.Breaker";
        }
      }
      validCells.push(cell);
    });

    schema.cells = validCells;

    this.isHistoryTracking = false;
    try {
      this.graph.fromJSON(schema);
    } catch (e) {
      console.warn("Retrying graph loading with fallback types:", e);
      schema.cells.forEach((cell) => {
        if (
          cell.type &&
          cell.type.startsWith("sld.") &&
          (!joint.shapes.sld ||
            !joint.shapes.sld[cell.type.replace("sld.", "")])
        ) {
          cell.type = "sld.Breaker";
        }
      });
      this.graph.fromJSON(schema);
    }
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
