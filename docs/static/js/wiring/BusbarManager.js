/**
 * BusbarManager.js
 * 모선(Busbar) 단자(Port) 자동 동적 생성, 기기 위치 변경 시 포트 정렬 동기화, 미사용 포트 정리를 관리합니다.
 */
class BusbarManager {
  constructor(editor) {
    this.editor = editor;
  }

  getCellPortOffset(cell, portId) {
    if (!cell) return { x: 0, y: 0 };
    const size = cell.size ? cell.size() : { width: 0, height: 0 };
    if (typeof cell.getPort === "function" && portId) {
      const port = cell.getPort(portId);
      if (port && port.args) {
        return {
          x: port.args.x !== undefined ? port.args.x : size.width / 2,
          y: port.args.y !== undefined ? port.args.y : size.height / 2,
        };
      }
    }
    const sldData = cell.get("sldData") || {};
    if (this.editor.paletteManager) {
      return this.editor.paletteManager.getPrimaryPortOffset(
        sldData.type,
        size.width,
        size.height,
        cell,
      );
    }
    if (typeof this.editor.getPrimaryPortOffset === "function") {
      return this.editor.getPrimaryPortOffset(
        sldData.type,
        size.width,
        size.height,
        cell,
      );
    }
    return { x: size.width / 2, y: size.height / 2 };
  }

  autoCreateBusbarPort(link) {
    if (!link || !link.isLink || !link.isLink()) return;

    const source = link.get("source");
    const target = link.get("target");

    if (!source || !target || !source.id || !target.id) return;

    const sourceCell = this.editor.graph.getCell(source.id);
    const targetCell = this.editor.graph.getCell(target.id);

    if (!sourceCell || !targetCell) return;

    const gridSize =
      (this.editor.options && this.editor.options.gridSize) || 10;
    const allLinks = this.editor.graph.getLinks();

    // Case 1: Target is Busbar
    if (
      targetCell.get("type") === "sld.Busbar" ||
      targetCell.get("sldData")?.type === "BUSBAR"
    ) {
      const busbar = targetCell;
      const busPos = busbar.position();
      const busSize = busbar.size();

      const sourceOffset = this.getCellPortOffset(sourceCell, source.port);
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
        busbar.portProp(currentPortId, "args/y", busSize.height / 2);
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

      const targetOffset = this.getCellPortOffset(targetCell, target.port);
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
        busbar.portProp(currentPortId, "args/y", busSize.height / 2);
      }
    }
  }

  cleanupUnusedBusbarPorts() {
    if (!this.editor.graph) return;
    const busbars = this.editor.graph
      .getElements()
      .filter(
        (el) =>
          el.get("type") === "sld.Busbar" ||
          el.get("sldData")?.type === "BUSBAR",
      );

    const allLinks = this.editor.graph.getLinks();

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
    const gridSize =
      (this.editor.options && this.editor.options.gridSize) || 10;
    const isBus =
      element.get("type") === "sld.Busbar" ||
      element.get("sldData")?.type === "BUSBAR";

    const connectedLinks = this.editor.graph.getConnectedLinks(element);

    if (isBus) {
      // Element is a Busbar: sync all its ports with connected equipment
      const busPos = element.position();
      const busSize = element.size();

      connectedLinks.forEach((link) => {
        const s = link.get("source");
        const t = link.get("target");
        const isSrcBus = s && s.id === element.id;
        const isTgtBus = t && t.id === element.id;

        const busPortId = isSrcBus ? s.port : isTgtBus ? t.port : null;
        const otherId = isSrcBus ? t?.id : isTgtBus ? s?.id : null;
        const otherPortId = isSrcBus ? t?.port : isTgtBus ? s?.port : null;

        if (busPortId && otherId) {
          const otherEl = this.editor.graph.getCell(otherId);
          if (otherEl && otherEl.isElement && otherEl.isElement()) {
            const otherPos = otherEl.position();
            const otherOffset = this.getCellPortOffset(otherEl, otherPortId);
            const otherPortAbsX = otherPos.x + otherOffset.x;
            const localX = Math.max(
              10,
              Math.min(busSize.width - 10, otherPortAbsX - busPos.x),
            );
            const snappedX = Math.round(localX / gridSize) * gridSize;
            if (element.getPort(busPortId)) {
              element.portProp(busPortId, "args/x", snappedX);
              element.portProp(busPortId, "args/y", busSize.height / 2);
            }
          }
        }
      });
      return;
    }

    // Element is standard equipment: sync any connected busbar's ports to this element
    const elemPos = element.position();

    connectedLinks.forEach((link) => {
      const s = link.get("source");
      const t = link.get("target");

      if (s && s.id !== element.id) {
        const other = this.editor.graph.getCell(s.id);
        if (
          other &&
          (other.get("type") === "sld.Busbar" ||
            other.get("sldData")?.type === "BUSBAR")
        ) {
          const busPos = other.position();
          const busSize = other.size();
          const elemOffset = this.getCellPortOffset(element, t?.port);
          const elemPortAbsX = elemPos.x + elemOffset.x;
          const localX = Math.max(
            10,
            Math.min(busSize.width - 10, elemPortAbsX - busPos.x),
          );
          const snappedX = Math.round(localX / gridSize) * gridSize;
          if (s.port && other.getPort(s.port)) {
            other.portProp(s.port, "args/x", snappedX);
            other.portProp(s.port, "args/y", busSize.height / 2);
          }
        }
      }

      if (t && t.id !== element.id) {
        const other = this.editor.graph.getCell(t.id);
        if (
          other &&
          (other.get("type") === "sld.Busbar" ||
            other.get("sldData")?.type === "BUSBAR")
        ) {
          const busPos = other.position();
          const busSize = other.size();
          const elemOffset = this.getCellPortOffset(element, s?.port);
          const elemPortAbsX = elemPos.x + elemOffset.x;
          const localX = Math.max(
            10,
            Math.min(busSize.width - 10, elemPortAbsX - busPos.x),
          );
          const snappedX = Math.round(localX / gridSize) * gridSize;
          if (t.port && other.getPort(t.port)) {
            other.portProp(t.port, "args/x", snappedX);
            other.portProp(t.port, "args/y", busSize.height / 2);
          }
        }
      }
    });
  }
}

if (typeof window !== "undefined") {
  window.BusbarManager = BusbarManager;
}
