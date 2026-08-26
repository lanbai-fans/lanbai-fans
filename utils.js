/* ============ 工具函数 ============ */
const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const lerp = (a,b,t)=> a+(b-a)*t;
const dist = (a,b)=> Math.hypot(a.x-b.x, a.y-b.y);
const rnd = (a=1,b)=> b===undefined? Math.random()*a : a+Math.random()*(b-a);
const rndi = (a,b)=> Math.floor(rnd(a,b+1));
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const chance = p => Math.random()<p;
const angTo = (a,b)=> Math.atan2(b.y-a.y, b.x-a.x);

function fmt(n){
  if(n>=10000) return (n/10000).toFixed(1)+'万';
  if(n>=1000) return (n/1000).toFixed(1)+'k';
  return Math.round(n).toString();
}
function fmtP(n){ return Math.round(n*100)+'%'; }

/* 可复现随机（用于生成种子一致的地窟） */
function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed>>>15, 1|seed);
    t = t + Math.imul(t ^ t>>>7, 61|t) ^ t;
    return ((t ^ t>>>14)>>>0)/4294967296;
  };
}

/* ============ 2.5D 等距投影 ============
 * 世界坐标 (x,y) 平面；等距斜 45°：
 *   u = (x - y) * COS30
 *   v = (x + y) * SIN30
 * 相机中心 cam.cx, cam.cy 是 iso 空间坐标（u,v 缩放前的原始值）
 */
const COS30 = 0.866025;
const SIN30 = 0.5;
function isoU(x,y){ return (x - y) * COS30; }
function isoV(x,y){ return (x + y) * SIN30; }

/* 世界 -> 屏幕 */
function toScreen(p, cam){
  const du = isoU(p.x,p.y) - cam.cx;
  const dv = isoV(p.x,p.y) - cam.cy;
  return { x: cam.ox + du * cam.zoom, y: cam.oy + dv * cam.zoom };
}

/* 屏幕 -> 世界（反解） */
function toWorld(sx, sy, cam){
  const du = (sx - cam.ox) / cam.zoom + cam.cx;
  const dv = (sy - cam.oy) / cam.zoom + cam.cy;
  const a = du / COS30;   // x - y
  const b = dv / SIN30;   // x + y
  return { x: (a + b)/2, y: (b - a)/2 };
}

/* 相机移动：跟随目标（目标为世界坐标） */
function camFollow(cam, target, dt){
  const tu = isoU(target.x,target.y);
  const tv = isoV(target.x,target.y);
  cam.cx = lerp(cam.cx, tu, 1-Math.pow(0.001, dt));
  cam.cy = lerp(cam.cy, tv, 1-Math.pow(0.001, dt));
}
