(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const scene = window.FreeDrawScene;
  const files = window.FreeDrawFiles;
  const prefix = 'freedraw.board.v1.';
  const activeKey = 'freedraw.active.v1';
  const memory = new Map();
  const storedVersions = new Map();
  const localEdits = new Set();
  const incomingVersions = new Map();
  const dialog = $('dialog');
  const popover = $('popover');
  const input = $('text-editor');
  const svg = $('canvas');
  let editor, active, anchor, editId, toastTimer, storageWorks = true, loading = false;
  let grid = true;
  const shortcuts = { v:'select', h:'hand', r:'rect', d:'diamond', o:'ellipse', a:'arrow', l:'line', p:'pen', t:'text', n:'note', e:'eraser' };
  const labels = {select:'Seleccionar', hand:'Mano', rect:'Rectángulo', diamond:'Rombo', ellipse:'Elipse', arrow:'Flecha', line:'Línea', pen:'Lápiz', text:'Texto', note:'Nota adhesiva', eraser:'Borrador'};
  const hints = {select:'Arrastra para seleccionar', hand:'Arrastra para mover el lienzo', rect:'Arrastra para dibujar un rectángulo', diamond:'Arrastra para dibujar un rombo', ellipse:'Arrastra para dibujar una elipse', arrow:'Arrastra del origen al destino', line:'Arrastra para trazar una línea', pen:'Dibuja a mano alzada', text:'Haz clic para escribir', note:'Haz clic para añadir una nota', eraser:'Arrastra sobre los elementos que quieras borrar'};
  const paths = {
    plus:'M12 5v14M5 12h14', folder:'M3 8V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z',
    edit:'m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15Z', board:'M4 4h16v16H4zM4 9h16',
    check:'m5 12 4 4L19 6', close:'m6 6 12 12M18 6 6 18', file:'M6 3h8l4 5v13H6zM14 3v6h4',
    image:'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6M15.5 8h.1', vector:'m12 3 8 8-8 10-8-10zM4 11h16M12 3v18',
    copy:'M8 8h12v13H8zM16 8V3H3v13h5', delete:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15',
    up:'m4 11 8-7 8 7M4 16l8-7 8 7', down:'m4 8 8 7 8-7M4 13l8 7 8-7',
    upload:'M12 15V3m-5 5 5-5 5 5M4 15v5h16v-5', grid:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'
  };
  function icon(name) {
    const node = document.createElementNS('http://www.w3.org/2000/svg','svg');
    node.setAttribute('viewBox','0 0 24 24');
    node.setAttribute('fill','none');
    node.setAttribute('stroke','currentColor');
    node.setAttribute('stroke-width','1.7');
    node.setAttribute('stroke-linejoin','round');
    node.setAttribute('stroke-linecap','round');
    node.setAttribute('width','19');
    node.setAttribute('height','19');
    node.setAttribute('aria-hidden','true');
    const p = document.createElementNS(node.namespaceURI,'path');
    p.setAttribute('d',paths[name] || paths.file);
    node.append(p); return node;
  }
  function node(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function button(cls, title, fn) {
    const el = node('button', cls, title);
    el.type = 'button'; el.addEventListener('click', fn);
    return el;
  }
  function toast(message) {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3600);
  }
  function persistentToast(id,message,label,action) {
    if ($(id)) return;
    const notice = node('div','toast');
    notice.id = id;
    notice.setAttribute('role','status');
    notice.append(node('span','',message),button('',label,action));
    $('toasts').prepend(notice);
  }
  function listBoards() {
    const boards = new Map(memory);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(prefix)) continue;
        try {
          const raw = localStorage.getItem(key);
          const board = JSON.parse(raw);
          if (board?.id && Array.isArray(board.elements) && !memory.has(board.id)) {
            storedVersions.set(board.id, raw);
            boards.set(board.id, board);
          }
        } catch { /* A single damaged record must not hide other boards. */ }
      }
    } catch { storageWorks = false; }
    return [...boards.values()].sort((a,b) => b.updated - a.updated);
  }
  function current() { return {title:active.title, elements:editor.getElements()}; }
  function saveStatus(saved) {
    const status = $('save-status');
    status.textContent = saved ? 'Guardado localmente' : 'Solo en memoria';
    status.classList.toggle('save-warning', !saved);
    status.title = saved ? 'Este tablero está guardado en este navegador' : 'Descarga el archivo editable para conservar los cambios';
    refreshControls();
  }
  function warnConflict() {
    saveStatus(false);
    persistentToast('conflict-notice','Este tablero cambió en otra pestaña','Recargar',() => {
      const id = active.id;
      finishText(true);
      acceptIncoming(id,incomingVersions.get(id));
    });
  }
  function save(changed = true) {
    if (loading || !active || !editor) return;
    if (changed) {
      localEdits.add(active.id);
      Object.assign(active, current(), {updated:Date.now()});
    }
    const id = active.id;
    memory.set(id, active);
    try {
      const raw = localStorage.getItem(prefix + id);
      if (raw !== (storedVersions.get(id) ?? null)) incomingVersions.set(id,raw);
      if (incomingVersions.has(id)) {
        warnConflict();
        return;
      }
      const serialized = JSON.stringify(active);
      if (raw !== serialized) localStorage.setItem(prefix + id, serialized);
      storedVersions.set(id,serialized);
      localStorage.setItem(activeKey, id);
      storageWorks = true;
      $('storage-notice')?.remove();
    } catch {
      storageWorks = false;
      persistentToast('storage-notice','No se pudo guardar el tablero en este navegador.','Descargar copia',() => download('JSON'));
    }
    saveStatus(storageWorks);
  }
  const freshBoard = (title,elements = []) => ({
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'board-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
    title, elements, updated:Date.now()
  });
  function openBoard(board) {
    closePopover(); finishText(false); loading = true;
    $('conflict-notice')?.remove();
    active = board;
    editor.load(board.elements);
    editor.setTool('select'); editor.fit();
    $('board-title').textContent = board.title;
    document.title = board.title + ' · FreeDraw';
    loading = false; save(false);
  }
  function refreshControls() {
    if (!editor) return;
    $('undo').disabled = !editor.canUndo();
    $('redo').disabled = !editor.canRedo();
  }
  function toolChanged(tool) {
    for (const btn of document.querySelectorAll('button[data-tool]')) {
      const selected = btn.dataset.tool === tool;
      btn.classList.toggle('active',selected);
      btn.setAttribute('aria-pressed',String(selected));
    }
    $('hint').replaceChildren(node('span','',hints[tool] || ''), node('span','hint-dot','·'), node('kbd','', 'Espacio'), node('span','','para mover'));
    svg.dataset.tool = tool;
  }
  function viewChanged(view) {
    $('zoom-value').textContent = Math.round(view.zoom * 100) + '%';
    const spacing = Math.max(8,20 * view.zoom);
    $('stage').style.backgroundSize = spacing + 'px ' + spacing + 'px';
    $('stage').style.backgroundPosition = view.x + 'px ' + view.y + 'px';
    if (editId) placeTextEditor();
  }
  function placeTextEditor() {
    const el = editor?.getElements().find(e => e.id === editId);
    if (!el) return;
    const view = editor.getView(), rect = svg.getBoundingClientRect();
    const x = rect.left + view.x + el.x * view.zoom, y = rect.top + view.y + el.y * view.zoom;
    const w = Math.min(Math.max(170, Math.abs(el.w || 160) * view.zoom + 14), window.innerWidth - 20);
    const h = Math.min(Math.max(76, Math.abs(el.h || 40) * view.zoom + 15), Math.max(100, window.innerHeight * .5));
    input.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
    input.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + 'px';
    input.style.width = w + 'px'; input.style.height = h + 'px';
    input.style.fontSize = Math.max(16,Math.min(36,(el.fontSize || 22) * view.zoom)) + 'px';
  }
  function editText(el) {
    closePopover(); editId = el.id; input.value = el.text || '';
    input.hidden = false; placeTextEditor(); input.focus(); input.select();
  }
  function finishText(cancel) {
    if (!editId) return;
    const id = editId; editId = null; input.hidden = true;
    if (cancel) editor.cancelText(id);
    else editor.updateText(id,input.value);
  }
  input.addEventListener('blur',() => finishText(false));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey && !e.isComposing)) {
      e.preventDefault(); e.stopPropagation(); finishText(e.key === 'Escape'); svg.focus();
    }
  });

  function closePopover() {
    if (anchor) anchor.setAttribute('aria-expanded','false');
    anchor = null; popover.hidden = true;
  }
  function positionPopover() {
    if (!anchor || popover.hidden) return;
    const a = anchor.getBoundingClientRect(), box = popover.getBoundingClientRect();
    popover.style.left = Math.max(8,Math.min(a.left, window.innerWidth - box.width - 8)) + 'px';
    const y = a.bottom + box.height + 8 < innerHeight ? a.bottom + 8 : Math.max(8,a.top - box.height - 8);
    popover.style.top = y + 'px';
  }
  function showPopover(trigger, make) {
    const same = anchor === trigger;
    closePopover(); if (same) return;
    anchor = trigger; anchor.setAttribute('aria-expanded','true');
    popover.replaceChildren(); make();
    popover.hidden = false; positionPopover();
  }
  function item(name,text,action,suffix) {
    const el = button('menu-item','',action);
    el.append(icon(name), node('span','',text));
    if (suffix) el.append(node('small','',suffix));
    return el;
  }
  function showDialog(title) {
    closePopover(); if (dialog.open) dialog.close();
    const heading = node('div','dialog-heading');
    const titleNode = node('h2','',title); titleNode.id='dialog-title';
    const close = button('dialog-close icon-button','',() => dialog.close());
    close.setAttribute('aria-label','Cerrar'); close.append(icon('close'));
    heading.append(titleNode,close);
    dialog.replaceChildren(heading); dialog.setAttribute('aria-labelledby','dialog-title');
    dialog.showModal();
  }
  function nameDialog(rename) {
    showDialog(rename ? 'Renombrar tablero' : 'Nuevo tablero');
    const form = node('form','board-form');
    const label = node('label','field','Nombre del tablero');
    const field = node('input','name-input');
    field.required = true; field.maxLength = 90;
    field.value = rename ? active.title : 'Tablero sin título';
    label.append(field);
    const submit = node('button','primary-button',rename ? 'Guardar nombre' : 'Crear tablero');
    submit.type = 'submit';
    const actions = node('div','dialog-actions');
    actions.append(button('secondary-button','Cancelar',() => dialog.close()),submit);
    form.append(label,actions); dialog.append(form); field.focus(); field.select();
    form.addEventListener('submit',e => {
      e.preventDefault();
      const name = field.value.trim();
      if (!name) { field.focus(); return; }
      dialog.close();
      if (!rename) { openBoard(freshBoard(name)); return; }
      active.title = name; $('board-title').textContent = name; document.title = name + ' · FreeDraw'; save();
    });
  }
  function deleteBoardDialog() {
    const board = active;
    showDialog('Eliminar tablero');
    dialog.append(node('p','dialog-description','¿Quieres eliminar «' + board.title + '»?'));
    const actions = node('div','dialog-actions');
    const cancel = button('secondary-button','Cancelar',() => dialog.close());
    const confirm = button('primary-button','Eliminar tablero',() => {
      dialog.close();
      try {
        localStorage.removeItem(prefix + board.id);
      } catch {
        toast('No se pudo eliminar el tablero de este navegador');
        return;
      }
      memory.delete(board.id);
      storedVersions.delete(board.id);
      localEdits.delete(board.id);
      incomingVersions.delete(board.id);
      openBoard(listBoards()[0] || freshBoard('Tablero sin título'));
    });
    actions.append(cancel,confirm);
    dialog.append(actions);
    cancel.focus();
  }
  function boardMenu() {
    popover.append(item('plus','Nuevo tablero',() => nameDialog(false)),item('edit','Renombrar',() => nameDialog(true)),
      item('copy','Duplicar tablero',() => openBoard(freshBoard('Copia de ' + active.title, editor.getElements()))),
      item('delete','Eliminar tablero',deleteBoardDialog),
      item('folder','Abrir archivo…',() => { closePopover(); $('import-file').click(); },'Ctrl O'),node('hr','menu-separator'),
      node('div','popover-title','Mis tableros'));
    for (const board of listBoards()) {
      popover.append(item(board.id === active.id ? 'check' : 'board', board.title, () => openBoard(board)));
    }
  }

  const templates = [
    ['flow','Mapa de producto','Del concepto al lanzamiento'],
    ['retro','Retrospectiva','Recoge ideas de tu equipo'],
    ['mind','Mapa mental','Conecta ideas alrededor de un tema']
  ];
  function templateDialog() {
    showDialog('Biblioteca de plantillas');
    dialog.append(node('p','dialog-description','Elige una plantilla para abrirla en un tablero nuevo.'));
    const grid = node('div','template-grid');
    for (const [type,title,desc] of templates) {
      const elements = scene.createTemplate(type);
      const btn = button('template-card','',() => { dialog.close(); openBoard(freshBoard(title, elements)); });
      const art = document.createElementNS(svg.namespaceURI,'svg');
      art.setAttribute('class','template-preview'); art.setAttribute('aria-hidden','true');
      const bounds = elements.map(scene.bounds);
      const x=Math.min(...bounds.map(b=>b.x)), y=Math.min(...bounds.map(b=>b.y));
      const w=Math.max(...bounds.map(b=>b.x+b.w))-x, h=Math.max(...bounds.map(b=>b.y+b.h))-y;
      art.setAttribute('viewBox',[x-20,y-20,w+40,h+40].join(' '));
      for (const el of elements) art.append(scene.drawElement(el));
      btn.append(art,node('strong','',title),node('small','',desc));
      grid.append(btn);
    }
    dialog.append(grid);
  }
  async function download(format) {
    try {
      await files['save'+format](current());
      if (dialog.open) dialog.close();
      toast('Archivo ' + format + ' listo para descargar');
    } catch (error) { toast(error.message || 'No se pudo exportar el tablero'); }
  }
  function exportDialog() {
    showDialog('Exportar tablero');
    const list = node('div','format-list');
    for (const [format,label,desc,symbol] of [
      ['PNG','Imagen PNG','Para pegar en un correo o presentación','image'],
      ['SVG','Vector SVG','Para ampliar el dibujo sin perder nitidez','vector'],
      ['JSON','Tablero editable','Para guardar una copia y seguir dibujando','file']
    ]) {
      const row = button('format-card','',() => download(format));
      const caption = node('div'); caption.append(node('strong','',label),node('small','',desc));
      row.append(icon(symbol),caption); list.append(row);
    }
    dialog.append(list);
  }
  async function importFile(file) {
    if (!file) return;
    try {
      const board = await files.readFile(file);
      openBoard(freshBoard(board.title,board.elements));
      if (board.warnings?.length) {
        showDialog('Archivo importado');
        for (const warning of board.warnings) dialog.append(node('p','dialog-description',warning));
      } else toast('Tablero importado');
    } catch (error) { toast(error.message || 'No se pudo abrir el archivo'); }
  }
  function setStyle(prop,value) {
    editor.setStyle({[prop]:value});
    popover.replaceChildren(); styleMenu(); positionPopover();
  }
  function styleChoices(title,property,options,values) {
    if (!values.length) return;
    const row = node('div','width-options style-choices');
    row.setAttribute('role','group');
    row.setAttribute('aria-label',title);
    for (const [value,label] of options) {
      const btn = button('width-choice',label,() => setStyle(property,value));
      btn.setAttribute('aria-pressed',String(values.every(current => current === value)));
      row.append(btn);
    }
    popover.append(node('div','popover-title',title),row);
  }
  function styleMenu() {
    const selected = new Set(editor.getSelection());
    const elements = editor.getElements().filter(e=>selected.has(e.id));
    const el = elements[0];
    const style = {...editor.getStyle(),...el};
    const targets = el ? elements : [{...style,type:editor.getTool()}];
    const drawable = targets.filter(target => !['text','eraser','hand'].includes(target.type));
    const textTargets = targets.filter(target => ['text','note','rect','diamond','ellipse'].includes(target.type));
    const palette = [['#343431','Grafito'],['#d76d54','Coral'],['#46765e','Bosque'],['#725a9e','Violeta'],['#386e94','Azul']];
    const fills = [['none','Sin relleno'],['#fbd9c6','Durazno'],['#d8e8d4','Salvia'],['#e5dcf6','Lavanda'],['#f8e8ae','Arena']];
    for (const [prop,label,colors] of [['stroke','Trazo',palette],['fill','Relleno',fills]]) {
      const row = node('div','swatches');
      for (const [color,name] of colors) {
        const btn = button('swatch','',()=>setStyle(prop,color));
        btn.style.background = color === 'none' ? 'linear-gradient(135deg,#fff 47%,#bd806e 48% 52%,#fff 53%)' : color;
        btn.title = name; btn.setAttribute('aria-label',label + ' ' + name);
        const match = (style[prop] || 'none').toLowerCase() === color;
        btn.classList.toggle('selected',match); btn.setAttribute('aria-pressed',String(match));
        row.append(btn);
      }
      popover.append(node('div','popover-title',label),row);
    }
    popover.append(node('div','popover-title','Grosor de línea'));
    const row = node('div','width-options');
    for (const width of [1,2,4,6]) {
      const btn = button('width-choice','',()=>setStyle('width',width));
      btn.title = width+' px'; btn.setAttribute('aria-label','Grosor de '+width+' píxeles');
      const activeWidth = width===style.width; btn.setAttribute('aria-pressed',String(activeWidth));
      const sample = node('span'); sample.style.height = width+'px'; btn.append(sample); row.append(btn);
    }
    popover.append(row);
    styleChoices('Tipo de línea','dash',[['solid','Continua'],['dashed','Discontinua']],drawable.map(target => target.dash || 'solid'));
    styleChoices('Opacidad','opacity',[[1,'100%'],[.75,'75%'],[.5,'50%'],[.25,'25%']],targets.map(target => target.opacity ?? 1));
    styleChoices('Alineación de texto','align',[['left','Izquierda'],['center','Centro'],['right','Derecha']],textTargets.map(scene.textAlignment));
    if (textTargets.length) {
      popover.append(node('div','popover-title','Tamaño de texto'));
      const sizes = node('div','width-options');
      for (const size of [16,24,32,48]) {
        const btn = button('width-choice',String(size),()=>setStyle('fontSize',size));
        btn.setAttribute('aria-label','Texto de '+size+' píxeles');
        btn.setAttribute('aria-pressed',String(style.fontSize===size));
        sizes.append(btn);
      }
      popover.append(sizes);
    }
    if (el) {
      popover.append(node('hr','menu-separator'),item('copy','Duplicar',()=>{editor.duplicate();closePopover();},'Ctrl D'),
        item('up','Subir una capa',()=>{editor.bringForward();closePopover();}),item('down','Bajar una capa',()=>{editor.sendBackward();closePopover();}),
        item('delete','Eliminar',()=>{editor.removeSelected();closePopover();},'Supr'));
    }
  }
  function helpDialog() {
    showDialog('Atajos de teclado');
    const list = node('div','help-grid');
    const entries = [...Object.entries(shortcuts).map(([key,tool])=>[labels[tool],key.toUpperCase()]),
      ['Mover el lienzo','Espacio + arrastrar'],['Deshacer','Ctrl / ⌘ + Z'],['Rehacer','Ctrl / ⌘ + Shift + Z'],
      ['Ajustar a pantalla','Shift + 1'],['Editar texto','Doble clic'],['Salto de línea','Shift + Enter'],
      ['Copiar','Ctrl / ⌘ + C'],['Cortar','Ctrl / ⌘ + X'],['Pegar','Ctrl / ⌘ + V'],
      ['Duplicar la selección','Ctrl / ⌘ + D'],['Seleccionar todo','Ctrl / ⌘ + A'],['Eliminar la selección','Supr'],
      ['Mover la selección 1 px','Flechas'],['Mover la selección 10 px','Shift + flechas'],
      ['Dibujar una figura proporcionada o una línea a 45°','Shift + arrastrar'],
      ['Descargar el tablero editable','Ctrl / ⌘ + S'],['Abrir un archivo','Ctrl / ⌘ + O']];
    for (const [label,key] of entries) { const row=node('div','help-row'); row.append(node('span','',label),node('kbd','',key)); list.append(row); }
    dialog.append(list);
  }
  function toggleGrid() {
    grid=!grid; $('stage').classList.toggle('grid-off',!grid);
    $('grid-button').setAttribute('aria-pressed',String(grid));
    try { localStorage.setItem('freedraw.grid',grid ? 'on':'off'); } catch { /* View preference is optional. */ }
  }
  editor = window.createEditor({svg,group:$('objects'),overlay:$('selection'),onChange:save,onSelection:refreshControls,onView:viewChanged,onEditText:editText,onTool:toolChanged});
  editor.setStyle({stroke:'#343431', fill:'none', width:2, fontSize:24});
  for (const btn of document.querySelectorAll('button[data-tool]')) btn.addEventListener('click',()=>{closePopover();editor.setTool(btn.dataset.tool);svg.focus();});
  $('undo').onclick=()=>editor.undo(); $('redo').onclick=()=>editor.redo();
  $('zoom-in').onclick=()=>editor.setZoom(editor.getView().zoom*1.25);
  $('zoom-out').onclick=()=>editor.setZoom(editor.getView().zoom/1.25);
  $('zoom-value').onclick=()=>editor.setZoom(1); $('fit').onclick=()=>editor.fit();
  $('board-menu').onclick=()=>showPopover($('board-menu'),boardMenu);
  $('style-button').onclick=()=>showPopover($('style-button'),styleMenu);
  $('grid-button').onclick=toggleGrid; $('library-button').onclick=templateDialog;
  $('export-button').onclick=exportDialog; $('help').onclick=helpDialog;
  $('import-file').onchange=e=>{ const file=e.target.files[0]; e.target.value=''; importFile(file); };
  $('stage').addEventListener('dragover',e=>{ if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  $('stage').addEventListener('drop',e=>{ if(e.dataTransfer.files.length){e.preventDefault(); importFile(e.dataTransfer.files[0]);} });
  document.addEventListener('pointerdown',e=>{if(anchor && !popover.contains(e.target) && !anchor.contains(e.target))closePopover();},true);
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)dialog.close();}});
  window.addEventListener('resize',()=>{positionPopover();if(editId)placeTextEditor();});
  document.addEventListener('keydown',e=>{
    if (dialog.open || e.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
    const key=e.key.toLowerCase(), mod=e.ctrlKey || e.metaKey;
    if (mod && ['s','o'].includes(key)) { e.preventDefault(); if(key==='s')download('JSON');else $('import-file').click();return; }
    if (mod || e.altKey) return;
    if (key==='escape') { closePopover(); return; }
    if (key==='?') {e.preventDefault();helpDialog();return;}
    if (e.shiftKey && e.code==='Digit1') {e.preventDefault();editor.fit();return;}
    if (key==='+' || key==='=' || key==='-') {e.preventDefault();editor.setZoom(editor.getView().zoom*(key==='-'?.8:1.25));return;}
    if (shortcuts[key]) {e.preventDefault();closePopover();editor.setTool(shortcuts[key]);}
  });
  function init() {
    let last; try {last=localStorage.getItem(activeKey);if(localStorage.getItem('freedraw.grid')==='off') toggleGrid();} catch {storageWorks=false;}
    const boards=listBoards();
    openBoard(boards.find(b=>b.id===last) || boards[0] || freshBoard('Mapa de producto',scene.createExample()));
    toolChanged('select'); refreshControls();
  }
  function acceptIncoming(id,raw) {
    let board;
    if (raw !== null) {
      try { board = JSON.parse(raw); } catch { return; }
      if (board?.id !== id || !Array.isArray(board.elements)) return;
    }
    incomingVersions.delete(id);
    localEdits.delete(id);
    if (board) {
      storedVersions.set(id,raw);
      memory.set(id,board);
    } else {
      storedVersions.delete(id);
      memory.delete(id);
    }
    if (active?.id !== id) return;
    $('conflict-notice')?.remove();
    if (!board) {
      openBoard(listBoards()[0] || freshBoard('Tablero sin título'));
      return;
    }
    active = board;
    loading = true;
    const view = editor.getView();
    editor.load(board.elements);
    editor.setView(view);
    loading = false;
    $('board-title').textContent = board.title;
    document.title = board.title + ' · FreeDraw';
    saveStatus(true);
  }
  window.addEventListener('storage',event=>{
    if (!event.key?.startsWith(prefix)) return;
    const id = event.key.slice(prefix.length);
    if (event.newValue === storedVersions.get(id)) return;
    const editing = active?.id === id && (editId || JSON.stringify(editor.getElements()) !== JSON.stringify(active.elements));
    if (localEdits.has(id) || editing || incomingVersions.has(id)) {
      incomingVersions.set(id,event.newValue);
      if (active?.id === id) warnConflict();
    } else {
      acceptIncoming(id,event.newValue);
    }
  });
  init();
})();
