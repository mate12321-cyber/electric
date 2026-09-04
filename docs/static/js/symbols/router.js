/**
 * symbols/router.js
 * 전문 CAD SLD 직교 라우터 및 입체 교차 점프 아크 커넥터:
 * - joint.routers.sldOrthogonal: 심볼 관통 및 테두리 밀착 방지, 단자 방향(상/하/좌/우) 인식 직교 배선 라우터
 * - joint.connectors.sldJumpover: 비접속 모선(Busbar) 및 전선(Link)과의 모든 입체 교차 지점에 점프 아크(Jumpover Bridge) 자동 렌더링
 */
(function () {
  if (typeof joint === "undefined") return;

  // Grid snap helpers
  const snap = (v) => Math.round(v / 10) * 10;
  const snapCeil = (v) => Math.ceil(v / 10) * 10;
  const snapFloor = (v) => Math.floor(v / 10) * 10;

  // 1. Custom CAD SLD Orthogonal Router
  if (joint.routers) {
    function getPortDirection(cell, portId, pt, bbox) {
      if (!cell || (typeof cell.isElement === "function" && !cell.isElement()))
        return null;
      const type = cell.get("type");
      if (
        type === "sld.Junction" ||
        type === "sld.Busbar" ||
        cell.get("sldData")?.type === "JUNCTION" ||
        cell.get("sldData")?.type === "BUSBAR"
      ) {
        return null; // Junctions and Busbars are omnidirectional connection targets
      }

      // 1. Check port definition in element ports.items FIRST
      if (typeof cell.getPort === "function" && portId && bbox) {
        const portObj = cell.getPort(portId);
        if (portObj && portObj.args) {
          const px = portObj.args.x;
          const py = portObj.args.y;
          if (py !== undefined && py <= 3) return "TOP";
          if (py !== undefined && py >= bbox.height - 3) return "BOTTOM";
          if (px !== undefined && px <= 3) return "LEFT";
          if (px !== undefined && px >= bbox.width - 3) return "RIGHT";
        }
      }

      // 2. Check physical port point relative to element bounding box
      if (bbox && pt) {
        if (pt.y <= bbox.y + 3) return "TOP";
        if (pt.y >= bbox.y + bbox.height - 3) return "BOTTOM";
        if (pt.x <= bbox.x + 3) return "LEFT";
        if (pt.x >= bbox.x + bbox.width - 3) return "RIGHT";

        if (pt.y <= bbox.y + bbox.height * 0.3) return "TOP";
        if (pt.y >= bbox.y + bbox.height * 0.7) return "BOTTOM";
        if (pt.x <= bbox.x + bbox.width * 0.3) return "LEFT";
        if (pt.x >= bbox.x + bbox.width * 0.7) return "RIGHT";
      }

      // 3. Fallback to port ID naming conventions
      if (portId) {
        const pLow = portId.toLowerCase();
        if (
          pLow === "top" ||
          pLow === "in" ||
          pLow === "p1" ||
          pLow === "pri"
        ) {
          return "TOP";
        }
        if (
          pLow === "bottom" ||
          pLow === "out" ||
          pLow === "p2" ||
          pLow === "sec" ||
          pLow === "ground" ||
          pLow === "dc_bat" ||
          pLow === "dc_out"
        ) {
          return "BOTTOM";
        }
        if (pLow === "left" || pLow === "ac_in") return "LEFT";
        if (pLow === "right" || pLow === "ac_out" || pLow === "tert")
          return "RIGHT";
      }

      return "BOTTOM";
    }

    joint.routers.sldOrthogonal = function (vertices, opt, linkView) {
      const src =
        (linkView && (linkView.sourceAnchor || linkView.sourcePoint)) ||
        (opt && opt.sourcePoint);
      const tgt =
        (linkView && (linkView.targetAnchor || linkView.targetPoint)) ||
        (opt && opt.targetPoint);

      if (!src || !tgt) return vertices || [];

      const sx = Math.round(src.x);
      const sy = Math.round(src.y);
      const tx = Math.round(tgt.x);
      const ty = Math.round(tgt.y);

      // If user has manually placed intermediate vertices, preserve them
      if (vertices && vertices.length > 0) {
        return vertices;
      }

      // Resolve source & target cells and bounding boxes
      let srcCell = null;
      let tgtCell = null;
      let srcPortId = null;
      let tgtPortId = null;

      if (linkView && linkView.model) {
        const link = linkView.model;
        const source = link.get("source") || {};
        const target = link.get("target") || {};
        srcPortId = source.port;
        tgtPortId = target.port;

        const graph = (linkView.paper && linkView.paper.model) || link.graph;
        if (graph) {
          if (source.id) srcCell = graph.getCell(source.id);
          if (target.id) tgtCell = graph.getCell(target.id);
        }
      }

      const getBox = (c) => {
        if (!c || (typeof c.isElement === "function" && !cellIsElement(c)))
          return null;
        if (typeof c.getBBox === "function") return c.getBBox();
        const pos = c.position ? c.position() : { x: 0, y: 0 };
        const size = c.size ? c.size() : { width: 0, height: 0 };
        return {
          x: pos.x,
          y: pos.y,
          width: size.width,
          height: size.height,
        };
      };

      function cellIsElement(c) {
        return c && typeof c.isElement === "function" && c.isElement();
      }

      // Fast-path: When dragging/drawing a link toward a free cursor point (target cell not yet resolved)
      if (!tgtCell) {
        if (!srcCell) {
          return Math.abs(sx - tx) <= 5 || Math.abs(sy - ty) <= 5
            ? []
            : [{ x: sx, y: ty }];
        }
        const srcBBox = getBox(srcCell);
        const srcDir = getPortDirection(srcCell, srcPortId, src, srcBBox);
        if (srcDir === "BOTTOM") {
          return sy <= ty && Math.abs(sx - tx) <= 5 ? [] : [{ x: sx, y: ty }];
        }
        if (srcDir === "TOP") {
          return sy >= ty && Math.abs(sx - tx) <= 5 ? [] : [{ x: sx, y: ty }];
        }
        if (srcDir === "LEFT") {
          return sx >= tx && Math.abs(sy - ty) <= 5 ? [] : [{ x: tx, y: sy }];
        }
        if (srcDir === "RIGHT") {
          return sx <= tx && Math.abs(sy - ty) <= 5 ? [] : [{ x: tx, y: sy }];
        }
        return [{ x: sx, y: ty }];
      }

      const srcBBox = getBox(srcCell);
      const tgtBBox = getBox(tgtCell);

      const srcDir = getPortDirection(srcCell, srcPortId, src, srcBBox);
      const tgtDir = getPortDirection(tgtCell, tgtPortId, tgt, tgtBBox);

      // 1. Check if source or target is a Junction or Busbar (Omnidirectional targets)
      const isSrcJunction =
        srcCell &&
        (srcCell.get("type") === "sld.Junction" ||
          srcCell.get("type") === "sld.Busbar" ||
          srcCell.get("sldData")?.type === "JUNCTION" ||
          srcCell.get("sldData")?.type === "BUSBAR");
      const isTgtJunction =
        tgtCell &&
        (tgtCell.get("type") === "sld.Junction" ||
          tgtCell.get("type") === "sld.Busbar" ||
          tgtCell.get("sldData")?.type === "JUNCTION" ||
          tgtCell.get("sldData")?.type === "BUSBAR");

      if (isTgtJunction) {
        if (srcDir === "BOTTOM") {
          if (sy <= ty) return sx === tx ? [] : [{ x: sx, y: ty }];
          const safeY = snapCeil(
            (srcBBox ? srcBBox.y + srcBBox.height : sy) + 20,
          );
          return [
            { x: sx, y: safeY },
            { x: tx, y: safeY },
          ];
        }
        if (srcDir === "TOP") {
          if (sy >= ty) return sx === tx ? [] : [{ x: sx, y: ty }];
          const safeY = snapFloor((srcBBox ? srcBBox.y : sy) - 20);
          return [
            { x: sx, y: safeY },
            { x: tx, y: safeY },
          ];
        }
        if (srcDir === "LEFT") {
          if (sx >= tx) return sy === ty ? [] : [{ x: tx, y: sy }];
          const safeX = snapFloor((srcBBox ? srcBBox.x : sx) - 20);
          return [
            { x: safeX, y: sy },
            { x: safeX, y: ty },
          ];
        }
        if (srcDir === "RIGHT") {
          if (sx <= tx) return sy === ty ? [] : [{ x: tx, y: sy }];
          const safeX = snapCeil(
            (srcBBox ? srcBBox.x + srcBBox.width : sx) + 20,
          );
          return [
            { x: safeX, y: sy },
            { x: safeX, y: ty },
          ];
        }
        return sx === tx || sy === ty ? [] : [{ x: sx, y: ty }];
      }

      if (isSrcJunction) {
        if (tgtDir === "TOP") {
          if (sy <= ty) return sx === tx ? [] : [{ x: tx, y: sy }];
          const safeY = snapFloor((tgtBBox ? tgtBBox.y : ty) - 20);
          return [
            { x: sx, y: safeY },
            { x: tx, y: safeY },
          ];
        }
        if (tgtDir === "BOTTOM") {
          if (sy >= ty) return sx === tx ? [] : [{ x: tx, y: sy }];
          const safeY = snapCeil(
            (tgtBBox ? tgtBBox.y + tgtBBox.height : ty) + 20,
          );
          return [
            { x: sx, y: safeY },
            { x: tx, y: safeY },
          ];
        }
        if (tgtDir === "LEFT") {
          if (sx <= tx) return sy === ty ? [] : [{ x: sx, y: ty }];
          const safeX = snapFloor((tgtBBox ? tgtBBox.x : tx) - 20);
          return [
            { x: safeX, y: sy },
            { x: safeX, y: ty },
          ];
        }
        if (tgtDir === "RIGHT") {
          if (sx >= tx) return sy === ty ? [] : [{ x: sx, y: ty }];
          const safeX = snapCeil(
            (tgtBBox ? tgtBBox.x + tgtBBox.width : tx) + 20,
          );
          return [
            { x: safeX, y: sy },
            { x: safeX, y: ty },
          ];
        }
        return sx === tx || sy === ty ? [] : [{ x: tx, y: sy }];
      }

      // 2. Same direction connections ('ㄷ' shape bypass)
      if (srcDir === "BOTTOM" && tgtDir === "BOTTOM") {
        const lowestBottom = Math.max(
          srcBBox ? srcBBox.y + srcBBox.height : sy,
          tgtBBox ? tgtBBox.y + tgtBBox.height : ty,
        );
        const safeY = snapCeil(lowestBottom + 20);
        return [
          { x: sx, y: safeY },
          { x: tx, y: safeY },
        ];
      }

      if (srcDir === "TOP" && tgtDir === "TOP") {
        const highestTop = Math.min(
          srcBBox ? srcBBox.y : sy,
          tgtBBox ? tgtBBox.y : ty,
        );
        const safeY = snapFloor(highestTop - 20);
        return [
          { x: sx, y: safeY },
          { x: tx, y: safeY },
        ];
      }

      if (srcDir === "LEFT" && tgtDir === "LEFT") {
        const leftX = Math.min(
          srcBBox ? srcBBox.x : sx,
          tgtBBox ? tgtBBox.x : tx,
        );
        const safeX = snapFloor(leftX - 20);
        return [
          { x: safeX, y: sy },
          { x: safeX, y: ty },
        ];
      }

      if (srcDir === "RIGHT" && tgtDir === "RIGHT") {
        const rightX = Math.max(
          srcBBox ? srcBBox.x + srcBBox.width : sx,
          tgtBBox ? tgtBBox.x + tgtBBox.width : tx,
        );
        const safeX = snapCeil(rightX + 20);
        return [
          { x: safeX, y: sy },
          { x: safeX, y: ty },
        ];
      }

      // 3. Opposite direction connections (Vertical Flow: BOTTOM <-> TOP)
      if (srcDir === "BOTTOM" && tgtDir === "TOP") {
        if (Math.abs(sx - tx) <= 6 && sy <= ty) {
          return [];
        }
        if (sy <= ty) {
          const bottomOfSrc = srcBBox ? srcBBox.y + srcBBox.height : sy;
          const topOfTgt = tgtBBox ? tgtBBox.y : ty;
          let midY = snap((bottomOfSrc + topOfTgt) / 2);
          if (midY <= bottomOfSrc + 10) midY = snapCeil(bottomOfSrc + 15);
          if (midY >= topOfTgt - 10) midY = snapFloor(topOfTgt - 15);
          return [
            { x: sx, y: midY },
            { x: tx, y: midY },
          ];
        } else {
          // Source is BELOW target: Route around cleanly
          const safeY1 = snapCeil(
            (srcBBox ? srcBBox.y + srcBBox.height : sy) + 20,
          );
          const safeY2 = snapFloor((tgtBBox ? tgtBBox.y : ty) - 20);

          if (
            srcBBox &&
            tgtBBox &&
            srcBBox.x + srcBBox.width + 30 <= tgtBBox.x
          ) {
            const midX = snap((srcBBox.x + srcBBox.width + tgtBBox.x) / 2);
            return [
              { x: sx, y: safeY1 },
              { x: midX, y: safeY1 },
              { x: midX, y: safeY2 },
              { x: tx, y: safeY2 },
            ];
          }
          if (
            srcBBox &&
            tgtBBox &&
            tgtBBox.x + tgtBBox.width + 30 <= srcBBox.x
          ) {
            const midX = snap((tgtBBox.x + tgtBBox.width + srcBBox.x) / 2);
            return [
              { x: sx, y: safeY1 },
              { x: midX, y: safeY1 },
              { x: midX, y: safeY2 },
              { x: tx, y: safeY2 },
            ];
          }

          const bypassX =
            sx < tx
              ? snapCeil(
                  Math.max(
                    srcBBox ? srcBBox.x + srcBBox.width : sx,
                    tgtBBox ? tgtBBox.x + tgtBBox.width : tx,
                  ) + 30,
                )
              : snapFloor(
                  Math.min(srcBBox ? srcBBox.x : sx, tgtBBox ? tgtBBox.x : tx) -
                    30,
                );
          return [
            { x: sx, y: safeY1 },
            { x: bypassX, y: safeY1 },
            { x: bypassX, y: safeY2 },
            { x: tx, y: safeY2 },
          ];
        }
      }

      if (srcDir === "TOP" && tgtDir === "BOTTOM") {
        if (Math.abs(sx - tx) <= 6 && sy >= ty) {
          return [];
        }
        if (sy >= ty) {
          const topOfSrc = srcBBox ? srcBBox.y : sy;
          const bottomOfTgt = tgtBBox ? tgtBBox.y + tgtBBox.height : ty;
          let midY = snap((topOfSrc + bottomOfTgt) / 2);
          if (midY >= topOfSrc - 10) midY = snapFloor(topOfSrc - 15);
          if (midY <= bottomOfTgt + 10) midY = snapCeil(bottomOfTgt + 15);
          return [
            { x: sx, y: midY },
            { x: tx, y: midY },
          ];
        } else {
          const safeY1 = snapFloor((srcBBox ? srcBBox.y : sy) - 20);
          const safeY2 = snapCeil(
            (tgtBBox ? tgtBBox.y + tgtBBox.height : ty) + 20,
          );

          if (
            srcBBox &&
            tgtBBox &&
            srcBBox.x + srcBBox.width + 30 <= tgtBBox.x
          ) {
            const midX = snap((srcBBox.x + srcBBox.width + tgtBBox.x) / 2);
            return [
              { x: sx, y: safeY1 },
              { x: midX, y: safeY1 },
              { x: midX, y: safeY2 },
              { x: tx, y: safeY2 },
            ];
          }
          if (
            srcBBox &&
            tgtBBox &&
            tgtBBox.x + tgtBBox.width + 30 <= srcBBox.x
          ) {
            const midX = snap((tgtBBox.x + tgtBBox.width + srcBBox.x) / 2);
            return [
              { x: sx, y: safeY1 },
              { x: midX, y: safeY1 },
              { x: midX, y: safeY2 },
              { x: tx, y: safeY2 },
            ];
          }

          const bypassX =
            sx < tx
              ? snapCeil(
                  Math.max(
                    srcBBox ? srcBBox.x + srcBBox.width : sx,
                    tgtBBox ? tgtBBox.x + tgtBBox.width : tx,
                  ) + 30,
                )
              : snapFloor(
                  Math.min(srcBBox ? srcBBox.x : sx, tgtBBox ? tgtBBox.x : tx) -
                    30,
                );
          return [
            { x: sx, y: safeY1 },
            { x: bypassX, y: safeY1 },
            { x: bypassX, y: safeY2 },
            { x: tx, y: safeY2 },
          ];
        }
      }

      // 4. Opposite direction connections (Horizontal Flow: LEFT <-> RIGHT)
      if (srcDir === "RIGHT" && tgtDir === "LEFT") {
        if (Math.abs(sy - ty) <= 6 && sx <= tx) {
          return [];
        }
        if (sx <= tx) {
          const midX = snap((sx + tx) / 2);
          return [
            { x: midX, y: sy },
            { x: midX, y: ty },
          ];
        } else {
          const safeX1 = snapCeil(
            (srcBBox ? srcBBox.x + srcBBox.width : sx) + 20,
          );
          const safeX2 = snapFloor((tgtBBox ? tgtBBox.x : tx) - 20);
          const safeY =
            sy < ty
              ? snapFloor(
                  Math.min(srcBBox ? srcBBox.y : sy, tgtBBox ? tgtBBox.y : ty) -
                    30,
                )
              : snapCeil(
                  Math.max(
                    srcBBox ? srcBBox.y + srcBBox.height : sy,
                    tgtBBox ? tgtBBox.y + tgtBBox.height : ty,
                  ) + 30,
                );
          return [
            { x: safeX1, y: sy },
            { x: safeX1, y: safeY },
            { x: safeX2, y: safeY },
            { x: safeX2, y: ty },
          ];
        }
      }

      if (srcDir === "LEFT" && tgtDir === "RIGHT") {
        if (Math.abs(sy - ty) <= 6 && sx >= tx) {
          return [];
        }
        if (sx >= tx) {
          const midX = snap((sx + tx) / 2);
          return [
            { x: midX, y: sy },
            { x: midX, y: ty },
          ];
        } else {
          const safeX1 = snapFloor((srcBBox ? srcBBox.x : sx) - 20);
          const safeX2 = snapCeil(
            (tgtBBox ? tgtBBox.x + tgtBBox.width : tx) + 20,
          );
          const safeY =
            sy < ty
              ? snapFloor(
                  Math.min(srcBBox ? srcBBox.y : sy, tgtBBox ? tgtBBox.y : ty) -
                    30,
                )
              : snapCeil(
                  Math.max(
                    srcBBox ? srcBBox.y + srcBBox.height : sy,
                    tgtBBox ? tgtBBox.y + tgtBBox.height : ty,
                  ) + 30,
                );
          return [
            { x: safeX1, y: sy },
            { x: safeX1, y: safeY },
            { x: safeX2, y: safeY },
            { x: safeX2, y: ty },
          ];
        }
      }

      // 5. Perpendicular Connections (Corner / L / S Routes without symbol edge hugging)

      // 5-1. BOTTOM -> LEFT (e.g. ACB bottom -> UPS left)
      if (srcDir === "BOTTOM" && tgtDir === "LEFT") {
        if (sx < tx) {
          if (sy <= ty) {
            return [{ x: sx, y: ty }];
          } else {
            const midX = snap((sx + tx) / 2);
            return [
              { x: midX, y: sy },
              { x: midX, y: ty },
            ];
          }
        } else {
          const safeY = snapCeil(
            (srcBBox ? srcBBox.y + srcBBox.height : sy) + 20,
          );
          const safeX = snapFloor((tgtBBox ? tgtBBox.x : tx) - 20);
          return [
            { x: sx, y: safeY },
            { x: safeX, y: safeY },
            { x: safeX, y: ty },
          ];
        }
      }

      // 5-2. BOTTOM -> RIGHT
      if (srcDir === "BOTTOM" && tgtDir === "RIGHT") {
        if (sx > tx) {
          if (sy <= ty) {
            return [{ x: sx, y: ty }];
          } else {
            const midX = snap((sx + tx) / 2);
            return [
              { x: midX, y: sy },
              { x: midX, y: ty },
            ];
          }
        } else {
          const safeY = snapCeil(
            (srcBBox ? srcBBox.y + srcBBox.height : sy) + 20,
          );
          const safeX = snapCeil(
            (tgtBBox ? tgtBBox.x + tgtBBox.width : tx) + 20,
          );
          return [
            { x: sx, y: safeY },
            { x: safeX, y: safeY },
            { x: safeX, y: ty },
          ];
        }
      }

      // 5-3. TOP -> LEFT
      if (srcDir === "TOP" && tgtDir === "LEFT") {
        if (sx < tx) {
          if (sy >= ty) {
            return [{ x: sx, y: ty }];
          } else {
            const midX = snap((sx + tx) / 2);
            return [
              { x: midX, y: sy },
              { x: midX, y: ty },
            ];
          }
        } else {
          const safeY = snapFloor((srcBBox ? srcBBox.y : sy) - 20);
          const safeX = snapFloor((tgtBBox ? tgtBBox.x : tx) - 20);
          return [
            { x: sx, y: safeY },
            { x: safeX, y: safeY },
            { x: safeX, y: ty },
          ];
        }
      }

      // 5-4. TOP -> RIGHT
      if (srcDir === "TOP" && tgtDir === "RIGHT") {
        if (sx > tx) {
          if (sy >= ty) {
            return [{ x: sx, y: ty }];
          } else {
            const midX = snap((sx + tx) / 2);
            return [
              { x: midX, y: sy },
              { x: midX, y: ty },
            ];
          }
        } else {
          const safeY = snapFloor((srcBBox ? srcBBox.y : sy) - 20);
          const safeX = snapCeil(
            (tgtBBox ? tgtBBox.x + tgtBBox.width : tx) + 20,
          );
          return [
            { x: sx, y: safeY },
            { x: safeX, y: safeY },
            { x: safeX, y: ty },
          ];
        }
      }

      // 5-5. RIGHT -> TOP (e.g. UPS right -> Switchgear top)
      if (srcDir === "RIGHT" && tgtDir === "TOP") {
        if (sy < ty) {
          if (sx <= tx) {
            return [{ x: tx, y: sy }];
          } else {
            const safeX = snapCeil(
              (srcBBox ? srcBBox.x + srcBBox.width : sx) + 20,
            );
            const midY = snap((sy + ty) / 2);
            return [
              { x: safeX, y: sy },
              { x: safeX, y: midY },
              { x: tx, y: midY },
            ];
          }
        } else {
          const safeX = snapCeil(
            (srcBBox ? srcBBox.x + srcBBox.width : sx) + 20,
          );
          const safeY = snapFloor((tgtBBox ? tgtBBox.y : ty) - 20);
          return [
            { x: safeX, y: sy },
            { x: safeX, y: safeY },
            { x: tx, y: safeY },
          ];
        }
      }

      // 5-6. RIGHT -> BOTTOM
      if (srcDir === "RIGHT" && tgtDir === "BOTTOM") {
        if (sy > ty) {
          if (sx <= tx) {
            return [{ x: tx, y: sy }];
          } else {
            const safeX = snapCeil(
              (srcBBox ? srcBBox.x + srcBBox.width : sx) + 20,
            );
            const midY = snap((sy + ty) / 2);
            return [
              { x: safeX, y: sy },
              { x: safeX, y: midY },
              { x: tx, y: midY },
            ];
          }
        } else {
          const safeX = snapCeil(
            (srcBBox ? srcBBox.x + srcBBox.width : sx) + 20,
          );
          const safeY = snapCeil(
            (tgtBBox ? tgtBBox.y + tgtBBox.height : ty) + 20,
          );
          return [
            { x: safeX, y: safeY ? sy : sy },
            { x: safeX, y: safeY },
            { x: tx, y: safeY },
          ];
        }
      }

      // 5-7. LEFT -> TOP
      if (srcDir === "LEFT" && tgtDir === "TOP") {
        if (sy < ty) {
          if (sx >= tx) {
            return [{ x: tx, y: sy }];
          } else {
            const safeX = snapFloor((srcBBox ? srcBBox.x : sx) - 20);
            const midY = snap((sy + ty) / 2);
            return [
              { x: safeX, y: sy },
              { x: safeX, y: midY },
              { x: tx, y: midY },
            ];
          }
        } else {
          const safeX = snapFloor((srcBBox ? srcBBox.x : sx) - 20);
          const safeY = snapFloor((tgtBBox ? tgtBBox.y : ty) - 20);
          return [
            { x: safeX, y: sy },
            { x: safeX, y: safeY },
            { x: tx, y: safeY },
          ];
        }
      }

      // 5-8. LEFT -> BOTTOM
      if (srcDir === "LEFT" && tgtDir === "BOTTOM") {
        if (sy > ty) {
          if (sx >= tx) {
            return [{ x: tx, y: sy }];
          } else {
            const safeX = snapFloor((srcBBox ? srcBBox.x : sx) - 20);
            const midY = snap((sy + ty) / 2);
            return [
              { x: safeX, y: sy },
              { x: safeX, y: midY },
              { x: tx, y: midY },
            ];
          }
        } else {
          const safeX = snapFloor((srcBBox ? srcBBox.x : sx) - 20);
          const safeY = snapCeil(
            (tgtBBox ? tgtBBox.y + tgtBBox.height : ty) + 20,
          );
          return [
            { x: safeX, y: sy },
            { x: safeX, y: safeY },
            { x: tx, y: safeY },
          ];
        }
      }

      // Straight aligned connections
      if (sx === tx || sy === ty) {
        return [];
      }

      // Default Clean Step: Midpoint Y
      const midY = snap((sy + ty) / 2);
      return [
        { x: sx, y: midY },
        { x: tx, y: midY },
      ];
    };
  }

  // Helper: Merge adjacent collinear segments into a single segment
  function simplifyCollinearPoints(rawPts) {
    if (!rawPts || rawPts.length <= 2) return rawPts || [];
    const validPts = rawPts.filter(Boolean);
    if (validPts.length <= 2) return validPts;

    const result = [validPts[0]];
    for (let i = 1; i < validPts.length - 1; i++) {
      const prev = result[result.length - 1];
      const curr = validPts[i];
      const next = validPts[i + 1];

      const isVert =
        Math.abs(prev.x - curr.x) < 2 && Math.abs(curr.x - next.x) < 2;
      const isHoriz =
        Math.abs(prev.y - curr.y) < 2 && Math.abs(curr.y - next.y) < 2;
      const isDup =
        Math.abs(prev.x - curr.x) < 2 && Math.abs(prev.y - curr.y) < 2;

      if (!isVert && !isHoriz && !isDup) {
        result.push(curr);
      }
    }
    result.push(validPts[validPts.length - 1]);
    return result;
  }

  // Helper: Retrieve all polyline points for a given link model
  function getLinkPolyline(link, paper) {
    if (!link) return null;
    const linkView = paper ? paper.findViewByModel(link) : null;
    if (linkView && linkView._polyPoints && linkView._polyPoints.length >= 2) {
      return linkView._polyPoints;
    }
    let src = linkView && (linkView.sourceAnchor || linkView.sourcePoint);
    let tgt = linkView && (linkView.targetAnchor || linkView.targetPoint);
    let route = linkView && (linkView.route || linkView._route);

    if (!src || !tgt) {
      const s = link.get("source");
      const t = link.get("target");
      if (!s || !t) return null;
      const graph = (paper && paper.model) || link.graph;
      if (!graph) return null;

      if (s.id) {
        const el = graph.getCell(s.id);
        if (!el) return null;
        const bbox =
          typeof el.getBBox === "function"
            ? el.getBBox()
            : { x: 0, y: 0, width: 0, height: 0 };
        if (s.port && typeof el.getPort === "function") {
          const port = el.getPort(s.port);
          src = {
            x:
              bbox.x +
              (port?.args?.x !== undefined ? port.args.x : bbox.width / 2),
            y:
              bbox.y +
              (port?.args?.y !== undefined ? port.args.y : bbox.height / 2),
          };
        } else {
          src = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
        }
      } else if (s.x !== undefined) {
        src = { x: s.x, y: s.y };
      }

      if (t.id) {
        const el = graph.getCell(t.id);
        if (!el) return null;
        const bbox =
          typeof el.getBBox === "function"
            ? el.getBBox()
            : { x: 0, y: 0, width: 0, height: 0 };
        if (t.port && typeof el.getPort === "function") {
          const port = el.getPort(t.port);
          tgt = {
            x:
              bbox.x +
              (port?.args?.x !== undefined ? port.args.x : bbox.width / 2),
            y:
              bbox.y +
              (port?.args?.y !== undefined ? port.args.y : bbox.height / 2),
          };
        } else {
          tgt = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
        }
      } else if (t.x !== undefined) {
        tgt = { x: t.x, y: t.y };
      }
    }

    if (!src || !tgt) return null;

    if (!route || route.length === 0) {
      const userVertices = link.get("vertices") || [];
      if (userVertices.length > 0) {
        route = userVertices;
      } else if (
        typeof joint !== "undefined" &&
        joint.routers &&
        typeof joint.routers.sldOrthogonal === "function"
      ) {
        route =
          joint.routers.sldOrthogonal(
            [],
            { sourcePoint: src, targetPoint: tgt },
            linkView || {
              model: link,
              paper: paper,
              sourcePoint: src,
              targetPoint: tgt,
            },
          ) || [];
      } else {
        route = [];
      }
    }

    const calculatedPts = simplifyCollinearPoints([
      src,
      ...(route || []).filter(Boolean),
      tgt,
    ]);
    if (linkView) {
      linkView._polyPoints = calculatedPts;
    }
    return calculatedPts;
  }

  // 2. CAD Crossover Connector (Jumpover Arc on Crossings with Busbars & Other Links)
  if (joint.connectors) {
    joint.connectors.sldJumpover = function (
      sourcePoint,
      targetPoint,
      routePoints,
      opt,
      linkView,
    ) {
      const rawPts = [
        sourcePoint,
        ...((routePoints && routePoints.filter(Boolean)) || []),
        targetPoint,
      ];
      const pts = simplifyCollinearPoints(rawPts);
      if (pts.length < 2) {
        if (linkView) {
          linkView._polyPoints = pts;
          linkView._polyBBox = null;
        }
        return `M ${sourcePoint.x} ${sourcePoint.y} L ${targetPoint.x} ${targetPoint.y}`;
      }

      // Compute bounding box for current link (with allowance for arc bulge)
      let linkMinX = Infinity,
        linkMaxX = -Infinity,
        linkMinY = Infinity,
        linkMaxY = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x < linkMinX) linkMinX = p.x;
        if (p.x > linkMaxX) linkMaxX = p.x;
        if (p.y < linkMinY) linkMinY = p.y;
        if (p.y > linkMaxY) linkMaxY = p.y;
      }
      const pad = 15;
      const linkBox = {
        minX: linkMinX - pad,
        maxX: linkMaxX + pad,
        minY: linkMinY - pad,
        maxY: linkMaxY + pad,
      };

      if (linkView) {
        linkView._polyPoints = pts;
        linkView._polyBBox = linkBox;
      }

      const link = linkView && linkView.model;
      const paper = linkView && linkView.paper;
      const graph = (paper && paper.model) || (link && link.graph);

      // Collect all busbars that this link is NOT connected to
      const crossingBusbars = [];
      const crossingLinks = [];

      if (graph && link) {
        const srcId = link.get("source")?.id;
        const tgtId = link.get("target")?.id;

        // 1. Busbars (with AABB pre-filtering)
        const elements =
          typeof graph.getElements === "function" ? graph.getElements() : [];
        elements.forEach((el) => {
          const sld = el.get("sldData") || {};
          if (
            (el.get("type") === "sld.Busbar" || sld.type === "BUSBAR") &&
            el.id !== srcId &&
            el.id !== tgtId
          ) {
            const pos = el.position();
            const sz = el.size();
            const bMinX = pos.x;
            const bMaxX = pos.x + sz.width;
            const bMinY = pos.y;
            const bMaxY = pos.y + sz.height;

            // Fast AABB check: skip if busbar box and link box do not overlap
            if (
              linkBox.maxX < bMinX ||
              linkBox.minX > bMaxX ||
              linkBox.maxY < bMinY ||
              linkBox.minY > bMaxY
            ) {
              return;
            }

            crossingBusbars.push({
              id: el.id,
              x1: bMinX,
              x2: bMaxX,
              y1: bMinY,
              y2: bMaxY,
              centerX: pos.x + sz.width / 2,
              centerY: pos.y + sz.height / 2,
            });
          }
        });

        // 2. Other Links (Wires, with AABB pre-filtering and cached BBox/Points)
        const allLinks =
          typeof graph.getLinks === "function" ? graph.getLinks() : [];
        allLinks.forEach((otherLink) => {
          if (!otherLink || otherLink.id === link.id) return;
          const oView = paper ? paper.findViewByModel(otherLink) : null;

          // Fast BBox check using cached BBox if available
          let oBox = oView && oView._polyBBox;
          if (oBox) {
            if (
              linkBox.maxX < oBox.minX ||
              linkBox.minX > oBox.maxX ||
              linkBox.maxY < oBox.minY ||
              linkBox.minY > oBox.maxY
            ) {
              return;
            }
          }

          const otherPts =
            (oView && oView._polyPoints) || getLinkPolyline(otherLink, paper);
          if (otherPts && otherPts.length >= 2) {
            if (!oBox) {
              let oMinX = Infinity,
                oMaxX = -Infinity,
                oMinY = Infinity,
                oMaxY = -Infinity;
              for (let k = 0; k < otherPts.length; k++) {
                const op = otherPts[k];
                if (op.x < oMinX) oMinX = op.x;
                if (op.x > oMaxX) oMaxX = op.x;
                if (op.y < oMinY) oMinY = op.y;
                if (op.y > oMaxY) oMaxY = op.y;
              }
              oBox = { minX: oMinX, maxX: oMaxX, minY: oMinY, maxY: oMaxY };
              if (oView) oView._polyBBox = oBox;

              if (
                linkBox.maxX < oBox.minX ||
                linkBox.minX > oBox.maxX ||
                linkBox.maxY < oBox.minY ||
                linkBox.minY > oBox.maxY
              ) {
                return;
              }
            }

            crossingLinks.push({
              id: otherLink.id,
              pts: otherPts,
            });
          }
        });
      }

      let d = `M ${Math.round(pts[0].x)} ${Math.round(pts[0].y)}`;
      let allHaloD = "";

      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];

        const isVert = Math.abs(p1.x - p2.x) < 2;
        const isHoriz = Math.abs(p1.y - p2.y) < 2;
        const jumps = [];

        if (isVert) {
          const segX = Math.round(p1.x);
          const minY = Math.min(p1.y, p2.y);
          const maxY = Math.max(p1.y, p2.y);
          const isDown = p1.y < p2.y;

          // A. Busbar Crossings (Vertical link crosses Horizontal busbar)
          if (crossingBusbars.length > 0) {
            crossingBusbars.forEach((bus) => {
              if (segX >= bus.x1 - 2 && segX <= bus.x2 + 2) {
                if (bus.y2 >= minY && bus.y1 <= maxY) {
                  const rawStartY = isDown ? bus.y1 - 3 : bus.y2 + 3;
                  const rawEndY = isDown ? bus.y2 + 3 : bus.y1 - 3;
                  const startY = isDown
                    ? Math.max(minY, rawStartY)
                    : Math.min(maxY, rawStartY);
                  const endY = isDown
                    ? Math.min(maxY, rawEndY)
                    : Math.max(minY, rawEndY);

                  if (isDown ? startY + 4 <= endY : startY - 4 >= endY) {
                    jumps.push({
                      type: "bus",
                      busY1: bus.y1,
                      busY2: bus.y2,
                      pos: bus.centerY,
                      startY: startY,
                      endY: endY,
                      bulgeX: segX + 13,
                      isDown,
                      segX,
                    });
                  }
                }
              }
            });
          }

          // B. Wire-to-Wire Crossings (Vertical segment jumps over Horizontal wire segment)
          if (crossingLinks.length > 0) {
            crossingLinks.forEach((oLink) => {
              for (let k = 0; k < oLink.pts.length - 1; k++) {
                const q1 = oLink.pts[k];
                const q2 = oLink.pts[k + 1];
                const isOtherHoriz = Math.abs(q1.y - q2.y) < 2;

                if (isOtherHoriz) {
                  const oY = Math.round(q1.y);
                  const oMinX = Math.min(q1.x, q2.x);
                  const oMaxX = Math.max(q1.x, q2.x);

                  // True crossing occurs when the vertical segment strictly passes through the horizontal segment
                  if (
                    segX > oMinX + 3 &&
                    segX < oMaxX - 3 &&
                    oY > minY + 3 &&
                    oY < maxY - 3
                  ) {
                    const alreadyExists = jumps.some(
                      (j) => Math.abs(j.pos - oY) < 10,
                    );
                    if (!alreadyExists) {
                      const rawStartY = isDown ? oY - 6 : oY + 6;
                      const rawEndY = isDown ? oY + 6 : oY - 6;
                      const startY = isDown
                        ? Math.max(minY, rawStartY)
                        : Math.min(maxY, rawStartY);
                      const endY = isDown
                        ? Math.min(maxY, rawEndY)
                        : Math.max(minY, rawEndY);

                      if (isDown ? startY + 4 <= endY : startY - 4 >= endY) {
                        jumps.push({
                          type: "wire",
                          pos: oY,
                          startY: startY,
                          endY: endY,
                          bulgeX: segX + 11,
                          isDown,
                          segX,
                        });
                      }
                    }
                  }
                }
              }
            });
          }
        } else if (isHoriz) {
          const segY = Math.round(p1.y);
          const minX = Math.min(p1.x, p2.x);
          const maxX = Math.max(p1.x, p2.x);
          const isRight = p1.x < p2.x;

          // A. Busbar Crossings (Horizontal link crosses Vertical busbar)
          if (crossingBusbars.length > 0) {
            crossingBusbars.forEach((bus) => {
              if (segY >= bus.y1 - 2 && segY <= bus.y2 + 2) {
                if (bus.x2 >= minX && bus.x1 <= maxX) {
                  const rawStartX = isRight ? bus.x1 - 3 : bus.x2 + 3;
                  const rawEndX = isRight ? bus.x2 + 3 : bus.x1 - 3;
                  const startX = isRight
                    ? Math.max(minX, rawStartX)
                    : Math.min(maxX, rawStartX);
                  const endX = isRight
                    ? Math.min(maxX, rawEndX)
                    : Math.max(minX, rawEndX);

                  if (isRight ? startX + 4 <= endX : startX - 4 >= endX) {
                    jumps.push({
                      type: "bus",
                      busX1: bus.x1,
                      busX2: bus.x2,
                      pos: bus.centerX,
                      startX: startX,
                      endX: endX,
                      bulgeY: segY - 13,
                      isRight,
                      segY,
                    });
                  }
                }
              }
            });
          }
        }

        if (jumps.length === 0) {
          d += ` L ${Math.round(p2.x)} ${Math.round(p2.y)}`;
        } else {
          if (isVert) {
            const isDown = p1.y < p2.y;
            if (isDown) {
              jumps.sort((a, b) => a.pos - b.pos);
            } else {
              jumps.sort((a, b) => b.pos - a.pos);
            }

            const resolvedJumps = resolveOverlappingJumps(jumps, isDown, true);
            const segX = Math.round(p1.x);

            resolvedJumps.forEach((j) => {
              const startY = Math.round(j.startY);
              const endY = Math.round(j.endY);
              const cp1Y = Math.round((startY * 2 + endY) / 3);
              const cp2Y = Math.round((startY + endY * 2) / 3);
              const bulgeX = Math.round(j.bulgeX);

              d += ` L ${segX} ${startY}`;
              d += ` C ${bulgeX} ${cp1Y}, ${bulgeX} ${cp2Y}, ${segX} ${endY}`;
              allHaloD += `M ${segX} ${startY} C ${bulgeX} ${cp1Y}, ${bulgeX} ${cp2Y}, ${segX} ${endY} `;
            });
          } else if (isHoriz) {
            const isRight = p1.x < p2.x;
            if (isRight) {
              jumps.sort((a, b) => a.pos - b.pos);
            } else {
              jumps.sort((a, b) => b.pos - a.pos);
            }

            const resolvedJumps = resolveOverlappingJumps(
              jumps,
              isRight,
              false,
            );
            const segY = Math.round(p1.y);

            resolvedJumps.forEach((j) => {
              const startX = Math.round(j.startX);
              const endX = Math.round(j.endX);
              const cp1X = Math.round((startX * 2 + endX) / 3);
              const cp2X = Math.round((startX + endX * 2) / 3);
              const bulgeY = Math.round(j.bulgeY);

              d += ` L ${startX} ${segY}`;
              d += ` C ${cp1X} ${bulgeY}, ${cp2X} ${bulgeY}, ${endX} ${segY}`;
              allHaloD += `M ${startX} ${segY} C ${cp1X} ${bulgeY}, ${cp2X} ${bulgeY}, ${endX} ${segY} `;
            });
          }

          d += ` L ${Math.round(p2.x)} ${Math.round(p2.y)}`;
        }
      }

      if (linkView && linkView.el) {
        let halo = linkView.el.querySelector(".sld-jumpover-halo");
        if (allHaloD) {
          if (!halo) {
            halo = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "path",
            );
            halo.setAttribute("class", "sld-jumpover-halo");
            halo.setAttribute("fill", "none");
            halo.setAttribute("stroke", "#ffffff");
            halo.setAttribute("stroke-width", "6.5");
            halo.setAttribute("stroke-linecap", "round");
            halo.setAttribute("stroke-linejoin", "round");
            const lineEl =
              linkView.el.querySelector("path[joint-selector='line']") ||
              linkView.el.querySelector("path");
            if (lineEl) {
              linkView.el.insertBefore(halo, lineEl);
            } else {
              linkView.el.appendChild(halo);
            }
          }
          halo.setAttribute("d", allHaloD);
          halo.style.display = "block";

          // Ensure the jumping link (with its white halo) renders on top in SVG DOM
          if (
            linkView.el.parentNode &&
            linkView.el.parentNode.lastChild !== linkView.el
          ) {
            linkView.el.parentNode.appendChild(linkView.el);
          }
        } else if (halo) {
          halo.setAttribute("d", "");
          halo.style.display = "none";
        }
      }

      return d;
    };

    function resolveOverlappingJumps(jumps, isForward, isVert) {
      if (!jumps || jumps.length <= 1) return jumps;
      const resolved = [Object.assign({}, jumps[0])];
      for (let i = 1; i < jumps.length; i++) {
        const prev = resolved[resolved.length - 1];
        const curr = jumps[i];

        if (isVert) {
          if (isForward) {
            if (curr.startY <= prev.endY + 2) {
              prev.endY = Math.max(prev.endY, curr.endY);
              prev.pos = (prev.pos + curr.pos) / 2;
            } else {
              resolved.push(Object.assign({}, curr));
            }
          } else {
            if (curr.startY >= prev.endY - 2) {
              prev.endY = Math.min(prev.endY, curr.endY);
              prev.pos = (prev.pos + curr.pos) / 2;
            } else {
              resolved.push(Object.assign({}, curr));
            }
          }
        } else {
          if (isForward) {
            if (curr.startX <= prev.endX + 2) {
              prev.endX = Math.max(prev.endX, curr.endX);
              prev.pos = (prev.pos + curr.pos) / 2;
            } else {
              resolved.push(Object.assign({}, curr));
            }
          } else {
            if (curr.startX >= prev.endX - 2) {
              prev.endX = Math.min(prev.endX, curr.endX);
              prev.pos = (prev.pos + curr.pos) / 2;
            } else {
              resolved.push(Object.assign({}, curr));
            }
          }
        }
      }
      return resolved;
    }

    joint.connectors.normal = joint.connectors.sldJumpover;
  }
})();
