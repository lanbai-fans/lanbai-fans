/* ============ 战斗逻辑：伤害结算、技能、敌人AI、掉落生成 ============ */

/* 护甲减伤 */
function damageReduction(armor){
  return 1 - 1/(1 + armor*CFG.combat.playerDefenseFactor);
}

/* 对敌人造成伤害 */
function damageEnemy(e, amount, player, isCrit){
  if(e.dead) return;
  e.hp -= amount;
  e.hurtFlash = CFG.misc.hurtFlash;
  e.aggro = true; e.aggroTimer = 3;
  // 击退（方向：从玩家指向敌人，把怪推离玩家）
  const a = angTo(player, e);
  e.x += Math.cos(a)*CFG.combat.enemyKb*0.4;
  e.y += Math.sin(a)*CFG.combat.enemyKb*0.4;
  // 伤害数字
  const col = isCrit? '#ffd700' : '#ffffff';
  const num = Math.round(amount);
  fx.dmgs.push(createDmgNum(e.x, e.y-rnd(10,26), num, col, isCrit));
  if(e.hp<=0) killEnemy(e, player);
}

function killEnemy(e, player){
  e.dead = true;
  player.kills++;
  // 记录最后击杀位置：本层清空后，裂界之门在最后一只怪的脚下生成
  game.lastKillPos = { x: e.x, y: e.y };
  // 经验
  const xp = e.xp;
  gainXp(player, xp);
  // 掉落：魂晶以地面掉落物形式生成（靠近拾取 → 自动喂食幻兽），装备同理
  const { drops, souls } = rollDrops(WORLD.floor, e.type==='elite'?'elite':(e.boss?'boss':'normal'));
  if(souls>0){
    fx.drops.push(createDrop(e.x+rnd(-16,16), e.y+rnd(-16,16), null, true, souls));
  }
  for(const item of drops){
    fx.drops.push(createDrop(e.x+rnd(-24,24), e.y+rnd(-24,24), item));
    feedLoot(item);
  }
  // 精英词缀死亡特效
  if(e.eliteAffix){
    if(e.eliteAffix.id==='venom'){
      for(let i=0;i<14;i++){
        const a=Math.random()*Math.PI*2, sp=rnd(30,120);
        fx.particles.push({kind:'particle',x:e.x,y:e.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,dur:rnd(.5,.9),color:'#7d3c98',r:rnd(2,5)});
      }
    }
    if(e.eliteAffix.id==='spawn'){
      for(let i=0;i<2;i++){
        const p = findSpawnNear(e.x,e.y,16,10);
        const pup = createEnemy('melee', p.x, p.y, WORLD.floor);
        pup.hp = Math.round(pup.maxHp*0.4); pup.maxHp = pup.hp;
        pup.speed *= 1.2;
        game.spawnQueue.push(pup);
      }
    }
  }
  fx.shake = Math.max(fx.shake, e.boss?0.5:0.22);
  // Boss 击败：剧情层 → 胜利；无尽层 Boss 只是奖励
  if(e.boss){
    game.bossDefeated = true;
    if(WORLD.floor === CFG.dungeon.maxFloors){
      gameOver(true);
      return;
    }
    showMsg('魔王已陨落！ 裂界之门开启');
  }
  // 粒子
  fx.particles.push(...createParticle(e.x,e.y,e.color,10,100));
}

function gainXp(player, amt){
  player.xp += amt;
  let leveled=false;
  while(player.level < CFG.xpCurve.length && player.xp >= CFG.xpCurve[player.level]){
    player.xp -= CFG.xpCurve[player.level];
    player.level++;
    // 等级成长（maxHp/maxMp）由 recomputeStats 统一计算，这里只做升级回血
    recomputeStats(player);
    player.hp = Math.min(player.maxHp, player.hp + 20);
    player.mp = Math.min(player.maxMp, player.mp + 12);
    leveled=true;
    fx.particles.push(...createParticle(player.x,player.y,'#ffd700',18,140));
    showMsg('等级提升！ 猎魔人 Lv.'+player.level);
  }
  return leveled;
}

/* ---------- 玩家技能释放 ---------- */
/* 技能等级（卡牌强化：1 + 额外等级） */
function skillLevel(player, id){
  const c = player && player.card;
  return 1 + ((c && c.skillLv && c.skillLv[id]) || 0);
}
/* 卡牌范围加成系数（普攻/技能范围 +%） */
function cardRangeMult(player){
  return 1 + ((player && player.card && player.card.range) || 0)/100;
}
/* 狂暴期间额外伤害（随狂暴等级成长） */
function furyAtkBonus(player){
  return player.furyT>0 ? CFG.skills.fury.atkMult + 0.12*(skillLevel(player,'fury')-1) : 0;
}

