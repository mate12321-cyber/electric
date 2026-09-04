/**
 * PaletteManager.js
 * 좌측 심볼 팔레트 드래그앤드롭 생성, 클릭 배치, 심볼 인스턴스화 및 단자 기준 그리드 스냅을 관리합니다.
 */
class PaletteManager {
  constructor(editor) {
    this.editor = editor;
    this._lastCreated = null;
  }

  setupDragDrop() {
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
        const rect = this.editor.container.getBoundingClientRect();
        const center = this.editor.getPaperPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        this.createElement(type, center.x, center.y);
      });
    });

    const dropArea =
      document.querySelector(".sld-canvas-wrapper") || this.editor.container;

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

      const p = this.editor.getPaperPoint(e.clientX, e.clientY);
      this.createElement(type, p.x, p.y);
      window.__draggedSymbolType = null;
    });
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

    const catalog = window.EQUIPMENT_CATALOG
      ? window.EQUIPMENT_CATALOG[type]
      : null;
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
      case "DS_3P":
        width = 44;
        height = 48;
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

    // Snap connection point (primary port) to grid
    const gridSize = (this.editor.options && this.editor.options.gridSize) || 5;
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

    this.editor.graph.addCell(cell);
    this.editor.selectCell(cell);
    if (this.editor.topologyTracker) {
      this.editor.topologyTracker.applyStyles(this.editor.paper);
    }
    this.editor.updateMinimap();
    this.editor.scheduleAutoSave();
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
      case "DS_3P":
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

    const gridSize =
      (this.editor.options && this.editor.options.gridSize) || 10;
    const targetPortX = Math.round(currentPortX / gridSize) * gridSize;
    const targetPortY = Math.round(currentPortY / gridSize) * gridSize;

    const newX = targetPortX - snapOffset.x;
    const newY = targetPortY - snapOffset.y;

    if (pos.x !== newX || pos.y !== newY) {
      el.position(newX, newY);
    }
  }
}

if (typeof window !== "undefined") {
  window.PaletteManager = PaletteManager;
}
