window.WB = window.WB || {};

WB.state = {
  tool: "pointer",

  strokeWidth: 2,
  smoothing: 2,
  transp: 1,
  currentColor: WB.CONFIG.COLORS[0],

  snapToGrid: false,
  bgMode: "transparent",

  collapseState: "partial",
  darkMode: false,

  // p5 / layers
  layers: [],
  activeLayer: 0,
  undoStack: Array.from({ length: 3 }, () => []),

  // in-progress action
  current: null,

  // pointer tracking
  pointerDown: false,
  activePointerId: null,
  activePointerType: "mouse",
  lastPressure: 1,
  isShiftDown: false,
  lastPointerClient: { x: 0, y: 0 },

  // laser
  laserTrail: [],
  laserInitialized: false,

  // pen memory (restore after laser/highlighter)
  penState: null,

  // highlighter memory
  highlighterInitialized: false,
  highlighterWidth: 20,
  highlighterTransp: 7,

  // hold timers / stillness
  holdAlignTimer: null,
  lastSignificantMoveAt: 0,
  lastMovePos: { x: 0, y: 0 },

  // selection / lasso
  lasso: {
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
  },

  // text
  defaultTextSize: 20,
  textDraft: null,

  // DOM refs (filled in ui.js)
  ui: {}
};
