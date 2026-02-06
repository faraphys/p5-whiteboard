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

  saveNow(){
    const S = WB.state;
    try{
      const payload = {
        version: "split_v1",
        page: WB.storage.pageId(),

        // keep it generic: store everything your app already stores
        state: S
      };
      localStorage.setItem(WB.storage.key(), JSON.stringify(payload));
    } catch(e) {}
  },

  loadNow(){
    try{
      const raw = localStorage.getItem(WB.storage.key());
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || data.version !== "split_v1" || !data.state) return;

      // merge onto existing WB.state to avoid missing defaults
      WB.state = Object.assign(WB.state, data.state);
    } catch(e) {}
  }
};
