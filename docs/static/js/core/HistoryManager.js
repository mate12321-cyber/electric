/**
 * HistoryManager.js
 * SLD 다이어그램의 실행취소(Undo) 및 다시실행(Redo) 상태 스택을 관리합니다.
 */
class HistoryManager {
  constructor(editor) {
    this.editor = editor;
    this.history = [];
    this.historyIndex = -1;
    this.isHistoryTracking = true;
    this.maxHistory = 50;
  }

  pushHistory() {
    if (!this.isHistoryTracking || !this.editor.graph) return;
    const compactObj = SLDSerializer.toCompactJSON(
      this.editor.graph,
      this.editor.paper,
      { diagramId: this.editor.options?.diagramId },
    );

    const jsonStr = JSON.stringify(compactObj);

    // Skip pushing duplicate snapshots if elements and links have not changed
    if (this.historyIndex >= 0 && this.history[this.historyIndex]) {
      try {
        const lastObj = JSON.parse(this.history[this.historyIndex]);
        if (
          JSON.stringify(lastObj.elements) ===
            JSON.stringify(compactObj.elements) &&
          JSON.stringify(lastObj.links) === JSON.stringify(compactObj.links)
        ) {
          return; // Identical graph structure and properties
        }
      } catch (e) {}
    }

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(jsonStr);

    // Max history cap
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      const selectedIds = (this.editor.selectedCells || [])
        .map((c) => c && c.id)
        .filter(Boolean);

      this.historyIndex--;
      this.isHistoryTracking = false;
      this.editor._isBatchOperation = true;
      this.editor.removeSelectionOverlay();

      if (typeof this.editor.paper?.freeze === "function") {
        this.editor.paper.freeze();
      }

      const schema = JSON.parse(this.history[this.historyIndex]);
      const { elements, links } = SLDSerializer.fromCompactJSON(schema);
      this.editor.graph.clear();
      this.editor.graph.addCells([...elements, ...links]);

      if (this.editor.topologyTracker) {
        this.editor.topologyTracker.invalidateCache();
        this.editor.topologyTracker.applyStyles(this.editor.paper);
      }

      if (selectedIds.length > 0) {
        const newCells = selectedIds
          .map((id) => this.editor.graph.getCell(id))
          .filter(Boolean);
        if (newCells.length > 0) {
          this.editor.selectCells(newCells);
        } else {
          this.editor.deselectAll();
        }
      } else {
        this.editor.deselectAll();
      }

      if (typeof this.editor.paper?.unfreeze === "function") {
        this.editor.paper.unfreeze();
      }

      this.editor.requestMinimapUpdate();
      this.editor.scheduleAutoSave();
      this.editor._isBatchOperation = false;
      this.isHistoryTracking = true;
      this.editor.showToast("실행취소 (Undo)");
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      const selectedIds = (this.editor.selectedCells || [])
        .map((c) => c && c.id)
        .filter(Boolean);

      this.historyIndex++;
      this.isHistoryTracking = false;
      this.editor._isBatchOperation = true;
      this.editor.removeSelectionOverlay();

      if (typeof this.editor.paper?.freeze === "function") {
        this.editor.paper.freeze();
      }

      const schema = JSON.parse(this.history[this.historyIndex]);
      const { elements, links } = SLDSerializer.fromCompactJSON(schema);
      this.editor.graph.clear();
      this.editor.graph.addCells([...elements, ...links]);

      if (this.editor.topologyTracker) {
        this.editor.topologyTracker.invalidateCache();
        this.editor.topologyTracker.applyStyles(this.editor.paper);
      }

      if (selectedIds.length > 0) {
        const newCells = selectedIds
          .map((id) => this.editor.graph.getCell(id))
          .filter(Boolean);
        if (newCells.length > 0) {
          this.editor.selectCells(newCells);
        } else {
          this.editor.deselectAll();
        }
      } else {
        this.editor.deselectAll();
      }

      if (typeof this.editor.paper?.unfreeze === "function") {
        this.editor.paper.unfreeze();
      }

      this.editor.requestMinimapUpdate();
      this.editor.scheduleAutoSave();
      this.editor._isBatchOperation = false;
      this.isHistoryTracking = true;
      this.editor.showToast("다시실행 (Redo)");
    }
  }

  canUndo() {
    return this.historyIndex > 0;
  }

  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  reset() {
    this.history = [];
    this.historyIndex = -1;
  }
}

if (typeof window !== "undefined") {
  window.HistoryManager = HistoryManager;
}
