/* ============================================================
 * 魔域·裂界 — 数值配置（单一配置源 ruleset_id: myr-demo-001）
 * 本文件是 GDD、Demo、测试共享的权威参数表。
 * ============================================================ */
const RULESET_ID = 'myr-demo-001';

const CFG = {
  ruleset_id: RULESET_ID,

  /* ---- 玩家基础 ---- */
  player: {
    maxHp: 150, maxMp: 100,
    baseAtk: 14, baseSpeed: 1.15,     // 攻速 次/秒
    critChance: 0.08, critMult: 1.6,
    moveSpeed: 175, sprintMult: 1.45,
    dodgeCost: 20, dashDistance: 110, dashCooldown: 2.2, invulnTime: 0.35,
    regen: 4, mpRegen: 6,             // 每秒回血/回蓝
    pickupRadius: 34,
  },

  /* ---- 幻兽（魔域特色：跟随作战） ---- */
  beast: {
    enabled: true, name: '幽炎魔灵',
    maxHp: 110, baseAtk: 10, baseSpeed: 0.95,
    followDist: 60, attackRange: 74, engageRange: 240,
    evolveLevels: [3, 6],             // 进化门槛（喂食魂晶后）
    feedCost: 5,                       // 每级所需魂晶
    maxLevel: 10,
    atkPerLevel: 1.8, hpPerLevel: 14, speedPerLevel: 0.05,
  },

  /* ---- 技能 ---- */
  skills: {
    // 左键普攻
    strike: { name: '裂风斩', mp: 0, cd: 0, range: 70, arc: 1.6, mult: 1.0 },
    // 右键/1 号技能
    fire:   { name: '魔焰冲击', mp: 18, cd: 2.5, range: 300, radius: 46, mult: 1.9, kind: 'projectile', speed: 620, icon: '🔥' },
    // 2 号技能
    nova:   { name: '暗影新星', mp: 26, cd: 5.0, radius: 150, mult: 1.4, slow: 0.5, slowDur: 2.5, kind: 'nova', icon: '🌀' },
    // 3 号技能
    fury:   { name: '魔灵狂暴', mp: 20, cd: 8.0, dur: 6, atkMult: 0.45, beastMult: 0.8, kind: 'buff', icon: '🐺' },
  },

  /* ---- 经验曲线（升到 L+1 所需总经验） ---- */
  xpCurve: [0, 18, 46, 88, 150, 230, 330, 450, 600, 780, 990, 1230, 1500, 1800, 2130, 2500, 2900, 3340, 3820, 4340],

  /* ---- 地窟 ---- */
  dungeon: {
    baseMobHp: 26, hpGrow: 1.27,
    baseMobDmg: 5, dmgGrow: 1.15,
    goldMult: 1.05,
    spawnBudget: { base: 12, perFloor: 7, max: 60 },  // 每层怪物预算
    maxFloors: 30,                                    // 地窟总层数（第30层终局魔王）
    bossEvery: 5,                                     // 每5层为 Boss 层（5/10/15/20/25/30）
    endless: true,                                    // 通关30层后可继续深入无尽模式
    eliteChance: 0.12,                                // 普通怪变异精英概率
    waveTimer: 0.8,                                   // 出生间隔
    firstSpawnDelay: 3.0,                             // 首波延迟
  },

  /* ---- 掉落（暗黑式稀有度阶梯） ---- */
  loot: {
    rarity: [
      { id: 'common',   name: '普通',   color: '#c8c8c8', weight: 52, affixN: [0,1] },
      { id: 'magic',    name: '魔法',   color: '#6bb5ff', weight: 30, affixN: [1,2] },
      { id: 'rare',     name: '稀有',   color: '#ffd700', weight: 14, affixN: [2,3] },
      { id: 'legend',   name: '传说',   color: '#ff8a3d', weight: 4,  affixN: [3,4] },
    ],
    baseDropChance: 0.22,             // 普通怪掉率
    eliteDropChance: 1.0,             // 精英必掉
    bossDrops: 3,
    soulChance: 0.5,                  // 怪物掉魂晶概率
    bossSoul: 8,
    affixPool: [
      { id: 'atk',  name: '攻击',  base: 3,  perLvl: 1.0, stat: 'atk',   desc: '+{v} 攻击' },
      { id: 'hp',   name: '生命',  base: 12, perLvl: 5,   stat: 'maxHp', desc: '+{v} 生命上限' },
      { id: 'spd',  name: '攻速',  base: 0.06, perLvl: 0.01, stat: 'speed', desc: '+{v}% 攻速' },
      { id: 'crit', name: '暴击',  base: 0.03, perLvl: 0.005, stat: 'critChance', desc: '+{v}% 暴击' },
      { id: 'critd',name: '爆伤',  base: 0.12, perLvl: 0.02,  stat: 'critMult', desc: '+{v}% 暴伤' },
      { id: 'arm',  name: '护甲',  base: 2,   perLvl: 0.6, stat: 'armor', desc: '+{v} 护甲' },
      { id: 'ms',   name: '移速',  base: 0.04, perLvl: 0.008, stat: 'moveSpeed', desc: '+{v}% 移速' },
    ],
    slots: [
      { id: 'weapon', name: '武器',  icon: '🗡️' },
      { id: 'armor',  name: '铠甲',  icon: '🛡️' },
      { id: 'helm',   name: '头盔',  icon: '⛑️' },
      { id: 'ring',   name: '戒指',  icon: '💍' },
      { id: 'boots',  name: '战靴',  icon: '👢' },
    ],
    names: {
      prefix: ['血纹', '魔渊', '噬魂', '龙脊', '亡语', '裂界', '幽冥', '赤焰', '霜语', '残暴'],
      weapon: ['猎魔之刃', '裂骨剑', '赤月镰', '斩魔戟', '穿云枪'],
      armor:  ['荆棘甲', '铁壁铠', '噬魔袍', '龙骨胸甲'],
      helm:   ['魔瞳盔', '血角盔', '冥思冠', '猎魔面罩'],
      ring:   ['魂戒', '血戒', '暗月指环', '魔契之戒'],
      boots:  ['疾风靴', '踏魂靴', '幽冥战靴', '裂界之靴'],
    },
  },

  /* ---- 战斗 ---- */
  combat: {
    playerDefenseFactor: 0.06,        // 护甲减伤公式: 1/(1+armor*f)
    enemyKb: 90,                      // 怪物受击击退
    damageNumberDur: 0.8,
  },

  /* ---- 敌人 ---- */
  enemies: {
    // 三类基础怪 + 精英变异
    melee:   { name: '魔化猎犬', hpMult: 1.0, dmgMult: 1.0,  speed: 130, atkCd: 1.1, range: 42, radius: 16, xp: 6,  soul: 1, color: '#c0392b', size: 1.0 },
    ranged:  { name: '冥火妖',  hpMult: 0.8, dmgMult: 0.9,  speed: 95,  atkCd: 2.2, range: 320, radius: 14, xp: 8,  soul: 1, color: '#8e44ad', size: 0.9, ranged: true },
    brute:   { name: '深渊巨魔',hpMult: 2.4, dmgMult: 1.5,  speed: 72,  atkCd: 2.4, range: 60, radius: 24, xp: 14, soul: 2, color: '#1e8449', size: 1.7 },
    elite:   { name: '精英',    hpMult: 3.4, dmgMult: 1.6,  speed: 1.08, atkCd: 0.9, range: 46, radius: 20, xp: 40, soul: 4, color: '#f39c12', size: 1.5 },
    boss:    { name: '裂界魔王',hpMult: 16,  dmgMult: 2.2,  speed: 92,  atkCd: 1.5, range: 90, radius: 34, xp: 200, soul: 15, color: '#e74c3c', size: 2.6, boss: true },
  },

  /* ---- 杂项 ---- */
  misc: {
    killCam: 0.15,        // 击杀震屏
    hurtFlash: 0.3,
  }
};
