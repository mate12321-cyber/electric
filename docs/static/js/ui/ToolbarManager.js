/**
 * ToolbarManager.js
 * 상단 툴바(도구 전환, 확대/축소/화면맞춤, 내보내기, 그리드 스냅 토글 등)를 관리합니다.
 */
class ToolbarManager {
  constructor(editor) {
    this.editor = editor;
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

    // Toolbar Rotate button (90deg)
    const btnRotateToolbar = document.getElementById("btn-rotate-toolbar");
    if (btnRotateToolbar) {
      btnRotateToolbar.addEventListener("click", () => {
        if (this.editor.selectionManager) {
          this.editor.selectionManager.rotateSelected(90);
        } else if (typeof this.editor.rotateSelected === "function") {
          this.editor.rotateSelected(90);
        }
      });
    }

    // Toolbar Batch Rename button
    const btnBatchRenameToolbar = document.getElementById(
      "btn-batch-rename-toolbar",
    );
    if (btnBatchRenameToolbar) {
      btnBatchRenameToolbar.addEventListener("click", () => {
        if (this.editor.batchRenameManager) {
          this.editor.batchRenameManager.openModal();
        } else if (typeof this.editor.openBatchRenameModal === "function") {
          this.editor.openBatchRenameModal();
        }
      });
    }

    // Toolbar Delete button
    const btnDeleteToolbar = document.getElementById("btn-delete-toolbar");
    if (btnDeleteToolbar) {
      btnDeleteToolbar.addEventListener("click", () => {
        if (this.editor.selectionManager) {
          this.editor.selectionManager.deleteSelected();
        } else if (typeof this.editor.deleteSelected === "function") {
          this.editor.deleteSelected();
        }
      });
    }

    // Save & Export buttons
    const btnSave = document.getElementById("btn-save-project");
    if (btnSave)
      btnSave.addEventListener("click", () => this.editor.saveDiagram(true));

    const btnExportSvg = document.getElementById("btn-export-svg");
    const btnExportPng = document.getElementById("btn-export-png");
    const btnExportJson = document.getElementById("btn-export-json");

    if (btnExportSvg)
      btnExportSvg.addEventListener(
        "click",
        () =>
          typeof SLDExport !== "undefined" &&
          SLDExport.toSVG(this.editor.paper),
      );
    if (btnExportPng)
      btnExportPng.addEventListener(
        "click",
        () =>
          typeof SLDExport !== "undefined" &&
          SLDExport.toPNG(this.editor.paper),
      );
    if (btnExportJson)
      btnExportJson.addEventListener(
        "click",
        () =>
          typeof SLDExport !== "undefined" &&
          SLDExport.toJSON(this.editor.graph, {
            id: this.editor.options.diagramId,
          }),
      );

    // Grid & Snap toggles
    const snapToggle = document.getElementById("status-snap-toggle");
    if (snapToggle) {
      snapToggle.addEventListener("click", () => {
        this.editor.options.snapToGrid = !this.editor.options.snapToGrid;
        snapToggle.innerText = this.editor.options.snapToGrid
          ? "스냅: 켜짐"
          : "스냅: 꺼짐";
        snapToggle.classList.toggle("active", this.editor.options.snapToGrid);
      });
    }

    // Close popup toolbar button
    const btnCloseToolbar = document.getElementById("btn-close-toolbar-popup");
    if (btnCloseToolbar) {
      btnCloseToolbar.addEventListener("click", () => this.closeToolbarPopup());
    }

    // Close toolbar popup when clicking outside
    window.addEventListener("pointerdown", (e) => {
      const toolbar = document.querySelector(".sld-toolbar");
      if (!toolbar || !toolbar.classList.contains("show")) return;
      if (
        !toolbar.contains(e.target) &&
        !e.target.closest(".sld-toolbar") &&
        !e.target.closest(".sld-modal") &&
        !e.target.closest(".sld-header")
      ) {
        this.closeToolbarPopup();
      }
    });
  }

  toggleToolbarPopup() {
    const toolbar = document.querySelector(".sld-toolbar");
    if (!toolbar) return;
    if (toolbar.classList.contains("show")) {
      this.closeToolbarPopup();
    } else {
      this.openToolbarPopup();
    }
  }

