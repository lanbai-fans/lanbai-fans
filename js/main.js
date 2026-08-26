/* ============ 主循环：输入、状态机、波次、门、游戏流程 ============ */
const fx = { drops:[], dmgs:[], particles:[], projectiles:[], rings:[], shake:0 };

const game = {
  player:null, beast:null, enemies:[], spawnQueue:[],
  floor:1, screen:'menu',          // menu / playing / dead / win
  paused:false,
  mouse:{ x:0, y:0, down:false, world:null, target:null },
  keys:{},
  bossDefeated:false,
  spawnTimer:0, spawnBudget:0,
  killTarget:0, doorActive:false, doorPos:null,
  runStart:0, time:0, last:0,
  meta:{ souls:0, atkUp:0, hpUp:0, lootUp:0, upgradeCount:0, nextCost:10 },
  maxFloorReached:1,
};

function setupRun(){
  game.floor=1; game.maxFloorReached=1;
  game.player = createPlayer(0,0);
  game.beast = createBeast(0,0);
  recomputeStats(game.player);
  recomputeBeast(game.beast);
  game.screen='playing';
  game.enemies=[]; game.spawnQueue=[]; fx.drops=[]; fx.dmgs=[]; fx.particles=[]; fx.projectiles=[]; fx.rings=[]; fx.shake=0;
  game.runStart=performance.now(); game.time=0;
  // 元强化
  const p=game.player;
  p.atk += game.meta.atkUp*3;
  p.maxHp += game.meta.hpUp*15; p.hp=p.maxHp;
  recomputeStats(p);
}

function loadFloor(){
  // 清场
  game.enemies=[]; game.spawnQueue=[]; fx.drops=[]; fx.projectiles=[]; fx.dmgs=[]; fx.particles=[]; fx.rings=[];
  WORLD.obstacles=[];
  const seed = Math.floor(Math.random()*1e9);
  initWorld(game.floor, seed);
  // 玩家与幻兽放中心
  const sp = WORLD.spawnPoints[0];
  game.player.x=sp.x; game.player.y=sp.y;
  game.beast.x=sp.x-30; game.beast.y=sp.y+20;
  game.bossDefeated=false; game.bossSpawned=false; game.doorActive=false; game.doorPos=null;
  // 波次预算（Boss层清空后触发Boss）
  const budget = Math.min(CFG.dungeon.spawnBudget.max,
    CFG.dungeon.spawnBudget.base + (game.floor-1)*CFG.dungeon.spawnBudget.perFloor);
  game.spawnBudget = budget;
  game.killTarget = budget;
  game.spawnTimer = CFG.dungeon.firstSpawnDelay;
  game.player.hp = game.player.maxHp;
  game.player.mp = game.player.maxMp;
  game.player.invuln = 2.0;
  showMsg('裂界之门开启 · 第'+game.floor+'层');
}

/* 波次生成 */
function updateSpawning(dt){
  if(game.bossDefeated) return;
  // 本层清空后
  if(game.enemies.length===0 && game.spawnQueue.length===0 && game.spawnBudget<=0){
    // 剧情首领层：生成 Boss
    if(game.floor===CFG.dungeon.maxFloors && !game.bossSpawned){
      game.bossSpawned=true;
      const ang=Math.random()*Math.PI*2, edgeR=rnd(420,560);
      const pos = findSpawnNear(game.player.x+Math.cos(ang)*edgeR, game.player.y+Math.sin(ang)*edgeR, 60, 30);
      const boss = createEnemy('boss', pos.x, pos.y, game.floor);
      boss.aggro=true; boss.aggroTimer=999;
      game.enemies.push(boss);
      showMsg('裂界魔王 苏醒了！');
      return;
    }
    // 开门：普通层清空即开门；首领层在Boss死后开门
    if(!game.doorActive && (game.floor < CFG.dungeon.maxFloors || game.bossDefeated)){
      openDoor();
    }
    return;
  }
  game.spawnTimer -= dt;
  if(game.spawnTimer<=0 && game.spawnBudget>0){
    game.spawnTimer = CFG.dungeon.waveTimer;
    // 决定生成类型
    let type;
    const r=Math.random();
    if(game.floor>=3 && r<0.18) type='brute';
    else if(game.floor>=2 && r<0.45) type='ranged';
    else type='melee';
    // 从玩家周围环形区域刷出（保证可见且主动靠近）
    const ang = Math.random()*Math.PI*2;
    const edgeR = rnd(360, 560);
    const cx = game.player.x + Math.cos(ang)*edgeR;
    const cy = game.player.y + Math.sin(ang)*edgeR;
    const pos = findSpawnNear(cx,cy,14,10);
    const e = createEnemy(type, pos.x, pos.y, game.floor);
    // 初始仇恨：主动靠近（有限时间，避免无限追击）
    e.aggro = true; e.aggroTimer = 5;
    // 精英变异
    if(chance(CFG.dungeon.eliteChance) && !e.boss){
      e.eliteAffix = rollEliteAffix();
      e.type='elite';
      e.name = e.eliteAffix.name+'·'+e.name;
      e.hp = Math.round(e.maxHp*1.5); e.maxHp=e.hp;
      applyEliteAffix(e);
    }
    game.enemies.push(e);
    game.spawnBudget--;
  }
}

