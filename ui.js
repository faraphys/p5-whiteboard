window.WB = window.WB || {};

WB.ui = {
  // Ensure WB.state exists even if ui.js runs before state.js (iframe / Slides quirks)
  ensureState(){
    WB.state = WB.state || {};

    const S = WB.state;

    // Minimal defaults only (do NOT try to fully mirror state.js, just what ui needs)
    if (typeof S.tool !== "string") S.tool = "pointer";

    if (typeof S.strokeWidth !== "number") S.strokeWidth = 2;
    if (typeof S.smoothing !== "number") S.smoothing = 2;
    if (typeof S.transp !== "number") S.transp = 1;

    // Fallback color list if config not ready yet
    const firstColor =
      (WB.CONFIG && Array.isArray(WB.CONFIG.COLORS) && WB.CONFIG.COLORS[0]) ? WB.CONFIG.COLORS[0] : "#000000";
    if (typeof S.currentColor !== "string") S.currentColor = firstColor;

    if (typeof S.snapToGrid !== "boolean") S.snapToGrid = false;
    if (typeof S.bgMode !== "string") S.bgMode = "transparent";

    if (typeof S.collapseState !== "string") S.collapseState = "partial";
    if (typeof S.darkMode !== "boolean") S.darkMode = false;

    if (!Array.isArray(S.layers)) S.layers = [];
    if (typeof S.activeLayer !== "number") S.activeLayer = 0;

    if (!S.lastPointerClient) S.lastPointerClient = { x: 0, y: 0 };

    if (typeof S.defaultTextSize !== "number") S.defaultTextSize = 20;

    // UI ref holder
    if (!S.ui || typeof S.ui !== "object") S.ui = {};

    return S;
  },

  init(){
    const S = WB.ui.ensureState();
    const U = S.ui;

    // --- DOM refs
    U.root = document.getElementById("ui");
    U.dragHandle = document.getElementById("dragHandle");
    U.btnCycle = document.getElementById("btnCycle");
    U.glyphCycle = document.getElementById("glyphCycle");
    U.btnDark = document.getElementById("btnDark");
    U.glyphDark = document.getElementById("glyphDark");
    U.btnShortcuts = document.getElementById("btnShortcuts");
    U.shortcutCard = document.getElementById("shortcutCard");

    U.toolPen = document.getElementById("toolPen");
    U.toolEraser = document.getElementById("toolEraser");
    U.toolHighlighter = document.getElementById("toolHighlighter");
    U.shapeTool = document.getElementById("shapeTool");
    U.toolFill = document.getElementById("toolFill");
    U.toolText = document.getElementById("toolText");
    U.toolLaser = document.getElementById("toolLaser");
    U.toolLasso = document.getElementById("toolLasso");

    U.colorSelect = document.getElementById("colorSelect");
    U.palette = document.getElementById("palette");
    U.paletteGrid = document.getElementById("paletteGrid");
    U.colorChip = document.getElementById("colorChip");

    U.strokeWidth = document.getElementById("strokeWidth");
    U.smoothing = document.getElementById("smoothing");
    U.transp = document.getElementById("transp");
    U.bgMode = document.getElementById("bgMode");
    U.snap = document.getElementById("snap");

    U.layersSelect = document.getElementById("layersSelect");
    U.layersMenu = document.getElementById("layersMenu");
    U.layersLabel = document.getElementById("layersLabel");

    U.undo = document.getElementById("undo");
    U.clear = document.getElementById("clear");

    U.textEditor = document.getElementById("textEditor");
    U.textEditorTitle = document.getElementById("textEditorTitle");
    U.textSizeEditor = document.getElementById("textSizeEditor");
    U.textInput = document.getElementById("textInput");

    U.cursorHint = document.getElementById("cursorHint");
    U.toast = document.getElementById("toast");

    // If UI skeleton isn't present, bail safely (prevents hard crashes in embed)
    if (!U.root) return;

    // --- Shortcuts card content (no Save/Open, no Export)
    if (U.shortcutCard){
      U.shortcutCard.innerHTML = `
        <div class="title">Shortcuts</div>
        <div class="row"><span><code>Esc</code></span><span>Pointer</span></div>
        <div class="row"><span><code>P</code></span><span>Pen</span></div>
        <div class="row"><span><code>E</code></span><span>Eraser</span></div>
        <div class="row"><span><code>H</code></span><span>Highlighter</span></div>
        <div class="row"><span><code>S</code></span><span>Cycle Shapes</span></div>
        <div class="row"><span><code>G</code></span><span>Cycle Grid</span></div>
        <div class="row"><span><code>N</code></span><span>Snap on/off</span></div>
        <div class="row"><span><code>F</code></span><span>Fill</span></div>
        <div class="row"><span><code>T</code></span><span>Text</span></div>
        <div class="row"><span><code>L</code></span><span>Lasso</span></div>
        <div class="row"><span><code>R</code></span><span>Laser</span></div>
        <div class="row"><span><code>Shift</code></span><span>Align line/arrow</span></div>
        <div class="row"><span><code>Ctrl+Z</code></span><span>Undo</span></div>
        <div class="row"><span><code>Del</code></span><span>Delete selection</span></div>
        <div class="row"><span><code>1..9</code></span><span>Width</span></div>
      `;
    }

    // palette + selects
    WB.ui.buildPalette();
    WB.ui.buildSelects();

    // --- close popups on outside click
    document.addEventListener("pointerdown",(ev)=>{
      if (U.colorSelect && !U.colorSelect.contains(ev.target)) U.palette?.classList.remove("open");
      if (U.layersSelect && !U.layersSelect.contains(ev.target)) U.layersMenu?.classList.remove("open");
      U.shortcutCard?.classList.remove("open");
    }, {capture:true});

    if (U.colorSelect){
      U.colorSelect.addEventListener("pointerdown",(ev)=>{
        ev.stopPropagation();
        U.layersMenu?.classList.remove("open");
        U.shortcutCard?.classList.remove("open");
        U.palette?.classList.toggle("open");
      });
    }

    if (U.layersSelect){
      U.layersSelect.addEventListener("pointerdown",(ev)=>{
        ev.stopPropagation();
        U.palette?.classList.remove("open");
        U.shortcutCard?.classList.remove("open");
        U.layersMenu?.classList.toggle("open");
      });
    }

    // shortcuts popover
    if (U.btnShortcuts && U.shortcutCard){
      U.btnShortcuts.addEventListener("pointerdown",(ev)=>{
        ev.stopPropagation();
        U.palette?.classList.remove("open");
        U.layersMenu?.classList.remove("open");
        U.shortcutCard.classList.toggle("open");
      });
      U.shortcutCard.addEventListener("pointerdown",(ev)=>ev.stopPropagation());
    }

    // toolbar cycle
    if (U.btnCycle){
      U.btnCycle.addEventListener("click",(ev)=>{
        ev.stopPropagation();
        S.collapseState = (S.collapseState==="full") ? "partial" : (S.collapseState==="partial") ? "expanded" : "full";
        WB.ui.applyCollapse();
        WB.storage?.scheduleSave?.();
      });
    }

    // dark mode
    if (U.btnDark){
      U.btnDark.addEventListener("click",(ev)=>{
        ev.stopPropagation();
        S.darkMode = !S.darkMode;
        document.body.classList.toggle("dark", S.darkMode);
        if (U.glyphDark) U.glyphDark.textContent = S.darkMode ? "🔆" : "🌙";
        WB.storage?.scheduleSave?.();
      });
    }

    // tools
    U.toolPen?.addEventListener("click",()=> WB.drawing?.setTool?.("pen"));
    U.toolEraser?.addEventListener("click",()=> WB.drawing?.setTool?.("eraser"));
    U.toolHighlighter?.addEventListener("click",()=> WB.drawing?.setTool?.("highlighter"));
    U.toolFill?.addEventListener("click",()=> WB.drawing?.setTool?.("fill"));
    U.toolText?.addEventListener("click",()=> WB.drawing?.setTool?.("text"));
    U.toolLaser?.addEventListener("click",()=> WB.drawing?.setTool?.("laser"));
    U.toolLasso?.addEventListener("click",()=> WB.drawing?.setTool?.("lasso"));

    if (U.shapeTool){
      U.shapeTool.addEventListener("input",()=> WB.drawing?.setTool?.(U.shapeTool.value));
      U.shapeTool.addEventListener("change",()=> WB.drawing?.setTool?.(U.shapeTool.value));
    }

    if (U.bgMode){
      U.bgMode.addEventListener("change",()=>{
        S.bgMode = U.bgMode.value;
        WB.storage?.scheduleSave?.();
      });
    }

    if (U.snap){
      U.snap.addEventListener("change",()=>{
        S.snapToGrid = U.snap.checked;
        WB.storage?.scheduleSave?.();
      });
    }

    U.undo?.addEventListener("click",()=>{ WB.lasso?.clearSelection?.(); WB.drawing?.undoActiveLayer?.(); });
    U.clear?.addEventListener("click",()=> WB.drawing?.clearActiveLayerUndoable?.());

    WB.ui.initDrag();
    WB.ui.applyCollapse();
    WB.ui.refreshToolButtons();
    WB.ui.rebuildLayersMenu();
    WB.ui.updateLayersLabel();

    // start UI state
    if (U.snap) U.snap.checked = !!S.snapToGrid;
    if (U.bgMode) U.bgMode.value = S.bgMode || "transparent";
    if (U.colorChip) U.colorChip.style.background = S.currentColor || "#000000";
  },

  buildPalette(){
    const S = WB.ui.ensureState();
    const U = S.ui;
    if (!U.paletteGrid) return;

    const colors = (WB.CONFIG && Array.isArray(WB.CONFIG.COLORS)) ? WB.CONFIG.COLORS : ["#000000","#ffffff"];
    U.paletteGrid.innerHTML="";
    for(const hex of colors){
      const sw=document.createElement("div");
      sw.className="swatch";
      sw.style.background=hex;
      sw.addEventListener("pointerdown",(ev)=>{
        ev.stopPropagation();
        S.currentColor=hex;
        if (U.colorChip) U.colorChip.style.background=hex;
        U.palette?.classList.remove("open");
        WB.storage?.scheduleSave?.();
      });
      U.paletteGrid.appendChild(sw);
    }
  },

  buildSelects(){
    const S = WB.ui.ensureState();
    const U = S.ui;

    if (!U.strokeWidth || !U.smoothing || !U.transp || !U.textSizeEditor) return;

    // width mapping 1..9 aligns with shortcuts
    const widths=[1,2,3,4,5,8,10,20,30];
    U.strokeWidth.innerHTML="";
    for(const v of widths){
      const o=document.createElement("option");
      o.value=String(v);
      o.textContent = `${v} pt`;
      U.strokeWidth.appendChild(o);
    }

    U.smoothing.innerHTML="";
    for(let v=1; v<=10; v++){
      const o=document.createElement("option");
      o.value=String(v);
      o.textContent = `${v}`;
      U.smoothing.appendChild(o);
    }

    U.transp.innerHTML="";
    for(let v=1; v<=10; v++){
      const o=document.createElement("option");
      o.value=String(v);
      o.textContent = `${v}`;
      U.transp.appendChild(o);
    }

    // text sizes
    const sizes=[10,12,14,16,20,24,28,36,48,72];
    U.textSizeEditor.innerHTML="";
    for(const s of sizes){
      const o=document.createElement("option");
      o.value=String(s);
      o.textContent = `${s} pt`;
      U.textSizeEditor.appendChild(o);
    }
    U.textSizeEditor.value = String(S.defaultTextSize || 20);

    // initial values + dynamic labels
    U.strokeWidth.value = String(S.strokeWidth || 2);
    U.smoothing.value = String(S.smoothing || 2);
    U.transp.value = String(S.transp || 1);
    WB.ui.updateWidthLabel();
    WB.ui.updateSmoothLabel();
    WB.ui.updateTranspLabel();

    U.strokeWidth.addEventListener("change",()=>{
      S.strokeWidth = parseInt(U.strokeWidth.value,10);
      if(S.tool!=="eraser") S.lastNonEraserWidth = S.strokeWidth;
      WB.ui.updateWidthLabel();
      WB.storage?.scheduleSave?.();
    });

    U.smoothing.addEventListener("change",()=>{
      S.smoothing = parseInt(U.smoothing.value,10);
      WB.ui.updateSmoothLabel();
      WB.storage?.scheduleSave?.();
    });

    U.transp.addEventListener("change",()=>{
      S.transp = parseInt(U.transp.value,10);
      WB.ui.updateTranspLabel();
      WB.storage?.scheduleSave?.();
    });

    U.textSizeEditor.addEventListener("change",()=>{
      const v = parseInt(U.textSizeEditor.value,10);
      S.defaultTextSize = v;
      if (S.textDraft) S.textDraft.size = v;
      WB.storage?.scheduleSave?.();
    });
  },

  updateWidthLabel(){
    const S = WB.ui.ensureState();
    const U = S.ui;
    if (!U.strokeWidth) return;
    const opt = U.strokeWidth.options[U.strokeWidth.selectedIndex];
    if (!opt) return;
    opt.textContent = `↕ ${U.strokeWidth.value} pt`;
    for (const o of U.strokeWidth.options){
      if (o !== opt) o.textContent = `${o.value} pt`;
    }
  },

  updateSmoothLabel(){
    const S = WB.ui.ensureState();
    const U = S.ui;
    if (!U.smoothing) return;
    const opt = U.smoothing.options[U.smoothing.selectedIndex];
    if (!opt) return;
    opt.textContent = `≈ ${U.smoothing.value}/10`;
    for (const o of U.smoothing.options){
      if (o !== opt) o.textContent = `${o.value}`;
    }
  },

  updateTranspLabel(){
    const S = WB.ui.ensureState();
    const U = S.ui;
    if (!U.transp) return;
    const opt = U.transp.options[U.transp.selectedIndex];
    if (!opt) return;
    opt.textContent = `◌ ${U.transp.value}/10`;
    for (const o of U.transp.options){
      if (o !== opt) o.textContent = `${o.value}`;
    }
  },

  applyCollapse(){
    const S = WB.ui.ensureState();
    const U = S.ui;
    if (!U.root) return;
    U.root.classList.toggle("full", S.collapseState==="full");
    U.root.classList.toggle("partial", S.collapseState==="partial");
    U.root.classList.toggle("expanded", S.collapseState==="expanded");
    if (U.glyphCycle) U.glyphCycle.textContent = (S.collapseState==="expanded") ? "▴" : "▾";
    if (S.collapseState==="full"){
      U.palette?.classList.remove("open");
      U.layersMenu?.classList.remove("open");
      U.shortcutCard?.classList.remove("open");
    }
  },

  refreshToolButtons(){
    const S = WB.ui.ensureState();
    const U = S.ui;
    const set = (btn, on)=> btn && btn.classList.toggle("active", !!on);

    set(U.toolPen, S.tool==="pen");
    set(U.toolEraser, S.tool==="eraser");
    set(U.toolHighlighter, S.tool==="highlighter");
    set(U.toolFill, S.tool==="fill");
    set(U.toolText, S.tool==="text");
    set(U.toolLaser, S.tool==="laser");
    set(U.toolLasso, S.tool==="lasso");
  },

  toast(msg){
    const S = WB.ui.ensureState();
    const U = S.ui;
    if (!U.toast) return;
    U.toast.textContent = msg;
    U.toast.classList.add("show");
    setTimeout(()=>U.toast.classList.remove("show"), 900);
  },

  showCursorHint(text, ms=700){
    const S = WB.ui.ensureState();
    const U = S.ui;
    if (!U.cursorHint) return;
    U.cursorHint.textContent = text;
    U.cursorHint.style.left = (S.lastPointerClient.x + 12) + "px";
    U.cursorHint.style.top  = (S.lastPointerClient.y + 12) + "px";
    U.cursorHint.classList.add("show");
    setTimeout(()=>U.cursorHint.classList.remove("show"), ms);
  },

  initDrag(){
    const S = WB.ui.ensureState();
    const U = S.ui;
    if (!U.dragHandle || !U.root) return;

    let dragging=false, startX=0,startY=0,startLeft=0,startTop=0;

    U.dragHandle.addEventListener("pointerdown",(ev)=>{
      if (ev.target.closest("button")) return;
      dragging=true;
      U.dragHandle.setPointerCapture(ev.pointerId);
      startX=ev.clientX; startY=ev.clientY;
      const rect=U.root.getBoundingClientRect();
      startLeft=rect.left; startTop=rect.top;
      U.root.style.left=`${startLeft}px`;
      U.root.style.top=`${startTop}px`;
      U.root.style.right="auto";
    });

    U.dragHandle.addEventListener("pointermove",(ev)=>{
      if(!dragging) return;
      const dx=ev.clientX-startX, dy=ev.clientY-startY;
      const rect=U.root.getBoundingClientRect();
      const w=rect.width, h=rect.height;
      const nl=WB.utils.clamp(startLeft+dx, 8, window.innerWidth-w-8);
      const nt=WB.utils.clamp(startTop+dy, 8, window.innerHeight-h-8);
      U.root.style.left=`${nl}px`;
      U.root.style.top=`${nt}px`;
    });

    U.dragHandle.addEventListener("pointerup",()=>{ dragging=false; });
  },

  rebuildLayersMenu(){
    const S = WB.ui.ensureState();
    const U = S.ui;
    if (!U.layersMenu) return;

    U.layersMenu.innerHTML="";
    for(let i=0;i<3;i++){
      const item=document.createElement("div");
      item.className="layer-item" + (S.layers[i]?.visible ? "" : " invisible");
      item.textContent = `Layer ${i+1}` + (i===S.activeLayer ? " ✓" : "");
      item.addEventListener("pointerdown",(ev)=>{
        ev.stopPropagation();
        if (S.activeLayer !== i) S.activeLayer = i;
        else if (S.layers[i]) S.layers[i].visible = !S.layers[i].visible;

        WB.lasso?.clearSelection?.();
        WB.drawing?.rebuildAllBuffers?.();
        WB.text?.rebuildTextOverlay?.();
        WB.ui.updateLayersLabel();
        WB.ui.rebuildLayersMenu();
        U.layersMenu.classList.remove("open");
        WB.storage?.scheduleSave?.();
      });
      U.layersMenu.appendChild(item);
    }
  },

  updateLayersLabel(){
    const S = WB.ui.ensureState();
    const U = S.ui;
    if (!U.layersLabel) return;
    const vis = S.layers[S.activeLayer]?.visible ? "on" : "off";
    U.layersLabel.textContent = `🧱 Layers (${S.activeLayer+1}:${vis})`;
  },

  isPointerOverUIClient(clientX, clientY){
    const S = WB.ui.ensureState();
    const U = S.ui;
    if (!U.root) return false;
    const rect = U.root.getBoundingClientRect();
    return clientX>=rect.left && clientX<=rect.right && clientY>=rect.top && clientY<=rect.bottom;
  }
};
