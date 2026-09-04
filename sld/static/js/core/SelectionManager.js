/**
 * SelectionManager.js
 * 단일/다중 선택, 고무줄(Lasso/Area) 영역 선택, 선택 바운딩박스/리사이즈 핸들 오버레이 및 선택 요소 조작(이동/삭제/상태전환)을 관리합니다.
 */
class SelectionManager {
  constructor(editor) {
    this.editor = editor;
    this.isAreaSelecting = false;
    this.areaSelectStart = { x: 0, y: 0 };
    this._isResizingBusbar = false;
  }

  get selectedCells() {
    return this.editor.selectedCells || [];
  }

  set selectedCells(val) {
    this.editor.selectedCells = val;
  }

  get selectedCell() {
    return this.editor.selectedCell || null;
  }

  set selectedCell(val) {
    this.editor.selectedCell = val;
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
      const view = this.editor.paper.findViewByModel(cell);
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
    if (this.editor.propertiesPanel) {
      this.editor.propertiesPanel.populateProperties(this.selectedCell);
    } else if (typeof this.editor.populateProperties === "function") {
      this.editor.populateProperties();
    }
  }

  selectCell(cell, append = false) {
    if (!cell) return;
    this.selectCells([cell], append);
  }

  _onSelectedCellTransform() {
    if (this._overlayRafId) return;
    this._overlayRafId = requestAnimationFrame(() => {
      this._overlayRafId = null;
      this.updateSelectionOverlay();
    });
  }