/* 开门（在远离玩家的角落生成裂界之门） */
function openDoor(){
  game.doorActive=true;
  const ang=Math.random()*Math.PI*2, edgeR=rnd(380,520);
  const corner = findSpawnNear(game.player.x+Math.cos(ang)*edgeR, game.player.y+Math.sin(ang)*edgeR, 40, 10);
  game.doorPos = corner;
  showMsg('裂界之门开启！前往深处');
}

/* 门交互：靠近门 → 下一层 */
function updateDoor(dt){
  if(game.doorActive && game.doorPos){
    const d = dist(game.player, game.doorPos);
    if(d<70){
      // 显示提示
      const w=toScreen(game.doorPos, Render.cam);
      if(game.floor >= CFG.dungeon.maxFloors && !game.clearedStory){
        // 首领层
      }
      if(game.floor===CFG.dungeon.maxFloors){
        // Boss层：生成Boss（首次进入该层最后）
      }
    }
  }
}

/* 幻兽指令：出击/召回 */
function beastCommand(){
  const b=game.beast;
  if(b.mode==='attack'){ b.mode='follow'; b.target=null; showMsg('幻兽·'+CFG.beast.name+' 召回'); }
  else { b.mode='attack'; b.commandCd=8; showMsg('幻兽·'+CFG.beast.name+' 出击！'); }
}

/* 技能释放入口 */
function useSkill(id){
  const p=game.player;
  if(game.screen!=='playing'||game.paused) return;
  const sk=CFG.skills[id];
  if(p.skillCd[id]>0) return;
  if(p.mp < sk.mp){ showMsg('魔力不足'); return; }
  p.mp -= sk.mp;
  p.skillCd[id] = sk.cd;
  switch(id){
    case 'fire': {
      const aim = game.mouse.world || {x:p.x+Math.cos(p.facing)*50, y:p.y+Math.sin(p.facing)*50};
      playerFire(p, game.enemies, aim.x, aim.y);
      break;
    }
    case 'nova': playerNova(p, game.enemies); break;
    case 'fury': playerFury(p, game.beast); break;
  }
  recomputeStats(p);
}

