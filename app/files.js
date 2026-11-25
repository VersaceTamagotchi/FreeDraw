/* File formats and image exports for FreeDraw. */
(() => {
  'use strict';

  const svgNS = 'http://www.w3.org/2000/svg';
  const types = new Set(['rect', 'ellipse', 'diamond', 'arrow', 'line', 'pen', 'text', 'note']);
  const bindingTargets = new Set(['rect', 'ellipse', 'diamond', 'note']);
  const externalTypes = new Map([
    ['rectangle', 'rect'], ['ellipse', 'ellipse'], ['diamond', 'diamond'],
    ['arrow', 'arrow'], ['line', 'line'], ['freedraw', 'pen'], ['text', 'text']
  ]);
  const sizeLimit = 16 * 1024 * 1024;
  const pointLimit = 250000;
  const extentLimit = 10000000;
  const defaultTitle = 'Pizarra sin título';

  function boardTitle(value) {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : defaultTitle;
  }

  function fileBase(title) {
    const name = boardTitle(title)
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .replace(/[. ]+$/g, '')
      .slice(0, 140);
    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? '_' + name : name || 'FreeDraw';
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }

  function numeric(value, min, max) {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error('El tablero contiene una medida fuera del intervalo permitido.');
    }
    return value;
  }

  function color(value) {
    if (typeof value !== 'string' || value.length > 90) return undefined;
    // The whitelist excludes SVG resource references and CSS variables.
    if (/^(?:#[a-f\d]{3,8}|[a-z]{1,25}|(?:rgba?|hsla?)\([+\-\d., %/]+\))$/i.test(value)) {
      return value;
    }
    return undefined;
  }

  function elementId(id, used) {
    if (typeof id !== 'string' || !/^[a-z\d][a-z\d_-]{0,159}$/i.test(id) ||
        /^(?:constructor|prototype)$/i.test(id) || used.has(id)) {
      let suffix = used.size + 1;
      do { id = 'element-' + suffix++; } while (used.has(id));
    }
    used.add(id);
    return id;
  }

  function normalizeElement(raw, context) {
    if (!raw || !types.has(raw.type)) throw new Error('El archivo contiene un elemento desconocido.');
    const element = { id: elementId(raw.id, context.ids), type: raw.type };
    for (const name of ['x', 'y', 'w', 'h']) {
      element[name] = numeric(raw[name], -extentLimit, extentLimit);
    }
    if (raw.text != null) {
      if (typeof raw.text !== 'string' || raw.text.length > 100000) {
        throw new Error('Uno de los textos del tablero es demasiado largo o no es válido.');
      }
      element.text = raw.text;
    }
    for (const name of ['stroke', 'fill']) {
      const safe = color(raw[name]);
      if (safe !== undefined) element[name] = safe;
    }
    if (raw.width != null) element.width = numeric(raw.width, 0, 1000);
    if (raw.fontSize != null) element.fontSize = numeric(raw.fontSize, 1, 10000);
    if (raw.opacity != null) element.opacity = numeric(raw.opacity, 0, 100);
    for (const name of ['variant', 'icon', 'align', 'dash']) {
      if (typeof raw[name] === 'string' && /^[a-z\d-]{1,40}$/i.test(raw[name])) {
        element[name] = raw[name];
      }
    }
    if (typeof raw.fontFamily === 'string' && /^[a-z\d '\u0022,-]{1,120}$/i.test(raw.fontFamily)) {
      element.fontFamily = raw.fontFamily;
    }
    if (Number.isFinite(raw.weight)) element.weight = numeric(raw.weight, 1, 1000);
    else if (typeof raw.weight === 'string' && /^(?:normal|bold|[1-9]00)$/.test(raw.weight)) {
      element.weight = raw.weight;
    }
    if (raw.points !== undefined) {
      if (!Array.isArray(raw.points) || raw.points.length > pointLimit - context.points) {
        throw new Error('El tablero excede el límite de puntos de dibujo.');
      }
      context.points += raw.points.length;
      element.points = raw.points.map(point => {
        if (!Array.isArray(point) || point.length !== 2) throw new Error('El dibujo contiene un punto inválido.');
        return point.map(axis => numeric(axis, -extentLimit, extentLimit));
      });
    }
    return element;
  }

  function convertExcalidraw(raw, context) {
    const type = externalTypes.get(raw.type);
    const item = {
      id: raw.id, type, x: raw.x, y: raw.y, w: raw.width, h: raw.height,
      stroke: raw.strokeColor, fill: raw.backgroundColor, width: raw.strokeWidth,
      opacity: typeof raw.opacity === 'number' ? raw.opacity / 100 : undefined
    };
    if (type === 'text') {
      item.text = raw.text ?? raw.originalText ?? '';
      item.fontSize = raw.fontSize;
      item.align = raw.textAlign === 'center' ? 'middle' : raw.textAlign === 'right' ? 'end' : 'start';
    }
    if (['pen', 'line', 'arrow'].includes(type) && Array.isArray(raw.points)) item.points = raw.points;
    if (raw.strokeStyle === 'dashed' || raw.strokeStyle === 'dotted') item.dash = 'dashed';
    const normalized = normalizeElement(item, context);
    if (normalized.points?.length) {
      // Excalidraw stores points relative to its first point, including negative coordinates.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of normalized.points) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      normalized.x += minX; normalized.y += minY;
      normalized.w = maxX - minX; normalized.h = maxY - minY;
      normalized.points = normalized.points.map(([x, y]) => [x - minX, y - minY]);
    }
    return normalized;
  }

  function restoreBindings(source, elements) {
    const targets = new Map();
    elements.forEach((element, index) => {
      const originalId = source[index].id;
      if (typeof originalId === 'string' && bindingTargets.has(element.type) && !targets.has(originalId)) {
        targets.set(originalId, element.id);
      }
    });
    let detached = 0;
    elements.forEach((element, index) => {
      if (element.type !== 'arrow') return;
      for (const key of ['startBinding', 'endBinding']) {
        const raw = source[index][key];
        if (raw == null) continue;
        const id = targets.get(raw.id ?? raw.elementId);
        if (!id) {
          detached++;
          continue;
        }
        const binding = { id, u: numeric(raw.u, 0, 1), v: numeric(raw.v, 0, 1) };
        if (raw.gap != null) binding.gap = numeric(raw.gap, 0, 24);
        element[key] = binding;
      }
    });
    return detached;
  }

  async function readFile(file) {
    if (!file || typeof file.text !== 'function') throw new Error('Elige un archivo de tablero.');
    if (file.size > sizeLimit) throw new Error('El archivo supera el límite de 16 MB.');
    let data;
    try {
      data = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
    } catch {
      throw new Error('El archivo no contiene un tablero JSON válido.');
    }
    return parseBoard(data, file.name);
  }

  function parseBoard(data, filename = '') {
    if (!data || !Array.isArray(data.elements)) throw new Error('El archivo no contiene una lista de elementos.');
    if (data.elements.length > 20000) throw new Error('El tablero supera el límite de 20 000 elementos.');
    const foreign = data.type === 'excalidraw' || data.type === 'excalidraw/clipboard';
    if (!foreign && ((data.format && data.format !== 'freedraw') || (data.type && data.type !== 'freedraw') ||
        (data.version != null && data.version !== 1))) {
      throw new Error('Esta versión o formato de tablero no es compatible.');
    }
    const fallbackName = String(filename || '').replace(/(?:\.freedraw)?\.(?:json|excalidraw|freedraw)$/i, '');
    const title = boardTitle(data.title || data.appState?.name || fallbackName);
    const context = { ids: new Set(), points: 0 };
    const elements = [], warnings = [];
    let skipped = 0, simplified = false;
    for (const raw of data.elements) {
      if (!raw || typeof raw !== 'object') throw new Error('El tablero contiene un elemento inválido.');
      if (foreign && raw.isDeleted) continue;
      if (foreign && !externalTypes.has(raw.type)) { skipped++; continue; }
      if (foreign && (raw.angle || raw.groupIds?.length || raw.containerId || raw.startBinding || raw.endBinding)) {
        simplified = true;
      }
      elements.push(foreign ? convertExcalidraw(raw, context) : normalizeElement(raw, context));
    }
    if (skipped && !elements.length) throw new Error('Este archivo solo contiene elementos que FreeDraw no puede importar.');
    if (skipped) warnings.push('Elementos de Excalidraw omitidos: ' + skipped + '.');
    if (simplified) warnings.push('Las formas importadas son independientes y conservan su orientación básica.');
    if (!foreign && restoreBindings(data.elements, elements)) {
      warnings.push('Algunas flechas quedaron libres porque falta su figura de destino.');
    }
    return { title, elements, warnings };
  }

  async function saveJSON(board) {
    const payload = { format: 'freedraw', version: 1, title: boardTitle(board.title), elements: board.elements };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (blob.size > sizeLimit || board.elements.length > 20000 ||
        board.elements.reduce((count, el) => count + (el.points?.length || 0), 0) > pointLimit) {
      throw new Error('El tablero supera el tamaño permitido para un archivo editable.');
    }
    download(blob, fileBase(payload.title) + '.freedraw.json');
  }

  function svgDocument(board) {
    const scene = window.FreeDrawScene;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    const svg = document.createElementNS(svgNS, 'svg');
    const title = document.createElementNS(svgNS, 'title');
    title.textContent = boardTitle(board.title);
    svg.append(title);
    const background = document.createElementNS(svgNS, 'rect');
    background.setAttribute('fill', '#fcfbf8');
    svg.append(background);
    for (const element of board.elements) {
      const bound = scene.bounds(element);
      const inset = 4 + (element.width || 2);
      right = Math.max(right, Math.max(bound.x, bound.x + bound.w) + inset);
      bottom = Math.max(bottom, Math.max(bound.y, bound.y + bound.h) + inset);
      left = Math.min(left, Math.min(bound.x, bound.x + bound.w) - inset);
      top = Math.min(top, Math.min(bound.y, bound.y + bound.h) - inset);
      svg.append(scene.drawElement(element));
    }
    const padding = 24;
    const x = board.elements.length ? Math.floor(left - padding) : 0;
    const y = board.elements.length ? Math.floor(top - padding) : 0;
    const width = board.elements.length ? Math.ceil(right + padding - x) : 960;
    const height = board.elements.length ? Math.ceil(bottom + padding - y) : 640;
    svg.setAttribute('viewBox', [x, y, width, height].join(' '));
    svg.setAttribute('width', width); svg.setAttribute('height', height);
    for (const [key, value] of Object.entries({ x, y, width, height })) background.setAttribute(key, value);
    return { svg, width, height };
  }

  function makeSVG(board) {
    return new XMLSerializer().serializeToString(svgDocument(board).svg);
  }

  async function saveSVG(board) {
    download(new Blob([makeSVG(board)], { type: 'image/svg+xml;charset=utf-8' }), fileBase(board.title) + '.svg');
  }

  async function savePNG(board) {
    const { svg, width, height } = svgDocument(board);
    const scale = Math.min(2, 4096 / width, 4096 / height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    svg.setAttribute('width', canvas.width); svg.setAttribute('height', canvas.height);
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('El navegador no pudo preparar la imagen.'));
        image.src = url;
      });
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('El navegador no pudo crear el PNG.');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('El navegador no pudo guardar la imagen PNG.');
      download(png, fileBase(board.title) + '.png');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const api = { saveJSON, saveSVG, savePNG, readFile, parseBoard, makeSVG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.FreeDrawFiles = api;
})();