function playerMelee(player, enemies){
  const ang = player.facing;
  const lv = skillLevel(player,'strike');
  const range = CFG.skills.strike.range * (1+0.10*(lv-1)) * cardRangeMult(player);
  const arc = CFG.skills.strike.arc;
  const mult = CFG.skills.strike.mult * (1+0.25*(lv-1)) + furyAtkBonus(player);
  player.attackAnim = 0.25;
  let hitAny=false;
  for(const e of enemies){
    if(e.dead) continue;
    const d = dist(player,e);
    if(d < range+e.radius){
      const a = angTo(player,e);
      let diff = a - ang;
      while(diff>Math.PI) diff-=2*Math.PI;
      while(diff<-Math.PI) diff+=2*Math.PI;
      if(Math.abs(diff) < arc/2 + 0.3){
        const dmg = calcPlayerDmg(player, mult);
        damageEnemy(e, dmg, player, isCritRoll(player));
        hitAny=true;
      }
    }
  }
  if(hitAny) fx.particles.push(...createParticle(player.x+Math.cos(ang)*30, player.y+Math.sin(ang)*30, '#ffaa55', 6, 60));
}

function playerFire(player, enemies, aimX, aimY){
  const ang = angTo(player, {x:aimX,y:aimY});
  player.facing = ang;
  const lv = skillLevel(player,'fire');
  const mult = CFG.skills.fire.mult * (1+0.28*(lv-1)) + furyAtkBonus(player);
  const radius = 7 * (1+0.08*(lv-1)) * cardRangeMult(player);
  const dmg = calcPlayerDmg(player, mult);
  fx.projectiles.push(createProjectile(player.x+Math.cos(ang)*26, player.y+Math.sin(ang)*26, ang, CFG.skills.fire.speed, dmg, 'player', '#ff8a3d', radius));
  fx.particles.push(...createParticle(player.x+Math.cos(ang)*20, player.y+Math.sin(ang)*20, '#ff8a3d', 8, 70));
}

function playerNova(player, enemies){
  const lv = skillLevel(player,'nova');
  const radius = CFG.skills.nova.radius * (1+0.12*(lv-1)) * cardRangeMult(player);
  const mult = CFG.skills.nova.mult * (1+0.32*(lv-1)) + furyAtkBonus(player);
  for(const e of enemies){
    if(e.dead) continue;
    if(dist(player,e) < radius+e.radius){
      const dmg = calcPlayerDmg(player, mult);
      damageEnemy(e, dmg, player, isCritRoll(player));
      // 减速只通过 slowT 生效（updateEnemy 中按 baseSpd 计算），不直接改 e.speed 避免永久叠加
      e.slowT = CFG.skills.nova.slowDur * (1+0.15*(lv-1));
    }
  }
  // 动画环
  fx.rings.push({x:player.x,y:player.y, t:0, dur:0.35, color:'#9b59b6', maxR:radius});
  fx.particles.push(...createParticle(player.x,player.y,'#9b59b6',16,120));
}

function playerFury(player, beast){
  const lv = skillLevel(player,'fury');
  player.furyT = CFG.skills.fury.dur * (1+0.18*(lv-1));
  beast.mode='attack';
  beast.commandCd = 6;
  fx.rings.push({x:player.x,y:player.y,t:0,dur:0.4,color:'#e67e22',maxR:90});
  fx.particles.push(...createParticle(player.x,player.y,'#e67e22',14,110));
  showMsg('魔灵狂暴！ 攻击力大幅提升');
}

function calcPlayerDmg(player, mult){
  // 基础攻击 × 倍率 × 卡牌伤害加成
  return player.atk * mult * (1 + ((player.card && player.card.dmg)||0)/100);
}
function isCritRoll(player){
  return Math.random() < player.critChance;
}
function rollPlayerCritDmg(player, dmg){
  return Math.random() < player.critChance ? dmg*player.critMult : dmg;
}