/* 玩家移动与输入 */
function updatePlayer(dt){
  const p=game.player;
  if(game.screen!=='playing') return;
  // 翻滚
  if(p.dashT>0){
    p.dashT-=dt;
    p.x += p.dashDir.x*CFG.player.dashDistance*dt/CFG.player.dashDistance*520;
    p.y += p.dashDir.y*CFG.player.dashDistance*dt/CFG.player.dashDistance*520;
    p.invuln = CFG.player.invulnTime;
  } else if(game.mouse.world && !game.mouse.target){
    // 点击移动（鼠标按住持续移动）
    const target = game.mouse.world;
    const d = dist(p, target);
    if(d>6){
      const a = angTo(p, target);
      const spd = p.moveSpeed * (game.keys['Shift']? CFG.player.sprintMult:1);
      p.x += Math.cos(a)*spd*dt;
      p.y += Math.sin(a)*spd*dt;
      p.facing = a;
    }
  }
  // 幻兽跟随
  updateBeast(game.beast, p, game.enemies, dt);
  resolveCollision(p, 14);

  // 攻击（左键点怪）
  if(game.mouse.down && !game.mouse.target && game.mouse.world){
    // 检测点击目标
    const world = game.mouse.world;
    let t=null, bd=100;
    for(const e of game.enemies){
      if(e.dead) continue;
      const d=dist(world,e);
      if(d<bd){bd=d;t=e;}
    }
    if(t && bd<40){
      game.mouse.target=t;
    }
  }
  // 锁定目标攻击
  if(game.mouse.target){
    const t=game.mouse.target;
    if(t.dead){ game.mouse.target=null; }
    else {
      const d=dist(p,t);
      if(d>60){
        const a=angTo(p,t);
        p.x+=Math.cos(a)*p.moveSpeed*dt;
        p.y+=Math.sin(a)*p.moveSpeed*dt;
        p.facing=a;
      } else {
        // 攻击
        p.facing=angTo(p,t);
        if(p._atkTimer<=0){
          p._atkTimer = 1/p.speed;
          playerMelee(p, [t]);
        }
      }
    }
  } else if(game.mouse.down && !game.mouse.target){
    // 无目标按住左键原地攻击（面朝鼠标方向）
    const world = game.mouse.world;
    if(world){
      p.facing = angTo(p, world);
    }
  }
  // 自动攻击 + 自动索敌移动：无手动目标时自动走向并攻击最近敌人（刷宝手感）
  if(!game.mouse.down && !game.mouse.target){
    let best=null, bd=380;
    for(const e of game.enemies){
      if(e.dead) continue;
      const d=dist(p,e);
      if(d<bd){bd=d;best=e;}
    }
    // 若本层已清空且有门，自动走向门
    if(!best && game.doorActive && game.doorPos){
      const d=dist(p, game.doorPos);
      if(d>24){
        const a=angTo(p, game.doorPos);
        p.x+=Math.cos(a)*p.moveSpeed*dt;
        p.y+=Math.sin(a)*p.moveSpeed*dt;
        p.facing=a;
      }
    } else if(best){
      p.facing=angTo(p,best);
      const d=dist(p,best);
      if(d>CFG.skills.strike.range*0.7){
        const a=angTo(p,best);
        p.x+=Math.cos(a)*p.moveSpeed*dt;
        p.y+=Math.sin(a)*p.moveSpeed*dt;
      }
      if(d<CFG.skills.strike.range+18 && p._atkTimer<=0){
        p._atkTimer = 1/p.speed;
        playerMelee(p, [best]);
      }
    }
  }
  if(p._atkTimer>0) p._atkTimer-=dt;

  // 冷却
  for(const k in p.skillCd) if(p.skillCd[k]>0) p.skillCd[k]-=dt;
  if(p.dashCd>0) p.dashCd-=dt;
  if(p.invuln>0) p.invuln-=dt;
  if(p.furyT>0) p.furyT-=dt;
  if(p.attackAnim>0) p.attackAnim-=dt;
  if(p.hurtFlash>0) p.hurtFlash-=dt;
  // 恢复
  p.hp = Math.min(p.maxHp, p.hp + CFG.player.regen*dt);
  p.mp = Math.min(p.maxMp, p.mp + CFG.player.mpRegen*dt);
}

/* 拾取 */
function updatePickup(dt){
  const p=game.player;
  for(const d of fx.drops){
    if(d.taken) continue;
    d.t+=dt;
    const dd = dist(p,d);
    if(dd < CFG.player.pickupRadius){
      d.taken=true;
      if(d.isSoul){
        p.souls += d.amount;
        // 幻兽共享魂晶：自动喂食升级（魔域特色）
        const before = game.beast.level;
        feedBeast(game.beast, d.amount);
        if(game.beast.level>before){
          fx.particles.push(...createParticle(game.beast.x,game.beast.y,'#ffd700',16,100));
          showMsg('幻兽·'+CFG.beast.name+' 升级到 Lv.'+game.beast.level+(game.beast.evolution>0?' 进化！':''));
        }
        fx.particles.push(...createParticle(d.x,d.y,'#8fe3ff',8,60));
      } else {
        p.inv.push(d.item);
        p.lootCount++;
        fx.particles.push(...createParticle(d.x,d.y,d.item.rarityColor,10,80));
        UI.feedLoot(d.item);
      }
    }
  }
  fx.drops = fx.drops.filter(d=>!d.taken);
}

