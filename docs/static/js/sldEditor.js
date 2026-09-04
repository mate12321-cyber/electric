/**
 * sldEditor.js
 * SLD(Single-Line Diagram) 전문 전력 계통도 캔버스 메인 에디터 오케스트레이터
 */

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
    this._activeDrawingLink = null;
    this._wireSource = null;

    // Sub-Managers (관심사 분리)
    this.historyManager = new HistoryManager(this);
    this.clipboardManager = new ClipboardManager(this);
    this.selectionManager = new SelectionManager(this);
    this.tJunctionManager = new TJunctionManager(this);
    this.busbarManager = new BusbarManager(this);
    this.propertiesPanel = new PropertiesPanel(this);
    this.paletteManager = new PaletteManager(this);
    this.toolbarManager = new ToolbarManager(this);
    this.keyboardManager = new KeyboardManager(this);
    this.batchRenameManager = new BatchRenameManager(this);

    this.init();
  }

  // --- Getter/Setter Proxies for Backward Compatibility ---
  get history() {
    return this.historyManager.history;
  }
  set history(v) {
    this.historyManager.history = v;
  }
  get historyIndex() {
    return this.historyManager.historyIndex;
  }
  set historyIndex(v) {
    this.historyManager.historyIndex = v;
  }
  get isHistoryTracking() {
    return this.historyManager.isHistoryTracking;
  }
  set isHistoryTracking(v) {
    this.historyManager.isHistoryTracking = v;
  }
  get _clipboard() {
    return this.clipboardManager.clipboard;
  }
  set _clipboard(v) {
    this.clipboardManager.clipboard = v;
  }
  get _snappedTBranch() {
    return this.tJunctionManager._snappedTBranch;
  }
  set _snappedTBranch(v) {
    this.tJunctionManager._snappedTBranch = v;
  }

  init() {
    if (!this.container) return;

    // 1. Initialize JointJS Graph & Paper
    this.graph = new joint.dia.Graph();
    this.topologyTracker = new PowerSystemTopologyTracker(this.graph, this);

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
      defaultLink: (cellView) => {
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
      validateConnection: function (cellViewS, magnetS, cellViewT, magnetT) {
        if (cellViewS === cellViewT) return false;
        if (!magnetS || !magnetT) return false;
        return true;
      },
      interactive: (cellView) => {
        if (this.activeTool === "pan") return false;
        if (this.activeTool === "select") {
          const type = cellView.model.get("type");
          if (
            type === "sld.Junction" ||
            cellView.model.get("sldData")?.type === "JUNCTION"
          ) {
            return { elementMove: true, addLinkFromMagnet: false };
          }
        }
        return true;
      },
    });

    // 2. Setup Events and Sub-Managers
    this.setupCanvasEvents();
    this.paletteManager.setupDragDrop();
    this.setupCellInteractions();
    this.propertiesPanel.setup();
    this.toolbarManager.setupToolbar();
    this.keyboardManager.setupKeyboardShortcuts();
    if (this.batchRenameManager) this.batchRenameManager.setup();
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

    // Mouse Move -> Status Coordinates & Pan Drag & Area Selection Drag & T-Branch Live Preview
    paperEl.addEventListener("mousemove", (e) => {
      const p = this.paper.clientToLocalPoint({ x: e.clientX, y: e.clientY });

      const coordEl = document.getElementById("status-coord");
      if (coordEl) {
        coordEl.innerText = "X: " + Math.round(p.x) + ", Y: " + Math.round(p.y);
      }

      // Live T-Branch Preview when dragging a wire or using Wire Tool
      const drawingSrc =
        (this._activeDrawingLink && this._activeDrawingLink.get("source")) ||
        (this.activeTool === "wire" ? this._wireSource : null);

      if (drawingSrc && drawingSrc.id) {
        const found = this.tJunctionManager.findTBranchTarget(
          p,
          drawingSrc,
          50,
        );

        if (found) {
          const jx = found.projection.x;
          const jy = found.projection.y;
          const srcEl = this.graph.getCell(drawingSrc.id);

          if (this._activeDrawingLink) {
            this._activeDrawingLink.set({
              target: { x: jx, y: jy },
              vertices: [],
            });
          }

          const wireColor =
            this.topologyTracker.getElementVoltageColor(srcEl) || "#377DFF";
          this.tJunctionManager.showTBranchPreview({ x: jx, y: jy }, wireColor);
          this._snappedTBranch = {
            link: found.link,
            projection: { x: jx, y: jy },
            source: drawingSrc,
          };
        } else {
          this.tJunctionManager.hideTBranchPreview();
          this._snappedTBranch = null;
        }
      } else {
        this.tJunctionManager.hideTBranchPreview();
        this._snappedTBranch = null;
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
      } else if (this.selectionManager.isAreaSelecting) {
        this.selectionManager.updateAreaSelection(e.clientX, e.clientY);
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
            if (!e.shiftKey) {
              this.deselectAll();
            }
            this.selectionManager.startAreaSelection(e.clientX, e.clientY);
          } else if (this.activeTool === "select") {
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            this._panOriginStart = { x: e.clientX, y: e.clientY };
            paperEl.style.cursor = "grabbing";
          }
        }
      }
    });

    window.addEventListener("mouseup", (e) => {
      this.tJunctionManager.hideTBranchPreview();

      if (this.isPanning) {
        this.isPanning = false;
        paperEl.style.cursor = this.isSpacePressed ? "grab" : "default";

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

      if (this.selectionManager.isAreaSelecting) {
        this.selectionManager.finishAreaSelection(
          e.clientX,
          e.clientY,
          e.shiftKey,
        );
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

      // 1. If snapped to a T-branch during live drag, finish T-branch connection
      if (this._snappedTBranch) {
        const snapped = this._snappedTBranch;
        this._snappedTBranch = null;
        if (this._activeDrawingLink) {
          this._activeDrawingLink.remove();
          this._activeDrawingLink = null;
        }
        this._lastDrawingSource = null;
        this._pendingLinkDrop = null;
        this.tJunctionManager.splitLinkAtPoint(
          snapped.link,
          snapped.projection,
          snapped.source,
        );
        return;
      }

      // 2. Fallback check if user was dragging a wire and dropped it over an existing wire line
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

        const branchTarget =
          this._snappedTBranch ||
          this.tJunctionManager.findTBranchTarget(paperPt, srcInfo, 50);

        if (
          branchTarget &&
          branchTarget.link &&
          branchTarget.link.get("source")?.id !== srcInfo.id &&
          branchTarget.link.get("target")?.id !== srcInfo.id
        ) {
          if (linkToRemove) {
            linkToRemove.remove();
          }
          this.tJunctionManager.splitLinkAtPoint(
            branchTarget.link,
            branchTarget.projection,
            srcInfo,
          );
        }
        this._snappedTBranch = null;
      } else {
        this._activeDrawingLink = null;
        this._lastDrawingSource = null;
        this._snappedTBranch = null;
      }
    });

    paperEl.addEventListener("contextmenu", (e) => e.preventDefault());

    // Mouse Wheel Zoom
    paperEl.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.toolbarManager.zoom(delta, { x: e.clientX, y: e.clientY });
      },
      { passive: false },
    );

    // Graph Real-time Transform -> Update Connected & Cross-Intersected Links & Throttled Minimap
    this.graph.on("change:position change:size", (element) => {
      if (this._isBatchOperation || !this.historyManager?.isHistoryTracking)
        return;
      if (element && element.isElement && element.isElement()) {
        if (!this._isMultiDragging) {
          this.busbarManager.syncConnectedBusbarPorts(element);
          this.updateAffectedLinks(element);
        }
      }
      this.requestMinimapUpdate();
      this.scheduleAutoSave();
    });

    this.graph.on("change:vertices change:source change:target", () => {
      if (this._isBatchOperation || !this.historyManager?.isHistoryTracking)
        return;
      this.refreshAllLinks();
    });

    this.graph.on("add remove change:sldData", () => {
      if (this._isBatchOperation || !this.historyManager?.isHistoryTracking)
        return;
      this.refreshAllLinks();
      this.topologyTracker.applyStyles(this.paper);
      this.requestMinimapUpdate();
      this.pushHistory();
      this.scheduleAutoSave();
    });
  }

  updateAffectedLinks(element) {
    if (!this.paper || !this.graph || !element) return;
    const connected = this.graph.getConnectedLinks(element);
    const linksToUpdate = new Set(connected);

    // Compute bounding box of moving element + its connected links
    const elPos = element.position ? element.position() : { x: 0, y: 0 };
    const elSize = element.size ? element.size() : { width: 0, height: 0 };
    let minX = elPos.x - 20;
    let maxX = elPos.x + elSize.width + 20;
    let minY = elPos.y - 20;
    let maxY = elPos.y + elSize.height + 20;

    connected.forEach((link) => {
      const view = this.paper.findViewByModel(link);
      const pts = (view && view._polyPoints) || null;
      if (pts) {
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (p.x - 20 < minX) minX = p.x - 20;
          if (p.x + 20 > maxX) maxX = p.x + 20;
          if (p.y - 20 < minY) minY = p.y - 20;
          if (p.y + 20 > maxY) maxY = p.y + 20;
        }
      }
    });

    const currentBBox = { minX, maxX, minY, maxY };
    const checkBBox = element._prevMoveBBox
      ? {
          minX: Math.min(minX, element._prevMoveBBox.minX),
          maxX: Math.max(maxX, element._prevMoveBBox.maxX),
          minY: Math.min(minY, element._prevMoveBBox.minY),
          maxY: Math.max(maxY, element._prevMoveBBox.maxY),
        }
      : currentBBox;
    element._prevMoveBBox = currentBBox;

    // Find all stationary links in the graph whose AABB intersects with the moving zone
    const allLinks = this.graph.getLinks();
    allLinks.forEach((otherLink) => {
      if (linksToUpdate.has(otherLink)) return;
      const oView = this.paper.findViewByModel(otherLink);
      const oPts = oView && oView._polyPoints;
      if (oPts && oPts.length >= 2) {
        let oMinX = Infinity,
          oMaxX = -Infinity,
          oMinY = Infinity,
          oMaxY = -Infinity;
        for (let k = 0; k < oPts.length; k++) {
          const op = oPts[k];
          if (op.x < oMinX) oMinX = op.x;
          if (op.x > oMaxX) oMaxX = op.x;
          if (op.y < oMinY) oMinY = op.y;
          if (op.y > oMaxY) oMaxY = op.y;
        }

        if (
          !(
            checkBBox.maxX < oMinX ||
            checkBBox.minX > oMaxX ||
            checkBBox.maxY < oMinY ||
            checkBBox.minY > oMaxY
          )
        ) {
          linksToUpdate.add(otherLink);
        }
      }
    });

    linksToUpdate.forEach((link) => {
      const view = this.paper.findViewByModel(link);
      if (view && typeof view.update === "function") {
        view.update();
      }
    });
  }

  refreshAllLinks() {
    if (!this.paper || !this.graph) return;
    const links = this.graph.getLinks();
    links.forEach((link) => {
      const view = this.paper.findViewByModel(link);
      if (view && typeof view.update === "function") {
        view.update();
      }
    });
  }

  setupCellInteractions() {
    // Element Pointer Down
    this.paper.on("element:pointerdown", (elementView, evt) => {
      const el = elementView.model;
      const sldData = el.get("sldData") || {};
      const catalog =
        (window.EQUIPMENT_CATALOG && window.EQUIPMENT_CATALOG[sldData.type]) ||
        {};

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

      if (!this.selectedCells.includes(el)) {
        this.selectCell(el);
      }

      // Hide/remove selection overlay during drag for zero overhead & cleaner UX
      this.removeSelectionOverlay();

      // Record starting positions for multi-drag
      if (this.selectedCells.length > 1) {
        this._multiDragStarts = this.selectedCells.map((c) => ({
          cell: c,
          pos: Object.assign({}, c.position()),
        }));
        this._multiDragPivotStart = Object.assign({}, el.position());
        this._isMultiDragging = true;

        let multiDragRafId = null;
        const onPivotChange = () => {
          if (!this._isMultiDragging) return;
          if (multiDragRafId) return;
          multiDragRafId = requestAnimationFrame(() => {
            multiDragRafId = null;
            if (!this._isMultiDragging) return;
            const curPos = el.position();
            const dx = curPos.x - this._multiDragPivotStart.x;
            const dy = curPos.y - this._multiDragPivotStart.y;

            this._multiDragStarts.forEach((item) => {
              if (item.cell.id !== el.id) {
                item.cell.position(item.pos.x + dx, item.pos.y + dy);
              }
            });
          });
        };

        el.on("change:position", onPivotChange);
        this._cleanupPivotDrag = () => {
          if (multiDragRafId) {
            cancelAnimationFrame(multiDragRafId);
            multiDragRafId = null;
          }
          el.off("change:position", onPivotChange);
          this._isMultiDragging = false;
        };
      }

      // If clicked on contact blade, toggle OPEN/CLOSED state
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
        const pivotEl = elementView ? elementView.model : this.selectedCells[0];
        if (pivotEl && pivotEl.isElement && pivotEl.isElement()) {
          const oldPos = Object.assign({}, pivotEl.position());
          this.paletteManager.snapElementToPortGrid(pivotEl);
          const newPos = pivotEl.position();
          const ddx = newPos.x - oldPos.x;
          const ddy = newPos.y - oldPos.y;

          this.selectedCells.forEach((c) => {
            if (c.isElement && c.isElement() && c.id !== pivotEl.id) {
              c.position(c.position().x + ddx, c.position().y + ddy);
            }
            this.busbarManager.syncConnectedBusbarPorts(c);
          });
        }
      } else {
        const el = elementView ? elementView.model : null;
        if (el && el.isElement && el.isElement()) {
          this.paletteManager.snapElementToPortGrid(el);
          this.busbarManager.syncConnectedBusbarPorts(el);
        }
      }

      this._isDraggingElement = false;
      if (elementView && elementView.model) {
        elementView.model._prevMoveBBox = null;
      }
      this.selectedCells.forEach((c) => {
        if (c && c.isElement && c.isElement()) {
          c._prevMoveBBox = null;
        }
      });

      this.refreshAllLinks();
      this.topologyTracker.applyStyles(this.paper);
      this.updateSelectionOverlay();
      this.updateMinimap();
      this.pushHistory();
      this.scheduleAutoSave();
    });

    // Double click element -> toggle equipment state (Generator START/STOP, Breaker OPEN/CLOSE)
    this.paper.on("element:pointerdblclick", (elementView) => {
      const el = elementView ? elementView.model : null;
      if (!el || !el.isElement || !el.isElement()) return;
      this.selectCell(el);
      this.selectionManager.toggleSelectedEquipmentState();
    });

    // Blank Click in Wire Tool -> T-junction if near wire
    this.paper.on("blank:pointerdown", (evt, x, y) => {
      if (this.activeTool === "wire" && this._wireSource) {
        const found = this.tJunctionManager.findLinkAtPoint({ x, y }, 35);
        if (
          found &&
          found.link.get("source")?.id !== this._wireSource.id &&
          found.link.get("target")?.id !== this._wireSource.id
        ) {
          this.tJunctionManager.splitLinkAtPoint(
            found.link,
            found.projection,
            this._wireSource,
          );
          this._wireSource = null;
        }
      }
    });

    this.paper.on("link:pointerdown", (linkView, evt) => {
      if (this.activeTool === "wire") {
        const paperPt = this.paper.clientToLocalPoint({
          x: evt.clientX,
          y: evt.clientY,
        });
        const found = this.tJunctionManager.findLinkAtPoint(paperPt, 35) || {
          link: linkView.model,
          projection: paperPt,
        };
        if (found) {
          if (this._wireSource) {
            if (
              found.link.get("source")?.id !== this._wireSource.id &&
              found.link.get("target")?.id !== this._wireSource.id
            ) {
              this.tJunctionManager.splitLinkAtPoint(
                found.link,
                found.projection,
                this._wireSource,
              );
              this._wireSource = null;
              return;
            }
          } else {
            const res = this.tJunctionManager.splitLinkAtPoint(
              found.link,
              found.projection,
            );
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
          this.busbarManager.cleanupUnusedBusbarPorts();
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
      this.busbarManager.cleanupUnusedBusbarPorts();
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
      this.busbarManager.autoCreateBusbarPort(link);
      this.busbarManager.cleanupUnusedBusbarPorts();
      this.topologyTracker.applyStyles(this.paper);
      this.updateMinimap();
      this.scheduleAutoSave();
    });

    this.graph.on("add", (cell) => {
      if (this._isBatchOperation || !this.historyManager?.isHistoryTracking)
        return;
      if (cell.isLink && cell.isLink()) {
        const src = cell.get("source");
        const tgt = cell.get("target");
        if (src && src.id && (!tgt || !tgt.id)) {
          this._activeDrawingLink = cell;
          this._lastDrawingSource = Object.assign({}, src);
        }
        this.busbarManager.autoCreateBusbarPort(cell);
      }
    });

    this.graph.on("remove", (cell) => {
      if (this._isBatchOperation || !this.historyManager?.isHistoryTracking)
        return;
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
        this.busbarManager.cleanupUnusedBusbarPorts();
      }
    });

    this.graph.on("change:source change:target", (link) => {
      if (this._isBatchOperation || !this.historyManager?.isHistoryTracking)
        return;
      if (link.isLink && link.isLink()) {
        this.busbarManager.autoCreateBusbarPort(link);
        this.busbarManager.cleanupUnusedBusbarPorts();
      }
    });

    this.graph.on("remove", (cell) => {
      if (this._isBatchOperation || !this.historyManager?.isHistoryTracking)
        return;
      if (cell) {
        this.busbarManager.cleanupUnusedBusbarPorts();
        this.tJunctionManager.cleanupOrphanedJunctions();
        this.refreshAllLinks();
      }
    });
  }

  // --- Public Interface Methods Delegated to Sub-Managers ---
  pushHistory() {
    this.historyManager.pushHistory();
  }
  undo() {
    this.historyManager.undo();
  }
  redo() {
    this.historyManager.redo();
  }
  copySelected() {
    this.clipboardManager.copySelected();
  }
  pasteCopied() {
    this.clipboardManager.pasteCopied();
  }
  duplicateSelected() {
    this.clipboardManager.duplicateSelected();
  }
  selectCells(cells, append = false) {
    this.selectionManager.selectCells(cells, append);
  }
  selectCell(cell, append = false) {
    this.selectionManager.selectCell(cell, append);
  }
  deselectAll() {
    this.selectionManager.deselectAll();
  }
  deleteSelected() {
    this.selectionManager.deleteSelected();
  }
  nudgeSelected(dx, dy) {
    this.selectionManager.nudgeSelected(dx, dy);
  }
  toggleSelectedEquipmentState(forcedState) {
    this.selectionManager.toggleSelectedEquipmentState(forcedState);
  }
  rotateSelected(deltaAngle, absolute) {
    if (this.selectionManager) {
      this.selectionManager.rotateSelected(deltaAngle, absolute);
    }
  }
  updateSelectionOverlay() {
    this.selectionManager.updateSelectionOverlay();
  }
  removeSelectionOverlay() {
    this.selectionManager.removeSelectionOverlay();
  }
  startAreaSelection(clientX, clientY) {
    this.selectionManager.startAreaSelection(clientX, clientY);
  }
  updateAreaSelection(clientX, clientY) {
    this.selectionManager.updateAreaSelection(clientX, clientY);
  }
  finishAreaSelection(clientX, clientY, shiftKey) {
    this.selectionManager.finishAreaSelection(clientX, clientY, shiftKey);
  }

  getLinkPoints(link) {
    return this.tJunctionManager.getLinkPoints(link);
  }
  findTBranchTarget(paperPoint, sourceInfo, maxDist = 50) {
    return this.tJunctionManager.findTBranchTarget(
      paperPoint,
      sourceInfo,
      maxDist,
    );
  }
  findLinkAtPoint(
    paperPoint,
    maxDist = 25,
    excludeLinkId = null,
    excludeElementId = null,
  ) {
    return this.tJunctionManager.findLinkAtPoint(
      paperPoint,
      maxDist,
      excludeLinkId,
      excludeElementId,
    );
  }
  showTBranchPreview(paperPoint, color = "#377DFF") {
    this.tJunctionManager.showTBranchPreview(paperPoint, color);
  }
  hideTBranchPreview() {
    this.tJunctionManager.hideTBranchPreview();
  }
  splitLinkAtPoint(targetLink, projPoint, newSourceInfo = null) {
    return this.tJunctionManager.splitLinkAtPoint(
      targetLink,
      projPoint,
      newSourceInfo,
    );
  }
  cleanupOrphanedJunctions() {
    this.tJunctionManager.cleanupOrphanedJunctions();
  }

  getCellPortOffset(cell, portId) {
    return this.busbarManager.getCellPortOffset(cell, portId);
  }
  autoCreateBusbarPort(link) {
    this.busbarManager.autoCreateBusbarPort(link);
  }
  cleanupUnusedBusbarPorts() {
    this.busbarManager.cleanupUnusedBusbarPorts();
  }
  syncConnectedBusbarPorts(element) {
    this.busbarManager.syncConnectedBusbarPorts(element);
  }

  setupPropertiesPanel() {
    this.propertiesPanel.setup();
  }
  populateProperties(cell) {
    this.propertiesPanel.populateProperties(cell);
  }
  clearProperties() {
    this.propertiesPanel.clearProperties();
  }

  setupPaletteDragDrop() {
    this.paletteManager.setupDragDrop();
  }
  createElement(type, x, y) {
    return this.paletteManager.createElement(type, x, y);
  }
  getPrimaryPortOffset(type, width, height, cellOrClass) {
    return this.paletteManager.getPrimaryPortOffset(
      type,
      width,
      height,
      cellOrClass,
    );
  }
  snapElementToPortGrid(el) {
    this.paletteManager.snapElementToPortGrid(el);
  }

  setupToolbar() {
    this.toolbarManager.setupToolbar();
  }
  setActiveTool(toolName) {
    this.toolbarManager.setActiveTool(toolName);
  }
  zoom(delta, clientPoint) {
    this.toolbarManager.zoom(delta, clientPoint);
  }
  setZoom(value) {
    this.toolbarManager.setZoom(value);
  }
  zoomToFit() {
    this.toolbarManager.zoomToFit();
  }
  updateZoomDisplay() {
    this.toolbarManager.updateZoomDisplay();
  }

  setupKeyboardShortcuts() {
    this.keyboardManager.setupKeyboardShortcuts();
  }

  getPaperPoint(clientX, clientY) {
    const p = this.paper.clientToLocalPoint({ x: clientX, y: clientY });
    const gridSize = this.options.gridSize || 10;
    return {
      x: Math.round(p.x / gridSize) * gridSize,
      y: Math.round(p.y / gridSize) * gridSize,
    };
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

  // --- Diagram Storage, Minimap & Modals ---
  loadDiagram(diagramId) {
    const cacheKey = "sld_diagram_" + diagramId;

    const isValidSchema = (s) => {
      if (!s || typeof s !== "object") return false;
      if (Array.isArray(s.elements) && s.elements.length > 0) return true;
      if (Array.isArray(s.links) && s.links.length > 0) return true;
      if (Array.isArray(s.cells) && s.cells.length > 0) return true;
      return false;
    };

    fetch("/api/sld/" + diagramId + "/")
      .then((res) => {
        if (!res.ok) throw new Error("API not available");
        return res.json();
      })
      .then((data) => {
        if (data.schema_data && isValidSchema(data.schema_data)) {
          this.applyLoadedSchema(data.schema_data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data.schema_data));
          } catch (e) {}
        } else {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              const schema = JSON.parse(cached);
              if (isValidSchema(schema)) {
                this.applyLoadedSchema(schema);
                return;
              }
            } catch (e) {}
          }
          if (
            window.DEFAULT_SLD_SCHEMA &&
            isValidSchema(window.DEFAULT_SLD_SCHEMA)
          ) {
            this.applyLoadedSchema(window.DEFAULT_SLD_SCHEMA);
          }
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
            if (isValidSchema(schema)) {
              this.applyLoadedSchema(schema);
              this.startStaticTelemetrySimulation();
              return;
            }
          } catch (e) {}
        }
        if (
          window.DEFAULT_SLD_SCHEMA &&
          isValidSchema(window.DEFAULT_SLD_SCHEMA)
        ) {
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
    if (!schema || (!schema.elements && !schema.links)) return;

    this.isHistoryTracking = false;
    this._isBatchOperation = true;

    const parsed = SLDSerializer.fromCompactJSON(schema);
    this.graph.clear();
    this.graph.addCells([...parsed.elements, ...parsed.links]);
    const restoredMeta = parsed.meta || {};

    this.busbarManager.cleanupUnusedBusbarPorts();
    this.tJunctionManager.cleanupOrphanedJunctions();
    const busbars = this.graph
      .getElements()
      .filter(
        (el) =>
          el.get("type") === "sld.Busbar" ||
          el.get("sldData")?.type === "BUSBAR",
      );
    busbars.forEach((b) => this.busbarManager.syncConnectedBusbarPorts(b));
    this.topologyTracker.applyStyles(this.paper);

    this._isBatchOperation = false;
    this.isHistoryTracking = true;
    this.pushHistory();
    this.updateMinimap();

    // Restore saved viewport or auto zoom to fit
    if (
      restoredMeta.viewport &&
      typeof restoredMeta.viewport.zoom === "number"
    ) {
      const vp = restoredMeta.viewport;
      this.paper.scale(vp.zoom, vp.zoom);
      this.paper.translate(vp.x || 0, vp.y || 0);
    } else {
      this.zoomToFit();
      setTimeout(() => this.zoomToFit(), 100);
      setTimeout(() => this.zoomToFit(), 400);
    }
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

  saveDiagram(isManual = false) {
    const schemaData =
      typeof SLDSerializer !== "undefined"
        ? SLDSerializer.toCompactJSON(this.graph, this.paper, {
            diagramId: this.options.diagramId,
          })
        : this.graph.toJSON();

    const data = {
      schema_data: schemaData,
    };

    const cacheKey = "sld_diagram_" + this.options.diagramId;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(schemaData));
    } catch (e) {}

    const csrfToken =
      document.querySelector("[name=csrfmiddlewaretoken]")?.value || "";

    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];

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
          autoSaveBadge.innerHTML =
            "☁️ 서버 저장 완료 " +
            timeStr +
            ' <span style="color:#52c41a">✓</span>';
        }
        if (isManual) {
          this.showToast("프로젝트가 서버에 안전하게 저장되었습니다.");
        }
      })
      .catch(() => {
        const autoSaveBadge = document.getElementById("auto-save-status");
        if (autoSaveBadge) {
          autoSaveBadge.innerHTML =
            "💾 로컬 저장 완료 " +
            timeStr +
            ' <span style="color:#52c41a">✓</span>';
        }
        if (isManual) {
          this.showToast(
            "프로젝트가 브라우저에 저장되었습니다. (" + timeStr + ")",
          );
        }
      });
  }

  scheduleAutoSave() {
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.saveDiagram(false);
    }, 4000);
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

      const targetPaperX = this._minimapBounds.x + clickX / this._minimapScale;
      const targetPaperY = this._minimapBounds.y + clickY / this._minimapScale;

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

  requestMinimapUpdate() {
    if (this._minimapRafId) return;
    this._minimapRafId = requestAnimationFrame(() => {
      this._minimapRafId = null;
      this.updateMinimap();
    });
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

    let svgHtml = "";

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
        // Skip
      } else {
        svgHtml += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${color}" stroke="${color}" stroke-width="0.5" />`;
      }
    });

    minimapContent.innerHTML = svgHtml;

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

  openBatchRenameModal(cells = null) {
    if (this.batchRenameManager) {
      this.batchRenameManager.openModal(cells);
    }
  }
}

window.SLDEditor = SLDEditor;
