setTool(t){
  const S=WB.state, U=S.ui;
  if (!t) t="pointer";

  // ✅ Ensure lasso sub-state always exists (storage/load merges may wipe it)
  if (!S.lasso || typeof S.lasso !== "object") {
    S.lasso = {
      points: [],
      selecting: false,
      selectedIdx: [],
      bbox: null,
      obb: null,
      mode: "idle",
      handle: null,
      moveStart: null,
      pivot: null,
      startOBB: null,
      startActionsSnapshot: null,
      liveText: null
    };
  } else {
    // Ensure required keys exist (in case older saved state misses some)
    S.lasso.points ??= [];
    S.lasso.selecting ??= false;
    S.lasso.selectedIdx ??= [];
    S.lasso.bbox ??= null;
    S.lasso.obb ??= null;
    S.lasso.mode ??= "idle";
    S.lasso.handle ??= null;
    S.lasso.moveStart ??= null;
    S.lasso.pivot ??= null;
    S.lasso.startOBB ??= null;
    S.lasso.startActionsSnapshot ??= null;
    S.lasso.liveText ??= null;
  }

  // commit text if open
  if (U?.textEditor && U.textEditor.style.display!=="none") WB.text.commitTextEdit();

  // entering highlighter: store pen settings (ONLY if coming from pen-like tools),
  // then switch to yellow + transp=7 temporarily.
  if (t === "highlighter" && S.tool !== "highlighter") {
    const comingFrom = S.tool;

    if (comingFrom !== "laser" && comingFrom !== "highlighter") {
      S.penState = {
        color: S.currentColor,
        width: S.strokeWidth,
        transp: S.transp,
        smoothing: S.smoothing
      };
    }

    if (!S.highlighterInitialized) {
      S.highlighterWidth = 20;
      S.highlighterTransp = 7;
      S.highlighterInitialized = true;
    }

    S.currentColor = "#FFFF00";
    S.transp = S.highlighterTransp;
    S.strokeWidth = S.highlighterWidth;

    if (U?.colorChip) U.colorChip.style.background = S.currentColor;
    if (U?.transp) { U.transp.value = String(S.transp); WB.ui.updateTranspLabel(); }
    if (U?.strokeWidth) { U.strokeWidth.value = String(S.strokeWidth); WB.ui.updateWidthLabel(); }
  }

  // restore pen settings when returning to pen from laser/highlighter
  if (t==="pen" && (S.tool==="highlighter" || S.tool==="laser")){
    const ps = S.penState;
    if (ps){
      S.currentColor = ps.color;
      S.strokeWidth = ps.width;
      S.transp = ps.transp;
      S.smoothing = ps.smoothing;

      if (U?.colorChip) U.colorChip.style.background = S.currentColor;

      if (U?.strokeWidth) U.strokeWidth.value = String(S.strokeWidth);
      if (U?.smoothing) U.smoothing.value = String(S.smoothing);
      if (U?.transp) U.transp.value = String(S.transp);

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
    if (t !== "highlighter") {
      S.strokeWidth = S.lastNonEraserWidth ?? S.strokeWidth ?? 2;
    }
  }

  if (U?.strokeWidth) {
    U.strokeWidth.value = String(S.strokeWidth);
    WB.ui.updateWidthLabel();
  }

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
