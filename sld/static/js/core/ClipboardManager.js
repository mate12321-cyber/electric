/**
 * ClipboardManager.js
 * 다이어그램 요소 및 내부 링크의 복사(Copy), 붙여넣기(Paste), 복제(Duplicate)를 관리합니다.
 */
class ClipboardManager {
  constructor(editor) {
    this.editor = editor;
    this.clipboard = null;
  }

  copySelected() {
    let cells = this.editor.selectedCells || [];
    if (cells.length === 0) {
      if (this.editor.selectedCell) {
        cells = [this.editor.selectedCell];
      } else {
        return;
      }
    }

    const selectedElements = cells.filter(
      (c) => c && c.isElement && c.isElement(),
    );
    if (selectedElements.length === 0) return;

    const selectedIds = new Set(selectedElements.map((el) => el.id));

    // Find internal links whose both source and target are in the selected set
    const internalLinks = this.editor.graph.getLinks().filter((link) => {
      const srcId = link.get("source")?.id;
      const tgtId = link.get("target")?.id;
      return srcId && tgtId && selectedIds.has(srcId) && selectedIds.has(tgtId);
    });

    const elementsJson = selectedElements.map((el) => el.toJSON());
    const linksJson = internalLinks.map((l) => l.toJSON());

    this.clipboard = {
      elements: elementsJson,
      links: linksJson,
      pasteCount: 0,
    };

    this.editor.showToast(
      `${selectedElements.length}개 설비가 복사되었습니다.`,
    );
  }

  pasteCopied() {
    if (
      !this.clipboard ||
      !this.clipboard.elements ||
      this.clipboard.elements.length === 0
    ) {
      return;
    }

    this.clipboard.pasteCount = (this.clipboard.pasteCount || 0) + 1;
    const offset = this.clipboard.pasteCount * 40;
    const gridSize =
      (this.editor.options && this.editor.options.gridSize) || 10;
    const dx = Math.round(offset / gridSize) * gridSize;
    const dy = Math.round(offset / gridSize) * gridSize;

    const idMap = new Map();
    const newElements = [];

    // 1. Clone and instantiate Elements
    this.clipboard.elements.forEach((elJson) => {
      const clonedJson = JSON.parse(JSON.stringify(elJson));
      const oldId = clonedJson.id;
      const typePrefix = clonedJson.sldData?.type
        ? clonedJson.sldData.type.toLowerCase().replace(/_/g, "-")
        : "el";
      const newId = typePrefix + "_" + Math.random().toString(36).substr(2, 9);
      idMap.set(oldId, newId);

      clonedJson.id = newId;
      clonedJson.position = {
        x: clonedJson.position.x + dx,
        y: clonedJson.position.y + dy,
      };

      // Clone ports if present (e.g. Busbar or custom element)
      if (clonedJson.ports && clonedJson.ports.items) {
        clonedJson.ports.items = clonedJson.ports.items.map((p) => {
          const newPortId =
            p.id.startsWith("bus_p_") || p.id.startsWith("p_")
              ? "bus_p_" + Math.random().toString(36).substr(2, 9)
              : p.id;
          idMap.set(`${oldId}:${p.id}`, newPortId);
          return Object.assign({}, p, { id: newPortId });
        });
      }

      // Resolve Shape Constructor
      let shapeType = clonedJson.type;
      let shapeClass = null;
      if (shapeType && shapeType.startsWith("sld.") && joint.shapes.sld) {
        shapeClass = joint.shapes.sld[shapeType.replace("sld.", "")];
      }
      if (
        !shapeClass &&
        joint.util &&
        typeof joint.util.getByPath === "function"
      ) {
        shapeClass = joint.util.getByPath(joint.shapes, shapeType, ".");
      }
      if (!shapeClass) {
        shapeClass =
          joint.shapes.sld.Breaker || joint.shapes.standard.Rectangle;
      }

      const newEl = new shapeClass(clonedJson);
      this.editor.graph.addCell(newEl);
      newElements.push(newEl);
    });

    // 2. Clone internal Links connecting the cloned elements
    this.clipboard.links.forEach((lJson) => {
      const clonedLink = JSON.parse(JSON.stringify(lJson));
      const oldSrcId = clonedLink.source?.id;
      const oldTgtId = clonedLink.target?.id;
      const newSrcId = idMap.get(oldSrcId);
      const newTgtId = idMap.get(oldTgtId);

      if (newSrcId && newTgtId) {
        clonedLink.id = "link_" + Math.random().toString(36).substr(2, 9);
        const oldSrcPort = clonedLink.source?.port;
        const oldTgtPort = clonedLink.target?.port;
        const newSrcPort =
          (oldSrcPort && idMap.get(`${oldSrcId}:${oldSrcPort}`)) || oldSrcPort;
        const newTgtPort =
          (oldTgtPort && idMap.get(`${oldTgtId}:${oldTgtPort}`)) || oldTgtPort;

        clonedLink.source = Object.assign({}, clonedLink.source, {
          id: newSrcId,
          port: newSrcPort,
        });
        clonedLink.target = Object.assign({}, clonedLink.target, {
          id: newTgtId,
          port: newTgtPort,
        });
        clonedLink.router = { name: "sldOrthogonal" };
        clonedLink.connector = { name: "normal" };

        const link = new joint.shapes.standard.Link(clonedLink);
        this.editor.graph.addCell(link);
      }
    });

    // 3. Select all newly pasted elements
    this.editor.selectCells(newElements);
    if (this.editor.topologyTracker) {
      this.editor.topologyTracker.applyStyles(this.editor.paper);
    }
    this.editor.updateMinimap();
    this.editor.pushHistory();
    this.editor.scheduleAutoSave();
    this.editor.showToast(`${newElements.length}개 설비가 붙여넣기되었습니다.`);
  }

  duplicateSelected() {
    this.copySelected();
    this.pasteCopied();
  }

  hasData() {
    return (
      this.clipboard &&
      this.clipboard.elements &&
      this.clipboard.elements.length > 0
    );
  }
}

if (typeof window !== "undefined") {
  window.ClipboardManager = ClipboardManager;
}
