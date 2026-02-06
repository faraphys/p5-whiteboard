window.WB = window.WB || {};

WB.text = {
  async waitForMathJaxReady(){
    if (!window.MathJax){
      await new Promise(r=>setTimeout(r,120));
      return WB.text.waitForMathJaxReady();
    }
    if (MathJax.startup?.promise) await MathJax.startup.promise;
  },

  setTextPointerEvents(on){
    const overlay=document.getElementById("text-overlay");
    overlay.querySelectorAll(".text-box").forEach(el=>{
      el.style.pointerEvents = on ? "auto" : "none";
    });
  },

  rebuildTextOverlay(){
    const S=WB.state;
    const overlay=document.getElementById("text-overlay");
    overlay.innerHTML = "";

    for(let li=0; li<3; li++){
      if(!S.layers[li].visible) continue;
      const actions=S.layers[li].actions;

      for(let i=0;i<actions.length;i++){
        const a=actions[i];
        if(a.type!=="text") continue;

        const div=document.createElement("div");
        div.className="text-box";
        div.style.left = a.x + "px";
        div.style.top  = a.y + "px";
        div.style.fontSize = (a.size||20) + "px";
        div.textContent = a.raw;

        div.dataset.layer = String(li);
        div.dataset.index = String(i);

        div.addEventListener("pointerdown",(ev)=>{
          if (S.tool==="text"){
            ev.stopPropagation();
            WB.text.openTextEditor(a.x,a.y,a.raw,a.size,i,li);
          }
        });

        overlay.appendChild(div);
      }
    }

    (async ()=>{
      try{
        await WB.text.waitForMathJaxReady();
        if (MathJax.typesetPromise) await MathJax.typesetPromise([overlay]);

        // store bbox for lasso
        for(let li=0; li<3; li++){
          const nodes=overlay.querySelectorAll(`.text-box[data-layer="${li}"]`);
          nodes.forEach(node=>{
            const idx=parseInt(node.dataset.index,10);
            const act=WB.state.layers[li].actions[idx];
            if (act && act.type==="text"){
              act.w=node.offsetWidth;
              act.h=node.offsetHeight;
            }
          });
        }
      }catch(e){
        console.warn("MathJax typeset failed", e);
      }
    })();
  },

  openTextEditor(x,y,raw,size,actionIndex, layerIndex){
    const S=WB.state, U=S.ui;
    WB.lasso.clearSelection();

    const li = (typeof layerIndex === "number") ? layerIndex : S.activeLayer;
    const s = size || S.defaultTextSize || 20;
    S.defaultTextSize = s;
    U.textSizeEditor.value = String(s);

    S.textDraft={ layer:li, actionIndex, x,y, raw, size:s };
    U.textEditor.style.display="block";
    U.textInput.value = raw || "";

    const pad=10, ew=380, eh=180;
    const left=WB.utils.clamp(x+pad, 8, window.innerWidth-ew-8);
    const top =WB.utils.clamp(y+pad, 8, window.innerHeight-eh-8);
    U.textEditor.style.left = `${left}px`;
    U.textEditor.style.top  = `${top}px`;

    setTimeout(()=>U.textInput.focus(),0);
  },

  cancelTextEdit(){
    const S=WB.state;
    S.ui.textEditor.style.display="none";
    S.textDraft=null;
  },

  commitTextEdit(){
    const S=WB.state, U=S.ui;
    if (!S.textDraft){ U.textEditor.style.display="none"; return; }

    const raw=(U.textInput.value||"").trim();
    const L=S.layers[S.textDraft.layer];
    if (!raw){ WB.text.cancelTextEdit(); return; }

    WB.drawing.pushUndo(S.textDraft.layer);

    const action={ type:"text", x:S.textDraft.x, y:S.textDraft.y, raw, size:S.textDraft.size||S.defaultTextSize, w:null, h:null };
    if (S.textDraft.actionIndex==null) L.actions.push(action);
    else L.actions[S.textDraft.actionIndex] = action;

    WB.text.cancelTextEdit();
    WB.text.rebuildTextOverlay();
    WB.storage.scheduleSave();
  },

  hookEditorEvents(){
    const S=WB.state, U=S.ui;

    // click outside commits
    document.addEventListener("pointerdown",(ev)=>{
      if (U.textEditor.style.display==="none") return;
      if (U.textEditor.contains(ev.target)) return;
      WB.text.commitTextEdit();
    }, {capture:true});

    U.textInput.addEventListener("keydown",(ev)=>{
      if ((ev.ctrlKey||ev.metaKey) && ev.key==="Enter"){
        ev.preventDefault();
        WB.text.commitTextEdit();
      } else if (ev.key==="Escape"){
        ev.preventDefault();
        WB.text.cancelTextEdit();
        WB.drawing.setTool("pointer");
      }
    });
  }
};
