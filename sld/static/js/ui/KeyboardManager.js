/**
 * KeyboardManager.js
 * 키보드 단축키(선택 도구 전환, 삭제, 실행취소/다시실행, 복사/붙여넣기, 방향키 이동, 개폐 상태 토글 등)를 관리합니다.
 */
class KeyboardManager {
  constructor(editor) {
    this.editor = editor;
  }

  setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }

      const code = e.code;
      const key = (e.key || "").toLowerCase();
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Helper matchers for English & Korean layouts (Hangul IME compatible)
      const isKey = (codeName, engChar, korChars = []) => {
        return (
          code === codeName ||
          key === engChar ||
          korChars.includes(e.key) ||
          korChars.includes(key)
        );
      };

      // 1. Tool shortcut keys & Ground state shortcut (without modifier keys)
      if (!isCtrlOrMeta && !e.altKey) {
        if (isKey("KeyV", "v", ["ㅍ"])) {
          this.editor.setActiveTool("select");
          this.editor.showToast("선택 도구 (V)");
          return;
        } else if (isKey("KeyL", "l", ["ㅣ"])) {
          this.editor.setActiveTool("lasso");
          this.editor.showToast("영역 선택 도구 (L)");
          return;
        } else if (isKey("KeyW", "w", ["ㅈ", "ㅉ"])) {
          this.editor.setActiveTool("wire");
          this.editor.showToast("직교 배선 도구 (W)");
          return;
        } else if (isKey("KeyG", "g", ["ㅎ"])) {
          if (
            this.editor.selectedCells &&
            this.editor.selectedCells.length > 0
          ) {
            e.preventDefault();
            e.stopPropagation();
            const primaryCell = this.editor.selectedCells.find(
              (c) => c.isElement && c.isElement(),
            );
            const curState = (
              primaryCell?.get("sldData")?.state || ""
            ).toUpperCase();
            const nextGState =
              curState === "GROUNDED" || curState === "GROUND"
                ? "DEAD"
                : "GROUNDED";
            if (this.editor.selectionManager) {
              this.editor.selectionManager.toggleSelectedEquipmentState(
                nextGState,
              );
            }
            return;
          }
        }
      }

      // 2. Select All: Ctrl/Cmd + A (or ㅁ)
      if (isCtrlOrMeta && isKey("KeyA", "a", ["ㅁ"])) {
        e.preventDefault();
        const allElements = this.editor.graph.getElements();
        if (allElements.length > 0) {
          this.editor.selectCells(allElements);
          this.editor.showToast(
            `전체 ${allElements.length}개 설비가 선택되었습니다.`,
          );
        }
        return;
      }

      // 3. Copy: Ctrl/Cmd + C (or ㅊ)
      if (isCtrlOrMeta && isKey("KeyC", "c", ["ㅊ"])) {
        e.preventDefault();
        if (this.editor.clipboardManager) {
          this.editor.clipboardManager.copySelected();
        }
        return;
      }

      // 4. Paste: Ctrl/Cmd + V (or ㅍ)
      if (isCtrlOrMeta && isKey("KeyV", "v", ["ㅍ"])) {
        e.preventDefault();
        if (this.editor.clipboardManager) {
          this.editor.clipboardManager.pasteCopied();
        }
        return;
      }

      // 5. Duplicate: Ctrl/Cmd + D (or ㅇ)
      if (isCtrlOrMeta && isKey("KeyD", "d", ["ㅇ"])) {
        e.preventDefault();
        if (this.editor.clipboardManager) {
          this.editor.clipboardManager.duplicateSelected();
        }
        return;
      }

      // 6. Spacebar Toggle: Live <-> Dead
      if (code === "Space" || e.key === " " || e.key === "Spacebar") {
        if (this.editor.selectedCells && this.editor.selectedCells.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          if (this.editor.selectionManager) {
            this.editor.selectionManager.toggleSelectedEquipmentState();
          }
          return;
        }
      }

      // 7. Delete: Delete / Backspace
      if (
        code === "Delete" ||
        code === "Backspace" ||
        e.key === "Delete" ||
        e.key === "Backspace"
      ) {
        if (this.editor.selectionManager) {
          this.editor.selectionManager.deleteSelected();
        }
        return;
      }

      // 8. Undo: Ctrl/Cmd + Z (or ㅋ)
      if (isCtrlOrMeta && isKey("KeyZ", "z", ["ㅋ"]) && !e.shiftKey) {
        e.preventDefault();
        if (this.editor.historyManager) {
          this.editor.historyManager.undo();
        }
        return;
      }

      // 9. Redo: Ctrl/Cmd + Y (or ㅛ) or Ctrl/Cmd + Shift + Z (or ㅋ)
      if (
        isCtrlOrMeta &&
        (isKey("KeyY", "y", ["ㅛ"]) ||
          (e.shiftKey && isKey("KeyZ", "z", ["ㅋ"])))
      ) {
        e.preventDefault();
        if (this.editor.historyManager) {
          this.editor.historyManager.redo();
        }
        return;
      }

      // 10. Save: Ctrl/Cmd + S (or ㄴ)
      if (isCtrlOrMeta && isKey("KeyS", "s", ["ㄴ"])) {
        e.preventDefault();
        this.editor.saveDiagram(true);
        return;
      }

      // 11. Batch Rename / Find & Replace: Ctrl/Cmd + H (or ㅗ) or F2
      if (
        (isCtrlOrMeta && isKey("KeyH", "h", ["ㅗ"])) ||
        code === "F2" ||
        e.key === "F2"
      ) {
        e.preventDefault();
        if (this.editor.batchRenameManager) {
          this.editor.batchRenameManager.openModal();
        } else if (typeof this.editor.openBatchRenameModal === "function") {
          this.editor.openBatchRenameModal();
        }
        return;
      }

      // 11. Arrow Keys: Nudge selected symbols (10px or Shift+50px)
      if (
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        code === "ArrowLeft" ||
        code === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        if (
          (this.editor.selectedCells && this.editor.selectedCells.length > 0) ||
          this.editor.selectedCell
        ) {
          e.preventDefault();
          e.stopPropagation();

          const step = e.shiftKey ? 50 : 10;
          let dx = 0;
          let dy = 0;

          if (code === "ArrowUp" || e.key === "ArrowUp") dy = -step;
          else if (code === "ArrowDown" || e.key === "ArrowDown") dy = step;
          else if (code === "ArrowLeft" || e.key === "ArrowLeft") dx = -step;
          else if (code === "ArrowRight" || e.key === "ArrowRight") dx = step;

          if (this.editor.selectionManager) {
            this.editor.selectionManager.nudgeSelected(dx, dy);
          }
          return;
        }
      }
    });
  }
}

if (typeof window !== "undefined") {
  window.KeyboardManager = KeyboardManager;
}