  updateSelectionOverlay() {
    this.removeSelectionOverlay();
    if (
      !this.selectedCells ||
      this.selectedCells.length === 0 ||
      !this.editor.paper
    )
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
            const gridSize =
              (this.editor.options && this.editor.options.gridSize) || 10;
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
              const paperPt = this.editor.paper.clientToLocalPoint({
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
              this.editor.updateMinimap();
              this.editor.pushHistory();
              this.editor.scheduleAutoSave();
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
      this.editor.paper.viewport ||
      (this.editor.paper.svg
        ? this.editor.paper.svg.querySelector(".joint-viewport") ||
          this.editor.paper.svg.querySelector("g") ||
          this.editor.paper.svg
        : null);
    if (viewport) {
      viewport.appendChild(overlay);
    }
  }

  removeSelectionOverlay() {
    if (this._overlayRafId) {
      cancelAnimationFrame(this._overlayRafId);
      this._overlayRafId = null;
    }
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
        const view = this.editor.paper.findViewByModel(cell);
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

    if (this.editor.propertiesPanel) {
      this.editor.propertiesPanel.clearProperties();
    } else if (typeof this.editor.clearProperties === "function") {
      this.editor.clearProperties();
    }
  }

  startAreaSelection(clientX, clientY) {
    this.isAreaSelecting = true;
    this.areaSelectStart = this.editor.paper.clientToLocalPoint({
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
        this.editor.paper.viewport ||
        (this.editor.paper.svg
          ? this.editor.paper.svg.querySelector(".joint-viewport") ||
            this.editor.paper.svg
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
    const p = this.editor.paper.clientToLocalPoint({ x: clientX, y: clientY });
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
    const elements = this.editor.graph.getElements();
    const selRect = { x: rx, y: ry, width: rw, height: rh };

    elements.forEach((el) => {
      const bbox = el.getBBox();
      const intersects =
        bbox.x < selRect.x + selRect.width &&
        bbox.x + bbox.width > selRect.x &&
        bbox.y < selRect.y + selRect.height &&
        bbox.y + bbox.height > selRect.y;

      const view = this.editor.paper.findViewByModel(el);
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

    const p = this.editor.paper.clientToLocalPoint({ x: clientX, y: clientY });
    const rx = Math.min(this.areaSelectStart.x, p.x);
    const ry = Math.min(this.areaSelectStart.y, p.y);
    const rw = Math.abs(p.x - this.areaSelectStart.x);
    const rh = Math.abs(p.y - this.areaSelectStart.y);

    const box = document.getElementById("sld-rubberband-box");
    if (box && box.parentNode) box.parentNode.removeChild(box);

    if (rw > 5 || rh > 5) {
      const selRect = { x: rx, y: ry, width: rw, height: rh };
      const elements = this.editor.graph.getElements();
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
          this.editor.showToast(`${matched.length}개 설비가 선택되었습니다.`);
        }
      } else if (!shiftKey) {
        this.deselectAll();
      }
    } else if (!shiftKey) {
      this.deselectAll();
    }
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

    this.editor._isBatchOperation = true;
    const wasTracking = this.editor.historyManager.isHistoryTracking;
    this.editor.historyManager.isHistoryTracking = false;

    targets.forEach((cell) => {
      if (cell.isElement && cell.isElement()) {
        cell.off(
          "change:position change:size",
          this._onSelectedCellTransform,
          this,
        );
      }
      const view = this.editor.paper.findViewByModel(cell);
      if (view && view.el) {
        view.el.classList.remove("sld-selected");
      }
      cell.remove();
    });

    if (this.editor.busbarManager) {
      this.editor.busbarManager.cleanupUnusedBusbarPorts();
    }
    if (this.editor.tJunctionManager) {
      this.editor.tJunctionManager.cleanupOrphanedJunctions();
    }

    this.editor._isBatchOperation = false;
    this.editor.historyManager.isHistoryTracking = wasTracking;

    this.editor.refreshAllLinks();
    this.removeSelectionOverlay();
    this.selectedCells = [];
    this.selectedCell = null;

    if (this.editor.propertiesPanel) {
      this.editor.propertiesPanel.clearProperties();
    }

    if (this.editor.topologyTracker) {
      this.editor.topologyTracker.applyStyles(this.editor.paper);
    }
    this.editor.updateMinimap();
    this.editor.pushHistory();
    this.editor.scheduleAutoSave();
    this.editor.showToast(`${count}개 항목이 삭제되었습니다.`);
  }

  nudgeSelected(dx, dy) {
    if (!this.selectedCells || this.selectedCells.length === 0) {
      if (this.selectedCell) {
        this.selectedCells = [this.selectedCell];
      } else {
        return;
      }
    }

    const elements = this.selectedCells.filter(
      (c) => c && c.isElement && c.isElement(),
    );
    if (elements.length === 0) return;

    elements.forEach((el) => {
      const pos = el.position();
      el.position(pos.x + dx, pos.y + dy);
      if (this.editor.busbarManager) {
        this.editor.busbarManager.syncConnectedBusbarPorts(el);
      }
    });

    this.updateSelectionOverlay();
    if (this.editor.topologyTracker) {
      this.editor.topologyTracker.applyStyles(this.editor.paper);
    }
    this.editor.updateMinimap();
    this.editor.pushHistory();
    this.editor.scheduleAutoSave();
  }

  rotateSelected(deltaAngle = 90, absolute = false) {
    if (!this.selectedCells || this.selectedCells.length === 0) {
      if (this.selectedCell) {
        this.selectedCells = [this.selectedCell];
      } else {
        return;
      }
    }

    const elements = this.selectedCells.filter(
      (c) => c && c.isElement && c.isElement(),
    );
    if (elements.length === 0) return;

    elements.forEach((el) => {
      const sldData = el.get("sldData") || {};
      const curAngle =
        sldData.angle !== undefined
          ? sldData.angle
          : el.angle
            ? el.angle()
            : el.get("angle") || 0;

      let targetAngle;
      if (absolute) {
        targetAngle = ((deltaAngle % 360) + 360) % 360;
      } else {
        targetAngle = (((curAngle + deltaAngle) % 360) + 360) % 360;
      }

      const physicalAngle = targetAngle === 90 || targetAngle === 270 ? 90 : 0;

      if (typeof el.rotate === "function") {
        el.rotate(physicalAngle, true);
      }
      sldData.angle = targetAngle;
      el.set("sldData", Object.assign({}, sldData));

      if (typeof el.updateContactVisual === "function") {
        el.updateContactVisual();
      } else if (typeof el.updateVisual === "function") {
        el.updateVisual();
      } else if (typeof el.updateFromSldData === "function") {
        el.updateFromSldData();
      }

      if (this.editor.busbarManager) {
        this.editor.busbarManager.syncConnectedBusbarPorts(el);
      }
    });

    this.updateSelectionOverlay();
    if (this.editor.propertiesPanel) {
      if (
        typeof this.editor.propertiesPanel.populateProperties === "function"
      ) {
        this.editor.propertiesPanel.populateProperties(
          this.selectedCell || elements[0],
        );
      } else if (
        typeof this.editor.propertiesPanel.updateFieldsVisibility === "function"
      ) {
        this.editor.propertiesPanel.updateFieldsVisibility();
      }
    }
    if (this.editor.topologyTracker) {
      this.editor.topologyTracker.applyStyles(this.editor.paper);
    }
    this.editor.updateMinimap();
    this.editor.pushHistory();
    this.editor.scheduleAutoSave();
    this.editor.showToast("심볼 90° 회전 완료");
  }

  toggleSelectedEquipmentState(forcedState) {
    if (!this.selectedCells || this.selectedCells.length === 0) {
      if (this.selectedCell) {
        this.selectedCells = [this.selectedCell];
      } else {
        return;
      }
    }

    const switchables = this.selectedCells.filter((cell) => {
      return cell && cell.isElement && cell.isElement();
    });

    if (switchables.length === 0) return;

    let targetState = forcedState;

    if (!targetState) {
      // Toggle logic: If any is OPEN/OFF/DEAD, turn ALL to LIVE/CLOSED/ON. Otherwise turn ALL to DEAD/OPEN.
      const hasInactive = switchables.some((cell) => {
        const sldData = cell.get("sldData") || {};
        const state = (
          sldData.state || (sldData.type === "GENERATOR" ? "DEAD" : "LIVE")
        ).toUpperCase();
        return state === "OPEN" || state === "OFF" || state === "DEAD";
      });
      targetState = hasInactive ? "LIVE" : "DEAD";
    }

    switchables.forEach((cell) => {
      const sldData = cell.get("sldData") || {};
      const catalog =
        (window.EQUIPMENT_CATALOG && window.EQUIPMENT_CATALOG[sldData.type]) ||
        {};
      let nextState = targetState;

      if (
        sldData.type === "ES" ||
        sldData.type === "GROUND_SWITCH" ||
        sldData.type === "GROUND"
      ) {
        nextState =
          targetState === "LIVE" || targetState === "CLOSED"
            ? "CLOSED"
            : "OPEN";
      } else if (
        sldData.type === "DS_3P" ||
        cell.get("type") === "sld.Disconnector3P"
      ) {
        if (
          targetState === "GROUNDED" ||
          targetState === "GROUND" ||
          targetState === "EARTH"
        ) {
          nextState = "EARTH";
        } else if (
          targetState === "DEAD" ||
          targetState === "OPEN" ||
          targetState === "OFF"
        ) {
          nextState = "OPEN";
        } else {
          nextState = "CLOSED";
        }
      } else if (
        catalog.subCategory === "SWITCH" ||
        sldData.type?.startsWith("CB_") ||
        sldData.type === "DS" ||
        sldData.type === "FUSE"
      ) {
        nextState =
          targetState === "DEAD" ||
          targetState === "OPEN" ||
          targetState === "OFF"
            ? "OPEN"
            : "CLOSED";
      } else if (
        sldData.type === "GENERATOR" ||
        sldData.type === "UPS" ||
        sldData.type === "BATTERY"
      ) {
        nextState =
          targetState === "DEAD" ||
          targetState === "OPEN" ||
          targetState === "OFF"
            ? "DEAD"
            : "LIVE";
        sldData.isOnline = nextState === "LIVE";
      } else {
        nextState = targetState;
      }

      sldData.state = nextState;
      cell.set("sldData", Object.assign({}, sldData));

      if (typeof cell.updateContactState === "function") {
        cell.updateContactState(nextState);
      }
      if (typeof cell.updateContactVisual === "function") {
        cell.updateContactVisual(nextState);
      }
      if (typeof cell.updateVisual === "function") {
        cell.updateVisual(nextState);
      }
      if (typeof cell.updateFromSldData === "function") {
        cell.updateFromSldData(nextState);
      }
    });

    if (this.editor.topologyTracker) {
      this.editor.topologyTracker.applyStyles(this.editor.paper);
    }
    if (this.editor.propertiesPanel) {
      if (
        typeof this.editor.propertiesPanel.populateProperties === "function"
      ) {
        this.editor.propertiesPanel.populateProperties(this.selectedCell);
      } else if (typeof this.editor.propertiesPanel.populate === "function") {
        this.editor.propertiesPanel.populate(this.selectedCell);
      }
    } else if (typeof this.editor.populateProperties === "function") {
      this.editor.populateProperties(this.selectedCell);
    }
    this.editor.updateMinimap();
    this.editor.pushHistory();
    this.editor.scheduleAutoSave();

    const stateNames = {
      LIVE: "가동/통전(ON)",
      CLOSED: "투입(ON)",
      OPEN: "개방(OFF)",
      DEAD: "정지/비통전(OFF)",
      OFF: "차단(OFF)",
      EARTH: "접지(EARTH)",
    };
    this.editor.showToast(
      `설비 상태: ${stateNames[targetState] || targetState}`,
    );
  }
}

if (typeof window !== "undefined") {
  window.SelectionManager = SelectionManager;
}
