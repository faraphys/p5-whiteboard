window.WB = window.WB || {};

WB.lasso = {
  clearSelection(){
    const L=WB.state.lasso;
    L.selectedIdx=[];
    L.bbox=null;
    L.points=[];
    L.selecting=false;
    L.mode="idle";       // "idle" | "move"
    L.moveStart=null;
    L.liveText=null;
  },

  pointInBBox(x,y,bb){
    if(!bb) return false;
    return (x>=bb.x && x<=bb.x+bb.w && y>=bb.y && y<=bb.y+bb.h);
  },

  onPointerDownInLasso(x,y){
    const S=WB.state;
    const L=S.lasso;

    // If selection exists: clicking inside bbox starts MOVE
    if (L.selectedIdx.length && L.bbox && WB.lasso.pointInBBox(x,y,L.bbox)){
      WB.drawing.pushUndo(S.activeLayer);
      L.mode="move";
      L.moveStart={x,y};
      return;
    }

    // Otherwise start new lasso selection
    // (Do NOT clear selection if user begins selecting? We clear because it's new selection.)
    WB.lasso.clearSelection();
    L.selecting=true;
    L.points=[{x,y}];
  },

  onPointerMoveInLasso(x,y){
    const S=WB.state;
    const L=S.lasso;

    if (L.mode==="move"){
      // incremental move so reversing works
      const dx = x - L.moveStart.x;
      const dy = y - L.moveStart.y;

      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001){
        WB.lasso.applyMove(dx,dy);
        L.moveStart = {x,y};

        WB.drawing.rebuildLayerBuffer(S.activeLayer);
        WB.text.rebuildTextOverlay();
      }
      return;
    }

    if (!L.selecting) return;
    const last=L.points[L.points.length-1];
    if (dist(last.x,last.y,x,y)<2) return;
    L.points.push({x,y});
  },

  onPointerUpInLasso(){
    const S=WB.state;
    const L=S.lasso;

    if (L.mode==="move"){
      // finish move
      L.mode="idle";
      L.moveStart=null;
      WB.storage.scheduleSave();
      return;
    }

    if (!L.selecting) return;
    L.selecting=false;
    WB.lasso.lassoSelect();
  },

  /* ========= Selection logic ========= */
  pointInPoly(pt, poly){
    let inside=false;
    for (let i=0,j=poly.length-1;i<poly.length;j=i++){
      const xi=poly[i].x, yi=poly[i].y;
      const xj=poly[j].x, yj=poly[j].y;
      const denom=(yj-yi)||1e-9;
      const inter=((yi>pt.y)!==(yj>pt.y)) && (pt.x < (xj-xi)*(pt.y-yi)/denom + xi);
      if (inter) inside=!inside;
    }
    return inside;
  },

  actionBBox(a){
    // minimal: supports path + shapes + text
    if (a.type==="text"){
      const w = a.w || 120;
      const h = a.h || 28;
      return { x:a.x, y:a.y, w, h };
    }
    if (a.type==="path"){
      const pts=a.points||[];
      if(!pts.length) return {x:0,y:0,w:0,h:0};
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const p of pts){ minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y); }
      const pad=Math.max(6, (a.style?.baseWeight||2)*2);
      return { x:minX-pad, y:minY-pad, w:(maxX-minX)+2*pad, h:(maxY-minY)+2*pad };
    }
    if (a.type==="line"||a.type==="arrow"||a.type==="rect"||a.type==="ellipse"){
      const minX=Math.min(a.a.x,a.b.x), minY=Math.min(a.a.y,a.b.y);
      const maxX=Math.max(a.a.x,a.b.x), maxY=Math.max(a.a.y,a.b.y);
      return { x:minX, y:minY, w:maxX-minX, h:maxY-minY };
    }
    if (a.type==="circle"){
      return { x:a.c.x-a.r, y:a.c.y-a.r, w:2*a.r, h:2*a.r };
    }
    if (a.type==="fill"){
      return { x:a.x-8,y:a.y-8,w:16,h:16 };
    }
    return {x:0,y:0,w:0,h:0};
  },

  lassoSelect(){
    const S=WB.state;
    const L=S.lasso;
    const poly=L.points.slice();
    L.points=[];
    if(poly.length<3){ WB.lasso.clearSelection(); return; }

    const actions=S.layers[S.activeLayer].actions;
    const selected=[];
    for(let i=0;i<actions.length;i++){
      const a=actions[i];
      const bb=WB.lasso.actionBBox(a);
      const corners=[
        {x:bb.x,y:bb.y},{x:bb.x+bb.w,y:bb.y},
        {x:bb.x+bb.w,y:bb.y+bb.h},{x:bb.x,y:bb.y+bb.h}
      ];
      const center={x:bb.x+bb.w/2,y:bb.y+bb.h/2};

      let hit=corners.some(p=>WB.lasso.pointInPoly(p,poly)) || WB.lasso.pointInPoly(center,poly);
      if(!hit && a.type==="path"){
        for(const p of (a.points||[])){
          if(WB.lasso.pointInPoly({x:p.x,y:p.y}, poly)){ hit=true; break; }
        }
      }
      if(hit) selected.push(i);
    }

    L.selectedIdx=selected;
    if(!selected.length){ L.bbox=null; return; }

    WB.lasso.recomputeSelectionBBox();
  },

  recomputeSelectionBBox(){
    const S=WB.state;
    const L=S.lasso;
    const actions=S.layers[S.activeLayer].actions;

    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const idx of L.selectedIdx){
      const bb=WB.lasso.actionBBox(actions[idx]);
      minX=Math.min(minX,bb.x); minY=Math.min(minY,bb.y);
      maxX=Math.max(maxX,bb.x+bb.w); maxY=Math.max(maxY,bb.y+bb.h);
    }
    L.bbox={x:minX,y:minY,w:maxX-minX,h:maxY-minY};
  },

  /* ========= Transform: translation only ========= */
  translateAction(a,dx,dy){
    if(a.type==="text"){ a.x+=dx; a.y+=dy; }
    else if(a.type==="path"){ for(const p of a.points){ p.x+=dx; p.y+=dy; } }
    else if(a.type==="circle"){ a.c.x+=dx; a.c.y+=dy; }
    else if(a.type==="fill"){ a.x+=dx; a.y+=dy; }
    else { a.a.x+=dx; a.a.y+=dy; a.b.x+=dx; a.b.y+=dy; }
  },

  applyMove(dx,dy){
    const S=WB.state;
    const L=S.lasso;
    const actions=S.layers[S.activeLayer].actions;

    for(const idx of L.selectedIdx) WB.lasso.translateAction(actions[idx],dx,dy);

    // update bbox
    if (L.bbox){
      L.bbox.x += dx;
      L.bbox.y += dy;
    }
  },

  deleteSelection(){
    const S=WB.state;
    const L=S.lasso;
    if(!L.selectedIdx.length) return;

    WB.drawing.pushUndo(S.activeLayer);

    const acts=S.layers[S.activeLayer].actions;
    const idxs=L.selectedIdx.slice().sort((a,b)=>b-a);
    for(const idx of idxs) acts.splice(idx,1);

    // NOTE: keep your existing "fill safety" if you still want it.
    // But this will delete ALL fills on layer, not only fills tied to deleted objects.
    // I'll keep your original behavior for now:
    S.layers[S.activeLayer].actions = acts.filter(a=>a.type!=="fill");

    WB.lasso.clearSelection();
    WB.drawing.rebuildLayerBuffer(S.activeLayer);
    WB.text.rebuildTextOverlay();
    WB.storage.scheduleSave();
  },

  /* ========= Draw overlay ========= */
  drawLassoOverlay(){
    const S=WB.state;
    const L=S.lasso;
    const dark=document.body.classList.contains("dark");

    // selection stroke while lassoing
    if (S.tool==="lasso" && L.selecting && L.points.length){
      push();
      noFill();
      stroke(dark?255:0,80);
      strokeWeight(2);
      beginShape();
      for(const p of L.points) vertex(p.x,p.y);
      endShape();
      pop();
    }

    // bbox only (no handles)
    if (L.selectedIdx.length && L.bbox){
      const bb=L.bbox;
      push();
      noFill();
      stroke(dark?255:0,130);
      strokeWeight(2);
      drawingContext.setLineDash([6,6]);
      rect(bb.x,bb.y,bb.w,bb.h);
      drawingContext.setLineDash([]);
      pop();
    }
  }
};
