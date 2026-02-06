window.WB = window.WB || {};

WB.drawing = {
  setupP5(){
    const S=WB.state;

    const c = createCanvas(windowWidth, windowHeight);
    c.parent("canvas-wrap");
    pixelDensity(1);

    // init layers
    S.layers = [];
    for (let i=0;i<3;i++){
      const pg=createGraphics(windowWidth, windowHeight);
      pg.pixelDensity(1);
      pg.clear();
      S.layers.push({ pg, actions: [], visible: true });
    }

    // init penState
    S.penState = { color: S.currentColor, width: S.strokeWidth, transp: S.transp, smoothing: S.smoothing };
  },

  drawFrame(){
    const S=WB.state;

    clear();
    WB.drawing.drawBackgroundOverlay(WB.state.bgMode);

    // composite layers
    for (let i=0;i<3;i++){
      if (!S.layers[i].visible) continue;
      image(S.layers[i].pg,0,0);
    }

    // preview current
    if (S.current && S.current.type!=="laser") WB.drawing.drawCurrentPreview(S.current);

    // lasso overlay
    WB.lasso.drawLassoOverlay();

    // laser
    WB.drawing.updateLaserTrail();
    WB.drawing.drawLaserTrail();
  },

  windowResized(){
    const S=WB.state;

    resizeCanvas(windowWidth, windowHeight);
    for (let i=0;i<3;i++){
      const old=S.layers[i].pg;
      const ng=createGraphics(windowWidth, windowHeight);
      ng.pixelDensity(1);
      ng.clear();
      ng.image(old,0,0);
      S.layers[i].pg=ng;
    }
    WB.drawing.rebuildAllBuffers();
    WB.text.rebuildTextOverlay();
  },

  setTool(t){
    const S=WB.state, U=S.ui;
    if (!t) t="pointer";

    // commit text if open
    if (U.textEditor.style.display!=="none") WB.text.commitTextEdit();

    // entering highlighter: store pen settings (ONLY if coming from pen-like tools),
    // then switch to yellow + transp=7 temporarily.
    if (t === "highlighter" && S.tool !== "highlighter") {
      const comingFrom = S.tool;

      // Only capture penState if we are not coming from laser/highlighter.
      // (Otherwise we'd "remember" laser/highlighter settings instead of actual pen settings.)
      if (comingFrom !== "laser" && comingFrom !== "highlighter") {
        S.penState = {
          color: S.currentColor,
          width: S.strokeWidth,
          transp: S.transp,
          smoothing: S.smoothing
        };
      }

      // highlighter defaults (persist for session once user changes them)
      if (!S.highlighterInitialized) {
        S.highlighterWidth = 20;
        S.highlighterTransp = 7;
        S.highlighterInitialized = true;
      }

      // Apply highlighter look (temporary; restore when leaving to pen or shapes)
      S.currentColor = "#FFFF00";
      S.transp = S.highlighterTransp;
      S.strokeWidth = S.highlighterWidth;

      U.colorChip.style.background = S.currentColor;
      U.transp.value = String(S.transp);
      WB.ui.updateTranspLabel();

      U.strokeWidth.value = String(S.strokeWidth);
      WB.ui.updateWidthLabel();
    }

    // ✅ FIX: restore pen settings when leaving laser/highlighter to Pen OR any Shape tool
    const restoreTargets = new Set(["pen","line","arrow","circle","rect","ellipse"]);
    if (restoreTargets.has(t) && (S.tool==="highlighter" || S.tool==="laser")){
      const ps = S.penState;
      if (ps){
        S.currentColor = ps.color;
        S.strokeWidth = ps.width;
        S.transp = ps.transp;
        S.smoothing = ps.smoothing;

        U.colorChip.style.background = S.currentColor;

        U.strokeWidth.value = String(S.strokeWidth);
        U.smoothing.value = String(S.smoothing);
        U.transp.value = String(S.transp);

        WB.ui.updateWidthLabel();
        WB.ui.updateSmoothLabel();
        WB.ui.updateTranspLabel();
      }
    }

    S.tool = t;
    S.current = null;

    // eraser width swap
    if (t==="eraser"){
      S.lastNonEraserWidth = S.lastNonEraserWidth ?? S.strokeWidth;
      S.strokeWidth = 10;
    } else {
      // IMPORTANT: do not override highlighter width on setTool("highlighter")
      if (t !== "highlighter") {
        S.strokeWidth = S.lastNonEraserWidth ?? S.strokeWidth ?? 2;
      }
    }

    U.strokeWidth.value = String(S.strokeWidth);
    WB.ui.updateWidthLabel();

    // text overlay pointer events
    WB.text.setTextPointerEvents(S.tool==="text" || S.tool==="pointer");

    // lasso selection remains, but stop lasso mode if leaving
    if (t!=="lasso") {
      S.lasso.mode="idle";
      S.lasso.selecting=false;
      S.lasso.liveText=null;
    }

    WB.ui.refreshToolButtons();
    WB.storage.scheduleSave();
  },

  /* ========= Styles ========= */
  makeStyle(pressure, pointerType){
    const S=WB.state;
    const mult=WB.utils.pressureMultiplier(pressure, pointerType);
    const w=S.strokeWidth*mult;
    const alpha=WB.utils.alphaFromTransp(S.transp);
    if (S.tool==="eraser") return { eraser:true, baseWeight:S.strokeWidth, weight:w, color:null, alpha:255, smoothing:S.smoothing };
    return { eraser:false, baseWeight:S.strokeWidth, weight:w, color:S.currentColor, alpha, smoothing:S.smoothing };
  },

  /* ========= Background overlay ========= */
  drawBackgroundOverlay(mode){
    if (mode==="transparent") return;

    const step=WB.CONFIG.GRID_STEP;
    const gridA=WB.utils.getCSSNum("--grid-a");
    const dotsA=WB.utils.getCSSNum("--dots-a");
    const dotsR=WB.utils.getCSSNum("--dots-r");
    const dark=document.body.classList.contains("dark");

    if (mode==="grid"){
      push();
      stroke(dark?255:0, gridA);
      strokeWeight(1);
      for(let x=0;x<width;x+=step) line(x,0,x,height);
      for(let y=0;y<height;y+=step) line(0,y,width,y);
      pop();
      return;
    }

    push();
    noStroke();
    fill(dark?255:0, dotsA);
    for(let x=0;x<width;x+=step){
      for(let y=0;y<height;y+=step){
        circle(x,y,dotsR);
      }
    }
    pop();
  },

  /* ========= Pointer actions ========= */
  pointerToCanvasXY(ev){
    const rect = ev.target.getBoundingClientRect();
    return { x: ev.clientX-rect.left, y: ev.clientY-rect.top };
  },

  startAction(x,y,pressure,pointerType){
    const S=WB.state;
    WB.ui.applyCollapse(); // no-op but ensures class state is applied

    // stillness tracking
    S.lastSignificantMoveAt = performance.now();
    S.lastMovePos = {x,y};

    if (S.tool==="pointer") return;

    if (S.tool==="text"){
      WB.text.openTextEditor(x,y,"",S.defaultTextSize,null,S.activeLayer);
      return;
    }

    if (S.tool==="fill"){
      WB.drawing.pushUndo(S.activeLayer);
      const a = WB.utils.alphaFromTransp(S.transp);
      const ok = WB.drawing.floodFillOnLayer(S.activeLayer, x, y, S.currentColor, a);
      if (ok){
        S.layers[S.activeLayer].actions.push({type:"fill", x, y, color:S.currentColor, alpha:a});
        WB.text.rebuildTextOverlay();
        WB.storage.scheduleSave();
      }
      return;
    }

    if (S.tool==="lasso"){
      WB.lasso.onPointerDownInLasso(x,y);
      return;
    }

    if (S.tool==="laser"){
      // first-time laser defaults (and store pen state once)
      if (!S.laserInitialized){
        S.penState = { color: S.currentColor, width: S.strokeWidth, transp: S.transp, smoothing: S.smoothing };
        S.currentColor = "#39FF14";
        S.strokeWidth = 2;
        S.ui.colorChip.style.background = S.currentColor;
        S.ui.strokeWidth.value = "2";
        WB.ui.updateWidthLabel();
        S.laserInitialized = true;
      }
      const p0=WB.utils.snapPoint(x,y);
      S.laserTrail.push({x:p0.x,y:p0.y,t:millis()});
      S.current={type:"laser"};
      return;
    }

    const p0=WB.utils.snapPoint(x,y);
    const layerIndex=S.activeLayer;

    // highlighter as LINE tool (uniform)
    if (S.tool==="highlighter"){
      // Remember any user adjustments to highlighter settings during this session
      S.highlighterWidth = S.strokeWidth;
      S.highlighterTransp = S.transp;

      WB.drawing.pushUndo(layerIndex);

      const alpha=WB.utils.alphaFromTransp(S.transp);
      S.current={type:"line", style:{eraser:false, weight:S.strokeWidth, color:S.currentColor, alpha}, a:p0, b:p0, layer:layerIndex};
      return;
    }

    // pen/eraser path (preview; commit on finish)
    if (S.tool==="pen" || S.tool==="eraser"){
      WB.drawing.pushUndo(layerIndex);
      const style=WB.drawing.makeStyle(pressure,pointerType);
      S.current={type:"path", style:{...style, weight:undefined}, points:[{x:p0.x,y:p0.y,p:pressure||1}], layer:layerIndex, pointerType};
      return;
    }

    // shapes
    if (["line","arrow","circle","rect","ellipse"].includes(S.tool)){
      WB.drawing.pushUndo(layerIndex);
    }
    const style=WB.drawing.makeStyle(pressure,pointerType);

    if (S.tool==="line") S.current={type:"line", style, a:p0, b:p0, layer:layerIndex};
    if (S.tool==="arrow") S.current={type:"arrow", style, a:p0, b:p0, layer:layerIndex};
    if (S.tool==="circle") S.current={type:"circle", style, c:p0, r:0, layer:layerIndex};
    if (S.tool==="rect") S.current={type:"rect", style, a:p0, b:p0, layer:layerIndex};
    if (S.tool==="ellipse") S.current={type:"ellipse", style, a:p0, b:p0, layer:layerIndex};
  },

  extendAction(x,y,pressure,pointerType){
    const S=WB.state;
    const p=WB.utils.snapPoint(x,y);

    if (S.tool==="lasso"){
      WB.lasso.onPointerMoveInLasso(p.x,p.y);
      return;
    }

    if (!S.current) return;

    if (S.current.type==="laser"){
      S.laserTrail.push({x:p.x,y:p.y,t:millis()});
      return;
    }

    // hold-to-align logic
    const now = performance.now();
    const moved = WB.utils.dist2(p.x,p.y,S.lastMovePos.x,S.lastMovePos.y) > WB.CONFIG.STILL_EPS_PX**2;
    if (moved){
      S.lastMovePos={x:p.x,y:p.y};
      S.lastSignificantMoveAt=now;
      WB.drawing.clearHoldTimer();
    } else {
      if (!S.holdAlignTimer && (now - S.lastSignificantMoveAt) > WB.CONFIG.STILL_TIME_MS){
        WB.drawing.armHoldTimer();
      }
    }

    if (S.current.type==="line" || S.current.type==="arrow"){
      S.current.b=p;
      if (S.isShiftDown) WB.drawing.alignLineLike(S.current);
      return;
    }

    if (S.current.type==="path"){
      const pts=S.current.points;
      const last=pts[pts.length-1];
      if (dist(last.x,last.y,p.x,p.y) < 0.8) return;

      const sm=S.current.style.smoothing||1;
      const a=(sm<=1)?1:(2/(sm+1));
      pts.push({x:last.x + a*(p.x-last.x), y:last.y + a*(p.y-last.y), p:(pressure ?? 1)});
      return;
    }

    if (["rect","ellipse"].includes(S.current.type)) S.current.b=p;
    if (S.current.type==="circle") S.current.r = dist(S.current.c.x,S.current.c.y,p.x,p.y);
  },

  finishAction(){
    const S=WB.state;
    WB.drawing.clearHoldTimer();

    if (S.tool==="lasso"){
      WB.lasso.onPointerUpInLasso();
      return;
    }

    if (!S.current) return;

    if (S.current.type==="laser"){ S.current=null; return; }

    const L=S.layers[S.current.layer];

    if (S.current.type==="path"){
      L.actions.push({type:"path", style:S.current.style, points:S.current.points});
      WB.drawing.drawPathActionToLayer(L.pg, L.actions[L.actions.length-1]);
    } else {
      WB.drawing.drawShapeActionToLayer(L.pg, S.current);
      L.actions.push(S.current);
    }

    S.current=null;
    WB.text.rebuildTextOverlay();
    WB.storage.scheduleSave();
  },

  clearHoldTimer(){
    const S=WB.state;
    if (S.holdAlignTimer){ clearTimeout(S.holdAlignTimer); S.holdAlignTimer=null; }
  },

  armHoldTimer(){
    const S=WB.state;
    WB.drawing.clearHoldTimer();
    S.holdAlignTimer = setTimeout(()=> {
      if (!S.current) return;

      if (S.current.type==="line" || S.current.type==="arrow"){
        WB.drawing.alignLineLike(S.current);
        return;
      }

      if (S.current.type==="path" && S.tool==="pen"){
        const lineObj = WB.drawing.maybeConvertPathToAxisLine(S.current);
        if (lineObj){
          S.current = lineObj;
          WB.drawing.alignLineLike(S.current);
        }
      }
    }, WB.CONFIG.HOLD_ALIGN_MS);
  },

  alignLineLike(a){
    const dx=a.b.x-a.a.x, dy=a.b.y-a.a.y;
    if (Math.abs(dx) >= Math.abs(dy)) a.b.y = a.a.y;
    else a.b.x = a.a.x;
  },

  /* ========= Draw previews & actions ========= */
  drawCurrentPreview(a){
    if (a.type==="path"){
      push();
      const pts=a.points;
      for(let k=1;k<pts.length;k++){
        const p0=pts[k-1], p1=pts[k];
        const avg=((p0.p??1)+(p1.p??1))/2;
        const mult=WB.utils.pressureMultiplier(avg, a.pointerType||"pen");
        const w=(a.style.baseWeight||2)*mult;

        if (a.style.eraser){
          erase(); stroke(0); strokeWeight(w); strokeCap(ROUND); strokeJoin(ROUND);
          line(p0.x,p0.y,p1.x,p1.y);
          noErase();
        } else {
          const col=color(a.style.color); col.setAlpha(a.style.alpha??255);
          stroke(col); strokeWeight(w); strokeCap(ROUND); strokeJoin(ROUND);
          line(p0.x,p0.y,p1.x,p1.y);
        }
      }
      pop();
      return;
    }

    if (["line","arrow","circle","rect","ellipse"].includes(a.type)){
      push();
      WB.drawing.drawShapeActionToCtx(window, a);
      pop();
    }
  },

  drawArrowHead(target, x1,y1,x2,y2, style){
    const ang=Math.atan2(y2-y1,x2-x1);
    const w=Math.max(1, style.weight||1);
    const headLen=Math.max(10, 3.2*w);
    const headAng=(28*Math.PI)/180;
    const x3=x2 - headLen*Math.cos(ang-headAng);
    const y3=y2 - headLen*Math.sin(ang-headAng);
    const x4=x2 - headLen*Math.cos(ang+headAng);
    const y4=y2 - headLen*Math.sin(ang+headAng);
    target.line(x2,y2,x3,y3);
    target.line(x2,y2,x4,y4);
  },

  drawShapeActionToCtx(ctx, a){
    const st=a.style;
    if (st.eraser){
      ctx.erase(); ctx.stroke(0);
      ctx.strokeWeight(st.weight); ctx.strokeCap(ROUND); ctx.strokeJoin(ROUND); ctx.noFill();
    } else {
      const col=color(st.color); col.setAlpha(st.alpha??255);
      ctx.stroke(col); ctx.strokeWeight(st.weight); ctx.strokeCap(ROUND); ctx.strokeJoin(ROUND); ctx.noFill();
    }

    if (a.type==="line") ctx.line(a.a.x,a.a.y,a.b.x,a.b.y);
    else if (a.type==="arrow"){ ctx.line(a.a.x,a.a.y,a.b.x,a.b.y); WB.drawing.drawArrowHead(ctx,a.a.x,a.a.y,a.b.x,a.b.y,st); }
    else if (a.type==="circle") ctx.circle(a.c.x,a.c.y,2*a.r);
    else if (a.type==="rect"){
      const x=Math.min(a.a.x,a.b.x), y=Math.min(a.a.y,a.b.y);
      const w=Math.abs(a.b.x-a.a.x), h=Math.abs(a.b.y-a.a.y);
      ctx.rect(x,y,w,h);
    }
    else if (a.type==="ellipse"){
      const minorRatio=Math.sqrt(1 - WB.CONFIG.ELLIPSE_E*WB.CONFIG.ELLIPSE_E);
      const cx=(a.a.x+a.b.x)/2, cy=(a.a.y+a.b.y)/2;
      const major=dist(a.a.x,a.a.y,a.b.x,a.b.y);
      const minor=major*minorRatio;
      const ang=Math.atan2(a.b.y-a.a.y, a.b.x-a.a.x);
      ctx.push();
      ctx.translate(cx,cy);
      ctx.rotate(ang);
      ctx.ellipse(0,0, major, minor);
      ctx.pop();
    }

    if (st.eraser) ctx.noErase();
  },

  drawShapeActionToLayer(pg, a){
    pg.push();
    WB.drawing.drawShapeActionToCtx(pg, a);
    pg.pop();
  },

  drawPathActionToLayer(pg, a){
    const pts=a.points;
    for(let k=1;k<pts.length;k++){
      const p0=pts[k-1], p1=pts[k];
      const avg=((p0.p??1)+(p1.p??1))/2;
      const mult=WB.utils.pressureMultiplier(avg, "pen");
      const w=(a.style.baseWeight||2)*mult;

      if (a.style.eraser){
        pg.erase();
        pg.stroke(0); pg.strokeWeight(w);
        pg.strokeCap(ROUND); pg.strokeJoin(ROUND);
        pg.line(p0.x,p0.y,p1.x,p1.y);
        pg.noErase();
      } else {
        const col=color(a.style.color); col.setAlpha(a.style.alpha??255);
        pg.stroke(col); pg.strokeWeight(w);
        pg.strokeCap(ROUND); pg.strokeJoin(ROUND);
        pg.line(p0.x,p0.y,p1.x,p1.y);
      }
    }
  },

  /* ========= Laser ========= */
  updateLaserTrail(){
    const S=WB.state;
    const now=millis();
    S.laserTrail = S.laserTrail.filter(p=> now-p.t < WB.CONFIG.LASER_FADE_MS);
  },

  drawLaserTrail(){
    const S=WB.state;
    if(!S.laserTrail.length) return;

    const w=Math.max(1,S.strokeWidth);
    const c=color(S.currentColor);

    push(); noFill();
    for(let i=1;i<S.laserTrail.length;i++){
      const p=S.laserTrail[i-1], q=S.laserTrail[i];
      const age=millis()-q.t;
      const a=map(age,0,WB.CONFIG.LASER_FADE_MS,200,0,true);
      stroke(red(c),green(c),blue(c),a);
      strokeWeight(w); strokeCap(ROUND);
      line(p.x,p.y,q.x,q.y);
    }
    const last=S.laserTrail[S.laserTrail.length-1];
    stroke(red(c),green(c),blue(c),210);
    strokeWeight(Math.max(8,w*2.2));
    point(last.x,last.y);
    pop();
  },

  /* ========= Flood fill ========= */
  floodFillOnLayer(layerIndex, x, y, fillHex, fillAlpha){
    const S=WB.state;
    const L=S.layers[layerIndex];
    const pg=L.pg;

    const ix=Math.floor(WB.utils.clamp(x,0,width-1));
    const iy=Math.floor(WB.utils.clamp(y,0,height-1));

    pg.loadPixels();
    const pix=pg.pixels;
    const W=width, H=height;

    const idx0=4*(iy*W+ix);
    const a0=pix[idx0+3];
    if (a0 > 12) return false;

    const cc=color(fillHex);
    const fr=Math.round(red(cc));
    const fg=Math.round(green(cc));
    const fb=Math.round(blue(cc));
    const fa=fillAlpha;

    const stack=[[ix,iy]];
    const visited=new Uint8Array(W*H);
    let filled=0;
    const MAX=650000;

    while(stack.length){
      const [cx,cy]=stack.pop();
      const p=cy*W+cx;
      if (visited[p]) continue;
      visited[p]=1;

      const off=4*p;
      const a=pix[off+3];
      if (a > 12) continue;

      pix[off]=fr; pix[off+1]=fg; pix[off+2]=fb; pix[off+3]=fa;
      filled++;
      if (filled>MAX) break;

      if (cx>0) stack.push([cx-1,cy]);
      if (cx<W-1) stack.push([cx+1,cy]);
      if (cy>0) stack.push([cx,cy-1]);
      if (cy<H-1) stack.push([cx,cy+1]);
    }

    pg.updatePixels();
    return filled>0;
  },

  /* ========= Rebuild buffers ========= */
  rebuildLayerBuffer(i){
    const S=WB.state;
    const L=S.layers[i];
    L.pg.clear();

    // draw non-fill, non-text
    for(const a of L.actions){
      if (a.type==="text" || a.type==="fill") continue;
      if (a.type==="path"){ WB.drawing.drawPathActionToLayer(L.pg, a); continue; }
      WB.drawing.drawShapeActionToLayer(L.pg, a);
    }

    // apply fills last
    for(const a of L.actions){
      if (a.type!=="fill") continue;
      WB.drawing.floodFillOnLayer(i, a.x, a.y, a.color, a.alpha);
    }
  },

  rebuildAllBuffers(){
    const S=WB.state;
    for(let i=0;i<3;i++) WB.drawing.rebuildLayerBuffer(i);
  },

  /* ========= Undo / Clear ========= */
  pushUndo(layerIndex){
    const S=WB.state;
    const L=S.layers[layerIndex];
    S.undoStack[layerIndex].push(JSON.stringify({ actions: L.actions, visible: L.visible }));
    if (S.undoStack[layerIndex].length > WB.CONFIG.UNDO_LIMIT) S.undoStack[layerIndex].shift();
  },

  undoActiveLayer(){
    const S=WB.state;
    const st=S.undoStack[S.activeLayer];
    if(!st.length) return;
    const snap=JSON.parse(st.pop());
    S.layers[S.activeLayer].actions = snap.actions || [];
    S.layers[S.activeLayer].visible = (typeof snap.visible==="boolean") ? snap.visible : true;
    WB.drawing.rebuildLayerBuffer(S.activeLayer);
    WB.text.rebuildTextOverlay();
    WB.storage.scheduleSave();
  },

  clearActiveLayerUndoable(){
    const S=WB.state;
    WB.lasso.clearSelection();
    WB.drawing.pushUndo(S.activeLayer);
    S.layers[S.activeLayer].actions = [];
    WB.drawing.rebuildLayerBuffer(S.activeLayer);
    WB.text.rebuildTextOverlay();
    WB.storage.scheduleSave();
  },

  /* ========= Pen straight-line conversion ========= */
  pointLineDist(px,py, ax,ay, bx,by){
    const vx=bx-ax, vy=by-ay;
    const wx=px-ax, wy=py-ay;
    const c1=vx*wx+vy*wy;
    const c2=vx*vx+vy*vy || 1e-9;
    const t=c1/c2;
    const projx=ax+t*vx, projy=ay+t*vy;
    return Math.hypot(px-projx, py-projy);
  },

  maybeConvertPathToAxisLine(pathAction){
    const pts=pathAction.points||[];
    if(pts.length<3) return null;
    const a0=pts[0], a1=pts[pts.length-1];
    const len=Math.hypot(a1.x-a0.x, a1.y-a0.y);
    if (len < WB.CONFIG.FREE_LINE_MIN_LENGTH) return null;

    let maxD=0;
    for(const p of pts){
      maxD=Math.max(maxD, WB.drawing.pointLineDist(p.x,p.y,a0.x,a0.y,a1.x,a1.y));
      if (maxD > WB.CONFIG.FREE_LINE_MAX_DEVIATION) return null;
    }

    const st = {
      eraser:false,
      weight: pathAction.style.baseWeight || WB.state.strokeWidth,
      color: pathAction.style.color || WB.state.currentColor,
      alpha: pathAction.style.alpha ?? WB.utils.alphaFromTransp(WB.state.transp)
    };

    return { type:"line", style: st, a:{x:a0.x,y:a0.y}, b:{x:a1.x,y:a1.y}, layer: pathAction.layer };
  }
};

