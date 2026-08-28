/* ============ 精灵图资源加载 ============ */
const ASSETS = {
  player: null,
  beast: null,
  enemyMelee: null,
  enemyRanged: null,
  enemyBrute: null,
  boss: null,
  _loaded: 0,
  _total: 6,
  ready() { return this._loaded >= this._total; },

  load() {
    if (typeof Image === 'undefined') return;   // 兼容无头/Node 测试环境
    const base = 'assets/';
    const defs = {
      player: base + 'player.png',
      beast: base + 'beast.png',
      enemyMelee: base + 'enemy_melee.png',
      enemyRanged: base + 'enemy_ranged.png',
      enemyBrute: base + 'enemy_brute.png',
      boss: base + 'boss.png',
    };
    for (const k in defs) {
      const img = new Image();
      img.onload = () => { this._loaded++; };
      img.onerror = () => { this._loaded++; };   // 加载失败：渲染层自动回退到几何绘制
      img.src = defs[k];
      this[k] = img;
    }
  },

  getEnemy(type, elite) {
    if (type === 'boss') return this.boss;
    if (type === 'brute' || elite) return this.enemyBrute;
    if (type === 'ranged') return this.enemyRanged;
    return this.enemyMelee;
  }
};
