/**
 * SLDSerializer.js
 * 전력 계통도(SLD)의 초경량 컴팩트 스키마(v2.0) 직렬화 및 역직렬화 전담 엔진.
 *
 * 기존 JointJS의 무거운 SVG attrs/markup 덤프를 배제하고
 * 상태와 토폴로지만을 컴팩트하게 추출/복원하여 95% 용량 절감 및 초고속 입출력을 제공합니다.
 */
class SLDSerializer {
  /**
   * JointJS Graph로부터 초경량 v2.0 JSON 스키마를 생성합니다.
   * @param {joint.dia.Graph} graph
   * @param {joint.dia.Paper} [paper]
   * @param {Object} [meta]
   * @returns {Object} v2.0 Compact Schema
   */
  static toCompactJSON(graph, paper = null, meta = {}) {
    if (!graph) return { version: "2.0", meta: {}, elements: [], links: [] };

    // 1. Viewport Meta
    let viewport = { zoom: 1.0, x: 0, y: 0 };
    if (
      paper &&
      typeof paper.scale === "function" &&
      typeof paper.translate === "function"
    ) {
      const s = paper.scale();
      const t = paper.translate();
      viewport = {
        zoom: Math.round((s.sx || 1) * 100) / 100,
        x: Math.round(t.tx || 0),
        y: Math.round(t.ty || 0),
      };
    }

    const mergedMeta = Object.assign(
      {
        title: "전력 계통도",
        gridSize: 10,
        viewport: viewport,
        savedAt: new Date().toISOString(),
      },
      meta || {},
    );

    // 2. Elements Serialization
    const elements = [];
    const rawElements =
      typeof graph.getElements === "function" ? graph.getElements() : [];

    rawElements.forEach((el) => {
      if (!el || !el.id) return;
      const pos = el.position ? el.position() : { x: 0, y: 0 };
      const sz = el.size ? el.size() : { width: 40, height: 40 };
      const sldData = el.get("sldData") || {};
      const rawType = el.get("type") || "sld.Breaker";
      const typeName = rawType.startsWith("sld.")
        ? rawType.replace("sld.", "")
        : rawType;

      const elObj = {
        id: el.id,
        type: typeName,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        w: Math.round(sz.width),
        h: Math.round(sz.height),
        data: sldData,
      };

      // Busbar or dynamic ports
      const ports = el.get("ports");
      if (
        ports &&
        ports.items &&
        Array.isArray(ports.items) &&
        ports.items.length > 0
      ) {
        elObj.ports = ports.items.map((p) => ({
          id: p.id,
          group: p.group || "bus-ports",
          args: p.args
            ? { x: Math.round(p.args.x || 0), y: Math.round(p.args.y || 0) }
            : undefined,
        }));
      }

      elements.push(elObj);
    });

    // 3. Links Serialization
    const links = [];
    const rawLinks =
      typeof graph.getLinks === "function" ? graph.getLinks() : [];

    rawLinks.forEach((link) => {
      if (!link || !link.id) return;
      const src = link.get("source") || {};
      const tgt = link.get("target") || {};
      if (!src.id || !tgt.id) return; // Skip broken links

      const linkObj = {
        id: link.id,
        from: { id: src.id, port: src.port || undefined },
        to: { id: tgt.id, port: tgt.port || undefined },
      };

      const vertices = link.get("vertices");
      if (vertices && Array.isArray(vertices) && vertices.length > 0) {
        linkObj.vertices = vertices.map((v) => ({
          x: Math.round(v.x),
          y: Math.round(v.y),
        }));
      }

      links.push(linkObj);
    });

    return {
      version: "2.0",
      meta: mergedMeta,
      elements: elements,
      links: links,
    };
  }

  /**
   * JSON 스키마(v2.0 컴팩트)로부터 JointJS Cell 인스턴스 배열을 생성합니다.
   * @param {Object} schema
   * @returns {{ elements: Array<joint.dia.Element>, links: Array<joint.dia.Link>, meta: Object }}
   */
  static fromCompactJSON(schema) {
    if (!schema) {
      return { elements: [], links: [], meta: {} };
    }

    const meta = schema.meta || {};
    const rawElements = Array.isArray(schema.elements) ? schema.elements : [];
    const rawLinks = Array.isArray(schema.links) ? schema.links : [];

    const instantiatedElements = [];
    const instantiatedLinks = [];
    const elementIdSet = new Set();

    // 1. Hydrate Elements
    rawElements.forEach((elData) => {
      if (!elData || !elData.id) return;
      const typeName = elData.type || "Breaker";
      let shapeClass = (joint.shapes.sld && joint.shapes.sld[typeName]) || null;
      if (
        !shapeClass &&
        joint.util &&
        typeof joint.util.getByPath === "function"
      ) {
        shapeClass = joint.util.getByPath(joint.shapes, "sld." + typeName, ".");
      }
      if (!shapeClass) {
        shapeClass =
          joint.shapes.sld.Breaker || joint.shapes.standard.Rectangle;
      }

      const cellConfig = {
        id: elData.id,
        position: { x: elData.x || 0, y: elData.y || 0 },
        size: { width: elData.w || 40, height: elData.h || 40 },
        sldData: elData.data || elData.sldData || {},
      };

      if (elData.ports && Array.isArray(elData.ports)) {
        cellConfig.ports = {
          groups: {
            "bus-ports": {
              position: { name: "absolute" },
              attrs: {
                circle: {
                  r: 3.5,
                  magnet: true,
                  fill: "#ffffff",
                  stroke: elData.data?.color || "#9C27B0",
                  strokeWidth: 1.5,
                },
              },
            },
          },
          items: elData.ports.map((p) => ({
            id: p.id,
            group: p.group || "bus-ports",
            args: p.args || { x: 0, y: 6 },
          })),
        };
      }

      try {
        const elInstance = new shapeClass(cellConfig);
        instantiatedElements.push(elInstance);
        elementIdSet.add(elData.id);
      } catch (e) {
        console.error("Failed to instantiate element:", elData, e);
      }
    });

    // 2. Hydrate Links
    rawLinks.forEach((lData) => {
      if (!lData || !lData.id) return;
      const src = lData.from || lData.source || {};
      const tgt = lData.to || lData.target || {};

      if (
        !src.id ||
        !tgt.id ||
        !elementIdSet.has(src.id) ||
        !elementIdSet.has(tgt.id)
      ) {
        return; // Ignore dangling link with missing endpoints
      }

      const linkConfig = {
        id: lData.id,
        source: { id: src.id, port: src.port },
        target: { id: tgt.id, port: tgt.port },
        router: { name: "sldOrthogonal" },
        connector: { name: "normal" },
        attrs: {
          line: {
            stroke: "#7A3E9D",
            strokeWidth: 2.5,
            targetMarker: { name: "none" },
          },
        },
      };

      if (
        lData.vertices &&
        Array.isArray(lData.vertices) &&
        lData.vertices.length > 0
      ) {
        linkConfig.vertices = lData.vertices;
      }

      try {
        const linkInstance = new joint.shapes.standard.Link(linkConfig);
        instantiatedLinks.push(linkInstance);
      } catch (e) {
        console.error("Failed to instantiate link:", lData, e);
      }
    });

    return {
      elements: instantiatedElements,
      links: instantiatedLinks,
      meta: meta,
    };
  }
}

if (typeof window !== "undefined") {
  window.SLDSerializer = SLDSerializer;
}
