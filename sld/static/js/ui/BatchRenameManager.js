/**
 * BatchRenameManager.js
 * 선택된 설비(또는 전체 계통 설비)의 이름을 일괄 치환(Find & Replace), 접두사/접미사 추가, 순차 번호 부여 등을 처리합니다.
 */
class BatchRenameManager {
  constructor(editor) {
    this.editor = editor;
    this.modal = null;
    this.currentMode = "replace"; // 'replace' | 'prefix-suffix' | 'pattern'
    this.targetScope = "selected"; // 'selected' | 'all'
    this.items = []; // Array of { cell, originalName, newName, type, isSelected }
    this.setupDone = false;
  }

  setup() {
    if (this.setupDone) return;
    this.modal = document.getElementById("modal-batch-rename");
    if (!this.modal) return;

    // Close button
    const closeBtn = document.getElementById("btn-close-rename-modal");
    const cancelBtn = document.getElementById("btn-cancel-rename");
    if (closeBtn) closeBtn.addEventListener("click", () => this.closeModal());
    if (cancelBtn) cancelBtn.addEventListener("click", () => this.closeModal());

    // Apply button
    const applyBtn = document.getElementById("btn-apply-rename");
    if (applyBtn) applyBtn.addEventListener("click", () => this.applyRename());

    // Mode tab buttons
    const tabs = this.modal.querySelectorAll(".rename-tab-btn");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const mode = tab.getAttribute("data-mode");
        this.setMode(mode);
      });
    });

    // Scope toggle buttons
    const btnScopeSelected = document.getElementById("rename-scope-selected");
    const btnScopeAll = document.getElementById("rename-scope-all");
    if (btnScopeSelected) {
      btnScopeSelected.addEventListener("click", () => {
        this.setScope("selected");
      });
    }
    if (btnScopeAll) {
      btnScopeAll.addEventListener("click", () => {
        this.setScope("all");
      });
    }

    // Input listeners for real-time live preview update
    const inputIds = [
      "rename-find-text",
      "rename-replace-text",
      "rename-match-case",
      "rename-use-regex",
      "rename-prefix-text",
      "rename-suffix-text",
      "rename-pattern-text",
      "rename-pattern-start",
      "rename-pattern-step",
      "rename-pattern-digits",
    ];

    inputIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => this.updatePreview());
        el.addEventListener("change", () => this.updatePreview());
      }
    });

    // Select All / Deselect All checkbox in preview table
    const selectAllCb = document.getElementById("rename-select-all-cb");
    if (selectAllCb) {
      selectAllCb.addEventListener("change", (e) => {
        const checked = e.target.checked;
        this.items.forEach((item) => (item.isSelected = checked));
        this.renderTable();
      });
    }

    // Quick preset buttons for common power system rename patterns
    const presetBtns = this.modal.querySelectorAll(".rename-preset-btn");
    presetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const findVal = btn.getAttribute("data-find") || "";
        const replaceVal = btn.getAttribute("data-replace") || "";
        const findInput = document.getElementById("rename-find-text");
        const replaceInput = document.getElementById("rename-replace-text");
        if (findInput) findInput.value = findVal;
        if (replaceInput) replaceInput.value = replaceVal;
        this.setMode("replace");
        this.updatePreview();
      });
    });

    this.setupDone = true;
  }

  openModal(targetCells = null) {
    if (!this.setupDone) this.setup();
    if (!this.modal) return;

    let cells = targetCells;
    if (!cells || cells.length === 0) {
      cells = this.editor.selectedCells || [];
      if (cells.length === 0 && this.editor.selectedCell) {
        cells = [this.editor.selectedCell];
      }
    }

    // Filter valid elements
    const selectedElements = cells.filter(
      (c) => c && typeof c.isElement === "function" && c.isElement(),
    );

    if (selectedElements.length > 0) {
      this.targetScope = "selected";
    } else {
      this.targetScope = "all";
    }

    this.collectItems();
    this.setMode("replace");
    this.updateScopeUI();
    this.updatePreview();

    this.modal.classList.add("active");

    // Focus find input
    setTimeout(() => {
      const findInput = document.getElementById("rename-find-text");
      if (findInput) {
        findInput.focus();
        findInput.select();
      }
    }, 50);
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.classList.remove("active");
  }

  setMode(mode) {
    this.currentMode = mode;
    const tabs = this.modal.querySelectorAll(".rename-tab-btn");
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.getAttribute("data-mode") === mode);
    });

    const panes = this.modal.querySelectorAll(".rename-mode-pane");
    panes.forEach((pane) => {
      pane.style.display =
        pane.getAttribute("data-mode") === mode ? "block" : "none";
    });

    this.updatePreview();
  }

  setScope(scope) {
    this.targetScope = scope;
    this.updateScopeUI();
    this.collectItems();
    this.updatePreview();
  }

  updateScopeUI() {
    const btnScopeSelected = document.getElementById("rename-scope-selected");
    const btnScopeAll = document.getElementById("rename-scope-all");
    const countSelectedEl = document.getElementById("rename-count-selected");
    const countAllEl = document.getElementById("rename-count-all");

    const selectedElements = (this.editor.selectedCells || []).filter(
      (c) => c && typeof c.isElement === "function" && c.isElement(),
    );
    const allElements = (
      this.editor.graph ? this.editor.graph.getElements() : []
    ).filter((el) => {
      const type = el.get("type") || "";
      const sldType = el.get("sldData")?.type || "";
      return type !== "sld.GroupBox" && sldType !== "GROUP_BOX";
    });

    if (countSelectedEl) countSelectedEl.innerText = selectedElements.length;
    if (countAllEl) countAllEl.innerText = allElements.length;

    if (btnScopeSelected) {
      btnScopeSelected.classList.toggle(
        "active",
        this.targetScope === "selected",
      );
      btnScopeSelected.disabled = selectedElements.length === 0;
    }
    if (btnScopeAll) {
      btnScopeAll.classList.toggle("active", this.targetScope === "all");
    }
  }

  collectItems() {
    let sourceElements = [];
    if (this.targetScope === "selected") {
      sourceElements = (this.editor.selectedCells || []).filter(
        (c) => c && typeof c.isElement === "function" && c.isElement(),
      );
      if (sourceElements.length === 0 && this.editor.selectedCell) {
        sourceElements = [this.editor.selectedCell];
      }
    } else {
      sourceElements = (
        this.editor.graph ? this.editor.graph.getElements() : []
      ).filter((el) => {
        const type = el.get("type") || "";
        const sldType = el.get("sldData")?.type || "";
        return type !== "sld.GroupBox" && sldType !== "GROUP_BOX";
      });
    }

    this.items = sourceElements.map((cell) => {
      const sldData = cell.get("sldData") || {};
      const catalog =
        (window.EQUIPMENT_CATALOG && window.EQUIPMENT_CATALOG[sldData.type]) ||
        {};
      const currentName =
        sldData.name ||
        cell.attr("nameLabel/text") ||
        cell.attr("label/text") ||
        catalog.nameKo ||
        "설비";
      const displayType = catalog.nameKo || sldData.type || "설비";
      const icon = catalog.icon || "⚡";

      return {
        cell: cell,
        originalName: currentName,
        newName: currentName,
        type: displayType,
        icon: icon,
        voltage: sldData.voltage || sldData.priVoltage || "",
        isSelected: true,
      };
    });
  }

  calculateNewNames() {
    if (!this.items || this.items.length === 0) return;

    if (this.currentMode === "replace") {
      const findText = document.getElementById("rename-find-text")?.value || "";
      const replaceText =
        document.getElementById("rename-replace-text")?.value || "";
      const matchCase =
        document.getElementById("rename-match-case")?.checked || false;
      const useRegex =
        document.getElementById("rename-use-regex")?.checked || false;

      this.items.forEach((item) => {
        if (!findText) {
          item.newName = item.originalName;
          return;
        }

        try {
          if (useRegex) {
            const flags = matchCase ? "g" : "gi";
            const regex = new RegExp(findText, flags);
            item.newName = item.originalName.replace(regex, replaceText);
          } else {
            if (matchCase) {
              item.newName = item.originalName.replaceAll(
                findText,
                replaceText,
              );
            } else {
              // Case insensitive string replace all
              const regex = new RegExp(
                findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "gi",
              );
              item.newName = item.originalName.replace(regex, replaceText);
            }
          }
        } catch (e) {
          item.newName = item.originalName;
        }
      });
    } else if (this.currentMode === "prefix-suffix") {
      const prefix = document.getElementById("rename-prefix-text")?.value || "";
      const suffix = document.getElementById("rename-suffix-text")?.value || "";

      this.items.forEach((item) => {
        item.newName = `${prefix}${item.originalName}${suffix}`;
      });
    } else if (this.currentMode === "pattern") {
      const pattern =
        document.getElementById("rename-pattern-text")?.value || "{name}-{n}";
      const startNum =
        parseInt(document.getElementById("rename-pattern-start")?.value, 10) ||
        1;
      const step =
        parseInt(document.getElementById("rename-pattern-step")?.value, 10) ||
        1;
      const digits =
        parseInt(document.getElementById("rename-pattern-digits")?.value, 10) ||
        1;

      let idx = 0;
      this.items.forEach((item) => {
        if (!item.isSelected) return;
        const currentVal = startNum + idx * step;
        const numStr = String(currentVal).padStart(digits, "0");
        idx++;

        let res = pattern
          .replace(/\{n\}/gi, numStr)
          .replace(/\{0n\}/gi, String(currentVal).padStart(2, "0"))
          .replace(/\{name\}/gi, item.originalName)
          .replace(/\{type\}/gi, item.type);

        item.newName = res;
      });
    }
  }

  updatePreview() {
    this.calculateNewNames();
    this.renderTable();
  }

  renderTable() {
    const tbody = document.getElementById("rename-preview-tbody");
    const countBadge = document.getElementById("rename-changed-count-badge");
    const applyBtn = document.getElementById("btn-apply-rename");
    if (!tbody) return;

    tbody.innerHTML = "";

    let changedCount = 0;
    let selectedCount = 0;

    if (!this.items || this.items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding: 24px; color: #94a3b8; font-size: 12px;">
            선택된 대상 설비가 없습니다.
          </td>
        </tr>
      `;
      if (countBadge) countBadge.innerText = "0개 대상";
      if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.innerText = "변경 적용";
      }
      return;
    }

    this.items.forEach((item, index) => {
      const isChanged = item.newName !== item.originalName;
      if (item.isSelected) {
        selectedCount++;
        if (isChanged) changedCount++;
      }

      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #f1f5f9";
      tr.style.background = item.isSelected
        ? isChanged
          ? "#f0fdf4"
          : "#ffffff"
        : "#f8fafc";

      tr.innerHTML = `
        <td style="padding: 8px 10px; text-align: center; width: 36px;">
          <input type="checkbox" class="rename-item-cb" data-index="${index}" ${item.isSelected ? "checked" : ""} style="cursor: pointer;" />
        </td>
        <td style="padding: 8px 10px; font-size: 11px; color: #475569; white-space: nowrap;">
          <span style="margin-right: 4px;">${item.icon}</span>
          <span>${item.type}</span>
          ${item.voltage ? `<span style="font-size: 10px; color: #94a3b8; margin-left: 2px;">(${item.voltage}kV)</span>` : ""}
        </td>
        <td style="padding: 8px 10px; font-size: 12px; color: #334155; font-weight: 500;">
          ${this.escapeHtml(item.originalName)}
        </td>
        <td style="padding: 8px 6px; text-align: center; color: #94a3b8; width: 24px;">➜</td>
        <td style="padding: 8px 10px; font-size: 12px;">
          <input type="text" class="rename-row-input" data-index="${index}" value="${this.escapeHtml(item.newName)}" 
            style="width: 100%; padding: 4px 8px; font-size: 12px; font-weight: 600; border: 1px solid ${isChanged ? "#86efac" : "#cbd5e1"}; background: ${isChanged ? "#ffffff" : "#f8fafc"}; color: ${isChanged ? "#15803d" : "#64748b"}; border-radius: 4px;" />
        </td>
      `;

      // Event listener for row checkbox
      const cb = tr.querySelector(".rename-item-cb");
      if (cb) {
        cb.addEventListener("change", (e) => {
          item.isSelected = e.target.checked;
          this.renderTable();
        });
      }

      // Event listener for manual inline name edit
      const inlineInput = tr.querySelector(".rename-row-input");
      if (inlineInput) {
        inlineInput.addEventListener("input", (e) => {
          item.newName = e.target.value;
          const changedNow = item.newName !== item.originalName;
          inlineInput.style.borderColor = changedNow ? "#86efac" : "#cbd5e1";
          inlineInput.style.color = changedNow ? "#15803d" : "#64748b";
          tr.style.background = changedNow ? "#f0fdf4" : "#ffffff";
          this.updateCountBadge();
        });
      }

      tbody.appendChild(tr);
    });

    this.updateCountBadge();

    // Sync select-all checkbox
    const selectAllCb = document.getElementById("rename-select-all-cb");
    if (selectAllCb) {
      selectAllCb.checked =
        selectedCount === this.items.length && this.items.length > 0;
      selectAllCb.indeterminate =
        selectedCount > 0 && selectedCount < this.items.length;
    }
  }

  updateCountBadge() {
    const countBadge = document.getElementById("rename-changed-count-badge");
    const applyBtn = document.getElementById("btn-apply-rename");

    let changedCount = 0;
    let selectedCount = 0;
    this.items.forEach((item) => {
      if (item.isSelected) {
        selectedCount++;
        if (item.newName !== item.originalName) changedCount++;
      }
    });

    if (countBadge) {
      countBadge.innerText = `총 ${this.items.length}개 중 ${changedCount}개 변경 예정`;
      countBadge.style.background = changedCount > 0 ? "#dcfce7" : "#f1f5f9";
      countBadge.style.color = changedCount > 0 ? "#15803d" : "#64748b";
    }

    if (applyBtn) {
      applyBtn.disabled = changedCount === 0;
      applyBtn.innerText =
        changedCount > 0 ? `변경 적용 (${changedCount}개)` : "변경 적용";
    }
  }

  applyRename() {
    const targetsToRename = this.items.filter(
      (item) => item.isSelected && item.newName !== item.originalName,
    );

    if (targetsToRename.length === 0) {
      this.editor.showToast("변경할 설비 이름이 없습니다.");
      this.closeModal();
      return;
    }

    const wasTracking = this.editor.historyManager.isHistoryTracking;
    this.editor.historyManager.isHistoryTracking = false;
    this.editor._isBatchOperation = true;

    targetsToRename.forEach((item) => {
      const cell = item.cell;
      const newName = item.newName.trim();
      const sldData = cell.get("sldData") || {};
      sldData.name = newName;
      cell.set("sldData", Object.assign({}, sldData));

      // Visual updates
      if (typeof cell.updateFromSldData === "function") {
        cell.updateFromSldData();
      }
      if (typeof cell.updateContactVisual === "function") {
        cell.updateContactVisual();
      }
      if (typeof cell.updateVisual === "function") {
        cell.updateVisual();
      }

      // JointJS attribute fallback updates
      try {
        if (cell.attr("nameLabel/text") !== undefined) {
          cell.attr("nameLabel/text", newName);
        }
        if (cell.attr("label/text") !== undefined) {
          cell.attr("label/text", newName);
        }
      } catch (e) {}
    });

    this.editor._isBatchOperation = false;
    this.editor.historyManager.isHistoryTracking = wasTracking;

    // Refresh properties panel if currently populated
    if (this.editor.propertiesPanel && this.editor.selectedCell) {
      this.editor.propertiesPanel.populateProperties(this.editor.selectedCell);
    }

    this.editor.updateMinimap();
    this.editor.pushHistory();
    this.editor.scheduleAutoSave();

    this.closeModal();
    this.editor.showToast(
      `✅ ${targetsToRename.length}개 설비의 이름이 성공적으로 변경되었습니다.`,
    );
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

if (typeof window !== "undefined") {
  window.BatchRenameManager = BatchRenameManager;
}