/* 投射物更新 */
function updateProjectiles(dt){
  for(const pr of fx.projectiles){
    pr.x += Math.cos(pr.ang)*pr.speed*dt;
    pr.y += Math.sin(pr.ang)*pr.speed*dt;
    pr.life -= dt;
    if(pr.life<=0){ pr.hit=true; continue; }
    if(pr.from==='player'){
      for(const e of game.enemies){
        if(e.dead||e.hp<=0) continue;
        if(dist(pr,e) < pr.radius+e.radius){
          pr.hit=true;
          const dmg = rollPlayerCritDmg(game.player, pr.dmg);
          damageEnemy(e, dmg, game.player, dmg===Math.round(pr.dmg*game.player.critMult));
          fx.particles.push(...createParticle(e.x,e.y,'#ff8a3d',6,60));
          break;
        }
      }
    } else {
      // 敌人投射物命中玩家
      if(game.player.invuln<=0 && dist(pr, game.player)<pr.radius+14){
        pr.hit=true;
        damagePlayer(pr.dmg, null);
      }
    }
  }
  fx.projectiles = fx.projectiles.filter(p=>!p.hit);
}

/* 特效更新 */
function updateFx(dt){
  for(const n of fx.dmgs){ n.t+=dt; }
  fx.dmgs = fx.dmgs.filter(n=>n.t<n.dur);
  for(const r of fx.rings){ r.t+=dt; }
  fx.rings = fx.rings.filter(r=>r.t<r.dur);
  for(const p of fx.particles){ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; }
  fx.particles = fx.particles.filter(p=>p.t<p.dur);
}

/* 敌人更新 */
function updateEnemies(dt){
  for(const e of game.enemies){
    if(e.dead) continue;
    updateEnemy(e, game.player, game.enemies, dt);
  }
  // 清理死亡
  game.enemies = game.enemies.filter(e=>!e.dead);
  // 处理生成的队列
  if(game.spawnQueue.length){
    game.enemies.push(...game.spawnQueue);
    game.spawnQueue=[];
  }
}

/* 死亡 / 胜利 */
function gameOver(win){
  const p=game.player;
  game.screen = win? 'win':'dead';
  game.paused=false;
  const deadEl=document.getElementById('dead');
  const winEl=document.getElementById('win');
  deadEl.classList.add('hidden');
  winEl.classList.add('hidden');
  deadEl.style.display='none';
  winEl.style.display='none';
  if(win){
    document.getElementById('wFloor').textContent = game.floor;
    document.getElementById('wKill').textContent = p.kills;
    document.getElementById('wLoot').textContent = p.lootCount;
    document.getElementById('wSoul').textContent = p.souls;
    winEl.classList.remove('hidden');
    winEl.style.display='flex';
  } else {
    document.getElementById('dFloor').textContent = game.floor;
    document.getElementById('dKill').textContent = p.kills;
    document.getElementById('dLoot').textContent = p.lootCount;
    document.getElementById('dSoul').textContent = p.souls;
    deadEl.classList.remove('hidden');
    deadEl.style.display='flex';
  }
  // 元强化：死亡后把魂晶兑换成永久强化（成本递增，攻/血交替）
  game.meta.souls += p.souls;
  let spent=0;
  while(game.meta.souls >= game.meta.nextCost){
    game.meta.souls -= game.meta.nextCost;
    game.meta.nextCost = 10 + game.meta.upgradeCount*3;
    if(game.meta.upgradeCount % 2 === 0) game.meta.atkUp++;
    else game.meta.hpUp++;
    game.meta.upgradeCount++;
    spent++;
  }
  const metaEl = document.getElementById(win?'metaLineWin':'metaLine');
  if(metaEl){
    metaEl.textContent = '元强化 Lv.'+game.meta.upgradeCount+' · 攻击+'+game.meta.atkUp*3+' · 生命+'+game.meta.hpUp*15+(spent>0?' · 本次强化×'+spent:'');
  }
}

/* 进入下一层（或触发Boss层） */
function goNextFloor(){
  game.floor++;
  game.maxFloorReached = Math.max(game.maxFloorReached, game.floor);
  loadFloor();
}

