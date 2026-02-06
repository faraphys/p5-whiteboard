window.WB = window.WB || {};

WB.storage = {
  hasExplicitPage(){
    const params = new URLSearchParams(location.search);
    if (params.has("page") || params.has("p")) return true;
    if (location.hash && location.hash.length > 1) return true;
    return false;
  },

  pageId(){
    const params = new URLSearchParams(location.search);
    return params.get("page") || params.get("p") || (location.hash ? location.hash.slice(1) : "default");
  },

  sessionIdIfNeeded(){
    // ONLY create per-tab ID if there is NO explicit page id
    if (WB.storage.hasExplicitPage()) return null;

    let sid = sessionStorage.getItem("wb_session_id");
    if (!sid){
      sid = String(Date.now()) + "_" + Math.random().toString(16).slice(2);
      sessionStorage.setItem("wb_session_id", sid);
    }
    return sid;
  },

  key(){
    const base = `p5_whiteboard_split_v2::${location.origin}${location.pathname}`;
    const pid  = `page=${WB.storage.pageId()}`;
    const sid  = WB.storage.sessionIdIfNeeded();
    return sid ? `${base}::${sid}::${pid}` : `${base}::${pid}`;
  },

  _timer: null,

  scheduleSave(){
    if (WB.storage._timer) clearTimeout(WB.storage._timer);
    WB.storage._timer = setTimeout(() => WB.storage.saveNow(), 180);
  },

  // ---- only keep SAFE, serializable state ----
  serialize(){
    const S = WB.state;

    const safeLayers = (S.layers || []).map(L => ({
      visible: (typeof L.visible === "boolean") ? L.visible : true,
      actions: Array.isArray(L.actions) ? L.actions : []
      // IMPORTANT: do NOT store L.pg (p5.Graphics)
    }));

    const safeUndo = Array.isArray(S.undoStack)
      ? S.undoStack.map(st => Array.isArray(st) ? st.slice(-WB.CONFIG.UNDO_LIMIT) : [])
      : Array.from({ length: 3 }, () => []);

    // Only persist the settings that should survive slide navigation / reload
    return {
      version: "split_v2",
      page: WB.storage.pageId(),

      tool: S.tool || "pointer",

      strokeWidth: S.strokeWidth ?? 2,
      smoothing: S.smoothing ?? 2,
      transp: S.transp ?? 1,
      currentColor: S.currentColor || (WB.CONFIG.COLORS && WB.CONFIG.COLORS[0]) || "#000000",

      snapToGrid: !!S.snapToGrid,
      bgMode: S.bgMode || "transparent",

      collapseState: S.collapseState || "partial",
      darkMode: !!S.darkMode,

      activeLayer: (typeof S.activeLayer === "number") ? S.activeLayer : 0,

      // tool-memory that should persist
      laserInitialized: !!S.laserInitialized,
      highlighterInitialized: !!S.highlighterInitialized,
      highlighterWidth: S.highlighterWidth ?? 20,
      highlighterTransp: S.highlighterTransp ?? 7,
      defaultTextSize: S.defaultTextSize ?? 20,

      penState: (S.penState && typeof S.penState === "object")
        ? {
            color: S.penState.color || S.currentColor,
            width: S.penState.width ?? S.strokeWidth,
            transp: S.penState.transp ?? S.transp,
            smoothing: S.penState.smoothing ?? S.smoothing
          }
        : null,

      layers: safeLayers,
      undoStack: safeUndo
    };
  },

  apply(data){
    const S = WB.state;
    if (!data || !data.layers) return;

    // merge simple fields (keep runtime-only fields intact)
    const fields = [
      "tool","strokeWidth","smoothing","transp","currentColor",
      "snapToGrid","bgMode","collapseState","darkMode","activeLayer",
      "laserInitialized","highlighterInitialized","highlighterWidth","highlighterTransp",
      "defaultTextSize","penState"
    ];
    for (const k of fields){
      if (typeof data[k] !== "undefined") S[k] = data[k];
    }

    // layers: only actions+visible (pg will be recreated in drawing.setupP5)
    if (Array.isArray(S.layers) && S.layers.length){
      for (let i=0;i<S.layers.length;i++){
        const src = data.layers[i];
        if (!src) continue;
        S.layers[i].visible = (typeof src.visible === "boolean") ? src.visible : true;
        S.layers[i].actions = Array.isArray(src.actions) ? src.actions : [];
      }
    } else {
      // if layers not yet created, store into a temp slot for later
      S._loadedLayers = data.layers;
    }

    // undo stacks
    if (Array.isArray(data.undoStack)){
      S.undoStack = data.undoStack.map(st => Array.isArray(st) ? st : []);
    }
  },

  // Call this after drawing.setupP5() if you load before layers exist
  applyLoadedLayersIfAny(){
    const S = WB.state;
    if (!S._loadedLayers) return;
    const layers = S._loadedLayers;
    delete S._loadedLayers;

    for (let i=0;i<S.layers.length;i++){
      const src = layers[i];
      if (!src) continue;
      S.layers[i].visible = (typeof src.visible === "boolean") ? src.visible : true;
      S.layers[i].actions = Array.isArray(src.actions) ? src.actions : [];
    }
  },

  saveNow(){
    try{
      const payload = WB.storage.serialize();
      localStorage.setItem(WB.storage.key(), JSON.stringify(payload));
    } catch(e){
      // don’t spam alerts; just log for debugging
      console.error("WB.storage.saveNow failed:", e);
    }
  },

  loadNow(){
    try{
      const raw = localStorage.getItem(WB.storage.key());
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || (data.version !== "split_v2" && data.version !== "split_v1")) return;

      // accept split_v1 by treating it as "maybe had too much" — but we only read what we need
      // If v1 had `state`, extract from it.
      const normalized = (data.version === "split_v1" && data.state) ? data.state : data;

      // v1 stored everything => pick out only safe parts
      const safe = {
        version: "split_v2",
        page: data.page || WB.storage.pageId(),

        tool: normalized.tool,
        strokeWidth: normalized.strokeWidth,
        smoothing: normalized.smoothing,
        transp: normalized.transp,
        currentColor: normalized.currentColor,

        snapToGrid: normalized.snapToGrid,
        bgMode: normalized.bgMode,

        collapseState: normalized.collapseState,
        darkMode: normalized.darkMode,

        activeLayer: normalized.activeLayer,

        laserInitialized: normalized.laserInitialized,
        highlighterInitialized: normalized.highlighterInitialized,
        highlighterWidth: normalized.highlighterWidth,
        highlighterTransp: normalized.highlighterTransp,
        defaultTextSize: normalized.defaultTextSize,
        penState: normalized.penState,

        layers: Array.isArray(normalized.layers)
          ? normalized.layers.map(L => ({ visible: !!L.visible, actions: Array.isArray(L.actions)?L.actions:[] }))
          : [],
        undoStack: Array.isArray(normalized.undoStack) ? normalized.undoStack : Array.from({ length: 3 }, () => [])
      };

      WB.storage.apply(safe);
    } catch(e){
      console.error("WB.storage.loadNow failed:", e);
    }
  }
};
