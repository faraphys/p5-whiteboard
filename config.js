window.WB = window.WB || {};

WB.CONFIG = {
  GRID_STEP: 20,

  LASER_FADE_MS: 2000,

  HOLD_ALIGN_MS: 500,
  STILL_EPS_PX: 7,
  STILL_TIME_MS: 120,

  FREE_LINE_MAX_DEVIATION: 7,
  FREE_LINE_MIN_LENGTH: 18,

  ELLIPSE_E: 0.9, // eccentricity
  HANDLE_R: 8,
  ROT_HANDLE_R: 14,
  ROT_MIN_RADIUS: 28,

  UNDO_LIMIT: 40,

  COLORS: [
    // common
    "#111111", "#D7263D", "#009E73", "#0072B2", "#FFFFFF", "#FF8A00",
    // extra
    "#E69F00", "#F0E442", "#56B4E9", "#CC79A7", "#00BFC4", "#D55E00",
    // fluorescent
    "#FFFF00", "#39FF14", "#FF00FF", "#00FFFF", "#B026FF", "#FF1744"
  ]
};
