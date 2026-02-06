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

  scheduleSave(){
    if (WB.storage._timer) clearTimeout(WB.storage._timer);
    WB.storage._timer = setTimeout(() => WB.storage.saveNow(), 180);
  },

  // ✅ Extract ONLY serializable parts (never store pg/ui/etc.)
  _buildSerializablePayload(){
    const S = WB.state;

    const safeState = {
      // drawing/tool prefs
      tool: S.tool,
      strokeWidth: S.strokeWidth,
      smoothing: S.smoothing,
      transp: S.transp,
      currentColor: S.currentColor,

      snapToGrid: S.snapToGrid,
      bgMode: S.bgMode,

      collapseState: S.collapseState,
      darkMode: S.darkMode,

      activeLayer: S.activeLayer,

      // laser + memories
      laserInitialized: S.laserInitialized,
      penState: S.penState,
      highlighterInitialized: S.highlighterInitialized,
      highlighterWidth: S.highlighterWidth,
      highlighterTransp: S.highlighterTransp,

      // text defaults
      defaultTextSize: S.defaultTextSize
    };

    // Layers: store only actions + visibility
    const layersData = (S.layers || []).map(L => ({
      visible: (typeof L.visible === "boolean") ? L.visible : true,
      actions: Array.isArray(L.actions) ? L.actions : []
    }));

    return {
      version: "split_v1",
      page: WB.storage.pageId(),
      ts: Date.now(),
      state: safeState,
      layers: layersData
    };
  },

  saveNow(){
    try{
      const payload = WB.storage._buildSerializablePayload();
      localStorage.setItem(WB.storage.key(), JSON.stringify(payload));
    } catch(e){
      // keep silent, but at least log in dev
      console.warn("[storage] saveNow failed:", e);
    }
  },

  loadNow(){
    try{
      const raw = localStorage.getItem(WB.storage.key());
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || data.version !== "split_v1") return;

      // ✅ Merge safe state fields onto existing defaults
      if (data.state && typeof data.state === "object"){
        Object.assign(WB.state, data.state);
      }

      // ✅ Do NOT overwrite runtime layers/pg; just stash layer data for later apply
      if (Array.isArray(data.layers)){
        WB.state._loadedLayersData = data.layers;
      }
    } catch(e){
      console.warn("[storage] loadNow failed:", e);
    }
  },

  // ✅ Call AFTER setupP5() created the p5.Graphics layers
  applyLoadedLayersIfAny(){
    const S = WB.state;
    const data = S._loadedLayersData;
    if (!Array.isArray(data) || !Array.isArray(S.layers) || !S.layers.length) return;

    for (let i=0; i<Math.min(S.layers.length, data.length); i++){
      const L = S.layers[i];
      const d = data[i] || {};
      L.visible = (typeof d.visible === "boolean") ? d.visible : true;
      L.actions = Array.isArray(d.actions) ? d.actions : [];
    }

    // cleanup
    delete S._loadedLayersData;
  }
};
