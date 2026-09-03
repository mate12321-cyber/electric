/**
 * TJunctionManager.js
 * 배선 도중 기존 연결선과의 직교 교차점 탐색, T분기 실시간 프리뷰 및 선로 자동 분할(Split)을 관리합니다.
 */
class TJunctionManager {
  constructor(editor) {
    this.editor = editor;
    this._snappedTBranch = null;
    this._lastSplitTime = 0;
    this._lastSplitLink = null;
  }

  getLinkPoints(link) {
    if (!link || !this.editor.paper) return null;
    const linkView = this.editor.paper.findViewByModel(link);
    if (!linkView) return null;

    let srcPt = linkView.sourceAnchor || linkView.sourcePoint;
    let tgtPt = linkView.targetAnchor || linkView.targetPoint;

    if (!srcPt) {
      const src = link.get("source");
      if (src && src.id) {
        const srcEl = this.editor.graph.getCell(src.id);
        if (srcEl) {
          const pos = srcEl.position();
          const size = srcEl.size();
          srcPt = { x: pos.x + size.width / 2, y: pos.y + size.height / 2 };
        }
      }
    }

    if (!tgtPt) {
      const tgt = link.get("target");
      if (tgt && tgt.id) {
        const tgtEl = this.editor.graph.getCell(tgt.id);
        if (tgtEl) {
          const pos = tgtEl.position();
          const size = tgtEl.size();
          tgtPt = { x: pos.x + size.width / 2, y: pos.y + size.height / 2 };
        }
      }
    }

    if (!srcPt || !tgtPt) return null;

    const vertices = link.get("vertices") || [];
    let routePoints = [];
    if (linkView.route && linkView.route.length > 0) {
      routePoints = linkView.route;
    } else if (linkView._route && linkView._route.length > 0) {
      routePoints = linkView._route;
    } else if (vertices.length > 0) {
      routePoints = vertices;
    } else if (
      typeof joint !== "undefined" &&
      joint.routers &&
      typeof joint.routers.sldOrthogonal === "function"
    ) {
      routePoints =
        joint.routers.sldOrthogonal(
          vertices,
          { sourcePoint: srcPt, targetPoint: tgtPt },
          linkView,
        ) || [];
    }

    return [srcPt, ...routePoints, tgtPt];
  }

