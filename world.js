/* ============ 地窟世界：生成、碰撞、渲染 ============ */
const WORLD = {
  grid: [],            // grid[y][x]  0=空地 1=障碍
  gw: 0, gh: 0,        // 网格尺寸
  size: 0,             // 世界像素边长
  obstacles: [],       // 障碍物圆/矩形列表 {x,y,w,h}
  spawnPoints: [],
  floor: 1,
  seed: 0,
};

function initWorld(floor, seed){
  WORLD.floor = floor;
  WORLD.seed = seed;
  const rng = mulberry32(seed);
  const gw = 26, gh = 26;
  WORLD.gw = gw; WORLD.gh = gh;
  const cell = 52;                   // 每格世界单位
  WORLD.size = gw * cell;
  WORLD.grid = [];
  for(let y=0;y<gh;y++){
    const row=[];
    for(let x=0;x<gw;x++){
      // 边界是墙
      if(x===0||y===0||x===gw-1||y===gh-1){ row.push(1); }
      else row.push(0);
    }
    WORLD.grid.push(row);
  }
  // 随机障碍（柱子/石块），保证中央区域开阔
  const n = 10 + Math.floor(rng()*6) + Math.min(floor,6)*2;
  let placed=0, guard=0;
  while(placed<n && guard<500){
    guard++;
    const x = rndi(2,gw-3), y = rndi(2,gh-3);
    if(WORLD.grid[y][x]===0){
      const w = rndi(1,2), h = rndi(1,2);
      let ok=true;
      for(let yy=y; yy<Math.min(y+h,gh-1); yy++)
        for(let xx=x; xx<Math.min(x+w,gw-1); xx++){
          if(WORLD.grid[yy][xx]!==0) ok=false;
        }
      // 避免堵死出生点区域
      if(Math.abs(x-gw/2)<2 && Math.abs(y-gh/2)<2) ok=false;
      if(ok){
        for(let yy=y; yy<Math.min(y+h,gh-1); yy++)
          for(let xx=x; xx<Math.min(x+w,gw-1); xx++) WORLD.grid[yy][xx]=1;
        const cx=(x+w/2)*cell, cy=(y+h/2)*cell;
        WORLD.obstacles.push({x:cx, y:cy, w:w*cell*0.94, h:h*cell*0.94, type: rng()<0.5?'column':'crate', rx:rng(), ry:rng()});
        placed++;
      }
    }
  }
  // 出生点：中心
  WORLD.spawnPoints = [{x:gw/2*cell, y:gh/2*cell}];
}

/* 格子是否可走 */
function cellWalkable(px,py){
  const cx=Math.floor(px/52), cy=Math.floor(py/52);
  if(cx<0||cy<0||cx>=WORLD.gw||cy>=WORLD.gh) return false;
  return WORLD.grid[cy][cx]===0;
}

/* 圆形 vs 障碍碰撞（返回修正后的位置） */
function resolveCollision(pos, radius){
  // 边界
  pos.x = clamp(pos.x, radius+20, WORLD.size-radius-20);
  pos.y = clamp(pos.y, radius+20, WORLD.size-radius-20);
  // 与障碍碰撞推离
  for(const ob of WORLD.obstacles){
    const hx=ob.w/2, hy=ob.h/2;
    const nx = clamp(pos.x, ob.x-hx, ob.x+hx);
    const ny = clamp(pos.y, ob.y-hy, ob.y+hy);
    let dx = pos.x-nx, dy = pos.y-ny;
    const d2 = dx*dx+dy*dy;
    if(d2 < radius*radius){
      const d = Math.sqrt(d2)||0.0001;
      const push = (radius-d);
      pos.x += dx/d*push;
      pos.y += dy/d*push;
    }
  }
  return pos;
}

/* 在可走位置放置实体（避开障碍与彼此） */
function findSpawnNear(cx, cy, radius, minDistFromCenter){
  for(let i=0;i<40;i++){
    const a = Math.random()*Math.PI*2;
    const r = minDistFromCenter + Math.random()*80;
    const x = cx + Math.cos(a)*r;
    const y = cy + Math.sin(a)*r;
    if(cellWalkable(x,y) && !obstacleAt(x,y,radius)){
      return {x,y};
    }
  }
  // 兜底：中心
  return {x:cx, y:cy};
}
function obstacleAt(x,y,radius){
  for(const ob of WORLD.obstacles){
    const hx=ob.w/2, hy=ob.h/2;
    const nx=clamp(x,ob.x-hx,ob.x+hx), ny=clamp(y,ob.y-hy,ob.y+hy);
    if((x-nx)**2+(y-ny)**2 < radius*radius) return true;
  }
  return false;
}
