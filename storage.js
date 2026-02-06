window.WB = window.WB || {};

WB.storage = {
  // Are we running inside an iframe?
  isEmbedded(){
    try { return window.top !== window.self; } catch(_) { return true; }
  },

  // Simple deterministic hash -> short id (for referrer-based page ids)
  hashStr(str){
    // djb2-ish
    let h = 5381;
    for (let i = 0; i < str.length; i++){
      h = ((h << 5) + h) ^ str.charCodeAt(i);
    }
    // unsigned + base36
    return (h >>> 0).toString(36);
  },

  hasExplicitPage(){
    const params = new URLSearchParams(location.search);
    if (params.has("page") || params.has("p")) return true;
    if (location.hash && location.hash.length > 1) return true;
    return false;
  },

  // IMPORTANT: pageId must be STABLE across iframe re-creation (slides.com navigation).
  pageId(){
    const params = new URLSearchParams(location.search);
    const explicit = params.get("page") || params.get("p") || (location.hash ? location.hash.slice(1) : "");
    if (explicit) return explicit;

    // If embedded (slides.com), use referrer as a stable per-slide seed.
    // Typically referrer encodes deck + slide location, and stays constant for the embedded instance.
    if (WB.storage.isEmbedded()){
      const ref = (document.referrer || "").trim();
      if (ref) return "ref_" + WB.storage.hashStr(ref);
    }

    return "default";
  },

  key(){
    // Keep key stable per hosted path + derived pageId
    const base = `p5_whiteboard_split_v2::${location.origin}${location.pathname}`;
    const pid  = `page=${WB.storage.pageId()}`;
    return `${base}::${pid}`;
  },

  _timer: null,

  scheduleSave(){
    if (WB.storage._timer) clearTimeout(WB.storage._timer);
    WB.storage._timer = setTimeout(() => WB.storage.saveNow(), 180);
  },

  saveNow(){
    const S = WB.state;
    try{
      const payload = {
        version: "split_v2",
        page: WB.storage.pageId(),
        state: S
      };
      localStorage.setItem(WB.storage.key(), JSON.stringify(payload));
    } catch(e) {
      // ignore (can fail in some embedded contexts)
    }
  },

  loadNow(){
    try{
      const raw = localStorage.getItem(WB.storage.key());
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || (data.version !== "split_v1" && data.version !== "split_v2") || !data.state) return;

      // Merge onto existing WB.state to keep defaults + existing object refs alive
      WB.state = Object.assign(WB.state, data.state);
    } catch(e) {
      // ignore
    }
  }
};
