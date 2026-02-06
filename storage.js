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
    const base = `p5_whiteboard_split_v1::${location.origin}${location.pathname}`;
    const pid  = `page=${WB.storage.pageId()}`;
    const sid  = WB.storage.sessionIdIfNeeded();
    return sid ? `${base}::${sid}::${pid}` : `${base}::${pid}`;
  },

  _timer: null,
  _loadedSnapshot: null,

  scheduleSave(){
    if (WB.storage._timer) clearTimeout(WB.storage._timer);
    WB.storage._timer = setTimeout(() => WB.storage.saveNow(), 180);
  },

  // ---- serialize only JSON-safe snapshot ----
  _makeSnapshot(){
    const S = WB.state;

    const safeLayers = (S.layers || []).map(L => ({
      visible: !!L.visible,
      actions: Array.isArray(L.actions) ? L.actions : []
    }));

    return {
      version: "split_v1",
      page: WB.storage.pageId(),
      t: Date.now(),

      // UI/interaction-independent settings (keep minimal & JSON-safe)
      settings: {
        tool: S.tool || "pointer",
        strokeWidth: S.strokeWidth ?? 2,
        smoothing: S.smoothing ?? 2,
        transp: S.transp ?? 1,
        currentColor: S.currentColor || (WB.CONFIG?.COLORS?.[0] || "#000000"),

        snapToGrid: !!S.snapToGrid,
        bgMode: S.bgMode || "transparent",

        collapseState: S.collapseState || "partial",
        darkMode: !!S.darkMode,

        activeLayer: S.activeLayer ?? 0,

        // memory features
        penState: S.penState || null,
        highlighterInitialized: !!S.highlighterInitialized,
        highlighterWidth: S.highlighterWidth ?? 20,
        highlighterTransp: S.highlighterTransp ?? 7,
        laserInitialized: !!S.laserInitialized
      },

      layers: safeLayers
    };
  },

  saveNow(){
    try{
      const snap = WB.storage._makeSnapshot();
      localStorage.setItem(WB.storage.key(), JSON.stringify(snap));
    } catch(e){
      // If this happens, you WANT to see it during dev:
      console.warn("[storage] saveNow failed:", e);
    }
  },

  // load JSON-safe snapshot into memory; applying to p5 layers happens after setupP5()
  loadNow(){
    try{
      const raw = localStorage.getItem(WB.storage.key());
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || data.version !== "split_v1") return;

      WB.storage._loadedSnapshot = data;

      // Apply settings immediately (these are JSON-safe)
      const S = WB.state;
      const st = data.settings || {};

      S.tool = st.tool ?? S.tool;

      S.strokeWidth = st.strokeWidth ?? S.strokeWidth;
      S.smoothing   = st.smoothing   ?? S.smoothing;
      S.transp      = st.transp      ?? S.transp;
      S.currentColor = st.currentColor ?? S.currentColor;

      S.snapToGrid = !!st.snapToGrid;
      S.bgMode     = st.bgMode ?? S.bgMode;

      S.collapseState = st.collapseState ?? S.collapseState;
      S.darkMode      = !!st.darkMode;

      S.activeLayer = st.activeLayer ?? S.activeLayer;

      S.penState = st.penState ?? S.penState;
      S.highlighterInitialized = !!st.highlighterInitialized;
      S.highlighterWidth  = st.highlighterWidth ?? S.highlighterWidth;
      S.highlighterTransp = st.highlighterTransp ?? S.highlighterTransp;
      S.laserInitialized  = !!st.laserInitialized;
    } catch(e){
      console.warn("[storage] loadNow failed:", e);
    }
  },

  // Call this AFTER WB.drawing.setupP5() created fresh p5.Graphics layers
  applyLoadedToRuntime(){
    const snap = WB.storage._loadedSnapshot;
    if (!snap || !snap.layers) return;

    const S = WB.state;
    for (let i = 0; i < 3; i++){
      const L = S.layers[i];
      const src = snap.layers[i];
      if (!L || !src) continue;

      L.visible = !!src.visible;
      L.actions = Array.isArray(src.actions) ? src.actions : [];
    }

    // Now rebuild buffers based on restored actions
    try { WB.drawing.rebuildAllBuffers(); } catch(_) {}
    try { WB.text.rebuildTextOverlay(); } catch(_) {}
  }
};
