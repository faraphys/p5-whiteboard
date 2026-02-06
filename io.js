window.WB = window.WB || {};

WB.io = {
  // ---------- helpers ----------
  _suggestFileName(){
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    return `whiteboard_${stamp}.wb.json`;
  },

  _collectState(){
    const S = WB.state;

    // IMPORTANT: strip p5 Graphics objects (pg) + any DOM refs
    const layers = (S.layers || []).map((L, i) => ({
      visible: !!L.visible,
      actions: Array.isArray(L.actions) ? L.actions : []
    }));

    const out = {
      version: 1,
      meta: {
        created: new Date().toISOString(),
        pageId: (WB.storage?.pageId && WB.storage.pageId()) || null
      },
      settings: {
        bgMode: S.bgMode,
        darkMode: !!S.darkMode,
        snapToGrid: !!S.snapToGrid,
        activeLayer: S.activeLayer,
        currentColor: S.currentColor,
        strokeWidth: S.strokeWidth,
        smoothing: S.smoothing,
        transp: S.transp,
        defaultTextSize: S.defaultTextSize
      },
      layers
    };

    return out;
  },

  _applyState(data){
    const S = WB.state;

    // settings
    if (data?.settings){
      const st = data.settings;
      if (typeof st.bgMode === "string") S.bgMode = st.bgMode;
      if (typeof st.darkMode === "boolean") S.darkMode = st.darkMode;
      if (typeof st.snapToGrid === "boolean") S.snapToGrid = st.snapToGrid;
      if (typeof st.activeLayer === "number") S.activeLayer = st.activeLayer;

      if (typeof st.currentColor === "string") S.currentColor = st.currentColor;
      if (typeof st.strokeWidth === "number") S.strokeWidth = st.strokeWidth;
      if (typeof st.smoothing === "number") S.smoothing = st.smoothing;
      if (typeof st.transp === "number") S.transp = st.transp;
      if (typeof st.defaultTextSize === "number") S.defaultTextSize = st.defaultTextSize;
    }

    // layers/actions
    if (Array.isArray(data?.layers) && S.layers && S.layers.length){
      for (let i=0;i<Math.min(3,data.layers.length);i++){
        S.layers[i].visible = !!data.layers[i].visible;
        S.layers[i].actions = Array.isArray(data.layers[i].actions) ? data.layers[i].actions : [];
      }
      // if fewer layers provided, clear the rest
      for (let i=data.layers.length;i<3;i++){
        if (S.layers[i]){
          S.layers[i].visible = true;
          S.layers[i].actions = [];
        }
      }
    }

    // update UI
    try{
      document.body.classList.toggle("dark", !!S.darkMode);
      if (S.ui?.glyphDark) S.ui.glyphDark.textContent = S.darkMode ? "🔆" : "🌙";
      if (S.ui?.snap) S.ui.snap.checked = !!S.snapToGrid;
      if (S.ui?.bgMode) S.ui.bgMode.value = S.bgMode;
      if (S.ui?.colorChip) S.ui.colorChip.style.background = S.currentColor;

      if (S.ui?.strokeWidth) S.ui.strokeWidth.value = String(S.strokeWidth);
      if (S.ui?.smoothing)   S.ui.smoothing.value   = String(S.smoothing);
      if (S.ui?.transp)      S.ui.transp.value      = String(S.transp);

      WB.ui?.updateWidthLabel?.();
      WB.ui?.updateSmoothLabel?.();
      WB.ui?.updateTranspLabel?.();
      WB.ui?.updateLayersLabel?.();
      WB.ui?.rebuildLayersMenu?.();
      WB.ui?.refreshToolButtons?.();
    }catch(_){}

    // rebuild buffers
    try{
      WB.lasso?.clearSelection?.();
      WB.drawing?.rebuildAllBuffers?.();
      WB.text?.rebuildTextOverlay?.();
      WB.storage?.scheduleSave?.();
    }catch(_){}
  },

  _downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  },

  _showJsonModal(jsonText){
    // simple modal with textarea + copy
    let wrap = document.getElementById("wbJsonModal");
    if (!wrap){
      wrap = document.createElement("div");
      wrap.id = "wbJsonModal";
      wrap.style.cssText = `
        position:fixed; inset:0; z-index:999999;
        background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center;
        padding:16px;
      `;
      wrap.innerHTML = `
        <div style="
          width:min(900px, 96vw); height:min(80vh, 700px);
          background:#fff; border-radius:14px; box-shadow:0 10px 40px rgba(0,0,0,.35);
          display:flex; flex-direction:column; overflow:hidden;">
          <div style="padding:10px 12px; display:flex; gap:8px; align-items:center; border-bottom:1px solid rgba(0,0,0,.12);">
            <div style="font:600 14px system-ui, sans-serif; flex:1;">Copy JSON (embedded-safe)</div>
            <button id="wbJsonCopy" style="padding:6px 10px; border-radius:10px; border:1px solid rgba(0,0,0,.18); background:#f3f3f3; cursor:pointer;">Copy</button>
            <button id="wbJsonClose" style="padding:6px 10px; border-radius:10px; border:1px solid rgba(0,0,0,.18); background:#f3f3f3; cursor:pointer;">Close</button>
          </div>
          <textarea id="wbJsonTA" spellcheck="false" style="
            flex:1; width:100%; border:0; outline:none; resize:none;
            padding:12px; font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;"></textarea>
          <div style="padding:10px 12px; font:12px/1.3 system-ui, sans-serif; color:#333; border-top:1px solid rgba(0,0,0,.12);">
            Tip: Save this text as <code>something.wb.json</code>. You can open it later with “Open”.
          </div>
        </div>
      `;
      document.body.appendChild(wrap);

      wrap.addEventListener("pointerdown",(ev)=>{
        if (ev.target === wrap) wrap.style.display="none";
      });

      wrap.querySelector("#wbJsonClose").addEventListener("click",()=>wrap.style.display="none");
      wrap.querySelector("#wbJsonCopy").addEventListener("click", async ()=>{
        const ta = wrap.querySelector("#wbJsonTA");
        ta.select();
        try{
          await navigator.clipboard.writeText(ta.value);
          WB.ui?.toast?.("JSON copied");
        }catch(e){
          document.execCommand("copy");
          WB.ui?.toast?.("Copied (fallback)");
        }
      });
    }

    wrap.style.display="flex";
    const ta = wrap.querySelector("#wbJsonTA");
    ta.value = jsonText;
    setTimeout(()=>{ ta.focus(); ta.setSelectionRange(0,0); }, 0);
  },

  // ---------- public API ----------
  async saveAsJson(){
    const data = WB.io._collectState();
    const json = JSON.stringify(data, null, 2);
    const filename = WB.io._suggestFileName();

    // 1) Best: File System Access API (standalone Chromium)
    if (window.showSaveFilePicker){
      try{
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "Whiteboard JSON", accept: { "application/json": [".json", ".wb.json"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return;
      }catch(e){
        // user cancelled or blocked → fall through
      }
    }

    // 2) Classic download link (may be blocked in iframe)
    try{
      const blob = new Blob([json], {type:"application/json"});
      WB.io._downloadBlob(blob, filename);
      return;
    }catch(e){
      // blocked → fall through
    }

    // 3) Embedded-safe fallback: show modal + copy
    WB.io._showJsonModal(json);
  },

  async openJsonFromFile(file){
    const text = await file.text();
    let data=null;
    try{
      data = JSON.parse(text);
    }catch(e){
      throw new Error("Invalid JSON file.");
    }
    WB.io._applyState(data);
  }
};
