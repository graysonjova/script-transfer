/*
 * Diagram export (HTML / JPG) shared by the Lineage and ERD pages.
 * Exports the SVG currently rendered inside a container, so it always
 * matches what is on screen (e.g. the selected domain).
 *
 * The exported HTML lets you drag the boxes. Save layout writes the new
 * positions into the SVG in that HTML file, so opening the saved file
 * shows the boxes where you left them.
 *
 * Usage:
 *   DiagramExport.download("html" | "jpg", "diagram", "file_name", "Page title");
 */
window.DiagramExport = (function () {

    function erdHoverScript() {
        return `
        function wireErdHover(svg) {
            if (!svg || svg.dataset.hoverReady === "true") {
                return;
            }

            svg.dataset.hoverReady = "true";

            const HIGHLIGHT = "#d9480f";
            const ENTITY = /entity-([A-Za-z0-9_]+)-\\d+/g;

            function idsOf(element) {
                return [
                    element.id,
                    element.getAttribute("data-id"),
                    ...Array.from(
                        element.querySelectorAll("[data-id]")
                    ).map(child => child.getAttribute("data-id"))
                ].join(" ");
            }

            function namesIn(text) {
                return Array.from(
                    (text || "").matchAll(ENTITY),
                    match => match[1]
                );
            }

            const nodes = Array.from(svg.querySelectorAll("g.node"))
                .map(element => ({
                    element,
                    name: namesIn(idsOf(element))[0]
                }))
                .filter(node => node.name);

            const edges = Array.from(
                svg.querySelectorAll(
                    ".edgePaths path, path.relationshipLine"
                )
            )
                .map(element => ({
                    element,
                    pair: namesIn(idsOf(element))
                }))
                .filter(edge => edge.pair.length >= 2);

            const labels = Array.from(
                svg.querySelectorAll(".edgeLabel")
            )
                .map(element => ({
                    element,
                    rect: element.querySelector("rect"),
                    pair: namesIn(idsOf(element))
                }))
                .filter(label => label.pair.length >= 2);

            if (!nodes.length || !edges.length) {
                return;
            }

            let tooltip = document.getElementById("joinTooltip");

            if (!tooltip) {
                tooltip = document.createElement("div");
                tooltip.id = "joinTooltip";

                tooltip.style.position = "fixed";
                tooltip.style.display = "none";
                tooltip.style.padding = "6px 10px";
                tooltip.style.background = "#222";
                tooltip.style.color = "#fff";
                tooltip.style.borderRadius = "4px";
                tooltip.style.fontSize = "13px";
                tooltip.style.pointerEvents = "none";
                tooltip.style.zIndex = "9999";
                tooltip.style.whiteSpace = "nowrap";

                document.body.appendChild(tooltip);
            }

            if (!svg.id) {
                const serial = document.querySelectorAll("svg[id^='export-svg-']").length + 1;
                svg.id = "export-svg-" + serial;
            }

            // Join-line hover
            edges.forEach((edge, index) => {
                const [fromTable, toTable] = edge.pair;

                if (!edge.element.id) {
                    edge.element.id = svg.id + "-edge-" + index;
                }

                const hitPath = edge.element.cloneNode(false);

                hitPath.removeAttribute("id");
                hitPath.setAttribute("class", "join-hit-area");
                hitPath.dataset.hitFor = edge.element.id;

                // Do NOT clone Mermaid cardinality markers.
                hitPath.removeAttribute("marker-start");
                hitPath.removeAttribute("marker-mid");
                hitPath.removeAttribute("marker-end");

                hitPath.style.fill = "none";
                hitPath.style.stroke = "transparent";
                hitPath.style.strokeWidth = "16px";
                hitPath.style.pointerEvents = "stroke";
                hitPath.style.cursor = "pointer";

                edge.element.parentNode.appendChild(hitPath);

                hitPath.addEventListener("mouseenter", event => {
                    tooltip.textContent =
                        fromTable + " ↔ " + toTable;

                    tooltip.style.display = "block";

                    edge.element.style.stroke = HIGHLIGHT;
                    edge.element.style.strokeWidth = "2.5px";

                    nodes.forEach(node => {
                        node.element.style.filter =
                            node.name === fromTable ||
                            node.name === toTable
                                ? "drop-shadow(0 0 4px " +
                                HIGHLIGHT + ")"
                                : "";
                    });

                    tooltip.style.left =
                        event.clientX + 12 + "px";

                    tooltip.style.top =
                        event.clientY + 12 + "px";
                });

                hitPath.addEventListener("mousemove", event => {
                    tooltip.style.left =
                        event.clientX + 12 + "px";

                    tooltip.style.top =
                        event.clientY + 12 + "px";
                });

                hitPath.addEventListener("mouseleave", () => {
                    tooltip.style.display = "none";

                    edge.element.style.stroke = "";
                    edge.element.style.strokeWidth = "";

                    nodes.forEach(node => {
                        node.element.style.filter = "";
                    });
                });
            });

            // Existing table hover
            function reset() {
                edges.forEach(edge => {
                    edge.element.style.stroke = "";
                    edge.element.style.strokeWidth = "";
                });

                labels.forEach(label => {
                    if (label.rect) {
                        label.rect.style.stroke = "";
                        label.rect.style.strokeWidth = "";
                    }
                });

                nodes.forEach(node => {
                    node.element.style.filter = "";
                });
            }

            nodes.forEach(node => {
                node.element.style.cursor = "grab";

                node.element.addEventListener("mouseenter", () => {
                    const linked = new Set([node.name]);

                    edges.forEach(edge => {
                        const active =
                            edge.pair.includes(node.name);

                        if (active) {
                            edge.pair.forEach(name =>
                                linked.add(name)
                            );
                        }

                        edge.element.style.stroke =
                            active ? HIGHLIGHT : "";

                        edge.element.style.strokeWidth =
                            active ? "2.5px" : "";
                    });

                    labels.forEach(label => {
                        const active =
                            label.pair.includes(node.name);

                        if (label.rect) {
                            label.rect.style.stroke =
                                active ? HIGHLIGHT : "";

                            label.rect.style.strokeWidth =
                                active ? "2px" : "";
                        }
                    });

                    nodes.forEach(otherNode => {
                        if (linked.has(otherNode.name)) {
                            const shadowSize =
                                otherNode.name === node.name
                                    ? 6
                                    : 3;

                            otherNode.element.style.filter =
                                "drop-shadow(0 0 " +
                                shadowSize +
                                "px " +
                                HIGHLIGHT +
                                ")";
                        } else {
                            otherNode.element.style.filter = "";
                        }
                    });
                });

                node.element.addEventListener(
                    "mouseleave",
                    reset
                );
            });
        }
        `;
    }

    // Drag boxes in the exported HTML and write the new positions back into the file.
    function layoutScript() {
        return `
        const ENTITY = /entity-([A-Za-z0-9_]+)-\\d+/g;
        let layoutDirty = false;
        let layoutFileHandle = null;

        function num(value) {
            const rounded = Math.round(value * 10) / 10;
            return Object.is(rounded, -0) ? 0 : rounded;
        }

        function idsOf(element) {
            return [
                element.id,
                element.getAttribute("data-id"),
                ...Array.from(element.querySelectorAll("[data-id]"))
                    .map(child => child.getAttribute("data-id"))
            ].join(" ");
        }

        function namesIn(text) {
            return Array.from(
                (text || "").matchAll(ENTITY),
                match => match[1]
            );
        }

        function nodeName(element) {
            if (element.hasAttribute("data-node")) {
                return element.getAttribute("data-node");
            }
            return namesIn(idsOf(element))[0] || "";
        }

        function draggableNodes(svg) {
            const nodes = Array.from(
                svg.querySelectorAll("[data-node], g.node, .ev-card")
            ).filter(node => node.transform && !node.closest("defs"));

            return nodes.filter(node => !nodes.some(
                other => other !== node && other.contains(node)
            ));
        }

        function edgeEnds(path) {
            if (path.dataset.from && path.dataset.to) {
                return [path.dataset.from, path.dataset.to];
            }
            const pair = namesIn(idsOf(path));
            if (pair.length >= 2) {
                return [pair[0], pair[1]];
            }
            return null;
        }

        function clientToParent(element, clientX, clientY) {
            const svg = element.ownerSVGElement;
            const parent = element.parentNode;
            const point = svg.createSVGPoint();
            point.x = clientX;
            point.y = clientY;
            const matrix = parent && parent.getScreenCTM && parent.getScreenCTM();
            if (!matrix) {
                return { x: clientX, y: clientY };
            }
            const local = point.matrixTransform(matrix.inverse());
            return { x: local.x, y: local.y };
        }

        function unitsPerPixel(element, clientX, clientY) {
            const origin = clientToParent(element, clientX, clientY);
            const next = clientToParent(element, clientX + 100, clientY + 100);
            return {
                x: (next.x - origin.x) / 100,
                y: (next.y - origin.y) / 100
            };
        }

        function ensureDragBase(element) {
            if (element.hasAttribute("data-drag-base")) {
                return;
            }
            element.setAttribute("data-drag-base", element.getAttribute("transform") || "");
            element.setAttribute("data-drag-x", "0");
            element.setAttribute("data-drag-y", "0");
        }

        function dragOffset(element) {
            ensureDragBase(element);
            return {
                x: parseFloat(element.getAttribute("data-drag-x")) || 0,
                y: parseFloat(element.getAttribute("data-drag-y")) || 0
            };
        }

        function setDragOffset(element, x, y) {
            const base = element.getAttribute("data-drag-base") || "";
            const drag = "translate(" + num(x) + " " + num(y) + ")";
            element.setAttribute("data-drag-x", String(num(x)));
            element.setAttribute("data-drag-y", String(num(y)));
            element.setAttribute("transform", base ? drag + " " + base : drag);
        }

        function boxIn(element, target) {
            if (!element.getBBox || !element.getScreenCTM || !target.getScreenCTM) {
                return null;
            }
            let bbox;
            try {
                bbox = element.getBBox();
            } catch (error) {
                return null;
            }
            if (!isFinite(bbox.width) || !isFinite(bbox.height)) {
                return null;
            }
            if (bbox.width > 100000 || bbox.height > 100000) {
                return null;
            }
            const from = element.getScreenCTM();
            const to = target.getScreenCTM();
            if (!from || !to) {
                return null;
            }
            let matrix;
            try {
                matrix = to.inverse().multiply(from);
            } catch (error) {
                return null;
            }
            const svg = element.ownerSVGElement;
            const corners = [
                [bbox.x, bbox.y],
                [bbox.x + bbox.width, bbox.y],
                [bbox.x, bbox.y + bbox.height],
                [bbox.x + bbox.width, bbox.y + bbox.height]
            ];
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            corners.forEach(corner => {
                const point = svg.createSVGPoint();
                point.x = corner[0];
                point.y = corner[1];
                const mapped = point.matrixTransform(matrix);
                minX = Math.min(minX, mapped.x);
                minY = Math.min(minY, mapped.y);
                maxX = Math.max(maxX, mapped.x);
                maxY = Math.max(maxY, mapped.y);
            });
            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                cx: (minX + maxX) / 2,
                cy: (minY + maxY) / 2
            };
        }

        function borderPoint(box, towardX, towardY) {
            const dx = towardX - box.cx;
            const dy = towardY - box.cy;
            if (dx === 0 && dy === 0) {
                return { x: box.cx, y: box.cy };
            }
            const scale = 1 / Math.max(
                Math.abs(dx) / (box.width / 2 || 1),
                Math.abs(dy) / (box.height / 2 || 1)
            );
            return {
                x: box.cx + dx * scale,
                y: box.cy + dy * scale
            };
        }

        function connectorKind(path) {
            if (path.dataset.connector) {
                return path.dataset.connector;
            }
            const d = path.getAttribute("d") || "";
            let kind = "orthogonal";
            if (path.dataset.from && path.dataset.to) {
                kind = /[CQ]/i.test(d) ? "curve" : "orthogonal";
            } else if (/[CQ]/i.test(d)) {
                kind = "curve";
            } else if (((d.match(/L/gi) || []).length) <= 1) {
                kind = "straight";
            }
            path.dataset.connector = kind;
            return kind;
        }

        function outward(box, other) {
            const dx = other.cx - box.cx;
            const dy = other.cy - box.cy;
            if (Math.abs(dx) > Math.abs(dy)) {
                return dx >= 0
                    ? { x: box.x + box.width, y: box.cy, nx: 1, ny: 0 }
                    : { x: box.x, y: box.cy, nx: -1, ny: 0 };
            }
            return dy >= 0
                ? { x: box.cx, y: box.y + box.height, nx: 0, ny: 1 }
                : { x: box.cx, y: box.y, nx: 0, ny: -1 };
        }

        // Mermaid cardinality arrows follow the direction of the first and last
        // segment. Those segments have to run straight out of the box, or the
        // arrow is drawn beside the line.
        function markerRoute(a, b) {
            const start = outward(a, b);
            const end = outward(b, a);
            const gap = Math.hypot(end.x - start.x, end.y - start.y);
            const stub = Math.max(18, Math.min(40, gap / 3 || 18));
            const leave = {
                x: start.x + start.nx * stub,
                y: start.y + start.ny * stub
            };
            const approach = {
                x: end.x + end.nx * stub,
                y: end.y + end.ny * stub
            };
            let midD;
            let midX;
            let midY;
            if (start.nx !== 0 && end.nx !== 0) {
                const mid = (leave.x + approach.x) / 2;
                midD = "L " + num(mid) + " " + num(leave.y)
                    + " L " + num(mid) + " " + num(approach.y);
                midX = mid;
                midY = (leave.y + approach.y) / 2;
            } else if (start.ny !== 0 && end.ny !== 0) {
                const mid = (leave.y + approach.y) / 2;
                midD = "L " + num(leave.x) + " " + num(mid)
                    + " L " + num(approach.x) + " " + num(mid);
                midX = (leave.x + approach.x) / 2;
                midY = mid;
            } else if (start.nx !== 0) {
                midD = "L " + num(approach.x) + " " + num(leave.y);
                midX = approach.x;
                midY = leave.y;
            } else {
                midD = "L " + num(leave.x) + " " + num(approach.y);
                midX = leave.x;
                midY = approach.y;
            }
            return {
                d: "M " + num(start.x) + " " + num(start.y)
                    + " L " + num(leave.x) + " " + num(leave.y)
                    + " " + midD
                    + " L " + num(approach.x) + " " + num(approach.y)
                    + " L " + num(end.x) + " " + num(end.y),
                midX: midX,
                midY: midY
            };
        }

        function nudgeMarkers(path) {
            ["marker-start", "marker-end", "marker-mid"].forEach(name => {
                const value = path.getAttribute(name);
                if (!value) {
                    return;
                }
                path.removeAttribute(name);
                path.setAttribute(name, value);
            });
        }

        function connector(a, b, kind, path) {
            if (
                path &&
                (
                    path.getAttribute("marker-start") ||
                    path.getAttribute("marker-end") ||
                    path.getAttribute("marker-mid")
                )
            ) {
                return markerRoute(a, b);
            }
            if (Math.abs(a.cx - b.cx) < 1 && Math.abs(a.cy - b.cy) < 1) {
                const x = a.x + a.width;
                const y = a.cy;
                return {
                    d: "M " + num(x) + " " + num(y)
                        + " C " + num(x + 36) + " " + num(y - 28)
                        + ", " + num(x + 36) + " " + num(y + 28)
                        + ", " + num(x) + " " + num(y + 8),
                    midX: x + 36,
                    midY: y
                };
            }

            if (kind === "straight" || kind === "curve") {
                const start = borderPoint(a, b.cx, b.cy);
                const end = borderPoint(b, a.cx, a.cy);
                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;
                if (kind === "straight") {
                    return {
                        d: "M " + num(start.x) + " " + num(start.y)
                            + " L " + num(end.x) + " " + num(end.y),
                        midX,
                        midY
                    };
                }
                const dx = (end.x - start.x) / 2;
                return {
                    d: "M " + num(start.x) + " " + num(start.y)
                        + " C " + num(start.x + dx) + " " + num(start.y)
                        + ", " + num(end.x - dx) + " " + num(end.y)
                        + ", " + num(end.x) + " " + num(end.y),
                    midX,
                    midY
                };
            }

            const dx = b.cx - a.cx;
            const dy = b.cy - a.cy;
            if (Math.abs(dx) >= Math.abs(dy)) {
                const start = {
                    x: dx >= 0 ? a.x + a.width : a.x,
                    y: a.cy
                };
                const end = {
                    x: dx >= 0 ? b.x : b.x + b.width,
                    y: b.cy
                };
                const midX = (start.x + end.x) / 2;
                return {
                    d: "M " + num(start.x) + " " + num(start.y)
                        + " L " + num(midX) + " " + num(start.y)
                        + " L " + num(midX) + " " + num(end.y)
                        + " L " + num(end.x) + " " + num(end.y),
                    midX,
                    midY: (start.y + end.y) / 2
                };
            }

            const start = {
                x: a.cx,
                y: dy >= 0 ? a.y + a.height : a.y
            };
            const end = {
                x: b.cx,
                y: dy >= 0 ? b.y : b.y + b.height
            };
            const midY = (start.y + end.y) / 2;
            return {
                d: "M " + num(start.x) + " " + num(start.y)
                    + " L " + num(start.x) + " " + num(midY)
                    + " L " + num(end.x) + " " + num(midY)
                    + " L " + num(end.x) + " " + num(end.y),
                midX: (start.x + end.x) / 2,
                midY
            };
        }

        function cssAttr(value) {
            if (window.CSS && CSS.escape) {
                return CSS.escape(value);
            }
            return String(value).replace(/"/g, "");
        }

        function placeLabel(label, midX, midY, space) {
            const parent = label.parentNode;
            if (!parent || !parent.getScreenCTM || !space.getScreenCTM) {
                return;
            }
            const svg = label.ownerSVGElement;
            const point = svg.createSVGPoint();
            point.x = midX;
            point.y = midY;
            let mapped;
            try {
                mapped = point.matrixTransform(
                    parent.getScreenCTM().inverse().multiply(space.getScreenCTM())
                );
            } catch (error) {
                return;
            }
            let bbox;
            try {
                bbox = label.getBBox();
            } catch (error) {
                bbox = { x: 0, y: 0, width: 0, height: 0 };
            }
            const cx = bbox.x + (bbox.width || 0) / 2;
            const cy = bbox.y + (bbox.height || 0) / 2;
            label.setAttribute(
                "transform",
                "translate(" + num(mapped.x - cx) + " " + num(mapped.y - cy) + ")"
            );
        }

        function refreshEdges(svg) {
            const byName = new Map();
            draggableNodes(svg).forEach(node => {
                const name = nodeName(node);
                if (name && !byName.has(name)) {
                    byName.set(name, node);
                }
            });

            const paths = Array.from(svg.querySelectorAll(
                ".lv-edges path, .edgePaths path, path.relationshipLine"
            )).filter(path => !path.classList.contains("join-hit-area"));

            const mids = [];
            paths.forEach(path => {
                const ends = edgeEnds(path);
                if (!ends || !path.parentNode) {
                    return;
                }
                const fromNode = byName.get(ends[0]);
                const toNode = byName.get(ends[1]);
                if (!fromNode || !toNode) {
                    return;
                }
                const fromBox = boxIn(fromNode, path.parentNode);
                const toBox = boxIn(toNode, path.parentNode);
                if (!fromBox || !toBox) {
                    return;
                }
                const route = connector(fromBox, toBox, connectorKind(path), path);
                path.setAttribute("d", route.d);
                nudgeMarkers(path);
                if (path.id) {
                    svg.querySelectorAll(
                        '.join-hit-area[data-hit-for="' + cssAttr(path.id) + '"]'
                    ).forEach(hit => hit.setAttribute("d", route.d));
                }
                mids.push({
                    key: ends.slice().sort().join("\\0"),
                    midX: route.midX,
                    midY: route.midY,
                    space: path.parentNode
                });
            });

            const used = new Set();
            svg.querySelectorAll(".edgeLabel").forEach(label => {
                const pair = namesIn(idsOf(label));
                if (pair.length < 2) {
                    return;
                }
                const key = pair.slice().sort().join("\\0");
                const index = mids.findIndex((item, itemIndex) =>
                    item.key === key && !used.has(itemIndex)
                );
                if (index < 0) {
                    return;
                }
                used.add(index);
                placeLabel(label, mids[index].midX, mids[index].midY, mids[index].space);
            });
        }

        function fitSvg(svg) {
            const current = svg.viewBox && svg.viewBox.baseVal;
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            svg.querySelectorAll(
                "path, rect, text, polygon, polyline, ellipse, circle, image, foreignObject"
            ).forEach(element => {
                if (element.closest("defs")) {
                    return;
                }
                if (element.classList.contains("join-hit-area")) {
                    return;
                }
                const box = boxIn(element, svg);
                if (!box) {
                    return;
                }
                minX = Math.min(minX, box.x);
                minY = Math.min(minY, box.y);
                maxX = Math.max(maxX, box.x + box.width);
                maxY = Math.max(maxY, box.y + box.height);
            });
            if (!isFinite(minX)) {
                return;
            }
            const pad = 24;
            minX -= pad;
            minY -= pad;
            maxX += pad;
            maxY += pad;
            if (current && current.width) {
                minX = Math.min(minX, current.x);
                minY = Math.min(minY, current.y);
                maxX = Math.max(maxX, current.x + current.width);
                maxY = Math.max(maxY, current.y + current.height);
            }
            if (
                current && current.width &&
                minX >= current.x - 0.5 &&
                minY >= current.y - 0.5 &&
                maxX <= current.x + current.width + 0.5 &&
                maxY <= current.y + current.height + 0.5
            ) {
                return;
            }
            const width = Math.max(1, maxX - minX);
            const height = Math.max(1, maxY - minY);
            svg.setAttribute(
                "viewBox",
                num(minX) + " " + num(minY) + " " + num(width) + " " + num(height)
            );
            svg.setAttribute("width", String(Math.ceil(width)));
            svg.setAttribute("height", String(Math.ceil(height)));
        }

        function markDirty() {
            layoutDirty = true;
            const status = document.getElementById("layoutStatus");
            if (status) {
                status.textContent = "Unsaved position changes. Save layout to keep them in the HTML file.";
            }
        }

        function wireDiagramDrag(svg) {
            if (!svg || svg.dataset.dragReady === "true") {
                return;
            }
            const nodes = draggableNodes(svg);
            if (!nodes.length) {
                return;
            }
            svg.dataset.dragReady = "true";
            nodes.forEach(node => {
                node.style.cursor = "grab";
            });

            svg.addEventListener("pointerdown", event => {
                if (event.button !== 0) {
                    return;
                }
                const hit = event.target.closest &&
                    event.target.closest("[data-node], g.node, .ev-card");
                if (!hit || !svg.contains(hit)) {
                    return;
                }
                const target = nodes.find(node => node === hit || node.contains(hit));
                if (!target) {
                    return;
                }
                event.preventDefault();
                const origin = dragOffset(target);
                const scale = unitsPerPixel(target, event.clientX, event.clientY);
                const startX = event.clientX;
                const startY = event.clientY;
                let moved = false;
                svg.classList.add("is-dragging");

                function move(ev) {
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;
                    if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) {
                        return;
                    }
                    moved = true;
                    setDragOffset(
                        target,
                        origin.x + dx * scale.x,
                        origin.y + dy * scale.y
                    );
                    refreshEdges(svg);
                }

                function up() {
                    document.removeEventListener("pointermove", move);
                    document.removeEventListener("pointerup", up);
                    document.removeEventListener("pointercancel", up);
                    svg.classList.remove("is-dragging");
                    if (!moved) {
                        return;
                    }
                    fitSvg(svg);
                    refreshEdges(svg);
                    markDirty();
                }

                document.addEventListener("pointermove", move);
                document.addEventListener("pointerup", up);
                document.addEventListener("pointercancel", up);
            });
        }

        function highlightColor(value) {
            return value === "#d9480f" || value === "rgb(217, 72, 15)";
        }

        function buildSavedHtml() {
            const clone = document.documentElement.cloneNode(true);
            clone.querySelectorAll(".join-hit-area, #joinTooltip").forEach(element => {
                element.remove();
            });
            clone.querySelectorAll("svg").forEach(svg => {
                svg.removeAttribute("data-hover-ready");
                svg.removeAttribute("data-drag-ready");
                svg.classList.remove("is-dragging");
                if (!svg.getAttribute("class")) {
                    svg.removeAttribute("class");
                }
            });
            clone.querySelectorAll("[data-node], g.node, .ev-card").forEach(node => {
                if (node.style.filter && node.style.filter.indexOf("217, 72, 15") !== -1) {
                    node.style.filter = "";
                }
                node.classList.remove("is-dragging");
            });
            clone.querySelectorAll(
                ".edgePaths path, path.relationshipLine, .edgeLabel rect, .lv-edges path"
            ).forEach(element => {
                if (highlightColor(element.style.stroke)) {
                    element.style.stroke = "";
                    element.style.strokeWidth = "";
                }
            });
            return "<!DOCTYPE html>\\n" + clone.outerHTML;
        }

        function savedFileName() {
            const meta = document.querySelector('meta[name="diagram-export-file"]');
            return (meta && meta.getAttribute("content")) || "diagram.html";
        }

        function downloadSaved(html, fileName) {
            const url = URL.createObjectURL(new Blob(
                [html],
                { type: "text/html;charset=utf-8" }
            ));
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function setSavedStatus(message) {
            layoutDirty = false;
            const status = document.getElementById("layoutStatus");
            if (status) {
                status.textContent = message;
            }
        }

        async function saveLayout() {
            const html = buildSavedHtml();
            const fileName = savedFileName();
            try {
                if (window.showSaveFilePicker) {
                    if (!layoutFileHandle) {
                        layoutFileHandle = await window.showSaveFilePicker({
                            suggestedName: fileName,
                            types: [{
                                description: "HTML file",
                                accept: { "text/html": [".html"] }
                            }]
                        });
                    }
                    const writable = await layoutFileHandle.createWritable();
                    await writable.write(html);
                    await writable.close();
                    setSavedStatus("Saved. Open that file next time and the boxes stay where you put them.");
                    return;
                }
            } catch (error) {
                if (error && error.name === "AbortError") {
                    return;
                }
                layoutFileHandle = null;
            }
            downloadSaved(html, fileName);
            setSavedStatus("Downloaded a new HTML file. Open that file to keep these positions.");
        }

        function initLayout() {
            document.querySelectorAll(".diagram svg").forEach(wireDiagramDrag);
            const button = document.getElementById("saveLayout");
            if (button) {
                button.addEventListener("click", () => {
                    saveLayout();
                });
            }
            window.addEventListener("beforeunload", event => {
                if (!layoutDirty) {
                    return;
                }
                event.preventDefault();
                event.returnValue = "";
            });
        }

        initLayout();
        `;
    }

    function getSvg(containerId) {
        const svg = document.querySelector(`#${containerId} svg`);
        if (!svg) {
            alert("Nothing to download yet - the diagram has not rendered.");
            return null;
        }
        return svg;
    }

    // Copy the SVG with a fixed pixel size (Mermaid uses width="100%")
    function serialize(svg) {
        const viewBox = svg.viewBox && svg.viewBox.baseVal;
        const box = (viewBox && viewBox.width) ? viewBox : svg.getBBox();
        const width = Math.ceil(box.width);
        const height = Math.ceil(box.height);

        const clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
        clone.setAttribute("width", width);
        clone.setAttribute("height", height);
        clone.style.maxWidth = "none";

        return {
            markup: new XMLSerializer().serializeToString(clone),
            width,
            height
        };
    }

    function save(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function cleanName(name) {
        return String(name).replace(/[^a-zA-Z0-9_-]+/g, "_");
    }

    function downloadHtml(svg, fileName, title) {
        const { markup } = serialize(svg);
        const safeTitle = String(title).replace(/</g, "&lt;");

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<meta name="diagram-export-file" content="${fileName}.html">

<style>
    body {
        font-family: Segoe UI, Arial, sans-serif;
        margin: 20px;
        background: #fafafa;
    }

    .diagram {
        background: white;
        padding: 20px;
        border: 1px solid #ddd;
        overflow: auto;
    }

    .meta {
        color: #666;
        font-size: 0.85em;
    }

    .layout-bar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin: 0 0 12px 0;
        padding: 8px 0;
        background: #fafafa;
    }

    .layout-bar button {
        padding: 6px 12px;
        font-family: inherit;
        cursor: pointer;
    }

    #layoutStatus {
        color: #666;
        font-size: 0.85em;
    }

    [data-node],
    .ev-card,
    g.node {
        cursor: grab;
        touch-action: none;
    }

    svg.is-dragging,
    svg.is-dragging * {
        cursor: grabbing;
    }
</style>
</head>

<body>

<h2>${safeTitle}</h2>
<p class="meta">Exported ${new Date().toLocaleString()}</p>
<div class="layout-bar">
    <button id="saveLayout" type="button">Save layout</button>
    <span id="layoutStatus">Drag the boxes to rearrange. Save layout stores the new positions in the HTML file.</span>
</div>

<div class="diagram">
    ${markup}
</div>

<script>
(function () {
    const svg = document.querySelector(".diagram svg");

    if (!svg) {
        return;
    }

    const HIGHLIGHT = "#d9480f";

    // ============================================================
    // LINEAGE HOVER
    // Highlights the complete upstream and downstream lineage.
    // ============================================================

    const lineagePaths = Array.from(
        svg.querySelectorAll(".lv-edges path")
    );

    const lineageNodes = Array.from(
        svg.querySelectorAll("[data-node]")
    );

    if (lineagePaths.length && lineageNodes.length) {
        const parents = {};
        const children = {};

        lineagePaths.forEach(path => {
            const from = path.dataset.from;
            const to = path.dataset.to;

            if (!from || !to) {
                return;
            }

            if (!parents[to]) {
                parents[to] = [];
            }

            if (!children[from]) {
                children[from] = [];
            }

            parents[to].push(from);
            children[from].push(to);
        });

        function walk(start, map) {
            const seen = new Set([start]);
            const queue = [start];

            while (queue.length) {
                const current = queue.shift();
                const connectedNodes = map[current] || [];

                connectedNodes.forEach(next => {
                    if (!seen.has(next)) {
                        seen.add(next);
                        queue.push(next);
                    }
                });
            }

            return seen;
        }

        function resetLineage() {
            lineagePaths.forEach(path => {
                path.setAttribute("stroke", "#8a8a8a");
                path.setAttribute("stroke-width", "1");
                path.setAttribute("opacity", "0.6");

                if (path.hasAttribute("marker-end")) {
                    path.setAttribute(
                        "marker-end",
                        "url(#lv-arrow)"
                    );
                }
            });

            lineageNodes.forEach(node => {
                const rect = node.querySelector("rect");

                if (!rect) {
                    return;
                }

                rect.setAttribute("stroke", "#9370db");
                rect.setAttribute("stroke-width", "1");
            });
        }

        lineageNodes.forEach(node => {
            const id = node.getAttribute("data-node");

            if (!id) {
                return;
            }

            node.addEventListener("mouseenter", () => {
                const upstream = walk(id, parents);
                const downstream = walk(id, children);

                lineagePaths.forEach(path => {
                    const from = path.dataset.from;
                    const to = path.dataset.to;

                    const active =
                        (
                            upstream.has(from) &&
                            upstream.has(to)
                        ) ||
                        (
                            downstream.has(from) &&
                            downstream.has(to)
                        );

                    path.setAttribute(
                        "stroke",
                        active ? HIGHLIGHT : "#8a8a8a"
                    );

                    path.setAttribute(
                        "stroke-width",
                        active ? "2" : "1"
                    );

                    path.setAttribute(
                        "opacity",
                        active ? "1" : "0.6"
                    );

                    if (path.hasAttribute("marker-end")) {
                        path.setAttribute(
                            "marker-end",
                            active
                                ? "url(#lv-arrow-hi)"
                                : "url(#lv-arrow)"
                        );
                    }

                    if (active && path.parentNode) {
                        path.parentNode.appendChild(path);
                    }
                });

                lineageNodes.forEach(otherNode => {
                    const otherId =
                        otherNode.getAttribute("data-node");

                    const active =
                        upstream.has(otherId) ||
                        downstream.has(otherId);

                    const rect =
                        otherNode.querySelector("rect");

                    if (!rect) {
                        return;
                    }

                    rect.setAttribute(
                        "stroke",
                        active ? HIGHLIGHT : "#9370db"
                    );

                    rect.setAttribute(
                        "stroke-width",
                        otherId === id
                            ? "3"
                            : active
                                ? "2"
                                : "1"
                    );
                });
            });

            node.addEventListener(
                "mouseleave",
                resetLineage
            );
        });
    }

    // ============================================================
    // MERMAID ERD HOVER
    // Uses the same structure as the working ERD web page.
    // Highlights direct relationships only.
    // ============================================================

    ${erdHoverScript()}
    // This is a no-op on lineage SVGs because they have no Mermaid ERD nodes/edges.
    wireErdHover(svg);

    ${layoutScript()}

})();
</script>

</body>
</html>`;

        save(
            new Blob(
                [html],
                { type: "text/html;charset=utf-8" }
            ),
            `${fileName}.html`
        );
    }

    function downloadAllHtml(items, fileName, title, initialDomain) {
        if (!Array.isArray(items) || !items.length) {
            alert("There are no domain diagrams to download.");
            return;
        }

        const safeTitle = String(title || "ERD")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        const safeInitialDomain = String(initialDomain || items[0].name)
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'");

        const options = items.map(item => {
            const safeName = String(item.name)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");

            const label = item.name === initialDomain && item.isAll
                ? "All (combined)"
                : item.isAll
                    ? "All (combined)"
                    : safeName;

            return (
                '<option value="' + safeName + '">' +
                label +
                '</option>'
            );
        }).join("");

        const diagrams = items.map(item => {
            const safeName = String(item.name)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");

            const heading = item.isAll
                ? "All domains"
                : safeName;

            return `
    <section
        class="domain-page"
        data-domain="${safeName}"
        hidden
    >
        <h3>${heading}</h3>

        <div class="diagram">
            ${item.markup}
        </div>
    </section>`;
        }).join("");

        const html = `<!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <title>${safeTitle}</title>
    <meta name="diagram-export-file" content="${cleanName(fileName)}.html">

    <style>
        body {
            font-family: Segoe UI, Arial, sans-serif;
            margin: 0;
            background: #fafafa;
            color: #222;
        }

        .top-wrapper {
            position: sticky;
            top: 0;
            z-index: 100;
            background: #ffffff;
            border-bottom: 1px solid #d8d8d8;
            padding: 16px 20px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }

        .top-wrapper h2 {
            margin: 0 0 12px 0;
        }

        .navigation {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
        }

        .navigation label {
            font-weight: 600;
        }

        .navigation select,
        .navigation button {
            padding: 6px 10px;
            font-family: inherit;
        }

        .content {
            padding: 20px;
        }

        .domain-page h3 {
            margin-top: 0;
        }

        .diagram {
            background: #ffffff;
            padding: 20px;
            border: 1px solid #ddd;
            overflow: auto;
            min-height: 300px;
        }

        .diagram svg {
            display: block;
            max-width: none;
        }

        .meta {
            color: #666;
            font-size: 0.85em;
            margin: 10px 0 0 0;
        }

        .layout-bar {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
        }

        .layout-bar button {
            padding: 6px 12px;
            font-family: inherit;
            cursor: pointer;
        }

        #layoutStatus {
            color: #666;
            font-size: 0.85em;
        }

        g.node,
        [data-node],
        .ev-card {
            cursor: grab;
            touch-action: none;
        }

        svg.is-dragging,
        svg.is-dragging * {
            cursor: grabbing;
        }
    </style>
    </head>

    <body>
    <div class="top-wrapper">
        <h2>${safeTitle}</h2>

        <div class="navigation">
            <label for="domainSelect">
                Nexus Analytics: Data Domains
            </label>

            <select id="domainSelect">
                ${options}
            </select>

            <button id="previousDomain" type="button">
                Previous
            </button>

            <button id="nextDomain" type="button">
                Next
            </button>
        </div>

        <p class="meta">
            ${items.length - 1} domain ERD(s) + combined.
            Exported ${new Date().toLocaleString()}
        </p>

        <div class="layout-bar">
            <button id="saveLayout" type="button">Save layout</button>
            <span id="layoutStatus">Drag the boxes to rearrange. Save layout stores the new positions in the HTML file.</span>
        </div>
    </div>

    <main class="content">
        ${diagrams}
    </main>

    <script>
    (function () {
        const select = document.getElementById("domainSelect");
        const pages = Array.from(
            document.querySelectorAll(".domain-page")
        );

        ${erdHoverScript()}
        ${layoutScript()}

        function showDomain(domain) {
            let selectedPage = null;

            pages.forEach(page => {
                const visible =
                    page.dataset.domain === domain;

                page.hidden = !visible;

                if (visible) {
                    selectedPage = page;
                }
            });

            if (!selectedPage && pages.length) {
                selectedPage = pages[0];
                selectedPage.hidden = false;
                domain = selectedPage.dataset.domain;
            }

            select.value = domain;

            if (selectedPage) {
                const svg =
                    selectedPage.querySelector("svg");

                wireErdHover(svg);
                wireDiagramDrag(svg);
            }

            if (window.location.hash !== "#" + encodeURIComponent(domain)) {
                history.replaceState(
                    null,
                    "",
                    "#" + encodeURIComponent(domain)
                );
            }
        }

        select.addEventListener("change", function () {
            showDomain(select.value);
        });

        document.getElementById("previousDomain")
            .addEventListener("click", function () {
                const index = Math.max(
                    0,
                    select.selectedIndex - 1
                );

                select.selectedIndex = index;
                showDomain(select.value);
            });

        document.getElementById("nextDomain")
            .addEventListener("click", function () {
                const index = Math.min(
                    select.options.length - 1,
                    select.selectedIndex + 1
                );

                select.selectedIndex = index;
                showDomain(select.value);
            });

        let openingDomain = '';

        if (window.location.hash.length > 1) {
            try {
                openingDomain = decodeURIComponent(
                    window.location.hash.substring(1)
                );
            } catch (error) {
                openingDomain = '';
            }
        }

        const domainExists = pages.some(
            page => page.dataset.domain === openingDomain
        );

        showDomain(
            domainExists
                ? openingDomain
                : '${safeInitialDomain}'
        );
    })();
    <\/script>
    </body>
    </html>`;

        save(
            new Blob(
                [html],
                { type: "text/html;charset=utf-8" }
            ),
            cleanName(fileName) + ".html"
        );
    }

    function downloadJpg(svg, fileName) {
        const { markup, width, height } = serialize(svg);

        // 2x for sharpness, reduced for very large diagrams (browser canvas limits)
        const maxSide = 16000;
        const maxArea = 100000000;
        const scale = Math.min(
            2,
            maxSide / width,
            maxSide / height,
            Math.sqrt(maxArea / (width * height))
        );

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = Math.floor(width * scale);
            canvas.height = Math.floor(height * scale);

            const context = canvas.getContext("2d");
            context.fillStyle = "#ffffff";   // JPG has no transparency
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            try {
                canvas.toBlob(
                    blob => save(blob, `${fileName}.jpg`),
                    "image/jpeg",
                    0.95
                );
            } catch (error) {
                console.error(error);
                alert("JPG export was blocked by the browser. Use HTML export instead.");
            }
        };
        image.onerror = () => alert("Could not convert the diagram to JPG.");
        image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
    }

    function download(format, containerId, fileName, title) {
        const svg = getSvg(containerId);
        if (!svg) return;
        const name = cleanName(fileName);
        if (format === "jpg") downloadJpg(svg, name);
        else downloadHtml(svg, name, title || fileName);
    }

    return {
        download,
        downloadAllHtml,
        serializeSvg: serialize
    };
})();
