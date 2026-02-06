window.WB = window.WB || {};

WB.storage = {
  isEmbedded(){
    try { return window.top !== window.self; } catch(_) { return true; }
  },

  hashStr(str){
    let h = 5381;
    for (let i = 0; i < str.length; i++){
      h = ((h << 5) + h) ^ str.charCodeAt(i);
    }
    return (h >>> 0).toString(36);
  },

  explicitPageId(){
    const params = new URLSearchParams(location.search);
    const q = params.get("page") || params.get("p");
    if (q) return q;
    if (location.hash && location.hash.length > 1) return location.hash.slice(1);
    return "";
  },

  referrerPageId(){
    if (!WB.storage.isEmbedded()) return "";
    const ref = (document.referrer || "").trim();
    if (!ref) return "";
    return "ref_" + WB.storage.hashStr(ref);
  },

  baseKeyPrefix(){
    // bump version so we don't collide with older experiments
    return `p5_whiteboard_split_v3::${location.origin}${location.pathname}`;
  },

  keyForPageId(pid){
    return `${WB.storage.baseKeyPrefix()}::page=${pid}`;
  },

  // The pageId we *prefer* for UI/logging
  pageId(){
    return WB.storage.explicitPageId() || WB.storage.referrerPageId() || "default";
  },

  // All candidate page IDs we should save/load under
  candidatePageIds(){
    const a = [];
    const exp = WB.storage.explicitPageId();
    const ref = WB.storage.referrerPageId();
    if (exp) a.push(exp);
    if (ref && ref !== exp) a.push(ref);
    if (!a.length) a.push("default");
    return a;
  },

  // Backward compatibility: your old split_v1 key (if present)
  legacyKeySplitV1(){
    const pid = WB.storage.pageId();
    const base = `p5_whiteboard_split_v1::${location.origin}${location.pathname}`;
    return `${base}::page=${pid}`;
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
        version: "split_v3",
        page: WB.storage.pageId(),
        state: S
      };

      // Save under all plausible keys so slides.com URL changes won't lose it
      for (const pid of WB.storage.candidatePageIds()){
        localStorage.setItem(WB.storage.keyForPageId(pid), JSON.stringify(payload));
      }
    } catch(e) {
      // ignore (some embedded contexts can block storage)
      // console.warn("saveNow failed", e);
    }
  },

  loadNow(){
    try{
      // Try new keys first
      for (const pid of WB.storage.candidatePageIds()){
        const raw = localStorage.getItem(WB.storage.keyForPageId(pid));
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (!data || !data.state) continue;
        WB.state = Object.assign(WB.state, data.state);
        return;
      }

      // Fallback: legacy split_v1 key (older versions)
      const legacy = localStorage.getItem(WB.storage.legacyKeySplitV1());
      if (legacy){
        const data = JSON.parse(legacy);
        if (data && data.state){
          WB.state = Object.assign(WB.state, data.state);
          return;
        }
      }
    } catch(e) {
      // ignore
    }
  }
};