  openToolbarPopup() {
    const toolbar = document.querySelector(".sld-toolbar");
    if (!toolbar) return;
    toolbar.classList.add("show");
    if (this.editor && typeof this.editor.showToast === "function") {
      this.editor.showToast("🛠️ 도구 툴바 ('T'로 닫기)");
    }
  }

  closeToolbarPopup() {
    const toolbar = document.querySelector(".sld-toolbar");
    if (!toolbar) return;
    toolbar.classList.remove("show");
  }

  setActiveTool(toolName) {
    this.editor.activeTool = toolName;
    const toolBtns = document.querySelectorAll(".tool-btn[data-tool]");
    toolBtns.forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-tool") === toolName);
    });
  }

  zoom(delta, clientPoint) {
    const oldScale = this.editor.scale;
    let newScale = Math.min(Math.max(0.3, this.editor.scale + delta), 2.5);
    newScale = Math.round(newScale * 100) / 100;
    if (newScale === oldScale) return;

    if (clientPoint) {
      // Zoom centered on cursor
      const rect = this.editor.container.getBoundingClientRect();
      const cursorX = clientPoint.x - rect.left;
      const cursorY = clientPoint.y - rect.top;

      const originX =
        cursorX - (cursorX - this.editor.origin.x) * (newScale / oldScale);
      const originY =
        cursorY - (cursorY - this.editor.origin.y) * (newScale / oldScale);

      this.editor.origin = { x: originX, y: originY };
      this.editor.paper.setOrigin(originX, originY);
    } else {
      // Zoom centered on viewport center
      const rect = this.editor.container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const originX = cx - (cx - this.editor.origin.x) * (newScale / oldScale);
      const originY = cy - (cy - this.editor.origin.y) * (newScale / oldScale);

      this.editor.origin = { x: originX, y: originY };
      this.editor.paper.setOrigin(originX, originY);
    }

    this.editor.scale = newScale;
    this.editor.paper.scale(newScale, newScale);
    this.updateZoomDisplay();
    this.editor.updateMinimap();
  }

  setZoom(value) {
    const clamped = Math.min(Math.max(0.3, value), 2.5);
    this.editor.scale = Math.round(clamped * 100) / 100;
    this.editor.paper.scale(this.editor.scale, this.editor.scale);
    this.updateZoomDisplay();
    this.editor.updateMinimap();
  }

  zoomToFit() {
    if (!this.editor.graph || !this.editor.paper) return;
    const elements = this.editor.graph.getElements();
    if (elements.length === 0) {
      this.editor.origin = { x: 0, y: 0 };
      this.editor.paper.setOrigin(0, 0);
      this.setZoom(1);
      return;
    }

    const bbox = this.editor.graph.getBBox();
    if (!bbox) return;

    const rect = this.editor.container.getBoundingClientRect();
    const padding = 60;
    const availW = Math.max(100, rect.width - padding * 2);
    const availH = Math.max(100, rect.height - padding * 2);

    const scaleX = availW / (bbox.width || 1);
    const scaleY = availH / (bbox.height || 1);
    let fitScale = Math.min(scaleX, scaleY, 1.2);
    fitScale = Math.max(0.3, Math.min(fitScale, 1.5));
    fitScale = Math.round(fitScale * 100) / 100;

    const targetOriginX =
      (rect.width - bbox.width * fitScale) / 2 - bbox.x * fitScale;
    const targetOriginY =
      (rect.height - bbox.height * fitScale) / 2 - bbox.y * fitScale;

    this.editor.origin = { x: targetOriginX, y: targetOriginY };
    this.editor.paper.setOrigin(targetOriginX, targetOriginY);
    this.setZoom(fitScale);
  }

  updateZoomDisplay() {
    const zoomLevelEl = document.getElementById("status-zoom-level");
    const zoomTextEl = document.getElementById("status-zoom-text");
    const zoomPctEl = document.getElementById("zoom-percentage");
    const pct = Math.round(this.editor.scale * 100) + "%";

    if (zoomLevelEl) zoomLevelEl.innerText = pct;
    if (zoomTextEl) zoomTextEl.innerText = pct;
    if (zoomPctEl) zoomPctEl.innerText = pct;

    if (this.editor && typeof this.editor.showToast === "function") {
      this.editor.showToast("🔍 배율: " + pct);
    }
  }
}

if (typeof window !== "undefined") {
  window.ToolbarManager = ToolbarManager;
}