/* ============================================================
   PATCH: Prevent "freeze after selecting Shapes"
   - avoids permanent noLoop()
   - forces loop/redraw on tool/action changes
   - guards against exceptions leaving app non-updating
   ============================================================ */
(() => {
  window.WB = window.WB || {};
  WB.drawing = WB.drawing || {};

  // --- 1) Neutralize accidental noLoop() usage
  if (!WB._orig_noLoop && typeof window.noLoop === "function") {
    WB._orig_noLoop = window.noLoop.bind(window);
    window.noLoop = function patchedNoLoop() {
      try { WB._orig_noLoop(); } catch(_) {}
      try {
        if (typeof WB.forceLoop === "function") WB.forceLoop();
        else if (typeof window.loop === "function") window.loop();
      } catch(_) {}
    };
  }

  // --- 2) Central "request redraw" primitive
  WB.drawing.requestRedraw = function requestRedraw() {
    try { WB.state && (WB.state.needsRedraw = true); } catch(_) {}
    try {
      if (typeof WB.forceLoop === "function") WB.forceLoop();
      else if (typeof window.loop === "function") window.loop();
    } catch(_) {}
  };

  // --- 3) Wrap critical drawing entry points to always request redraw
  function wrap(name) {
    const fn = WB.drawing[name];
    if (typeof fn !== "function" || fn._patched) return;

    const wrapped = function (...args) {
      try {
        const out = fn.apply(this, args);
        WB.drawing.requestRedraw();
        return out;
      } catch (e) {
        console.error(`[drawing.js] ${name} crashed:`, e);
        WB.drawing.requestRedraw();
        throw e;
      }
    };
    wrapped._patched = true;
    WB.drawing[name] = wrapped;
  }

  [
    "setTool",
    "startAction",
    "extendAction",
    "finishAction",
    "undoActiveLayer",
    "clearActiveLayerUndoable",
    "rebuildAllBuffers",
    "windowResized",
    "drawFrame"
  ].forEach(wrap);

  // --- 4) Tool change redraw safeguard
  try {
    let _tool = WB.state?.tool;
    if (WB.state) {
      Object.defineProperty(WB.state, "tool", {
        get() { return _tool; },
        set(v) {
          _tool = v;
          WB.drawing.requestRedraw();
        },
        configurable: true
      });
    }
  } catch (_) {}

  // --- 5) ensure redraw() doesn't get lost
  if (!WB._orig_redraw && typeof window.redraw === "function") {
    WB._orig_redraw = window.redraw.bind(window);
    window.redraw = function patchedRedraw() {
      try { return WB._orig_redraw(); }
      finally { WB.drawing.requestRedraw(); }
    };
  }
})();