/* 玩家方法绑定（供UI调用） */
function hideScreens(){
  for(const id of ['start','dead','win']){
    const el=document.getElementById(id);
    el.classList.add('hidden');
    el.style.display='none';
  }
}
game.startRun = function(){
  hideScreens();
  UI.toggleBag(false);
  setupRun();
  loadFloor();
  UI.updateHUD();
  UI.tutorial();
};
game.nextFloor = function(){
  const winEl=document.getElementById('win');
  winEl.classList.add('hidden');
  winEl.style.display='none';
  goNextFloor();
};
game.toMenu = function(){
  hideScreens();
  UI.toggleBag(false);
  game.screen='menu';
  const startEl=document.getElementById('start');
  startEl.classList.remove('hidden');
  startEl.style.display='flex';
};
game.useSkill = useSkill;

/* 输入处理 */
function bindInput(){
  const canvas=document.getElementById('game');
  canvas.addEventListener('mousemove', e=>{
    game.mouse.x=e.clientX; game.mouse.y=e.clientY;
    game.mouse.world = toWorld(e.clientX,e.clientY,Render.cam);
  });
  canvas.addEventListener('mousedown', e=>{
    if(game.screen!=='playing'||game.paused) return;
    if(e.button===0){
      game.mouse.down=true;
      // 点击地面 → 移动目标；点怪 → 攻击
      const w=toWorld(e.clientX,e.clientY,Render.cam);
      let t=null,bd=44;
      for(const en of game.enemies){
        if(en.dead) continue;
        const d=dist(w,en);
        if(d<bd){bd=d;t=en;}
      }
      if(t){ game.mouse.target=t; }
      else { game.mouse.target=null; game.mouse.world=w; }
    } else if(e.button===2){
      // 右键：当前技能（默认魔焰）
      useSkill('fire');
    }
  });
  canvas.addEventListener('mouseup', e=>{
    if(e.button===0){ game.mouse.down=false; }
  });
  canvas.addEventListener('contextmenu', e=>e.preventDefault());
  window.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    game.keys[k]=true;
    if(game.screen!=='playing') return;
    if(k==='1') useSkill('fire');
    if(k==='2') useSkill('nova');
    if(k==='3') useSkill('fury');
    if(k==='q') beastCommand();
    if(k==='i'||k==='tab'){ e.preventDefault(); UI.toggleBag(); }
    if(k===' '){
      // 翻滚
      const p=game.player;
      if(p.dashCd<=0 && p.mp>=CFG.player.dodgeCost){
        p.dashCd=CFG.player.dashCooldown;
        p.mp-=CFG.player.dodgeCost;
        const a = game.mouse.world? angTo(p, game.mouse.world) : p.facing;
        p.dashDir={x:Math.cos(a), y:Math.sin(a)};
        p.dashT=0.22;
        fx.particles.push(...createParticle(p.x,p.y,'#ffffff',8,50));
      }
    }
    if(k==='escape'){ UI.toggleBag(false); }
  });
  window.addEventListener('keyup', e=>{ game.keys[e.key.toLowerCase()]=false; });
}

/* 主循环 */
let lastT=0;
function frame(t){
  requestAnimationFrame(frame);
  if(!lastT) lastT=t;
  let dt=(t-lastT)/1000; lastT=t;
  dt=Math.min(dt,0.05);
  if(game.screen==='playing' && !game.paused){
    game.time+=dt;
    updateSpawning(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateBeast(game.beast, game.player, game.enemies, dt);
    updateProjectiles(dt);
    updatePickup(dt);
    updateFx(dt);
    // 门推进
    if(game.doorActive && game.doorPos){
      const d=dist(game.player, game.doorPos);
      if(d<110){
        game.mouse.world=null; game.mouse.target=null;
        // 进入下一层
        goNextFloor();
      }
    }
    UI.updateHUD();
  }
  if(game.player) camFollow(Render.cam, game.player, dt);
  Render.draw();
}

/* 启动 */
function boot(){
  Render.init(document.getElementById('game'));
  UI.init();
  bindInput();
  camFollow(Render.cam, {x:0,y:0}, 1);
  document.getElementById('loading').style.display='none';
  requestAnimationFrame(frame);
}

/* 全局错误捕获（调试用） */
window.addEventListener('error', function(ev){
  const el=document.getElementById('errbox');
  if(el){
    el.textContent = '运行时错误: '+ev.message;
    el.style.display='block';
  }
});
window.addEventListener('load', boot);
