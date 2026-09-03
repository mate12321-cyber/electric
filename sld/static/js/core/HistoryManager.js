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
    const json = this.editor.graph.toJSON();
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(JSON.stringify(json));

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
      this.editor.removeSelectionOverlay();
      this.editor.graph.fromJSON(JSON.parse(this.history[this.historyIndex]));
      if (this.editor.topologyTracker) {
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

      this.editor.updateMinimap();
      this.editor.scheduleAutoSave();
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
      this.editor.removeSelectionOverlay();
      this.editor.graph.fromJSON(JSON.parse(this.history[this.historyIndex]));
      if (this.editor.topologyTracker) {
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

      this.editor.updateMinimap();
      this.editor.scheduleAutoSave();
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