/* ---------- 敌人 AI ---------- */
function updateEnemy(e, player, enemies, dt){
  e.anim += dt*6;
  if(e.hurtFlash>0) e.hurtFlash-=dt;
  if(e.slowT>0) e.slowT-=dt;
  if(e.atkAnim>0) e.atkAnim-=dt;   // 攻击动画按时间衰减（原在渲染层按帧衰减，帧率不稳时会卡住）
  e.atkTimer -= dt;
  // 仇恨
  const d = dist(e, player);
  if(d < 360){ e.aggro=true; e.aggroTimer=3; }
  if(e.aggroTimer>0) e.aggroTimer-=dt; else if(d>420) e.aggro=false;

  if(e.dead) return;
  const baseSpd = e.speed * (e.slowT>0?0.6:1);

  if(e.ranged){
    // 远程怪：保持距离射击
    e.facing = angTo(e, player);
    if(d < 300 && d > 120){
      e.x -= Math.cos(e.facing)*baseSpd*dt;
      e.y -= Math.sin(e.facing)*baseSpd*dt;
    } else if(d > 300){
      e.x += Math.cos(e.facing)*baseSpd*dt;
      e.y += Math.sin(e.facing)*baseSpd*dt;
    }
    e.shootCd -= dt;
    if(e.shootCd<=0 && d<360){
      e.shootCd = e.atkCd;
      e.atkAnim=0.3;
      const dmg = Math.round(e.dmg * rnd(0.9,1.1));
      fx.projectiles.push(createProjectile(e.x, e.y, e.facing, 260, dmg, 'enemy', e.color, 6));
      // 远程攻击预告光效
      fx.rings.push({x:e.x,y:e.y,t:0,dur:0.25,color:'#e74c3c',maxR:20});
    }
  } else {
    if(e.aggro){
      e.facing = angTo(e, player);
      if(d > e.range*0.7){
        e.x += Math.cos(e.facing)*baseSpd*dt;
        e.y += Math.sin(e.facing)*baseSpd*dt;
      } else {
        e.x -= Math.cos(e.facing)*baseSpd*0.4*dt;
        e.y -= Math.sin(e.facing)*baseSpd*0.4*dt;
      }
      // 近战攻击
      if(e.atkTimer<=0 && d < e.range+e.radius+18){
        e.atkTimer = e.atkCd;
        e.atkAnim = 0.3;
        // 攻击命中玩家
        const dmg = Math.round(e.dmg * rnd(0.85,1.15));
        damagePlayer(dmg, e);
        fx.particles.push(...createParticle(player.x,player.y,'#ff5555',6,50));
      }
    }
  }
  resolveCollision(e, e.radius);
  // 精英词缀被动
  if(e.eliteAffix && e.eliteAffix.id==='frost' && e.aggro){
    // 冰甲：受击时已处理（在damageEnemy可加，简化跳过）
  }
}

function damagePlayer(amount, source){
  const p = game.player;
  if(p.invuln>0 || game.paused) return;
  const red = damageReduction(p.armor);
  const final = Math.max(1, Math.round(amount*(1-red)));
  p.hp -= final;
  p.hurtFlash = CFG.misc.hurtFlash;
  fx.shake = Math.max(fx.shake, 0.3);
  fx.particles.push(...createParticle(p.x,p.y,'#ff5555',10,70));
  fx.dmgs.push(createDmgNum(p.x,p.y-rnd(10,20),final,'#ff6666',false));
  if(p.hp<=0){
    p.hp=0;
    gameOver(false);
  }
}

/* ---------- 幻兽 AI ---------- */
function updateBeast(b, player, enemies, dt){
  if(!b.alive) return;
  b.anim += dt*5;
  b.cd -= dt;
  b.commandCd -= dt;
  // 找目标
  if(b.mode==='attack' || b.commandCd>0){
    if(!b.target || b.target.dead){
      let best=null,bd=1e9;
      for(const e of enemies){
        if(e.dead) continue;
        const d=dist(b,e);
        if(d<bd){bd=d;best=e;}
      }
      b.target=best;
    }
    if(b.target){
      const d=dist(b,b.target);
      if(d>CFG.beast.attackRange*0.6){
        const a=angTo(b,b.target);
        b.x+=Math.cos(a)*b.speed*220*dt;
        b.y+=Math.sin(a)*b.speed*220*dt;
      }
      if(b.cd<=0 && d<CFG.beast.attackRange+b.target.radius+16){
        b.cd = 1/b.speed;
        b.anim = -0.2;
        const dmg = Math.round(b.atk*rnd(0.9,1.1));
        damageEnemy(b.target, dmg, player, false);
        fx.particles.push(...createParticle(b.target.x,b.target.y,'#9b59b6',5,50));
      }
    }
  }
  // 跟随玩家
  const d = dist(b, player);
  if(d > CFG.beast.followDist && !b.target){
    const a = angTo(b, player);
    b.x += Math.cos(a)*260*dt;
    b.y += Math.sin(a)*260*dt;
  }
  resolveCollision(b, 12);
}
