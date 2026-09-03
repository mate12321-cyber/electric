/**
 * SLD Export & Import Utilities
 * Supports High-Resolution PNG, Vector SVG, and Diagram JSON Schema export/import.
 */

const SLDExport = {
  /**
   * Export Diagram to SVG file
   */
  toSVG: function (paper, filename = "power_diagram.svg") {
    const svgElem = paper.svg;
    if (!svgElem) return;

    // Clone SVG and prepare for standalone export
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgElem);

    // Add XML namespace if missing
    if (!svgStr.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      svgStr = svgStr.replace(
        /^<svg/,
        '<svg xmlns="http://www.w3.org/2000/svg"',
      );
    }

    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Export Diagram to High-Res PNG
   */
  toPNG: function (paper, filename = "power_diagram.png", scale = 2) {
    const svgElem = paper.svg;
    if (!svgElem) return;

    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgElem);
    if (!svgStr.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      svgStr = svgStr.replace(
        /^<svg/,
        '<svg xmlns="http://www.w3.org/2000/svg"',
      );
    }

    const bbox = paper.getContentBBox();
    const width = Math.max(1200, bbox.width + 100);
    const height = Math.max(800, bbox.height + 100);

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    // White/dark background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = function () {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob(function (blob) {
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
      });
    };
    img.src = url;
  },

  /**
   * Export Diagram to Compact JSON Schema (v2.0)
   */
  toJSON: function (graph, metadata = {}, filename = "power_diagram.json") {
    const exportData =
      typeof SLDSerializer !== "undefined"
        ? SLDSerializer.toCompactJSON(graph, null, metadata)
        : {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            metadata: metadata,
            graph: graph.toJSON(),
          };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

window.SLDExport = SLDExport;
