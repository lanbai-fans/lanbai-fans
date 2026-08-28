/* ============ 肉鸽卡牌：过层二选一强化（伤害/范围/攻速/技能等级…） ============ */

/* 卡池：普通 / 稀有 / 史诗 三档 */
const CARDS = [
  /* ---- 普通 ---- */
  { id:'atk1',    name:'力量印记', icon:'⚔️', rarity:'common', desc:'攻击力 +3',                    apply(p){ p.card.atk+=3; } },
  { id:'dmg1',    name:'锋刃祝福', icon:'🗡️', rarity:'common', desc:'所有伤害 +6%',                 apply(p){ p.card.dmg+=6; } },
  { id:'as1',     name:'疾风之爪', icon:'🌪️', rarity:'common', desc:'攻击速度 +8%',                 apply(p){ p.card.as+=8; } },
  { id:'hp1',     name:'坚韧之心', icon:'🛡️', rarity:'common', desc:'生命上限 +25 并回复 25',        apply(p){ p.card.hp+=25; }, heal:25 },
  { id:'ms1',     name:'轻盈之靴', icon:'👢', rarity:'common', desc:'移动速度 +8%',                  apply(p){ p.card.ms+=8; } },
  { id:'crit1',   name:'锐利之眼', icon:'👁️', rarity:'common', desc:'暴击率 +3%',                   apply(p){ p.card.crit+=0.03; } },
  { id:'critd1',  name:'致命打击', icon:'💥', rarity:'common', desc:'暴击伤害 +12%',                 apply(p){ p.card.critD+=0.12; } },
  { id:'regen1',  name:'再生符文', icon:'💚', rarity:'common', desc:'每秒回复生命 +2',               apply(p){ p.card.regen+=2; } },
  { id:'loot1',   name:'贪婪之印', icon:'💰', rarity:'common', desc:'装备掉率 +15%',                 apply(p){ p.card.loot+=15; } },
  { id:'beast1',  name:'幻兽之魂', icon:'🐺', rarity:'common', desc:'幻兽攻击力 +15%',               apply(p){ p.card.beastAtk+=15; } },

  /* ---- 稀有 ---- */
  { id:'atk2',    name:'蛮力印记', icon:'⚔️', rarity:'rare', desc:'攻击力 +6',                      apply(p){ p.card.atk+=6; } },
  { id:'dmg2',    name:'屠戮之势', icon:'🗡️', rarity:'rare', desc:'所有伤害 +12%',                  apply(p){ p.card.dmg+=12; } },
  { id:'as2',     name:'狂怒之速', icon:'🌪️', rarity:'rare', desc:'攻击速度 +14%',                  apply(p){ p.card.as+=14; } },
  { id:'hp2',     name:'钢铁之躯', icon:'🛡️', rarity:'rare', desc:'生命上限 +60 并回复 60',         apply(p){ p.card.hp+=60; }, heal:60 },
  { id:'skStrike',name:'裂风精通', icon:'✨', rarity:'rare', desc:'裂风斩等级+1：伤害+25%，范围+10%', apply(p){ p.card.skillLv.strike++; } },
  { id:'skFire',  name:'魔焰精通', icon:'🔥', rarity:'rare', desc:'魔焰等级+1：伤害+28%，弹体更大',   apply(p){ p.card.skillLv.fire++; } },
  { id:'skNova',  name:'新星精通', icon:'🌀', rarity:'rare', desc:'暗影新星等级+1：伤害+32%，范围+12%', apply(p){ p.card.skillLv.nova++; } },
  { id:'skFury',  name:'狂暴精通', icon:'🐺', rarity:'rare', desc:'魔灵狂暴等级+1：持续+18%，增伤更高', apply(p){ p.card.skillLv.fury++; } },
  { id:'range1',  name:'范围扩张', icon:'🎯', rarity:'rare', desc:'普攻与技能范围 +15%',            apply(p){ p.card.range+=15; } },
  { id:'crit2',   name:'暴击大师', icon:'⚡', rarity:'rare', desc:'暴击率 +5%',                      apply(p){ p.card.crit+=0.05; } },
  { id:'critd2',  name:'处刑者',   icon:'☠️', rarity:'rare', desc:'暴击伤害 +25%',                  apply(p){ p.card.critD+=0.25; } },
  { id:'soul1',   name:'魂晶洪流', icon:'💎', rarity:'rare', desc:'立即获得 12 魂晶',               apply(p){ p.souls+=12; } },

  /* ---- 史诗 ---- */
  { id:'atk3',    name:'魔君之力', icon:'⚔️', rarity:'epic', desc:'攻击力 +12',                     apply(p){ p.card.atk+=12; } },
  { id:'dmg3',    name:'毁灭化身', icon:'☄️', rarity:'epic', desc:'所有伤害 +20%',                  apply(p){ p.card.dmg+=20; } },
  { id:'as3',     name:'极速之魂', icon:'🌪️', rarity:'epic', desc:'攻击速度 +22%',                  apply(p){ p.card.as+=22; } },
  { id:'hp3',     name:'泰坦之躯', icon:'🛡️', rarity:'epic', desc:'生命上限 +110 并回复全满',        apply(p){ p.card.hp+=110; }, heal:'full' },
  { id:'skAll',   name:'全能精通', icon:'📖', rarity:'epic', desc:'所有技能等级 +1',                apply(p){ for(const k in p.card.skillLv) p.card.skillLv[k]++; } },
  { id:'beast3',  name:'幻兽王者', icon:'🐲', rarity:'epic', desc:'幻兽攻击+40%，生命+30%',         apply(p){ p.card.beastAtk+=40; p.card.beastHp+=30; } },
  { id:'immortal',name:'不朽之心', icon:'♥️', rarity:'epic', desc:'每秒回复+5，生命上限+40',        apply(p){ p.card.regen+=5; p.card.hp+=40; }, heal:40 },
];

