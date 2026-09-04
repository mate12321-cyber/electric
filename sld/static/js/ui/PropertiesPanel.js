/**
 * PropertiesPanel.js
 * 우측 설비 속성 패널(일반, 스타일, 데이터/텔레메트리 탭) 렌더링 및 양방향 데이터 바인딩을 관리합니다.
 */
class PropertiesPanel {
  constructor(editor) {
    this.editor = editor;
  }

  setup() {
    const bindInput = (id, propKey, isNumber = false) => {
      const input = document.getElementById(id);
      if (!input) return;
      const handler = (e) => {
        if (!this.editor.selectedCell) return;
        const sldData = this.editor.selectedCell.get("sldData") || {};
        let val = e.target.value;
        if (isNumber) val = parseFloat(val) || 0;
        sldData[propKey] = val;

        if (propKey === "state") {
          const st = String(val).toUpperCase();
          sldData.isOnline = st === "LIVE" || st === "CLOSED" || st === "ON";
        }

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

        this.editor.selectedCell.set("sldData", Object.assign({}, sldData));

        // Always trigger symbol-specific visual updates immediately
        if (typeof this.editor.selectedCell.updateFromSldData === "function") {
          this.editor.selectedCell.updateFromSldData();
        }
        if (typeof this.editor.selectedCell.updateVisual === "function") {
          this.editor.selectedCell.updateVisual();
        }
        if (
          typeof this.editor.selectedCell.updateContactVisual === "function"
        ) {
          this.editor.selectedCell.updateContactVisual();
        }

        if (this.editor.topologyTracker) {
          this.editor.topologyTracker.applyStyles(this.editor.paper);
        }
        this.editor.updateMinimap();
        this.editor.scheduleAutoSave();
      };

      input.addEventListener("input", handler);
      input.addEventListener("change", handler);
    };

    bindInput("prop-name", "name");
    bindInput("prop-earth-name", "earthName");
    bindInput("prop-desc", "desc");
    bindInput("prop-state", "state");
    bindInput("prop-voltage", "voltage", true);
    bindInput("prop-pri-voltage", "priVoltage", true);
    bindInput("prop-sec-voltage", "secVoltage", true);
    bindInput("prop-tert-voltage", "tertVoltage", true);
    bindInput("prop-connection", "connection");
    bindInput("prop-capacity", "capacity");
    bindInput("prop-current", "current", true);
    bindInput("prop-symbol-color", "color");
    bindInput("prop-line-color", "lineColor");
    bindInput("prop-line-width", "lineWidth", true);

    // Setup all combo dropdowns (Direct input vs presets)
    this.setupComboDropdowns();

    // Busbar Length Binding
    const busLengthInput = document.getElementById("prop-bus-length");
    if (busLengthInput) {
      const handleBusLength = (e) => {
        if (!this.editor.selectedCell) return;
        const sldData = this.editor.selectedCell.get("sldData") || {};
        if (
          sldData.type !== "BUSBAR" &&
          this.editor.selectedCell.get("type") !== "sld.Busbar"
        )
          return;

        const ports = this.editor.selectedCell.getPorts() || [];
        let maxPortX = 0;
        ports.forEach((p) => {
          if (p.args && p.args.x !== undefined && p.args.x > maxPortX) {
            maxPortX = p.args.x;
          }
        });
        const minAllowedWidth = Math.max(40, maxPortX + 10);

        let val = parseFloat(e.target.value) || 200;
        val = Math.max(minAllowedWidth, Math.min(3000, val));
        const curSize = this.editor.selectedCell.size();
        this.editor.selectedCell.resize(val, curSize.height);
        this.editor.updateSelectionOverlay();
        this.editor.updateMinimap();
        this.editor.scheduleAutoSave();
      };
      busLengthInput.addEventListener("input", handleBusLength);
      busLengthInput.addEventListener("change", handleBusLength);
    }

    // ATO Property bindings (TIE Breakers)
    const atoEnabledCb = document.getElementById("prop-ato-enabled");
    if (atoEnabledCb) {
      atoEnabledCb.addEventListener("change", () => {
        if (!this.editor.selectedCell) return;
        const sldData = this.editor.selectedCell.get("sldData") || {};
        sldData.atoEnabled = atoEnabledCb.checked;
        this.editor.selectedCell.set("sldData", Object.assign({}, sldData));
        this.populateProperties(this.editor.selectedCell);
        this.editor.scheduleAutoSave();
      });
    }

    const bindAtoSelect = (id, propKey) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => {
          if (!this.editor.selectedCell) return;
          const sldData = this.editor.selectedCell.get("sldData") || {};
          sldData[propKey] = el.value;
          this.editor.selectedCell.set("sldData", Object.assign({}, sldData));
          this.populateProperties(this.editor.selectedCell);
          this.editor.scheduleAutoSave();
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
        if (this.editor.selectionManager) {
          this.editor.selectionManager.toggleSelectedEquipmentState(
            targetState,
          );
        } else if (
          typeof this.editor.toggleSelectedEquipmentState === "function"
        ) {
          this.editor.toggleSelectedEquipmentState(targetState);
        }
      });
    });

    const delBtn = document.getElementById("btn-delete-element");
    if (delBtn) {
      delBtn.addEventListener("click", () => {
        if (this.editor.selectionManager) {
          this.editor.selectionManager.deleteSelected();
        } else if (typeof this.editor.deleteSelected === "function") {
          this.editor.deleteSelected();
        }
      });
    }

    // Batch Rename Triggers
    const btnPropBatchRename = document.getElementById("btn-prop-batch-rename");
    if (btnPropBatchRename) {
      btnPropBatchRename.addEventListener("click", () => {
        if (this.editor.batchRenameManager) {
          this.editor.batchRenameManager.openModal();
        } else if (typeof this.editor.openBatchRenameModal === "function") {
          this.editor.openBatchRenameModal();
        }
      });
    }

    const btnPropOpenRename = document.getElementById("btn-prop-open-rename");
    if (btnPropOpenRename) {
      btnPropOpenRename.addEventListener("click", () => {
        if (this.editor.batchRenameManager) {
          this.editor.batchRenameManager.openModal();
        } else if (typeof this.editor.openBatchRenameModal === "function") {
          this.editor.openBatchRenameModal();
        }
      });
    }

    // Color Quick Palette in Property Style Tab
    const paletteColors = document.querySelectorAll(".prop-color-picker");
    paletteColors.forEach((cp) => {
      cp.addEventListener("click", () => {
        const color = cp.getAttribute("data-color");
        if (this.editor.selectedCells && this.editor.selectedCells.length > 0) {
          this.editor.selectedCells.forEach((cell) => {
            const sldData = cell.get("sldData") || {};
            sldData.color = color;
            cell.set("sldData", Object.assign({}, sldData));
          });
          const colorInput = document.getElementById("prop-symbol-color");
          if (colorInput) colorInput.value = color;
          if (this.editor.topologyTracker) {
            this.editor.topologyTracker.applyStyles(this.editor.paper);
          }
          this.editor.scheduleAutoSave();
        }
      });
    });

    // Rotation Angle Presets (0°, 90°, 180°, 270°)
    const angleBtns = document.querySelectorAll(".btn-prop-angle");
    angleBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetAngle = parseInt(btn.getAttribute("data-angle"), 10) || 0;
        if (typeof this.editor.rotateSelected === "function") {
          this.editor.rotateSelected(targetAngle, true);
        } else if (
          this.editor.selectionManager &&
          typeof this.editor.selectionManager.rotateSelected === "function"
        ) {
          this.editor.selectionManager.rotateSelected(targetAngle, true);
        }
        this.updateRotationUI(targetAngle);
      });
    });

    const btnRotate90 = document.getElementById("btn-prop-rotate-90");
    if (btnRotate90) {
      btnRotate90.addEventListener("click", () => {
        if (typeof this.editor.rotateSelected === "function") {
          this.editor.rotateSelected(90, false);
        } else if (
          this.editor.selectionManager &&
          typeof this.editor.selectionManager.rotateSelected === "function"
        ) {
          this.editor.selectionManager.rotateSelected(90, false);
        }
        const cell =
          this.editor.selectedCell ||
          (this.editor.selectionManager &&
            this.editor.selectionManager.selectedCells &&
            this.editor.selectionManager.selectedCells[0]);
        if (cell) {
          const sldData = cell.get("sldData") || {};
          const curAngle =
            sldData.angle !== undefined
              ? sldData.angle
              : cell.angle
                ? cell.angle()
                : 0;
          this.updateRotationUI(curAngle);
        }
      });
    }
  }

  setupComboDropdowns() {
    const comboSelects = document.querySelectorAll("select[data-combo-for]");
    comboSelects.forEach((sel) => {
      const targetId = sel.getAttribute("data-combo-for");
      const targetInput = document.getElementById(targetId);
      if (!targetInput) return;

      sel.addEventListener("change", () => {
        if (sel.value === "__custom__") {
          targetInput.focus();
          targetInput.select();
        } else {
          targetInput.value = sel.value;
          targetInput.dispatchEvent(new Event("input", { bubbles: true }));
          targetInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      const syncSelectToInput = () => {
        const val = targetInput.value;
        const matchOpt = Array.from(sel.options).find(
          (opt) => opt.value !== "__custom__" && opt.value === String(val),
        );
        sel.value = matchOpt ? String(val) : "__custom__";
      };

      targetInput.addEventListener("input", syncSelectToInput);
      targetInput.addEventListener("change", syncSelectToInput);
    });
  }

  updateRotationUI(angle) {
    const normAngle = ((Math.round(angle || 0) % 360) + 360) % 360;
    const disp = document.getElementById("prop-rotation-display");
    if (disp) disp.innerText = `${normAngle}°`;
    const angleBtns = document.querySelectorAll(".btn-prop-angle");
    angleBtns.forEach((btn) => {
      const bAngle = parseInt(btn.getAttribute("data-angle"), 10);
      if (bAngle === normAngle) {
        btn.classList.add("sld-btn-primary");
        btn.classList.remove("sld-btn-secondary");
      } else {
        btn.classList.remove("sld-btn-primary");
        btn.classList.add("sld-btn-secondary");
      }
    });
  }

  updateFieldsVisibility() {
    if (this.editor.selectedCell) {
      this.populateProperties(this.editor.selectedCell);
    }
  }

  populate(cell) {
    this.populateProperties(cell);
  }

  populateProperties(cell) {
    if (!cell) {
      if (this.editor.selectedCells && this.editor.selectedCells.length > 0) {
        cell = this.editor.selectedCells[0];
      } else {
        this.clearProperties();
        return;
      }
    }

    const sldData = cell.get("sldData") || {};
    const catalog =
      (window.EQUIPMENT_CATALOG && window.EQUIPMENT_CATALOG[sldData.type]) ||
      {};

    const setValue = (id, val) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = val !== undefined && val !== null ? val : "";
        const comboSelect = document.querySelector(
          `select[data-combo-for="${id}"]`,
        );
        if (comboSelect) {
          const strVal = String(el.value);
          const matchOpt = Array.from(comboSelect.options).find(
            (opt) => opt.value !== "__custom__" && opt.value === strVal,
          );
          comboSelect.value = matchOpt ? strVal : "__custom__";
        }
      }
    };

    const isMulti =
      this.editor.selectedCells && this.editor.selectedCells.length > 1;
    const multiBanner = document.getElementById("group-prop-multi-selection");
    const countTitle = document.getElementById("prop-multi-count-title");
    const groupName = document.getElementById("group-prop-name");
    const groupDesc = document.getElementById("group-prop-desc");

    if (multiBanner) {
      multiBanner.style.display = isMulti ? "block" : "none";
      if (isMulti && countTitle) {
        countTitle.innerText = `다중 설비 선택됨 (${this.editor.selectedCells.length}개)`;
      }
    }

    if (groupName) groupName.style.display = isMulti ? "none" : "block";
    if (groupDesc) groupDesc.style.display = isMulti ? "none" : "block";

    const isDisconnector3P =
      !isMulti &&
      (sldData.type === "DS_3P" || cell.get("type") === "sld.Disconnector3P");
    const groupEarthName = document.getElementById("group-prop-earth-name");
    if (groupEarthName)
      groupEarthName.style.display = isDisconnector3P ? "block" : "none";
    if (isDisconnector3P) {
      setValue("prop-earth-name", sldData.earthName || "154kV ES");
    }

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

        const allElements = this.editor.graph.getElements();
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

    const curState = (
      sldData.state || (sldData.type === "GENERATOR" ? "DEAD" : "LIVE")
    ).toUpperCase();
    const mappedState =
      curState === "CLOSED" || curState === "LIVE" || curState === "ON"
        ? "LIVE"
        : curState === "OPEN" || curState === "DEAD" || curState === "OFF"
          ? "DEAD"
          : curState === "GROUNDED" ||
              curState === "GROUND" ||
              curState === "EARTH"
            ? "GROUNDED"
            : curState;

    const stateBtns = document.querySelectorAll(".state-toggle-btn");
    stateBtns.forEach((b) => {
      const bState = b.getAttribute("data-state");
      b.classList.toggle("active", bState === mappedState);
    });

    setValue("prop-name", sldData.name || catalog.nameKo || "설비");
    setValue("prop-earth-name", sldData.earthName || "154kV ES");
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
    setValue("prop-line-width", sldData.lineWidth || 2);
    setValue("prop-memo", sldData.memo || "");

    const curAngle =
      sldData.angle !== undefined
        ? sldData.angle
        : cell.angle
          ? cell.angle()
          : 0;
    this.updateRotationUI(curAngle);

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
        statusBadge.innerText = "⚡ 투입 (CLOSED)";
        statusBadge.className = "telemetry-badge-live";
      } else if (isGrounded) {
        statusBadge.innerText = "⏚ 접지 (GROUNDED)";
        statusBadge.className = "telemetry-badge-grounded";
      } else {
        statusBadge.innerText = "⚪ 개방 (OPEN)";
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
}

if (typeof window !== "undefined") {
  window.PropertiesPanel = PropertiesPanel;
}
