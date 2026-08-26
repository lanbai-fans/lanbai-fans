/* ============ 实体：玩家 / 幻兽 / 敌人 / 投射物 / 掉落 / 特效 ============ */

/* ---------- 玩家 ---------- */
function createPlayer(x,y){
  return {
    kind:'player', x, y, vx:0, vy:0,
    hp: CFG.player.maxHp, mp: CFG.player.maxMp,
    level:1, xp:0, souls:0, kills:0, lootCount:0,
    atk: CFG.player.baseAtk, speed: CFG.player.baseSpeed,
    critChance: CFG.player.critChance, critMult: CFG.player.critMult,
    moveSpeed: CFG.player.moveSpeed, maxHp: CFG.player.maxHp, maxMp: CFG.player.maxMp,
    armor:0,
    facing: -Math.PI/2, aim:{x:0,y:0},
    invuln:0, dashCd:0, dashT:0, dashDir:{x:0,y:0},
    skillCd:{ fire:0, nova:0, fury:0 },
    furyT:0, _atkTimer:0,
    attackAnim:0, hurtFlash:0,
    inv: [], equip: { weapon:null, armor:null, helm:null, ring:null, boots:null },
    statsPanelDirty:true,
  };
}

function recomputeStats(p){
  p.atk = CFG.player.baseAtk;
  p.speed = CFG.player.baseSpeed;
  p.critChance = CFG.player.critChance;
  p.critMult = CFG.player.critMult;
  p.moveSpeed = CFG.player.moveSpeed;
  p.maxHp = CFG.player.maxHp;
  p.armor = 0;
  for(const slot of Object.keys(p.equip)){
    const it = p.equip[slot];
    if(!it) continue;
    if(slot==='weapon') p.atk += it.basePower;
    for(const a of it.affixes){
      if(a.stat==='atk') p.atk += a.value;
      else if(a.stat==='maxHp') p.maxHp += a.value;
      else if(a.stat==='speed') p.speed += a.value/100;
      else if(a.stat==='critChance') p.critChance += a.value/100;
      else if(a.stat==='critMult') p.critMult += a.value/100;
      else if(a.stat==='armor') p.armor += a.value;
      else if(a.stat==='moveSpeed') p.moveSpeed += p.moveSpeed*a.value/100;
    }
  }
  p.hp = Math.min(p.hp, p.maxHp);
  p.mp = Math.min(p.mp, p.maxMp);
  p.statsPanelDirty = true;
}

/* ---------- 幻兽（跟随 + 自动攻击 + 喂食进化） ---------- */
function createBeast(x,y){
  return {
    kind:'beast', x, y, vx:0, vy:0,
    hp: CFG.beast.maxHp, maxHp: CFG.beast.maxHp,
    atk: CFG.beast.baseAtk, speed: CFG.beast.baseSpeed,
    level:1, feed:0, evolution:0,   // evolution 0幼 1成 2王
    cd:0, mode:'attack',            // attack / follow / recall（默认协战）
    target:null, alive:true, anim:0, commandCd:0,
  };
}
function recomputeBeast(b){
  b.atk = CFG.beast.baseAtk + (b.level-1)*CFG.beast.atkPerLevel;
  b.maxHp = CFG.beast.maxHp + (b.level-1)*CFG.beast.hpPerLevel;
  b.speed = CFG.beast.baseSpeed + (b.level-1)*CFG.beast.speedPerLevel;
  b.hp = Math.min(b.hp, b.maxHp);
}
/* 喂食魂晶提升幻兽 */
function feedBeast(b, amount){
  const cost = CFG.beast.feedCost;
  b.feed += amount;
  while(b.feed >= cost && b.level < CFG.beast.maxLevel){
    b.feed -= cost;
    b.level++;
    recomputeBeast(b);
    b.evolution = (b.level>=CFG.beast.evolveLevels[1])?2 : (b.level>=CFG.beast.evolveLevels[0]?1:0);
  }
}

/* ---------- 敌人 ---------- */
function createEnemy(type, x, y, floor){
  const cfg = CFG.enemies[type];
  const hpMul = Math.pow(CFG.dungeon.hpGrow, floor-1);
  const dmgMul = Math.pow(CFG.dungeon.dmgGrow, floor-1);
  const isBoss = type==='boss';
  const isElite = type==='elite';
  const hp = Math.round((CFG.dungeon.baseMobHp * cfg.hpMult * hpMul) * (isElite?1.5:1) * (isBoss?CFG.dungeon.goldMult:1));
  const dmg = Math.round(CFG.dungeon.baseMobDmg * cfg.dmgMult * dmgMul);
  return {
    kind:'enemy', type, x, y, vx:0, vy:0,
    name:cfg.name, hp, maxHp:hp, dmg,
    speed: cfg.speed * (isElite?cfg.speed:1),
    atkCd: cfg.atkCd, atkTimer:0, range:cfg.range, radius:cfg.radius,
    color:cfg.color, size:cfg.size, xp:cfg.xp, soul:cfg.soul,
    ranged: !!cfg.ranged, boss: !!cfg.boss,
    facing: 0, hurtFlash:0, anim:0, atkAnim:0,
    eliteAffix: null,
    aggro:false, aggroTimer:0,
    shootCd:0, dead:false,
  };
}

/* 精英词缀 */
const ELITE_AFFIXES = [
  { id:'fast',   name:'迅捷',  desc:'移速+60%' },
  { id:'brute',  name:'蛮力',  desc:'伤害+70%，体型变大' },
  { id:'frost',  name:'冰甲',  desc:'受击减速攻击者' },
  { id:'venom',  name:'毒雾',  desc:'死亡释放毒圈' },
  { id:'spawn',  name:'召唤',  desc:'死亡召唤幼犬' },
];
function rollEliteAffix(){
  return pick(ELITE_AFFIXES);
}
function applyEliteAffix(e){
  const a = e.eliteAffix;
  if(!a) return;
  if(a.id==='fast') e.speed *= 1.6;
  if(a.id==='brute'){ e.dmg = Math.round(e.dmg*1.7); e.size*=1.3; e.radius*=1.2; }
}

/* ---------- 投射物（玩家魔焰 / 敌人冥火） ---------- */
function createProjectile(x,y,ang,speed,dmg,from,color,radius){
  return {
    kind:'projectile', x, y, ang, speed, dmg, from, color, radius: radius||6,
    life:3.2, hit:false,
  };
}

/* ---------- 地面掉落物 ---------- */
function createDrop(x,y,item,isSoul,amount){
  return {
    kind:'drop', x, y, item:item||null,
    isSoul: !!isSoul, amount: amount||0,
    bob: Math.random()*6, taken:false, t:0,
  };
}

/* ---------- 伤害数字 / 粒子 ---------- */
function createDmgNum(x,y,val,color,crit){
  return { kind:'dmg', x, y, val, color, crit:!!crit, t:0, dur:CFG.combat.damageNumberDur, vy:-1 };
}
function createParticle(x,y,color,n,spread){
  const arr=[];
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, sp=rnd(20,spread||90);
    arr.push({ kind:'particle', x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, t:0, dur:rnd(0.3,0.7), color, r:rnd(1.5,3.5) });
  }
  return arr;
}
