/* SVG primitives and editable starter boards. Coordinates and pen points are in canvas units. */
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const INK = "#292d2b";
  const SANS = "Inter, 'Segoe UI', Arial, sans-serif";
  const MONO = "'Courier New', monospace";
  const HAND = "'Segoe Print', 'Chalkboard SE', 'Comic Sans MS', cursive";
  let nextId = 0;

  function svg(tag, attributes = {}, value) {
    const element = document.createElementNS(NS, tag);
    for (const [key, attribute] of Object.entries(attributes)) {
      if (attribute != null) element.setAttribute(key, String(attribute));
    }
    if (value != null) element.textContent = value;
    return element;
  }

  const num = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

  function paint(value, fallback) {
    if (typeof value !== "string") return fallback;
    if (/^#[\da-f]{3,8}$/i.test(value) || /^[a-z]{1,25}$/i.test(value) ||
        /^(?:rgb|hsl)a?\([\d.% ,/+-]+\)$/i.test(value)) return value;
    return fallback;
  }

  function path(group, data, attributes = {}) {
    group.append(svg("path", {d: data, ...attributes}));
  }

  function make(type, x, y, w, h, options) {
    return {id: globalThis.crypto?.randomUUID?.() || `fd-${Date.now().toString(36)}-${++nextId}`,
      type, x, y, w, h, stroke: INK, fill: "none", width: 2, ...options};
  }

  // Original single-stroke lettering keeps the sketch titles consistent in exported images.
  // The letters use an 18-unit em, a 15-unit baseline and a 10-unit x-height.
  const letters = {
    a: [9, "M7.5 6.1Q5.4 3.9 2.9 6.1C.1 8.7 .4 14 3.2 14.7Q5.8 15.3 7.7 7.6M7.7 5.7Q7.2 10.9 8.1 14.8"],
    b: [9, "M1.5 .5Q1 6 1.4 14.8M1.5 11.3C2.5 5.4 6.5 3.6 8.2 6.7C10.1 10.7 5.7 16.7 1.7 14"],
    c: [8, "M7.5 6.5C5 3.7 1.8 6 .9 9.5C-.5 15.1 4.1 16.4 7.3 13.2"],
    d: [9.5, "M7.6 6.5C5.8 4.3 2.8 5.2 1.4 8.5C-.1 12.1 1.2 15 3.7 14.9Q6.6 14.6 8 7.6M8.6 .4Q7.5 6.8 8.3 14.8"],
    e: [9, "M1.1 10.4C4.5 10.5 8.7 8.6 7.1 5.9C5.7 3.9 2.5 5.7 1.2 8.8C-1 14.4 3.5 17.1 8.3 12.7"],
    f: [7.2, "M2.2 15.3Q1.8 9.2 3.3 3.7C4.2 -.2 6.3 -.2 7 1.1M.2 7.1L6.7 6.5"],
    g: [9.5, "M7.7 6C5 3.7 1.1 6.1 .8 11C.5 16.8 6.4 15.5 8 7.4M8.2 5.7Q8.7 16.7 6.7 19.4Q4.4 22.6 1.3 19.6"],
    h: [10, "M1.4 .4Q.8 9.5 1.4 15M1.4 12.5C3.3 4.9 7.4 3.8 8.5 6.6Q9.2 9.1 8.6 14.8"],
    i: [4, "M1.8 5.9Q1.2 10.8 1.9 14.7M2.2 1.5l.08 -.2"],
    j: [5, "M3.2 5.8Q3.6 14.6 2.3 18.3Q1 21.2 -1.4 19.4M3.5 1.4l.12 -.17"],
    k: [9, "M1.4 .7Q.7 8.7 1.2 15M7.7 5.8L1.6 10.9M3.9 9.5Q6.5 12.9 8.7 14.6"],
    l: [4.8, "M2.1 .4C1.6 3.5 .9 10.4 1.8 13.6Q2.1 15 3.6 14.8"],
    m: [14, "M1.2 5.8Q1.1 11.5 .9 15M1.3 11.7C2.8 5.2 6.5 3.4 7.2 7.1Q7.5 9.6 7.1 14.6M7.5 10.5C9.7 3.3 13 4.9 13.1 8Q13.2 11.8 13 14.6"],
    n: [9.8, "M1.3 5.7Q1.2 11.1 1 14.9M1.5 11.8C3.3 5.2 7.4 3.5 8.6 6.7Q9.1 9 8.5 14.6"],
    o: [9.8, "M5.8 5.2C2.2 4.8 .3 8.2 .7 11.6C1.1 16 6 16 8 12.2C9.4 9.3 8.5 5.7 5.5 5.3"],
    p: [9.2, "M1.3 5.9Q.9 15.7 .7 20.6M1.4 10.6C4 4.4 8 4.4 8.5 8C9.1 12.3 5.5 15.6 2.3 14.1"],
    q: [9, "M7.7 6.3C4.7 3.8 .5 7.3 .6 11.9C.7 16.1 5.9 15.6 7.7 8.1M8 5.8Q7.8 15.3 8.1 20.5"],
    r: [7.8, "M1.2 5.9Q1.2 10.6 .9 15M1.5 10.7C3 6.2 5.8 4.1 7.3 6.1"],
    s: [8.2, "M7.1 6.3C4.5 3.9 .8 5.8 1.8 8.2C2.6 10.2 7.2 9.5 7.2 12.2C7.2 15.6 2.7 16 .6 13.5"],
    t: [7.5, "M3.3 2.1Q2.1 7 2.4 12.6C2.6 15.6 5.1 15.6 7 13.6M.3 7L6.8 6.4"],
    u: [9.7, "M1.6 5.8Q.6 11 1.7 13.5C3.4 17.1 7.6 13.4 8.4 7.3M8.6 5.6Q8.1 11.1 8.7 14.8"],
    v: [9.4, "M.8 5.7Q2.4 12.1 4.5 15Q6.6 11.1 8.8 5.6"],
    w: [13.6, "M.6 5.9Q1.5 12 3.4 15Q5.4 11.9 6.8 7.5Q7.8 12 9.9 14.5Q12 10.8 13.1 5.7"],
    x: [9, "M1 5.9Q3.8 9.8 8.1 14.6M8 5.7Q5 10.6 1 14.7"],
    y: [9, "M.7 5.8Q1.9 10.7 4.8 14.4M8.5 5.7Q5.6 15.5 2.7 19.7Q1.2 21 -.4 20.1"],
    z: [8.8, "M1.1 6.4L7.9 5.8Q4.7 10.8 1 14.7L8.2 14.4"],
    A: [12, "M.3 14.8Q3.2 7.3 6.1 .5Q9.5 7.8 11.4 14.6M2.2 10.5L9.8 9.6"],
    D: [12.5, "M1.8 .9Q1.3 8.1 1.6 14.7M1.5 .9C8 -.5 12.5 2.5 11.8 7.7C11.2 12.3 7.3 15.3 1.5 14.7"],
    E: [10.5, "M9.5 1Q5.6 .7 1.5 1.2Q1.2 7.8 1.1 14.7Q5.5 14.8 9.9 14.3M1.6 7.4L8 7"],
    I: [6.7, "M.8 1.6L6.6 1.1M3.8 1.6Q3.2 8.1 3.2 14.3M.5 14.8L6 14.4"],
    L: [10.2, "M2 1Q1.1 8.5 1.2 14.7Q5.2 14.9 9.7 14.3"],
    M: [14.8, "M1 14.8Q1.8 8.3 2.7 .8Q5.4 5.6 7.3 9.7Q10.3 4.5 12.9 .6Q13.2 8 14.2 14.8"],
    P: [10.5, "M1.7 1.3Q1 8.9 1.3 15M1.6 1.4C7.1 -.7 11.1 1.2 9.7 5C8.5 8.3 4.7 8.8 1.7 8.1"],
    R: [11.5, "M1.8 1.2Q1.1 8 1.1 15M1.8 1.3C8.7 -.9 11.2 2 9.3 5.8Q6.8 8.6 2.6 8.1M4.8 8.2Q7.8 11.8 10.8 14.6"],
    S: [11, "M10.1 2.4C6.6 -.8 1 .7 1.3 4C1.6 7.8 10.2 6.4 10.1 11C10.1 15.1 4.5 16.8 .5 13.5"],
    V: [12, "M.6 .9Q2.8 9.9 5.5 15Q8.8 7.6 11.4 .8"],
    " ": [5.3, ""], ".": [4, "M1.5 14.5l.2 -.2"], ",": [4, "M2 14l-1.2 3"],
    "-": [6.8, "M.7 10l5.2 -.5"], "!": [4.4, "M2.5 1.1l-.9 9.3M1.7 14.4l.1 -.2"]
  };

  function glyph(character) {
    const normalized = character.normalize("NFD");
    const base = letters[normalized[0]];
    if (!base) return null;
    let data = base[1];
    if (normalized.includes("\u0301")) data += `M${base[0] / 2} 3l2.8 -2.8`;
    if (normalized.includes("\u0303")) data += `M2.3 2.8q1.1 -1.7 2.8 -.5q1.7 1.2 2.8 -.6`;
    if (normalized.includes("\u0308")) data += `M2.5 2.3l.1 -.1m3 .2l.1 -.1`;
    return [base[0], data];
  }

  function handLine(group, value, x, top, size, color, options = {}) {
    const characters = [...value];
    const shapes = characters.map(glyph);
    if (shapes.some(item => !item)) {
      group.append(svg("text", {x, y: top + size * .85, fill: color, stroke: "none",
        "text-anchor": options.center ? "middle" : "start", "font-size": size,
        "font-family": HAND, "font-weight": options.bold ? 700 : 500}, value));
      return;
    }
    const unit = size / 18;
    const spacing = options.bold ? 1.65 : 1.35;
    const fullWidth = shapes.reduce((sum, [width]) => sum + width + spacing, 0);
    const start = options.center ? x - (fullWidth - spacing) * unit / 2 : x;
    const run = svg("g", {transform: `translate(${start} ${top}) scale(${unit})`,
      stroke: color, fill: "none", "stroke-width": options.bold ? 1.7 : 1.16,
      "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true"});
    let cursor = 0;
    shapes.forEach(([width, data], index) => {
      if (data) path(run, data, {transform: `translate(${cursor} ${[0, -.12, .18, -.06, .11][index % 5]})`});
      cursor += width + spacing;
    });
    group.append(run);
  }

  function hitBox(group, x, y, width, height) {
    group.append(svg("rect", {x, y, width: Math.max(1, width), height: Math.max(1, height),
      fill: "transparent", stroke: "none"}));
  }

  function pointsOf(el) {
    if (Array.isArray(el.points) && el.points.length) return el.points
      .filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
    return [[0, 0], [num(el.w), num(el.h)]];
  }

  function bounds(el) {
    const x = num(el.x), y = num(el.y);
    if (["arrow", "line", "pen"].includes(el.type)) {
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const [px, py] of pointsOf(el)) {
        left = Math.min(left, px); right = Math.max(right, px);
        top = Math.min(top, py); bottom = Math.max(bottom, py);
      }
      if (left === Infinity) return {x, y, w: 0, h: 0};
      return {x: x + left, y: y + top, w: right - left, h: bottom - top};
    }
    const size = Math.max(4, num(el.fontSize, 23));
    const lines = String(el.text || "").split("\n");
    const w = num(el.w, el.type === "text" ? Math.max(10, ...lines.map(line => line.length * size * .59)) : 0);
    const h = num(el.h, el.type === "text" ? Math.max(1, lines.length) * size * 1.25 : 0);
    return {x: x + Math.min(0, w), y: y + Math.min(0, h), w: Math.abs(w), h: Math.abs(h)};
  }

  function penPath(points, smooth) {
    if (!points.length) return "";
    const f = ([x, y]) => `${x},${y}`;
    let d = `M${f(points[0])}`;
    if (points.length === 1) return `${d}l.01,.01`;
    if (!smooth || points.length < 3) return d + "L" + points.slice(1).map(f).join(" ");
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i], [nx, ny] = points[i + 1];
      d += `Q${x},${y} ${(x + nx) / 2},${(y + ny) / 2}`;
    }
    return d + "L" + f(points[points.length - 1]);
  }

  function drawLine(group, el, stroke, width) {
    const points = pointsOf(el);
    if (!points.length) return;
    const d = penPath(points, el.type === "pen" || el.variant === "curve");
    path(group, d, {fill: "none", stroke: "transparent", "stroke-width": Math.max(10, width)});
    path(group, d, {fill: "none", stroke, "stroke-width": width,
      "stroke-dasharray": el.dash === "dashed" ? `${width * 3.1} ${width * 3.6}` : undefined});
    if (el.type !== "arrow" || points.length < 2) return;
    const [endX, endY] = points[points.length - 1];
    const previous = points.slice(0, -1).reverse().find(([x, y]) => Math.hypot(endX - x, endY - y) > .1);
    if (!previous) return;
    const angle = Math.atan2(endY - previous[1], endX - previous[0]);
    const length = Math.min(15, Math.max(7, width * 4.3), Math.hypot(num(el.w), num(el.h)) * .38 || 12);
    const leftX = endX - length * Math.cos(angle - .5), leftY = endY - length * Math.sin(angle - .5);
    const rightX = endX - length * Math.cos(angle + .5), rightY = endY - length * Math.sin(angle + .5);
    path(group, `M${leftX},${leftY}L${endX},${endY} ${rightX},${rightY}`,
      {fill: "none", stroke, "stroke-width": width});
  }

  let measureContext;
  function textMeasure(size, weight, family = SANS) {
    if (measureContext === undefined) {
      try { measureContext = document.createElement("canvas").getContext("2d"); }
      catch { measureContext = null; }
    }
    if (measureContext) measureContext.font = `${weight} ${size}px ${family}`;
    return text => measureContext ? measureContext.measureText(text).width : text.length * size * .54;
  }

  function wrapLines(value, width, size, weight = 400) {
    const measure = textMeasure(size, weight);
    const lines = [];
    for (const paragraph of value.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const combined = line ? line + " " + word : word;
        if (line && measure(combined) > width) {
          lines.push(line);
          line = word;
        } else {
          line = combined;
        }
        if (line === word && measure(word) > width) {
          line = "";
          for (const character of word) {
            if (line && measure(line + character) > width) {
              lines.push(line);
              line = "";
            }
            line += character;
          }
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function visibleLines(lines, count, width, size, weight) {
    if (count >= lines.length) return lines;
    if (count < 1) return ["…"];
    const visible = lines.slice(0, count);
    const measure = textMeasure(size, weight);
    const last = Array.from(visible[count - 1].trimEnd());
    while (last.length && measure(last.join("") + "…") > width) last.pop();
    visible[count - 1] = last.join("") + "…";
    return visible;
  }

  function shapeLayout(el, w) {
    const size = Math.max(4, num(el.fontSize, el.type === "note" ? 20 : 18));
    const weight = num(el.weight, 500);
    const width = Math.max(3, el.type === "diamond" ? w * .59 : el.type === "ellipse" ? w * .74 : w - 12);
    const heightFraction = el.type === "diamond" ? .41 : el.type === "ellipse" ? .67 : 1;
    const lines = wrapLines(String(el.text || ""), width, size, weight);
    return {lines, size, weight, width, heightFraction, lineHeight: size * 1.22};
  }

  function phaseLayout(el, w, scale) {
    const [label = "", ...paragraphs] = String(el.text || "").split("\n");
    const width = Math.max(1, w - 15 * scale);
    const titleSize = Math.max(4, num(el.fontSize, 31)) * scale;
    const title = wrapLines(label, width, titleSize, 700);
    const size = 15.4 * scale;
    const lines = paragraphs.length ? wrapLines(paragraphs.join("\n"), width, size) : [];
    const lineHeight = size * 1.22;
    const titleHeight = title.length * titleSize * 1.22 - titleSize * .22;
    const requiredHeight = 2 * (titleHeight + 3 * scale + lines.length * lineHeight);
    return {width, title, titleSize, titleHeight, lines, size, lineHeight, requiredHeight};
  }

  function heightForShapeText(el) {
    if (!el.text) return el.h;
    const {w, h} = bounds(el);
    if (el.type === "note" && el.variant === "phase") {
      const scale = Math.max(.1, Math.min(w / 210, h / 176));
      if (phaseLayout(el, w, scale).requiredHeight <= h) return h;
      return Math.max(h, Math.ceil(phaseLayout(el, w, Math.max(.1, w / 210)).requiredHeight));
    }
    const {lines, lineHeight, heightFraction} = shapeLayout(el, w);
    return Math.max(h, Math.ceil((4 + lines.length * lineHeight) / heightFraction));
  }

  function nativeText(group, value, x, baseline, size, color, options = {}) {
    group.append(svg("text", {x, y: baseline, fill: color, stroke: "none", "font-size": size,
      "font-family": options.font || SANS, "font-weight": options.weight || 400,
      "letter-spacing": options.spacing, "text-anchor": options.anchor || "start",
      "dominant-baseline": "alphabetic", "xml:space": "preserve"}, value));
  }

  function textSize(el) {
    const size = Math.max(4, num(el.fontSize, 23));
    const lines = String(el.text || "").split("\n");
    const label = el.variant === "label";
    const hand = ["heading", "hand", "annotation"].includes(el.variant);
    const weight = hand ? (el.variant === "heading" ? 700 : 500) : num(el.weight, label ? 700 : 400);
    const measure = textMeasure(size, weight, hand ? HAND : label ? MONO : SANS);
    let longest = 0;
    for (const line of lines) {
      let width = measure(line);
      if (label) width += Array.from(line).length * 2.1;
      if (hand && line) {
        const shapes = Array.from(line, glyph);
        const spacing = el.variant === "heading" ? 1.65 : 1.35;
        if (shapes.every(Boolean)) {
          width = shapes.reduce((sum, [advance]) => sum + advance + spacing, -spacing) * size / 18;
        }
      }
      longest = Math.max(longest, width);
    }
    return {w: Math.max(12, Math.ceil(longest * 1.1) + 6), h: lines.length * size * 1.35};
  }

  function drawText(group, el, w, h, color) {
    const size = Math.max(4, num(el.fontSize, 23)), value = String(el.text || "");
    const center = ["center", "middle"].includes(el.align);
    const right = ["end", "right"].includes(el.align);
    hitBox(group, 0, 0, w, h);
    const lines = value.split("\n");
    for (const [index, line] of lines.entries()) {
      const top = index * size * 1.24;
      if (["heading", "hand", "annotation"].includes(el.variant)) {
        handLine(group, line, center ? w / 2 : 0, top, size, color, {center, bold: el.variant === "heading"});
      } else {
        nativeText(group, line, center ? w / 2 : right ? w : 0, top + size * .91, size, color, {
          anchor: center ? "middle" : right ? "end" : "start", font: el.variant === "label" ? MONO : SANS,
          spacing: el.variant === "label" ? 2.1 : undefined,
          weight: num(el.weight, el.variant === "label" ? 700 : 400)
        });
      }
    }
  }

  function roughBox(w, h, radius) {
    const r = Math.max(0, Math.min(radius, w / 4, h / 4));
    if (w < 14 || h < 14) return `M0,0L${w},0 ${w},${h} 0,${h}Z`;
    return `M${r},1.1Q${w * .38},-.65 ${w - r},.8Q${w - .15},.8 ${w - .4},${r}
      Q${w + .7},${h * .55} ${w - .15},${h - r}Q${w},${h - .2} ${w - r},${h - .3}
      Q${w * .51},${h + .5} ${r},${h - .6}Q.5,${h} .6,${h - r}
      Q1.45,${h * .5} .4,${r}Q.2,.9 ${r},1.1Z`;
  }

  function drawIcon(group, name, x, y, size, color) {
    const g = svg("g", {transform: `translate(${x} ${y}) scale(${size / 44})`,
      fill: "none", stroke: color, "stroke-width": 2.05, "stroke-linecap": "round", "stroke-linejoin": "round"});
    if (name === "bulb") {
      path(g, "M14.3 27.4C13.8 24 10.2 23.3 10.1 17.3C10 10.7 14.8 6.2 21.2 6.1C27.7 6 33 10.5 32.9 16.9C32.8 22.9 28.6 25.1 27.7 28.8L27.3 31.4L15.2 31.8Z",
        {fill: "#ffdc86", stroke: "none", transform: "translate(1.4 1.2)"});
      path(g, "M15.4 30C15.3 23.8 9.9 23.2 10.2 16.6C10.4 10.3 15 6.1 21.7 6.2C28.2 6.3 32.8 10.6 32.5 16.8C32.3 23.5 27.1 24.8 27.2 30.1Z");
      path(g, "M15.9 33.6l10.8 -.3M17.3 36.8l8.1 -.2M19.2 39q2 2.1 4.3 -.1M20.1 29.4l-2.2 -10l4 3.4l3.8 -3.9l-2.2 10.4",
        {"stroke-width": 1.6});
      path(g, "M21.1 1l.1 -2M7.2 5.9L4.9 3.4M4.5 16.9l-3.2 -.2M7 26.5l-2.8 1.8M35.8 6.5l2.5 -2.3M38.2 16.6l3 -.4M35.9 26.3l2.3 2",
        {"stroke-width": 1.65});
    } else if (name === "layers") {
      path(g, "M3 17.2L22 6.2L41.4 16.2L22.7 27.2Z", {fill: "#b1d3ad", stroke: "none", transform: "translate(1 .8)"});
      path(g, "M2.5 16.9Q12.1 11.2 21.7 6.1Q31.5 10.8 41.3 16.2L22.3 27.2Z");
      path(g, "M9.1 20.8L2.8 24.5L22.5 34.6L41.7 23.2L35 19.9");
      path(g, "M8.8 28.1L3.1 31.6L22.8 41.5L41.9 30.2L35.4 27.2");
      path(g, "M14.3 14.7l7.5 -4M17 16.8l7.1 -3.8", {"stroke-width": 1.25, opacity: .75});
    } else if (name === "rocket") {
      path(g, "M12 25C16.8 13.7 27.1 5.1 38.6 4.5C38.3 16.3 32.2 26.3 21.9 31.7Z",
        {fill: "#cbb7ed", stroke: "none", transform: "translate(1.5 .7)"});
      path(g, "M12.2 24.7C18.4 11.7 27.1 5.2 38.3 4.4C38.2 16.6 31.8 26.4 21.5 31.7Z");
      path(g, "M16.5 17.8Q10.1 17.7 5.5 25.8l8.3 .4M28.1 26.7Q28.7 33.3 20.7 38.8L19.8 31M13.3 29.3L9.7 34.4M16.5 32.3l-3.2 5M10.5 27.5l-3.7 3.7");
      g.append(svg("circle", {cx: 28.1, cy: 14.5, r: 3.55, fill: "#ede4f8"}));
      path(g, "M5.9 35.5L3 39M8.4 38.7l-1.3 1.5", {stroke: "#af735c", "stroke-width": 1.6});
    }
    group.append(g);
  }

  function drawPhase(group, el, w, h, color, fill, width) {
    const body = roughBox(w, h, 12);
    path(group, body, {fill: color, stroke: "none", opacity: .1, transform: "translate(2.8 3.8)"});
    path(group, body, {fill, stroke: color, "stroke-width": width});
    path(group, `M${w * .73} ${h - 3.1}q${w * .099} .95 ${w * .159} -.25`,
      {stroke: color, fill: "none", "stroke-width": .75, opacity: .33});
    const scale = Math.max(.1, Math.min(w / 210, h / 176));
    const iconSize = 44 * scale;
    const baseline = h / 2 - 6 * scale;
    drawIcon(group, el.icon, (w - iconSize) / 2, baseline - 54 * scale, iconSize, color);
    const {width: textWidth, title, titleSize, titleHeight, lines, size, lineHeight} = phaseLayout(el, w, scale);
    const available = h - baseline - 9 * scale;
    const titleCapacity = Math.floor((available + .22 * titleSize) / (1.22 * titleSize));
    const count = Math.floor((available - titleHeight) / lineHeight);
    const onlyTitleFits = count < 1 && lines.length > 0;
    const headings = onlyTitleFits ? visibleLines([...title, ""], Math.min(titleCapacity, title.length), textWidth, titleSize, 700)
      : visibleLines(title, titleCapacity, textWidth, titleSize, 700);
    headings.forEach((line, i) =>
      handLine(group, line, w / 2, baseline + scale + i * titleSize * 1.22, titleSize, color, {center: true, bold: true}));
    if (count < 1 || !lines.length) return;
    visibleLines(lines, count, textWidth, size, 400).forEach((line, i) =>
      nativeText(group, line, w / 2, baseline + titleHeight + 15 * scale + i * lineHeight, size, color, {anchor: "middle"}));
  }

  function drawShape(group, el, w, h, color, fill, width) {
    const attrs = {fill, stroke: color, "stroke-width": width,
      "stroke-dasharray": el.dash === "dashed" ? `${width * 3} ${width * 3}` : undefined};
    if (el.type === "diamond") {
      path(group, `M${w * .5},0L${w},${h * .49} ${w * .5},${h} 0,${h * .5}Z`, attrs);
    } else if (el.type === "ellipse") {
      group.append(svg("ellipse", {cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2, ...attrs}));
    } else {
      path(group, roughBox(w, h, el.type === "note" ? 3 : Math.min(8, w * .04)), attrs);
    }
    const value = String(el.text || "");
    if (!value) return;
    const {lines, size, weight, width: textWidth, lineHeight, heightFraction} = shapeLayout(el, w);
    const count = Math.floor((h * heightFraction - 4) / lineHeight);
    const visible = visibleLines(lines, count, textWidth, size, weight);
    const start = (h - (visible.length - 1) * lineHeight) / 2 + size * .32;
    visible.forEach((line, i) => nativeText(group, line, w / 2, start + i * lineHeight, size, color,
      {anchor: "middle", weight}));
  }

  function drawElement(el) {
    const position = `translate(${num(el.x)} ${num(el.y)})`;
    const g = svg("g", {"data-id": el.id, "data-element-id": el.id, transform: position,
      "stroke-linecap": "round", "stroke-linejoin": "round", opacity: Math.max(0, Math.min(1, num(el.opacity, 1)))});
    if (el.text) g.append(svg("title", {}, el.text));
    const color = paint(el.stroke, INK);
    const fill = paint(el.fill, el.type === "note" ? "#ffebad" : "none");
    const width = Math.min(48, Math.max(.2, num(el.width, 2)));
    if (["pen", "line", "arrow"].includes(el.type)) {
      drawLine(g, el, color, width);
    } else {
      const {w, h} = bounds(el);
      if (el.type === "text") drawText(g, el, w, h, color);
      else if (el.type === "note" && el.variant === "phase") drawPhase(g, el, w, h, color, fill, width);
      else drawShape(g, el, w, h, color, fill, width);
    }
    return g;
  }

  function stroke(type, points, options = {}) {
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return make(type, x, y, Math.max(...xs) - x, Math.max(...ys) - y, {
      points: points.map(([px, py]) => [px - x, py - y]), ...options});
  }

  function bind(element, u, v, gap = 0) {
    return {id: element.id, u, v, gap};
  }

  function eyebrow(label) {
    return [
      stroke("pen", [[22, 11], [33, 10.5], [45, 10.4]], {stroke: "#d17c51", width: 3}),
      make("text", 56, 4, 225, 18, {text: label, variant: "label", fontSize: 12, stroke: "#6a675f"})
    ];
  }

  function heading(text, w = 680) {
    return make("text", 20, 32, w, 66, {text, variant: "heading", fontSize: 57});
  }

  function createExample() {
    const elements = [...eyebrow("MAPA DE PROCESO"), heading("El viaje de una idea", 588)];
    elements.push(
      stroke("pen", [[355, 97], [394, 92], [454, 92.5], [522, 90.7], [597, 92.4]],
        {stroke: "#ecb08d", width: 4.6}),
      stroke("pen", [[384, 100], [426, 96.7], [499, 96.9], [556, 95.4]],
        {stroke: "#efc7ac", width: 1.45}),
      stroke("pen", [[615, 30], [617, 38], [625, 40], [617.5, 43], [615, 51], [612.8, 43.5], [605.5, 41], [613, 38.5], [615, 30]],
        {stroke: "#b87249", width: 1.95}),
      stroke("pen", [[628, 25], [629, 28.3], [632, 29.5], [629.3, 30.5], [628, 34], [627, 30.8], [624.1, 29.6], [627.2, 28.2], [628, 25]],
        {stroke: "#b87249", width: 1.3})
    );
    const cards = [
      [20, "#f8d7bf", "bulb", "Explorar\nEntender el problema\ny escuchar a la gente."],
      [323, "#dce9d3", "layers", "Diseñar\nDar forma a las ideas\ny probar un prototipo."],
      [626, "#e6ddf2", "rocket", "Lanzar\nPublicar la solución\ny medir su impacto."]
    ];
    const phases = cards.map(([x, fill, icon, text]) => make("note", x, 141, 222, 178,
      {text, variant: "phase", icon, fill, width: 2.05, fontSize: 31.5}));
    elements.push(...phases);
    elements.push(
      stroke("arrow", [[252, 230], [269, 225], [292, 225.5], [313, 229.5]], {variant: "curve", width: 2.7,
        startBinding: bind(phases[0], 1, .5, 10), endBinding: bind(phases[1], 0, .5, 10)}),
      stroke("arrow", [[556, 230], [574, 235], [594, 233.6], [615, 228.5]], {variant: "curve", width: 2.7,
        startBinding: bind(phases[1], 1, .5, 11), endBinding: bind(phases[2], 0, .5, 11)}),
      stroke("arrow", [[742, 329], [738, 349], [725, 367], [705, 375], [683, 378], [657, 378],
        [641, 374], [635, 365], [636, 355], [644, 352], [652, 357], [649, 369], [635, 379],
        [610, 385], [581, 385], [555, 382]], {stroke: "#776f62", variant: "curve", width: 1.85,
          startBinding: bind(phases[2], .52, 1, 10)}),
      make("text", 278, 365, 265, 34, {text: "Aprender y volver a probar", variant: "annotation", fontSize: 19.5, stroke: "#655e53"}),
      stroke("pen", [[278, 391], [302, 392], [326, 390], [342, 390.5]],
        {stroke: "#c39269", width: 1.6})
    );
    return elements;
  }

  function createRetro() {
    const elements = [...eyebrow("RETROSPECTIVA"), heading("Mirar hacia atrás", 565)];
    const columns = [
      ["Mantener", "#dce9d3", "Compartimos avances\nantes de la revisión."],
      ["Mejorar", "#f8d7bf", "Los bloqueos tardaron\nen hacerse visibles."],
      ["Probar", "#e6ddf2", "Revisar los bloqueos\nal inicio de la diaria."]
    ];
    columns.forEach(([label, fill, note], index) => {
      const x = 20 + index * 280;
      elements.push(make("text", x + 6, 136, 240, 44, {text: label, variant: "hand", fontSize: 33}));
      elements.push(stroke("line", [[x + 2, 184], [x + 242, 184.5]], {stroke: "#b9b7ad", width: 1.4}));
      elements.push(make("note", x + 5, 210, 231, 136, {text: note, fill, fontSize: 18}));
    });
    return elements;
  }

  function createMind() {
    const elements = [...eyebrow("MAPA MENTAL"), heading("Mapa de ideas", 480)];
    const center = make("ellipse", 290, 208, 211, 101, {text: "Nuestra idea", fontSize: 24, fill: "#ffebbc"});
    const branches = [
      [25, 150, "#dce9d3", "Personas", [[290, 238], [248, 231], [240, 199], [207, 191]]],
      [25, 319, "#e6ddf2", "Necesidades", [[290, 281], [255, 289], [243, 343], [207, 357]]],
      [595, 142, "#f8d7bf", "Soluciones", [[500, 238], [543, 231], [553, 197], [584, 185]]],
      [595, 315, "#d9e9ee", "Experimentos", [[500, 281], [546, 290], [549, 334], [584, 353]]]
    ];
    for (const [x, y, fill, text, coords] of branches) {
      const node = make("rect", x, y, 174, 82, {text, fill, fontSize: 20});
      const onLeft = x < center.x;
      elements.push(stroke("arrow", coords, {variant: "curve", width: 2,
        startBinding: bind(center, onLeft ? 0 : 1, (coords[0][1] - center.y) / center.h),
        endBinding: bind(node, onLeft ? 1 : 0, .5, onLeft ? 8 : 11)}));
      elements.push(node);
    }
    elements.push(center);
    return elements;
  }

  function createTemplate(name) {
    if (name === "retro") return createRetro();
    if (name === "mind") return createMind();
    if (name === "blank") return [];
    return createExample();
  }

  window.FreeDrawScene = {SANS, drawElement, bounds, heightForShapeText, textSize, createExample, createTemplate};
})();
