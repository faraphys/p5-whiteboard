// app.js — hardened init for Slides.com + prevent "freeze after selecting Shapes"

(function(){
  // simple overlay to show errors without opening DevTools
  function showFatal(msg){
    let el = document.getElementById("wbFatal");
    if (!el){
      el = document.createElement("div");
      el.id = "wbFatal";
      el.style.cssText =
        "position:fixed;left:10px;bottom:10px;right:10px;z-index:999999;" +
        "background:rgba(0,0,0,0.8);color:#fff;padding:10px;border-radius:10px;" +
        "font:12px/1.35 system-ui, sans-serif;white-space:pre-wrap;";
      document.body.appendChild(el);
    }
    el.textContent = msg;
  }

  window.addEventListener("error", (e) => {
    showFatal("JS error:\n" + (e?.message || e) + "\n" + (e?.filename || "") + ":" + (e?.lineno || ""));
  });

  window.addEventListener("unhandledrejection", (e) => {
    showFatal("Promise rejection:\n" + (e?.reason?.message || e?.reason || e));
  });

  // Global helper: always restart draw loop if anything stops it
  window.WB = window.WB || {};
  WB.forceLoop = () => { try { loop(); } catch(_) {} };

  // Watchdog: if a module uses noLoop(), we resume periodically
  setInterval(() => { WB.forceLoop(); }, 500);

  // ============================================================
  // CRITICAL: Ensure WB.state has all containers BEFORE ui/drawing
  // Prevents: "Cannot set properties of undefined (setting '0')"
  // ============================================================
  WB.ensureStateDefaults = function ensureStateDefaults(){
    WB.state = WB.state || {};
    const S = WB.state;

    // core fields (only if missing)
    if (typeof S.tool !== "string") S.tool = "pointer";

    if (typeof S.strokeWidth !== "number") S.strokeWidth = 2;
    if (typeof S.smoothing !== "number") S.smoothing = 2;
    if (typeof S.transp !== "number") S.transp = 1;

    const firstColor =
      (WB.CONFIG && Array.isArray(WB.CONFIG.COLORS) && WB.CONFIG.COLORS[0]) ? WB.CONFIG.COLORS[0] : "#000000";
    if (typeof S.currentColor !== "string") S.currentColor = firstColor;

    if (typeof S.snapToGrid !== "boolean") S.snapToGrid = false;
    if (typeof S.bgMode !== "string") S.bgMode = "transparent";

    if (typeof S.collapseState !== "string") S.collapseState = "partial";
    if (typeof S.darkMode !== "boolean") S.darkMode = false;

    // arrays / objects that MUST exist
    if (!Array.isArray(S.layers)) S.layers = [];
    if (typeof S.activeLayer !== "number") S.activeLayer = 0;

    if (!Array.isArray(S.undoStack) || S.undoStack.length !== 3){
      S.undoStack = Array.from({ length: 3 }, () => []);
    } else {
      // ensure each stack is an array
      for (let i=0;i<3;i++){
        if (!Array.isArray(S.undoStack[i])) S.undoStack[i] = [];
      }
    }

    if (!Array.isArray(S.laserTrail)) S.laserTrail = [];
    if (typeof S.laserInitialized !== "boolean") S.laserInitialized = false;

    if (!S.penState) S.penState = null;

    if (typeof S.highlighterInitialized !== "boolean") S.highlighterInitialized = false;
    if (typeof S.highlighterWidth !== "number") S.highlighterWidth = 20;
    if (typeof S.highlighterTransp !== "number") S.highlighterTransp = 7;

    if (!S.lastPointerClient) S.lastPointerClient = { x: 0, y: 0 };

    // lasso structure
    if (!S.lasso || typeof S.lasso !== "object"){
      S.lasso = {
        points: [],
        selecting: false,
        selectedIdx: [],
        bbox: null,
        obb: null,
        mode: "idle",
        handle: null,
        moveStart: null,
        pivot: null,
        startOBB: null,
        startActionsSnapshot: null,
        liveText: null
      };
    } else {
      if (!Array.isArray(S.lasso.selectedIdx)) S.lasso.selectedIdx = [];
      if (!Array.isArray(S.lasso.points)) S.lasso.points = [];
      if (typeof S.lasso.mode !== "string") S.lasso.mode = "idle";
    }

    if (typeof S.defaultTextSize !== "number") S.defaultTextSize = 20;
    if (typeof S.textDraft === "undefined") S.textDraft = null;

    // ui ref holder
    if (!S.ui || typeof S.ui !== "object") S.ui = {};

    return S;
  };

  // ===== Keyboard focus + Delete handler (reliable in iframes) =====
  WB.installKeyboard = function installKeyboard(){
    if (WB._kbdInstalled) return;
    WB._kbdInstalled = true;

    const wrap = document.getElementById("canvas-wrap");
    if (wrap){
      wrap.tabIndex = 0;
      wrap.style.outline = "none";

      const focusWrap = () => {
        try { wrap.focus({ preventScroll: true }); }
        catch(_) { try { wrap.focus(); } catch(__) {} }
      };

      wrap.addEventListener("pointerdown", focusWrap, { passive:true });
      wrap.addEventListener("mousedown", focusWrap, { passive:true });
      wrap.addEventListener("touchstart", focusWrap, { passive:true });
    }

    window.addEventListener("keydown", (ev) => {
      const S = WB.state;
      if (!S) return;

      // Don't hijack keys if typing in input/textarea/contenteditable
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

      // Also treat WB text editor as typing mode
      const textEditorOpen = !!(S.ui?.textEditor && S.ui.textEditor.style.display !== "none");

      if (typing || textEditorOpen) return;

      // Delete/Backspace => delete lasso selection if present
      if (ev.key === "Delete" || ev.key === "Backspace"){
        const L = S.lasso;
        if (L && Array.isArray(L.selectedIdx) && L.selectedIdx.length){
          ev.preventDefault();
          ev.stopPropagation();
          try { WB.lasso.deleteSelection(); } catch(e){ console.error(e); }
          try { WB.drawing.requestRedraw?.(); } catch(_) {}
          WB.forceLoop();
          return;
        }
      }
    }, true); // capture phase is crucial inside iframes
  };

  // ---- p5 entry points ----
  window.setup = function setup(){
    // ✅ Ensure state is safe BEFORE anything else touches it
    WB.ensureStateDefaults();

    // init in your usual order
    WB.ui.init();
    WB.text.hookEditorEvents();
    WB.drawing.setupP5();

    // Load persisted state (may overwrite parts) => re-ensure containers afterwards
    WB.storage.loadNow();
    WB.ensureStateDefaults();

    WB.drawing.rebuildAllBuffers();
    WB.text.rebuildTextOverlay();

    // start with pointer tool (no tool)
    WB.drawing.setTool("pointer");
    WB.forceLoop();

    const canvasEl = document.querySelector("canvas");
    canvasEl.style.touchAction = "none";

    // ✅ install keyboard handling AFTER canvas exists
    WB.installKeyboard();

    canvasEl.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();

      // capture pointer so pointerup arrives reliably (pen/tablet)
      try { canvasEl.setPointerCapture(ev.pointerId); } catch(_) {}

      // ignore if starting on UI
      if (WB.ui?.isPointerOverUIClient && WB.ui.isPointerOverUIClient(ev.clientX, ev.clientY)) return;

      WB.ensureStateDefaults();

      WB.state.pointerDown = true;
      WB.state.activePointerId = ev.pointerId;
      WB.state.activePointerType = ev.pointerType || "mouse";
      WB.state.lastPressure = (typeof ev.pressure === "number") ? ev.pressure : 1;

      const { x, y } = WB.drawing.pointerToCanvasXY(ev);
      WB.drawing.startAction(x, y, WB.state.lastPressure, WB.state.activePointerType);

      WB.forceLoop();
    }, { passive:false });

    canvasEl.addEventListener("pointermove", (ev) => {
      if (!WB.state.pointerDown || ev.pointerId !== WB.state.activePointerId) return;
      ev.preventDefault();

      WB.state.lastPressure = (typeof ev.pressure === "number") ? ev.pressure : WB.state.lastPressure;

      const { x, y } = WB.drawing.pointerToCanvasXY(ev);
      WB.drawing.extendAction(x, y, WB.state.lastPressure, WB.state.activePointerType);

      WB.forceLoop();
    }, { passive:false });

    canvasEl.addEventListener("pointerup", (ev) => {
      if (!WB.state.pointerDown || ev.pointerId !== WB.state.activePointerId) return;
      ev.preventDefault();

      try { canvasEl.releasePointerCapture(ev.pointerId); } catch(_) {}

      WB.drawing.finishAction();

      WB.state.pointerDown = false;
      WB.state.activePointerId = null;
      WB.state.activePointerType = "mouse";
      WB.state.lastPressure = 1;

      WB.forceLoop();
    }, { passive:false });

    canvasEl.addEventListener("pointercancel", (ev) => {
      try { canvasEl.releasePointerCapture(ev.pointerId); } catch(_) {}

      // commit on cancel so it doesn't vanish
      if (WB.state.pointerDown && ev.pointerId === WB.state.activePointerId){
        try { WB.drawing.finishAction(); } catch(_) {}
      }

      WB.state.pointerDown = false;
      WB.state.activePointerId = null;
      WB.state.activePointerType = "mouse";
      WB.state.lastPressure = 1;

      WB.forceLoop();
    }, { passive:false });

    // ESC => pointer tool
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape"){
        try { WB.text.cancelTextEdit?.(); } catch(_) {}
        try { WB.lasso.clearSelection?.(); } catch(_) {}
        try { WB.drawing.setTool("pointer"); } catch(_) {}
        WB.forceLoop();
      }
    });
  };

  window.draw = function draw(){
    try{
      WB.drawing.drawFrame();
    } catch(e){
      console.error("drawFrame crashed:", e);
      showFatal("drawFrame crashed:\n" + (e?.message || e) + "\n\nOpen DevTools Console for stack trace.");
      WB.forceLoop();
    }
  };

  window.windowResized = function windowResized(){
    try { WB.drawing.windowResized(); } catch(e){ console.error(e); }
    WB.forceLoop();
  };
})();
