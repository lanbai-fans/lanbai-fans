/* ============ 装备掉落与词缀系统 ============ */

/* 根据稀有度权重抽取稀有度 */
function rollRarity(rng){
  rng = rng || Math.random;
  const total = CFG.loot.rarity.reduce((s,r)=>s+r.weight,0);
  let roll = rng()*total;
  for(const r of CFG.loot.rarity){
    roll -= r.weight;
    if(roll<=0) return r;
  }
  return CFG.loot.rarity[0];
}

/* 生成一件装备（floor 决定物品等级强度） */
function rollItem(floor, forcedRarity){
  const rng = Math.random;
  const rarity = forcedRarity || rollRarity();
  const slot = pick(CFG.loot.slots);
  const affixN = rndi(rarity.affixN[0], rarity.affixN[1]);
  const affixes = [];
  const used = new Set();
  for(let i=0;i<affixN;i++){
    const pool = CFG.loot.affixPool.filter(a=>!used.has(a.id));
    if(pool.length===0) break;
    const aff = pick(pool);
    used.add(aff.id);
    // 数值随楼层与稀有度成长
    const lvlScale = Math.pow(1.10, floor-1);
    let v;
    if(aff.stat==='speed'||aff.stat==='critChance'||aff.stat==='critMult'||aff.stat==='moveSpeed'){
      v = (aff.base + aff.perLvl*(floor-1)*0.8) * (1 + rarity.weight/100*0.15) * lvlScale;
      v = Math.round(v*1000)/10; // 保留一位小数（百分比）
    } else {
      v = (aff.base + aff.perLvl*(floor-1)*1.2) * (1 + rarity.weight/100*0.2) * lvlScale;
      v = Math.round(v);
    }
    affixes.push({ ...aff, value: v });
  }
  // 基础白板值（武器攻击力）随稀有度与楼层
  const basePower = Math.round((8 + (floor-1)*3.2) * (1 + rarity.weight/100*0.35));
  const name = pick(CFG.loot.names.prefix) + (slot.id==='weapon'? pick(CFG.loot.names.weapon) : pick(CFG.loot.names[slot.id==='armor'?'armor':slot.id==='helm'?'helm':slot.id==='ring'?'ring':'boots']));
  // 战力估算
  let power = basePower*2;
  for(const a of affixes){
    if(a.stat==='atk') power += a.value*2;
    else if(a.stat==='maxHp') power += a.value*0.5;
    else if(a.stat==='speed') power += a.value*400;
    else if(a.stat==='critChance') power += a.value*300;
    else if(a.stat==='critMult') power += a.value*150;
    else if(a.stat==='armor') power += a.value*1.2;
    else if(a.stat==='moveSpeed') power += a.value*200;
  }
  return {
    uid: 'item_'+Math.random().toString(36).slice(2,9),
    name, slot: slot.id, slotName: slot.name, icon: slot.icon,
    rarity: rarity.id, rarityName: rarity.name, rarityColor: rarity.color,
    basePower, affixes, power: Math.round(power), floor,
    level: floor,
  };
}

/* 根据怪物类型结算掉落（返回掉落物品列表 + 魂晶） */
function rollDrops(floor, enemyType){
  const drops = [];
  let souls = 0;
  const cfg = CFG.loot;
  const rng = Math.random;
  const L = floor;
  if(enemyType==='boss'){
    for(let i=0;i<cfg.bossDrops;i++){
      // Boss 掉落：至少一件稀有，其余按阶梯
      let forced = null;
      if(i===0) forced = { id:'rare', name:'稀有', color:'#ffd700', weight:14, affixN:[2,3] };
      drops.push(rollItem(L, forced));
    }
    souls = CFG.enemies.boss.soul;
  } else if(enemyType==='elite'){
    // 精英必掉一件，保底魔法
    let forced = chance(0.5)? null : { id:'magic', name:'魔法', color:'#6bb5ff', weight:30, affixN:[1,2] };
    drops.push(rollItem(L, forced));
    if(chance(0.35)) drops.push(rollItem(L));
    souls = CFG.enemies.elite.soul;
  } else {
    if(chance(cfg.baseDropChance)) drops.push(rollItem(L));
    souls = chance(cfg.soulChance)? CFG.enemies.melee.soul : 0;
  }
  return { drops, souls };
}

/* 词缀转文本 */
function affixText(a){
  let v;
  if(a.stat==='speed'||a.stat==='critChance'||a.stat==='critMult'||a.stat==='moveSpeed'){
    v = (Math.round(a.value*10)/10)+'%';
  } else v = Math.round(a.value);
  return a.desc.replace('{v}', v);
}