  findTBranchTarget(paperPoint, sourceInfo, maxDist = 50) {
    if (!paperPoint || !this.editor.graph) return null;

    let srcEl = null;
    let srcPortX = null;
    let srcPortY = null;

    if (sourceInfo && sourceInfo.id) {
      srcEl = this.editor.graph.getCell(sourceInfo.id);
      if (srcEl && srcEl.isElement && srcEl.isElement()) {
        const srcPos = srcEl.position();
        const srcSize = srcEl.size();
        srcPortX = srcPos.x + srcSize.width / 2;
        srcPortY = srcPos.y + srcSize.height / 2;

        if (typeof srcEl.getPorts === "function") {
          const ports = srcEl.getPorts() || [];
          const portObj = ports.find((prt) => prt.id === sourceInfo.port);
          if (portObj && portObj.args) {
            srcPortX =
              srcPos.x +
              (portObj.args.x !== undefined
                ? portObj.args.x
                : srcSize.width / 2);
            srcPortY =
              srcPos.y +
              (portObj.args.y !== undefined
                ? portObj.args.y
                : srcSize.height / 2);
          }
        }
      }
    }

    const links = this.editor.graph.getLinks();
    let bestMatch = null;
    let bestDist = maxDist;

    links.forEach((link) => {
      if (
        sourceInfo &&
        (link.get("source")?.id === sourceInfo.id ||
          link.get("target")?.id === sourceInfo.id)
      ) {
        return;
      }

      const pts = this.getLinkPoints(link);
      if (!pts || pts.length < 2) return;

      const srcPt = pts[0];
      const tgtPt = pts[pts.length - 1];

      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];

        const isHorizontal = Math.abs(p1.y - p2.y) < 5;
        const isVertical = Math.abs(p1.x - p2.x) < 5;

        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        let candidatePoint = null;

        // 1. Prioritize Orthogonal Ray Alignment from Source Port
        if (srcPortX !== null && srcPortY !== null) {
          if (isHorizontal && srcPortX >= minX - 10 && srcPortX <= maxX + 10) {
            candidatePoint = {
              x: Math.round(srcPortX / 10) * 10,
              y: Math.round(p1.y / 10) * 10,
            };
          } else if (
            isVertical &&
            srcPortY >= minY - 10 &&
            srcPortY <= maxY + 10
          ) {
            candidatePoint = {
              x: Math.round(p1.x / 10) * 10,
              y: Math.round(srcPortY / 10) * 10,
            };
          }
        }

        // 2. Fallback to normal perpendicular projection onto segment
        if (!candidatePoint) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const l2 = dx * dx + dy * dy;
          if (l2 === 0) continue;

          let t =
            ((paperPoint.x - p1.x) * dx + (paperPoint.y - p1.y) * dy) / l2;
          t = Math.max(0, Math.min(1, t));

          if (isHorizontal) {
            candidatePoint = {
              x: Math.round((p1.x + t * dx) / 10) * 10,
              y: Math.round(p1.y / 10) * 10,
            };
          } else if (isVertical) {
            candidatePoint = {
              x: Math.round(p1.x / 10) * 10,
              y: Math.round((p1.y + t * dy) / 10) * 10,
            };
          } else {
            candidatePoint = {
              x: Math.round((p1.x + t * dx) / 10) * 10,
              y: Math.round((p1.y + t * dy) / 10) * 10,
            };
          }
        }

        // Must not be at terminal endpoints of existing link
        if (
          Math.hypot(candidatePoint.x - srcPt.x, candidatePoint.y - srcPt.y) <
            18 ||
          Math.hypot(candidatePoint.x - tgtPt.x, candidatePoint.y - tgtPt.y) <
            18
        ) {
          continue;
        }

        const dist = Math.hypot(
          paperPoint.x - candidatePoint.x,
          paperPoint.y - candidatePoint.y,
        );

        // Strong score bonus if candidate gives a straight branch line
        const isStraightBranch =
          (srcPortX !== null &&
            candidatePoint.x === Math.round(srcPortX / 10) * 10) ||
          (srcPortY !== null &&
            candidatePoint.y === Math.round(srcPortY / 10) * 10);

        const scoreDist = isStraightBranch ? dist * 0.45 : dist;

        if (scoreDist < bestDist) {
          bestDist = scoreDist;
          bestMatch = {
            link,
            projection: candidatePoint,
            segment: { p1, p2 },
            dist,
          };
        }
      }
    });

    return bestMatch;
  }

  findLinkAtPoint(
    paperPoint,
    maxDist = 25,
    excludeLinkId = null,
    excludeElementId = null,
  ) {
    if (!paperPoint || !this.editor.graph) return null;

    const links = this.editor.graph.getLinks();
    let bestLink = null;
    let bestDist = maxDist;
    let bestProjection = null;
    let bestSegment = null;

    links.forEach((link) => {
      if (excludeLinkId && link.id === excludeLinkId) return;
      if (
        excludeElementId &&
        (link.get("source")?.id === excludeElementId ||
          link.get("target")?.id === excludeElementId)
      ) {
        return;
      }

      const pts = this.getLinkPoints(link);
      if (!pts || pts.length < 2) return;

      const srcPt = pts[0];
      const tgtPt = pts[pts.length - 1];

      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const l2 = dx * dx + dy * dy;
        if (l2 === 0) continue;

        let t = ((paperPoint.x - p1.x) * dx + (paperPoint.y - p1.y) * dy) / l2;
        t = Math.max(0, Math.min(1, t));

        const proj = {
          x: p1.x + t * dx,
          y: p1.y + t * dy,
        };

        // Do not split at the terminal endpoints (ports) of existing links!
        if (
          Math.hypot(proj.x - srcPt.x, proj.y - srcPt.y) < 22 ||
          Math.hypot(proj.x - tgtPt.x, proj.y - tgtPt.y) < 22
        ) {
          continue;
        }

        const dist = Math.hypot(paperPoint.x - proj.x, paperPoint.y - proj.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestLink = link;
          bestProjection = proj;
          bestSegment = { p1, p2 };
        }
      }
    });

    if (bestLink && bestProjection) {
      return {
        link: bestLink,
        projection: bestProjection,
        dist: bestDist,
        segment: bestSegment,
      };
    }
    return null;
  }

  showTBranchPreview(paperPoint, color = "#377DFF") {
    if (!paperPoint || !this.editor.paper) return;

    const viewport =
      this.editor.paper.viewport ||
      (this.editor.paper.el &&
        this.editor.paper.el.querySelector(".joint-viewport")) ||
      this.editor.paper.svg;
    if (!viewport) return;

    let previewEl = document.getElementById("sld-tbranch-preview");
    if (!previewEl || previewEl.parentNode !== viewport) {
      if (previewEl && previewEl.parentNode) {
        previewEl.parentNode.removeChild(previewEl);
      }
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.id = "sld-tbranch-preview";
      g.setAttribute("class", "tbranch-preview-group");

      const pulse = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      pulse.setAttribute("class", "tbranch-preview-pulse");
      pulse.setAttribute("fill", "none");
      pulse.setAttribute("stroke-width", "2.5");

      const dot = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      dot.setAttribute("class", "tbranch-preview-dot");
      dot.setAttribute("r", "5.5");
      dot.setAttribute("stroke", "#ffffff");
      dot.setAttribute("stroke-width", "1.5");

      g.appendChild(pulse);
      g.appendChild(dot);
      viewport.appendChild(g);
      previewEl = g;
    }

    const pulse = previewEl.querySelector(".tbranch-preview-pulse");
    const dot = previewEl.querySelector(".tbranch-preview-dot");

    if (pulse) {
      pulse.setAttribute("cx", paperPoint.x);
      pulse.setAttribute("cy", paperPoint.y);
      pulse.setAttribute("stroke", color);
    }
    if (dot) {
      dot.setAttribute("cx", paperPoint.x);
      dot.setAttribute("cy", paperPoint.y);
      dot.setAttribute("fill", color);
    }
    previewEl.style.display = "block";
  }

  hideTBranchPreview() {
    const previewEl = document.getElementById("sld-tbranch-preview");
    if (previewEl) {
      previewEl.style.display = "none";
    }
  }

  splitLinkAtPoint(targetLink, projPoint, newSourceInfo = null) {
    if (!targetLink || !projPoint) return null;

    // Do not split a link connected directly to the newSourceInfo itself
    if (newSourceInfo && newSourceInfo.id) {
      if (
        targetLink.get("source")?.id === newSourceInfo.id ||
        targetLink.get("target")?.id === newSourceInfo.id
      ) {
        return null;
      }
    }

    const pts = this.getLinkPoints(targetLink);
    if (pts && pts.length >= 2) {
      const srcPt = pts[0];
      const tgtPt = pts[pts.length - 1];
      if (
        Math.hypot(projPoint.x - srcPt.x, projPoint.y - srcPt.y) < 20 ||
        Math.hypot(projPoint.x - tgtPt.x, projPoint.y - tgtPt.y) < 20
      ) {
        return null;
      }
    }

    // Debounce duplicate rapid split calls
    const now = Date.now();
    if (
      this._lastSplitTime &&
      now - this._lastSplitTime < 250 &&
      this._lastSplitLink === targetLink.id
    ) {
      return null;
    }
    this._lastSplitTime = now;
    this._lastSplitLink = targetLink.id;

    const gridSize =
      (this.editor.options && this.editor.options.gridSize) || 10;
    let jx = Math.round(projPoint.x / gridSize) * gridSize;
    let jy = Math.round(projPoint.y / gridSize) * gridSize;

    // Smart Alignment: Match junction coordinate to source port
    if (newSourceInfo && newSourceInfo.id) {
      const match = this.findTBranchTarget(projPoint, newSourceInfo, 80);
      if (match && match.projection) {
        jx = match.projection.x;
        jy = match.projection.y;
      }
    }

    // 1. Create Junction Node at (jx, jy)
    const junction = new joint.shapes.sld.Junction({
      position: { x: jx - 7, y: jy - 7 },
      size: { width: 14, height: 14 },
      sldData: {
        type: "JUNCTION",
        name: "분기점",
        state: "LIVE",
        color:
          targetLink.get("sldData")?.color ||
          targetLink.attr("line/stroke") ||
          "#377DFF",
      },
    });
    this.editor.graph.addCell(junction);

    const origSource = Object.assign({}, targetLink.get("source"));
    const origTarget = Object.assign({}, targetLink.get("target"));
    const linkColor =
      targetLink.attr("line/stroke") ||
      targetLink.get("sldData")?.color ||
      "#377DFF";

    // 2. Re-route original link: origSource -> Junction
    targetLink.set({
      target: { id: junction.id, port: "p1" },
      vertices: [],
      router: { name: "sldOrthogonal" },
    });

    // 3. Create second link: Junction -> origTarget
    const link2 = new joint.shapes.standard.Link({
      source: { id: junction.id, port: "p1" },
      target: origTarget,
      vertices: [],
      router: { name: "sldOrthogonal" },
      connector: { name: "normal" },
      attrs: {
        line: {
          stroke: linkColor,
          strokeWidth: 2.5,
          targetMarker: { type: "none" },
        },
      },
    });
    this.editor.graph.addCell(link2);

    // 4. If a third incoming source was provided, create/connect: newSource -> Junction
    let branchLink = null;
    if (newSourceInfo && newSourceInfo.id) {
      branchLink = new joint.shapes.standard.Link({
        source: { id: newSourceInfo.id, port: newSourceInfo.port },
        target: { id: junction.id, port: "p1" },
        vertices: [],
        router: { name: "sldOrthogonal" },
        connector: { name: "normal" },
        attrs: {
          line: {
            stroke: linkColor,
            strokeWidth: 2.5,
            targetMarker: { type: "none" },
          },
        },
      });
      this.editor.graph.addCell(branchLink);

      // Clean up any stale direct links that previously linked newSourceInfo to origSource or origTarget
      const duplicateLinks = this.editor.graph.getLinks().filter((l) => {
        if (
          l.id === targetLink.id ||
          l.id === link2.id ||
          l.id === branchLink?.id
        )
          return false;
        const s = l.get("source");
        const t = l.get("target");
        return (
          (s?.id === newSourceInfo.id &&
            (t?.id === origSource.id || t?.id === origTarget.id)) ||
          (t?.id === newSourceInfo.id &&
            (s?.id === origSource.id || s?.id === origTarget.id))
        );
      });
      duplicateLinks.forEach((l) => l.remove());
    }

    if (this.editor.topologyTracker) {
      this.editor.topologyTracker.applyStyles(this.editor.paper);
    }
    this.editor.updateMinimap();
    this.editor.pushHistory();
    this.editor.scheduleAutoSave();
    this.editor.showToast("연결선에 분기 접속점(T-분기)이 연결되었습니다.");

    return { junction, link1: targetLink, link2, branchLink };
  }

  cleanupOrphanedJunctions() {
    if (!this.editor.graph) return;
    const junctions = this.editor.graph
      .getElements()
      .filter(
        (el) =>
          el.get("type") === "sld.Junction" ||
          el.get("sldData")?.type === "JUNCTION",
      );

    junctions.forEach((junction) => {
      const connectedLinks = this.editor.graph.getConnectedLinks(junction);
      if (connectedLinks.length === 0) {
        junction.remove();
      } else if (connectedLinks.length === 1) {
        connectedLinks[0].remove();
        junction.remove();
      } else if (connectedLinks.length === 2) {
        const l1 = connectedLinks[0];
        const l2 = connectedLinks[1];

        const getOtherEndpoint = (link, junctionId) => {
          const s = link.get("source");
          const t = link.get("target");
          return s && s.id === junctionId ? t : s;
        };

        const ep1 = getOtherEndpoint(l1, junction.id);
        const ep2 = getOtherEndpoint(l2, junction.id);

        if (ep1 && ep2 && ep1.id && ep2.id && ep1.id !== ep2.id) {
          const color =
            l1.attr("line/stroke") || l2.attr("line/stroke") || "#377DFF";

          l1.remove();
          l2.remove();
          junction.remove();

          const mergedLink = new joint.shapes.standard.Link({
            source: ep1,
            target: ep2,
            router: { name: "sldOrthogonal" },
            connector: { name: "normal" },
            attrs: {
              line: {
                stroke: color,
                strokeWidth: 2.5,
                targetMarker: { type: "none" },
              },
            },
          });
          this.editor.graph.addCell(mergedLink);
        } else {
          l1.remove();
          l2.remove();
          junction.remove();
        }
      }
    });
  }
}

if (typeof window !== "undefined") {
  window.TJunctionManager = TJunctionManager;
}