const CARD_RARITY = {
  common:{ name:'普通', color:'#c8c8c8' },
  rare:  { name:'稀有', color:'#ffd700' },
  epic:  { name:'史诗', color:'#ff8a3d' },
};

/* 抽取两张互不相同的卡牌；Boss 层卡池质量更高 */
function rollCards(floor){
  const isBoss = floor % CFG.dungeon.bossEvery === 0;
  const w = isBoss? { common:4, rare:10, epic:8 } : { common:10, rare:6, epic:3 };
  const out=[]; const used=new Set();
  let guard=0;
  while(out.length<2 && guard++<80){
    let total=0;
    for(const c of CARDS) if(!used.has(c.id)) total += w[c.rarity]||0;
    if(total<=0) break;
    let roll=Math.random()*total, chosen=null;
    for(const c of CARDS){
      if(used.has(c.id)) continue;
      roll -= w[c.rarity]||0;
      if(roll<=0){ chosen=c; break; }
    }
    if(!chosen) chosen = CARDS.find(c=>!used.has(c.id));
    if(chosen){ used.add(chosen.id); out.push(chosen); }
  }
  return out;
}

/* 应用卡牌效果（含回复/回满）并重算属性 */
function applyCard(card){
  const p = game.player;
  card.apply(p);
  recomputeStats(p);
  if(game.beast) recomputeBeast(game.beast);
  if(card.heal==='full') p.hp = p.maxHp;
  else if(card.heal) p.hp = Math.min(p.maxHp, p.hp + card.heal);
  if(card.id==='soul1') showMsg('获得 12 魂晶');
}

/* 进入裂界之门：本层清空 → 二选一卡牌 → 下一层 */
function enterDoor(){
  game.mouse.world=null; game.mouse.target=null;
  if(game.floor === CFG.dungeon.maxFloors){
    // 第 30 层 Boss 被击败时已触发胜利；此处兜底
    gameOver(true);
    return;
  }
  showCardPick();
}

/* 玩家选定卡牌 */
function pickCard(card){
  applyCard(card);
  UI.hideCardPick();
  advanceFloor();
}

/* 弹出选卡界面（游戏暂停） */
function showCardPick(){
  const cards = rollCards(game.floor);
  document.getElementById('cardSub').textContent = '第 '+game.floor+' 层已清空 · 在两张卡牌中选择一张';
  const row = document.getElementById('cardRow');
  row.innerHTML='';
  for(const c of cards){
    const rar = CARD_RARITY[c.rarity];
    const d = document.createElement('div');
    d.className='ccard';
    d.style.borderColor = rar.color;
    d.innerHTML = `
      <div class="cc-icon">${c.icon}</div>
      <div class="cc-name">${c.name}</div>
      <div class="cc-rare" style="color:${rar.color}">${rar.name}</div>
      <div class="cc-desc">${c.desc}</div>`;
    d.addEventListener('click', ()=>pickCard(c));
    row.appendChild(d);
  }
  const el = document.getElementById('cardpick');
  el.classList.remove('hidden');
  el.style.display='flex';
  game.paused = true;
}
