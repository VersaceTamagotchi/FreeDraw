(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const editable = new Set(["text", "note", "rect", "ellipse", "diamond"]);
  const paths = new Set(["pen", "line", "arrow"]);
  const containers = new Set(["rect", "ellipse", "diamond", "note"]);
  const bindingKeys = ["startBinding", "endBinding"];
  const aliases = { selection: "select", pointer: "select", rectangle: "rect", circle: "ellipse", pencil: "pen", sticky: "note", pan: "hand", draw: "pen", freehand: "pen" };
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const id = () => window.crypto?.randomUUID?.() || ("fd-" + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const sameIds = (a, b) => a.length === b.length && a.every(item => b.includes(item));

  function svgNode(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    return node;
  }

  function boxFrom(a, b) {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }

  function union(boxes) {
    if (!boxes.length) return null;
    const x = Math.min(...boxes.map(box => box.x));
    const y = Math.min(...boxes.map(box => box.y));
    return { x, y, w: Math.max(...boxes.map(box => box.x + box.w)) - x, h: Math.max(...boxes.map(box => box.y + box.h)) - y };
  }

  function worldPoints(el) {
    const points = el.points?.length ? el.points : [[0, 0], [el.w, el.h]];
    return points.map(([x, y]) => ({ x: x + el.x, y: y + el.y }));
  }

  function setPath(el, pts) {
    let left = pts[0].x, right = left, top = pts[0].y, bottom = top;
    for (const p of pts) {
      left = Math.min(left, p.x);
      right = Math.max(right, p.x);
      top = Math.min(top, p.y);
      bottom = Math.max(bottom, p.y);
    }
    return { ...el, x: left, y: top, w: right - left, h: bottom - top, points: pts.map(p => [p.x - left, p.y - top]) };
  }

  function nearestOnSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  function perimeterPoint(shape, p) {
    const { x, y, w, h } = shape, cx = x + w / 2, cy = y + h / 2;
    if (shape.type === "ellipse") {
      const theta = Math.atan2((p.y - cy) / h, (p.x - cx) / w);
      return { x: cx + Math.cos(theta) * w / 2, y: cy + Math.sin(theta) * h / 2 };
    }
    const corners = shape.type === "diamond"
      ? [[cx, y], [x + w, cy], [cx, y + h], [x, cy]]
      : [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    let nearest, minimum = Infinity;
    for (let i = 0; i < corners.length; i++) {
      const [ax, ay] = corners[i], [bx, by] = corners[(i + 1) % corners.length];
      const q = nearestOnSegment(p, { x: ax, y: ay }, { x: bx, y: by });
      const error = distance(q, p);
      if (error < minimum) { minimum = error; nearest = q; }
    }
    return nearest;
  }

  function anchorPoint(binding, shape) {
    const x = shape.x + shape.w * binding.u, y = shape.y + shape.h * binding.v;
    const dx = (binding.u - 0.5) * 2, dy = (binding.v - 0.5) * 2, norm = Math.hypot(dx, dy) || 1;
    const gap = binding.gap || 0;
    return { x: x + gap * dx / norm, y: y + gap * dy / norm };
  }

  function withoutBinding(el, key) {
    if (!el[key]) return el;
    const next = { ...el };
    delete next[key];
    return next;
  }

  // Keep bindings within a moved/copied selection, detach its arrows from stationary shapes.
  function selectionBindings(el, ids, remap) {
    if (el.type !== "arrow") return el;
    for (const key of bindingKeys) {
      const binding = el[key];
      if (!binding) continue;
      if (!ids.has(binding.id)) el = withoutBinding(el, key);
      else if (remap) el = { ...el, [key]: { ...binding, id: remap.get(binding.id) } };
    }
    return el;
  }

  function shortestAngleEnd(a, b) {
    const length = distance(a, b);
    const angle = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) * Math.PI / 4;
    return { x: a.x + Math.cos(angle) * length, y: a.y + Math.sin(angle) * length };
  }

  function createEditor({ svg, group, overlay, onChange, onSelection, onView, onEditText, onTool }) {
    const { drawElement, bounds } = window.FreeDrawScene;
    const defaults = { stroke: "#292d2b", fill: "none", width: 2.2, fontSize: 23 };
    let scene = [], selected = [], tool = "select";
    let view = { x: 0, y: 0, zoom: 1 };
    let gesture = null, space = false, pendingText = null;
    let clipboard = [], pastes = 0;
    const pointers = new Map(), rendered = new Map(), undoStack = [], redoStack = [];
    const listeners = new AbortController();
    const listen = (target, name, callback, options = {}) => target.addEventListener(name, callback, { ...options, signal: listeners.signal });
    const selectedItems = () => scene.filter(el => selected.includes(el.id));
    const selectionBox = () => union(selectedItems().map(bounds));
    const toLocal = (x, y) => {
      const rect = svg.getBoundingClientRect();
      return { x: x - rect.left, y: y - rect.top };
    };
    const toWorld = point => ({ x: (point.x - view.x) / view.zoom, y: (point.y - view.y) / view.zoom });
    const localPoint = event => toLocal(event.clientX, event.clientY);
    const worldPoint = event => toWorld(localPoint(event));

    function snapEndpoint(el, key, p, objects) {
      let nearest = null, position = p, best = 14 / view.zoom;
      for (let i = objects.length - 1; i >= 0; i--) {
        const shape = objects[i];
        if (!containers.has(shape.type) || shape.w <= 0 || shape.h <= 0) continue;
        if (p.x < shape.x - best || p.x > shape.x + shape.w + best || p.y < shape.y - best || p.y > shape.y + shape.h + best) continue;
        const q = perimeterPoint(shape, p), error = distance(q, p);
        if (error < best) {
          best = error;
          position = q;
          nearest = { id: shape.id, u: clamp((q.x - shape.x) / shape.w, 0, 1), v: clamp((q.y - shape.y) / shape.h, 0, 1) };
        }
      }
      const pts = worldPoints(el);
      pts[key === "startBinding" ? 0 : pts.length - 1] = position;
      return setPath(nearest ? { ...el, [key]: nearest } : withoutBinding(el, key), pts);
    }

    function followBindings(objects, moved) {
      const byId = new Map(objects.map(el => [el.id, el]));
      return objects.map(el => {
        if (el.type !== "arrow") return el;
        const endpoints = bindingKeys.map(key => {
          const binding = el[key];
          return binding && moved.has(binding.id) && byId.has(binding.id) ? anchorPoint(binding, byId.get(binding.id)) : null;
        });
        if (!endpoints.some(Boolean)) return el;
        const pts = worldPoints(el);
        if (pts.length < 2) return el;
        const [a, b] = endpoints;
        const start = pts[0], end = pts.at(-1);
        const ds = a ? { x: a.x - start.x, y: a.y - start.y } : { x: 0, y: 0 };
        const de = b ? { x: b.x - end.x, y: b.y - end.y } : { x: 0, y: 0 };
        if (Math.abs(ds.x) + Math.abs(ds.y) + Math.abs(de.x) + Math.abs(de.y) < 1e-6) return el;
        return setPath(el, pts.map((p, i) => {
          const t = i / (pts.length - 1);
          return { x: p.x + ds.x * (1 - t) + de.x * t, y: p.y + ds.y * (1 - t) + de.y * t };
        }));
      });
    }

    function transformSelected(original, transform) {
      const moved = new Set(selected);
      const objects = original.map(el => moved.has(el.id) ? transform(selectionBindings(el, moved)) : el);
      return followBindings(objects, moved);
    }

    function deleteObjects(ids) {
      const removed = new Set(ids);
      scene = scene.filter(el => !removed.has(el.id)).map(el => {
        if (el.type === "arrow") {
          for (const key of bindingKeys) if (removed.has(el[key]?.id)) el = withoutBinding(el, key);
        }
        return el;
      });
      select(selected.filter(key => !removed.has(key)));
    }

    function select(ids) {
      if (sameIds(selected, ids)) return;
      selected = [...ids];
      drawOverlay();
      onSelection?.([...selected]);
    }

    function cursor() {
      svg.style.cursor = gesture?.kind === "pan" ? "grabbing" : space || tool === "hand" ? "grab" :
        tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";
    }

    function setTool(value) {
      const next = aliases[value] || value;
      if (next !== tool) {
        cancelGesture();
        tool = next;
        if (tool !== "select") select([]);
        onTool?.(tool);
      }
      cursor();
    }

    function drawOverlay() {
      overlay.replaceChildren();
      const z = view.zoom, accent = "#5d6cc6";
      const box = selectionBox();
      function outline(b, fill = "none", dashed = false) {
        overlay.append(svgNode("rect", { x: b.x, y: b.y, width: b.w, height: b.h, fill,
          stroke: accent, "stroke-width": 1.25 / z, "stroke-dasharray": dashed ? (4 / z + " " + 3 / z) : "none",
          "pointer-events": "none" }));
      }
      function handle(p, name, shape) {
        const radius = 4.3 / z;
        const hit = svgNode("rect", { x: p.x - 8 / z, y: p.y - 8 / z, width: 16 / z, height: 16 / z,
          fill: "transparent", "pointer-events": "all", "data-handle": name, cursor: shape });
        overlay.append(svgNode("rect", { x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2,
          rx: 1.4 / z, fill: "white", stroke: accent, "stroke-width": 1.3 / z, "pointer-events": "none" }), hit);
      }
      if (box && tool === "select") {
        const pad = 4 / z;
        const halo = { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
        outline(halo);
        const single = selected.length === 1 && selectedItems()[0];
        if (single && (single.type === "arrow" || single.type === "line")) {
          const pts = worldPoints(single);
          handle(pts[0], "first", "crosshair");
          handle(pts.at(-1), "last", "crosshair");
        } else {
          handle({ x: halo.x, y: halo.y }, "nw", "nwse-resize");
          handle({ x: halo.x + halo.w, y: halo.y }, "ne", "nesw-resize");
          handle({ x: halo.x, y: halo.y + halo.h }, "sw", "nesw-resize");
          handle({ x: halo.x + halo.w, y: halo.y + halo.h }, "se", "nwse-resize");
        }
      }
      if (gesture?.kind === "marquee" && gesture.box) outline(gesture.box, "rgba(94,110,196,0.09)", true);
      const activeArrow = gesture?.kind === "draw" && gesture.el.type === "arrow" ? scene.at(-1) :
        gesture?.kind === "endpoint" ? selectedItems()[0] : null;
      if (activeArrow?.type === "arrow") {
        const pts = worldPoints(activeArrow);
        for (const key of bindingKeys) {
          if (!activeArrow[key]) continue;
          const p = key === "startBinding" ? pts[0] : pts.at(-1);
          overlay.append(svgNode("circle", { cx: p.x, cy: p.y, r: 5 / z, fill: "white", stroke: accent,
            "stroke-width": 1.8 / z, "pointer-events": "none" }));
        }
      }
    }

    function render() {
      const ids = new Set(scene.map(el => el.id));
      for (const [key, entry] of rendered) {
        if (!ids.has(key)) { entry.node.remove(); rendered.delete(key); }
      }
      let next = group.firstChild;
      for (const el of scene) {
        let previous = rendered.get(el.id);
        if (!previous || previous.el !== el) {
          const node = drawElement(el);
          if (previous) {
            if (previous.node === next) next = node;
            previous.node.replaceWith(node);
          }
          previous = { el, node };
          rendered.set(el.id, previous);
        }
        if (previous.node !== next) group.insertBefore(previous.node, next);
        next = previous.node.nextSibling;
      }
      drawOverlay();
    }

    function setView(next) {
      if (![next?.x, next?.y, next?.zoom].every(Number.isFinite)) return;
      view = { x: next.x, y: next.y, zoom: clamp(next.zoom, 0.05, 8) };
      const transform = "translate(" + view.x + " " + view.y + ") scale(" + view.zoom + ")";
      group.setAttribute("transform", transform);
      overlay.setAttribute("transform", transform);
      drawOverlay();
      onView?.({ ...view });
    }

    function zoomAt(value, anchor) {
      if (!Number.isFinite(value)) return;
      const zoom = clamp(value, 0.05, 8), world = toWorld(anchor);
      setView({ x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom, zoom });
    }

    function visibleArea() {
      const canvas = svg.getBoundingClientRect();
      const area = { left: 0, top: 0, right: canvas.width, bottom: canvas.height };
      const controls = svg.parentElement.querySelectorAll(".tool-rail, .zoom-controls, .grid-button, .style-button, .hint-bar, .help-button");
      for (const control of controls) {
        const rect = control.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (control.matches(".grid-button, .style-button")) {
          area.top = Math.max(area.top, rect.bottom - canvas.top);
        } else if (control.matches(".tool-rail") && getComputedStyle(control).flexDirection === "column") {
          area.left = Math.max(area.left, rect.right - canvas.left);
        } else {
          area.bottom = Math.min(area.bottom, rect.top - canvas.top);
        }
      }
      return area;
    }

    function fit() {
      const box = union(scene.map(bounds));
      if (!box) { setView({ x: 0, y: 0, zoom: 1 }); return; }
      const area = visibleArea();
      const width = area.right - area.left, height = area.bottom - area.top;
      if (width <= 0 || height <= 0) return;
      const padding = Math.min(28, width * .05, height * .05);
      const zoom = clamp(Math.min((width - padding * 2) / Math.max(1, box.w), (height - padding * 2) / Math.max(1, box.h)), 0.05, 1.1);
      setView({
        x: area.left + (width - box.w * zoom) / 2 - box.x * zoom,
        y: area.top + (height - box.h * zoom) / 2 - box.y * zoom,
        zoom
      });
    }

    function commit(before) {
      if (before === scene) return;
      undoStack.push(before);
      if (undoStack.length > 80) undoStack.shift();
      redoStack.length = 0;
      onChange?.();
    }

    function restore(from, to) {
      cancelGesture();
      if (!from.length) return;
      to.push(scene);
      scene = from.pop();
      select(selected.filter(key => scene.some(el => el.id === key)));
      render();
      onChange?.();
    }

    function load(elements) {
      cancelGesture();
      pendingText = null;
      const seen = new Set();
      scene = clone(Array.isArray(elements) ? elements : []).map(el => {
        if (!el.id || seen.has(el.id)) el.id = id();
        seen.add(el.id);
        return el;
      });
      select([]);
      undoStack.length = redoStack.length = 0;
      render();
      onChange?.();
    }

    function hit(p, target) {
      const domId = target?.closest?.("[data-element-id],[data-id]")?.dataset;
      const direct = domId?.elementId || domId?.id;
      const tolerance = 5 / view.zoom;
      for (let i = scene.length - 1; i >= 0; i--) {
        const el = scene[i];
        if (el.id === direct) return el;
        const b = bounds(el);
        if (p.x < b.x - tolerance || p.x > b.x + b.w + tolerance || p.y < b.y - tolerance || p.y > b.y + b.h + tolerance) continue;
        if (paths.has(el.type)) {
          const pts = worldPoints(el), t = tolerance + (el.width || 2) / 2;
          if (pts.length === 1 && distance(p, pts[0]) <= t) return el;
          if (pts.some((q, idx) => idx > 0 && distance(p, nearestOnSegment(p, pts[idx - 1], q)) <= t)) return el;
          continue;
        }
        if (el.type === "ellipse" || el.type === "diamond") {
          const a = Math.abs(p.x - b.x - b.w / 2) / (b.w / 2 + tolerance);
          const c = Math.abs(p.y - b.y - b.h / 2) / (b.h / 2 + tolerance);
          if (el.type === "ellipse" ? a * a + c * c > 1 : a + c > 1) continue;
        }
        return el;
      }
      return null;
    }

    function setStyle(partial) {
      if (!partial || typeof partial !== "object") return;
      const allowed = ["stroke", "fill", "width", "fontSize", "dash", "opacity", "fontFamily", "align", "roughness", "strokeStyle"];
      const style = Object.fromEntries(Object.entries(partial).filter(([key]) => allowed.includes(key)));
      Object.assign(defaults, style);
      if (!selected.length || !selectedItems().some(el => Object.entries(style).some(([key, value]) => el[key] !== value))) return;
      const before = scene;
      scene = scene.map(el => selected.includes(el.id) ? { ...el, ...style } : el);
      render();
      commit(before);
    }

    function removeSelected() {
      if (!selected.length) return;
      const before = scene;
      deleteObjects(selected);
      render();
      commit(before);
    }

    function addCopies(items, offset) {
      if (!items.length) return;
      const before = scene;
      const remap = new Map(items.map(el => [el.id, id()]));
      const copies = items.map(el => ({ ...selectionBindings(el, remap, remap), id: remap.get(el.id), x: el.x + offset, y: el.y + offset }));
      scene = [...scene, ...copies];
      setTool("select");
      select(copies.map(el => el.id));
      render();
      commit(before);
    }

    function moveLayer(forward) {
      const before = scene, arranged = [...scene], step = forward ? -1 : 1;
      for (let i = forward ? arranged.length - 2 : 1; i >= 0 && i < arranged.length; i += step) {
        const j = i - step;
        if (selected.includes(arranged[i].id) && !selected.includes(arranged[j].id)) {
          [arranged[i], arranged[j]] = [arranged[j], arranged[i]];
        }
      }
      if (arranged.every((el, index) => el === before[index])) return;
      scene = arranged;
      render();
      commit(before);
    }

    function updateText(key, value) {
      const el = scene.find(item => item.id === key);
      if (!el || !editable.has(el.type) || typeof value !== "string") return;
      const fresh = pendingText?.id === key;
      const before = fresh ? pendingText.before : scene;
      if (fresh) pendingText = null;
      if (el.type === "text" && !value.trim()) {
        scene = fresh ? before : scene.filter(item => item.id !== key);
        select(selected.filter(item => item !== key));
      } else {
        if (el.type === "text" && el.text === value) return;
        let next = { ...el, text: value };
        if (el.type === "text") {
          Object.assign(next, window.FreeDrawScene.textSize(next));
        } else {
          next.h = window.FreeDrawScene.heightForShapeText(next);
          if (!fresh && el.text === value && el.h === next.h) return;
        }
        scene = scene.map(item => item.id === key ? next : item);
        if (el.h !== next.h) scene = followBindings(scene, new Set([key]));
      }
      render();
      commit(before);
    }

    function cancelText(key) {
      if (pendingText?.id !== key) return;
      scene = pendingText.before;
      pendingText = null;
      select(selected.filter(item => item !== key));
      render();
    }

    function cancelGesture() {
      if (!gesture) return;
      const active = gesture;
      gesture = null;
      if (active.before) {
        scene = active.before;
        select(active.oldSelection || []);
      }
      render();
      cursor();
    }

    function capture(event) {
      try { svg.setPointerCapture(event.pointerId); } catch { /* Pointer may already be gone. */ }
    }

    function newTextAt(p) {
      return { id: id(), type: "text", ...defaults, x: p.x, y: p.y, w: 140, h: defaults.fontSize * 1.4, text: "" };
    }

    function editNewElement(el, before) {
      if ((el.type === "text" || el.type === "note") && onEditText) {
        pendingText = { id: el.id, before };
        onEditText(clone(el));
      } else {
        commit(before);
      }
    }

    function begin(event) {
      if (event.button !== 0 && event.button !== 1) return;
      // Commit the floating text area's blur before capturing a new canvas action.
      svg.focus?.({ preventScroll: true });
      const local = localPoint(event), p = toWorld(local);
      pointers.set(event.pointerId, local);
      capture(event);
      event.preventDefault();
      if (pointers.size > 1) {
        if (gesture?.kind === "pinch") return;
        cancelGesture();
        const [a, b] = pointers.values();
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        gesture = { kind: "pinch", startZoom: view.zoom, initialDistance: Math.max(1, distance(a, b)), anchor: toWorld(center) };
        return;
      }
      if (space || tool === "hand" || event.button === 1) {
        gesture = { kind: "pan", pointer: event.pointerId, local, view };
        cursor();
        return;
      }

      const oldSelection = [...selected];
      const session = { pointer: event.pointerId, before: scene, start: p, oldSelection };
      if (tool === "eraser") {
        gesture = { ...session, kind: "erase" };
        eraseAt(p, event.target);
        return;
      }
      if (tool === "select") {
        const handle = event.target.closest?.("[data-handle]")?.dataset.handle;
        if (handle && selected.length) {
          gesture = { ...session, kind: handle === "first" || handle === "last" ? "endpoint" : "resize", handle, box: selectionBox() };
          return;
        }
        const target = hit(p, event.target);
        if (!target) {
          if (!event.shiftKey) select([]);
          gesture = { ...session, kind: "marquee", additive: event.shiftKey };
          return;
        }
        if (event.shiftKey && selected.includes(target.id)) {
          select(selected.filter(key => key !== target.id));
          return;
        }
        if (!selected.includes(target.id)) select(event.shiftKey ? [...selected, target.id] : [target.id]);
        gesture = { ...session, kind: "move" };
        return;
      }
      const el = tool === "text" ? newTextAt(p) : { id: id(), type: tool, x: p.x, y: p.y, w: 0, h: 0, ...defaults };
      if (tool === "note" && (!el.fill || el.fill === "none" || el.fill === "transparent")) el.fill = "#ffebad";
      if (paths.has(tool)) { el.points = [[0, 0], [0, 0]]; el.fill = "none"; }
      gesture = { ...session, kind: "draw", el, pts: [p] };
      scene = [...scene, el];
      render();
    }

    function eraseAt(p, target) {
      const el = hit(p, target);
      if (!el) return;
      deleteObjects([el.id]);
      render();
    }

    function resize(p, uniform) {
      const g = gesture, box = g.box;
      if (!box) return;
      const east = g.handle.endsWith("e"), south = g.handle.startsWith("s");
      const dx = (east ? 1 : -1) * (p.x - g.start.x), dy = (south ? 1 : -1) * (p.y - g.start.y);
      let sx = Math.max(5, box.w + dx) / (box.w || 1), sy = Math.max(5, box.h + dy) / (box.h || 1);
      if (uniform) sx = sy = Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy;
      const ax = east ? box.x : box.x + box.w, ay = south ? box.y : box.y + box.h;
      const scale = point => ({ x: ax + (point.x - ax) * sx, y: ay + (point.y - ay) * sy });
      scene = transformSelected(g.before, el => {
        if (paths.has(el.type)) return setPath(el, worldPoints(el).map(scale));
        const next = { ...el, ...scale(el), w: el.w * sx, h: el.h * sy };
        if (el.type === "text") next.fontSize = Math.max(5, (el.fontSize || defaults.fontSize) * Math.min(sx, sy));
        return next;
      });
    }

    function move(event) {
      const local = localPoint(event);
      if (pointers.has(event.pointerId)) pointers.set(event.pointerId, local);
      if (!gesture) return;
      const g = gesture, p = toWorld(local);
      if (g.kind === "pinch") {
        if (pointers.size < 2) return;
        const [a, b] = pointers.values();
        const zoom = clamp(g.startZoom * distance(a, b) / g.initialDistance, 0.05, 8);
        setView({ x: (a.x + b.x) / 2 - g.anchor.x * zoom, y: (a.y + b.y) / 2 - g.anchor.y * zoom, zoom });
        return;
      }
      if (event.pointerId !== g.pointer) return;
      if (g.kind === "pan") {
        setView({ ...g.view, x: g.view.x + local.x - g.local.x, y: g.view.y + local.y - g.local.y });
        return;
      }
      const changed = distance(p, g.start) * view.zoom > 2.5;
      if (!changed && !g.moved && g.kind !== "erase") return;
      g.moved ||= changed;
      switch (g.kind) {
        case "move": {
          let dx = p.x - g.start.x, dy = p.y - g.start.y;
          if (event.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
          scene = transformSelected(g.before, el => ({ ...el, x: el.x + dx, y: el.y + dy }));
          break;
        }
        case "marquee": {
          g.box = boxFrom(g.start, p);
          const b = g.box;
          const inside = scene.filter(el => {
            const r = bounds(el);
            return r.x >= b.x && r.y >= b.y && r.x + r.w <= b.x + b.w && r.y + r.h <= b.y + b.h;
          });
          select([...new Set([...(g.additive ? g.oldSelection : []), ...inside.map(el => el.id)])]);
          drawOverlay();
          return;
        }
        case "erase": eraseAt(p, event.target); return;
        case "resize": resize(p, event.shiftKey); break;
        case "endpoint": {
          scene = g.before.map(el => {
            if (el.id !== selected[0]) return el;
            const pts = worldPoints(el), first = g.handle === "first";
            const opposite = pts[first ? Math.min(1, pts.length - 1) : Math.max(0, pts.length - 2)];
            const point = event.shiftKey ? shortestAngleEnd(opposite, p) : p;
            if (el.type === "arrow") return snapEndpoint(el, first ? "startBinding" : "endBinding", point, g.before);
            pts[first ? 0 : pts.length - 1] = point;
            return setPath(el, pts);
          });
          break;
        }
        case "draw": {
          const el = g.el;
          let drawn = el;
          if (el.type === "pen") {
            const samples = event.getCoalescedEvents?.() || [];
            for (const e of (samples.length ? samples : [event])) {
              const sample = worldPoint(e);
              if (distance(sample, g.pts.at(-1)) * view.zoom >= 1) g.pts.push(sample);
            }
            drawn = setPath(el, g.pts);
          } else if (paths.has(el.type)) {
            const endPoint = event.shiftKey ? shortestAngleEnd(g.start, p) : p;
            drawn = setPath(el, [g.start, endPoint]);
            if (el.type === "arrow") {
              drawn = snapEndpoint(drawn, "startBinding", g.start, g.before);
              drawn = snapEndpoint(drawn, "endBinding", endPoint, g.before);
            }
          } else if (el.type !== "text") {
            let end = p;
            if (event.shiftKey) {
              const size = Math.max(Math.abs(p.x - g.start.x), Math.abs(p.y - g.start.y));
              end = { x: g.start.x + (p.x < g.start.x ? -size : size), y: g.start.y + (p.y < g.start.y ? -size : size) };
            }
            drawn = { ...el, ...boxFrom(g.start, end) };
          }
          scene = [...g.before, drawn];
          break;
        }
      }
      render();
    }

    function end(event, canceled = false) {
      pointers.delete(event.pointerId);
      const g = gesture;
      if (!g) return;
      if (g.kind === "pinch") {
        if (pointers.size < 2) gesture = null;
        return;
      }
      if (g.pointer !== event.pointerId) return;
      if (canceled) { cancelGesture(); return; }
      if (g.kind === "draw" || g.kind === "move" || g.kind === "resize" || g.kind === "endpoint") move(event);
      gesture = null;
      if (g.kind === "draw") {
        let el = scene.at(-1);
        if (!g.moved && !paths.has(el.type) && el.type !== "text") {
          el = { ...el, w: el.type === "note" ? 158 : 132, h: el.type === "note" ? 138 : 88 };
        }
        if (!g.moved && paths.has(el.type)) {
          const delta = el.type === "pen" ? 0.15 : 94;
          el = setPath(el, [g.start, { x: g.start.x + delta, y: g.start.y + (el.type === "pen" ? 0.15 : 0) }]);
          if (el.type === "arrow") {
            el = snapEndpoint(el, "startBinding", g.start, g.before);
            el = snapEndpoint(el, "endBinding", { x: g.start.x + delta, y: g.start.y }, g.before);
          }
        }
        scene = [...g.before, el];
        if (el.type !== "pen") { setTool("select"); select([el.id]); }
        render();
        editNewElement(el, g.before);
      } else {
        render();
        if (g.before) commit(g.before);
      }
      cursor();
    }

    function keydown(event) {
      const target = event.target;
      if (event.defaultPrevented || event.isComposing || target?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog']") || document.querySelector("dialog[open]")) return;
      const key = event.key.toLowerCase(), command = event.ctrlKey || event.metaKey;
      if (command && !event.altKey) {
        if (key === "z") restore(event.shiftKey ? redoStack : undoStack, event.shiftKey ? undoStack : redoStack);
        else if (key === "y") restore(redoStack, undoStack);
        else if (key === "a") { setTool("select"); select(scene.map(el => el.id)); }
        else if (key === "d") addCopies(selectedItems(), 16 / view.zoom);
        else if ((key === "c" || key === "x") && selected.length) {
          clipboard = selectedItems();
          pastes = 0;
          if (key === "x") removeSelected();
        } else if (key === "v" && clipboard.length) {
          pastes++;
          addCopies(clipboard, 16 * pastes / view.zoom);
        } else return;
      } else if (key === " " && !target?.closest?.("button,a")) { space = true; cursor(); }
      else if (key === "escape") { if (gesture) cancelGesture(); else { setTool("select"); select([]); } }
      else if (key === "delete" || key === "backspace") removeSelected();
      else if (key === "enter" && selected.length === 1 && editable.has(selectedItems()[0]?.type)) onEditText?.(clone(selectedItems()[0]));
      else if (key.startsWith("arrow") && selected.length) {
        const step = event.shiftKey ? 10 : 1;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        const before = scene;
        scene = transformSelected(scene, el => ({ ...el, x: el.x + dx, y: el.y + dy }));
        render();
        commit(before);
      } else return;
      event.preventDefault();
    }

    svg.style.touchAction = "none";
    overlay.style.pointerEvents = "none";
    listen(svg, "pointerdown", begin);
    listen(svg, "pointermove", move);
    listen(svg, "pointerup", event => end(event));
    listen(svg, "pointercancel", event => end(event, true));
    listen(svg, "lostpointercapture", event => { if (pointers.has(event.pointerId)) end(event, true); });
    listen(svg, "dblclick", event => {
      if (tool !== "select") return;
      const p = worldPoint(event), el = hit(p, event.target);
      if (el) {
        if (editable.has(el.type)) { select([el.id]); onEditText?.(clone(el)); }
        return;
      }
      if (event.target.closest?.("[data-handle]")) return;
      const before = scene, text = newTextAt(p);
      scene = [...scene, text];
      select([text.id]);
      render();
      editNewElement(text, before);
    });
    listen(svg, "wheel", event => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? svg.clientHeight : 1;
      if (event.ctrlKey || event.metaKey) zoomAt(view.zoom * Math.exp(-event.deltaY * unit * 0.008), localPoint(event));
      else {
        const x = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
        const y = event.shiftKey && !event.deltaX ? 0 : event.deltaY;
        setView({ ...view, x: view.x - x * unit, y: view.y - y * unit });
      }
    }, { passive: false });
    listen(window, "keydown", keydown);
    listen(window, "keyup", event => { if (event.code === "Space") { space = false; cursor(); } });
    listen(window, "blur", () => { space = false; pointers.clear(); cancelGesture(); cursor(); });
    cursor();

    return {
      load, setTool, setStyle, removeSelected, fit, setView, updateText, cancelText,
      getTool: () => tool, getSelection: () => [...selected], getElements: () => clone(scene),
      getView: () => ({ ...view }), getStyle: () => ({ ...defaults }),
      undo: () => restore(undoStack, redoStack), redo: () => restore(redoStack, undoStack),
      canUndo: () => !!undoStack.length, canRedo: () => !!redoStack.length,
      duplicate: () => addCopies(selectedItems(), 16 / view.zoom),
      selectAll: () => { setTool("select"); select(scene.map(el => el.id)); },
      bringForward: () => moveLayer(true), sendBackward: () => moveLayer(false),
      setZoom: value => { const r = svg.getBoundingClientRect(); zoomAt(value, { x: r.width / 2, y: r.height / 2 }); },
      getScreenPoint: p => { const r = svg.getBoundingClientRect(); return { x: r.left + view.x + p.x * view.zoom, y: r.top + view.y + p.y * view.zoom }; },
      destroy: () => { listeners.abort(); }
    };
  }

  window.createEditor = createEditor;
})();
