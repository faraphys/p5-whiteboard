window.WB = window.WB || {};

WB.utils = {
  clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); },
  dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; },

  alphaFromTransp(t){
    const a = 255 - (t-1) * (230/9);
    return Math.round(WB.utils.clamp(a, 20, 255));
  },

  getCSSNum(varName){
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return parseFloat(v || "0");
  },

  snapPoint(x,y){
    const S = WB.state;
    if (!S.snapToGrid) return {x,y};
    const step = WB.CONFIG.GRID_STEP;
    return { x: Math.round(x/step)*step, y: Math.round(y/step)*step };
  },

  pressureMultiplier(p, pointerType){
    const pr = Math.max(0, Math.min(1, (p ?? 1)));
    const isPen = (pointerType === "pen");
    if (!isPen && (pr === 0 || pr === 1)) return 1;
    return 0.45 + 1.10 * pr;
  },

  rotateVec(v, ang){
    const s=Math.sin(ang), c=Math.cos(ang);
    return { x: v.x*c - v.y*s, y: v.x*s + v.y*c };
  },

  rotatePoint(p, c, ang){
    const v={x:p.x-c.x,y:p.y-c.y};
    const vr=WB.utils.rotateVec(v, ang);
    return { x:c.x+vr.x, y:c.y+vr.y };
  },

  toLocal(p, c, ang){
    const v={x:p.x-c.x,y:p.y-c.y};
    return WB.utils.rotateVec(v, -ang);
  },

  fromLocal(v, c, ang){
    const vr=WB.utils.rotateVec(v, ang);
    return { x:c.x+vr.x, y:c.y+vr.y };
  }
};
