/* ============ UI：HUD / 技能栏 / 背包 / 悬浮提示 / 掉落推送 ============ */
const UI = {
  skills:[],        // 技能栏按钮 [{id, el, cdEl}]
  bagOpen:false,
  hoveringItem:null,

  init(){
    // 技能栏
    const bar = document.getElementById('skillbar');
    const skillDefs = [
      { id:'fire',  key:'1' },
      { id:'nova',  key:'2' },
      { id:'fury',  key:'3' },
    ];
    UI.skills = skillDefs.map(sd=>{
      const sk = document.createElement('div');
      sk.className='sk';
      sk.id='sk_'+sd.id;
      sk.innerHTML = `<div class="key">${sd.key}</div><span>${CFG.skills[sd.id].icon}</span><div class="cd"></div><div class="cost">${CFG.skills[sd.id].mp>0?CFG.skills[sd.id].mp:''}</div>`;
      sk.addEventListener('click', ()=> game.useSkill(sd.id));
      bar.appendChild(sk);
      return { id:sd.id, el:sk, cdEl:sk.querySelector('.cd'), cost:CFG.skills[sd.id].mp };
    });
    // 背包
    document.getElementById('invClose').addEventListener('click', ()=>UI.toggleBag(false));
    document.getElementById('bag').addEventListener('click', UI.onBagClick);
    // 屏幕按钮
    document.getElementById('startBtn').addEventListener('click', ()=>game.startRun());
    document.getElementById('retryBtn').addEventListener('click', ()=>game.startRun());
    document.getElementById('nextBtn').addEventListener('click', ()=>game.nextFloor());
    document.getElementById('menuBtn2').addEventListener('click', ()=>game.toMenu());
    document.getElementById('menuBtn3').addEventListener('click', ()=>game.toMenu());
    document.getElementById('tutorial').addEventListener('click', ()=>{ document.getElementById('tutorial').style.display='none'; game.paused=false; });
    // 移动端虚拟按钮：背包 / 翻滚 / 幻兽指令
    document.getElementById('btnBag').addEventListener('click', ()=>UI.toggleBag());
    document.getElementById('btnDodge').addEventListener('click', ()=>doDodge());
    document.getElementById('btnBeast').addEventListener('click', ()=>beastCommand());
    // 点击顶部等级框 → 切换角色属性面板（该面板原来没有任何入口，是死 UI）
    const lb=document.getElementById('levelbox');
    lb.style.cursor='pointer'; lb.title='点击查看角色属性';
    lb.addEventListener('click', ()=>{
      const s=document.getElementById('stats');
      s.style.display = (s.style.display==='block')? 'none':'block';
    });
  },

  updateHUD(){
    const p=game.player;
    document.getElementById('hpTxt').textContent = Math.max(0,Math.round(p.hp))+'/'+p.maxHp;
    document.getElementById('mpTxt').textContent = Math.round(p.mp)+'/'+p.maxMp;
    document.getElementById('playerhp').querySelector('div').style.width=(p.hp/p.maxHp*100)+'%';
    document.getElementById('playermp').querySelector('div').style.width=(p.mp/p.maxMp*100)+'%';
    const xpNeed = CFG.xpCurve[p.level]||0;
    const xpPct = xpNeed? Math.min(100,p.xp/xpNeed*100):0;
    document.getElementById('xpb').querySelector('div').style.width=xpPct+'%';
    document.getElementById('xpTxt').textContent = p.level>=CFG.xpCurve.length? 'MAX' : p.xp+'/'+xpNeed;
    document.getElementById('levelbox').innerHTML = p.level+'<small>猎魔人</small>';
    document.getElementById('floorbox').innerHTML = '层'+WORLD.floor+'<small>'+(WORLD.floor<=CFG.dungeon.maxFloors?'裂界地窟':'无尽深渊')+'</small>';
    document.getElementById('soulbox').innerHTML = p.souls+'<small>魂晶</small>';
    document.getElementById('killbox').innerHTML = p.kills+'<small>击杀</small>';

    // 技能冷却
    for(const s of UI.skills){
      const cd = p.skillCd[s.id];
      if(cd>0){
        s.cdEl.style.display='flex';
        s.cdEl.textContent = cd.toFixed(1);
        const total = CFG.skills[s.id].cd;
        s.el.style.filter = 'grayscale(0.7)';
      } else {
        s.cdEl.style.display='none';
        s.el.style.filter='none';
        if(p.mp < CFG.skills[s.id].mp){
          s.el.style.opacity=0.5;
        } else s.el.style.opacity=1;
      }
    }
    // 统计面板
    if(p.statsPanelDirty){
      document.getElementById('sAtk').textContent = Math.round(p.atk);
      document.getElementById('sSpd').textContent = p.speed.toFixed(2);
      document.getElementById('sCrit').textContent = fmtP(p.critChance);
      document.getElementById('sCritD').textContent = fmtP(p.critMult);
      document.getElementById('sMs').textContent = Math.round(p.moveSpeed);
      document.getElementById('sMaxHp').textContent = p.maxHp;
      document.getElementById('sArm').textContent = p.armor;
      document.getElementById('sDmg').textContent = (p.card? p.card.dmg:0)+'%';
      document.getElementById('sRegen').textContent = p.regen.toFixed(1);
      const sk = p.card? p.card.skillLv.strike+p.card.skillLv.fire+p.card.skillLv.nova+p.card.skillLv.fury : 0;
      document.getElementById('sSkill').textContent = sk>0? '+'+sk+' 级':'—';
      p.statsPanelDirty=false;
    }
    // 幻兽等级提示（放在等级旁？改用 feed 显示）
    // Boss 血条
    const boss = game.enemies.find(e=>e.boss&&!e.dead);
    const bw = document.getElementById('bosswrap');
    if(boss){
      bw.style.display='block';
      document.getElementById('bossbar').querySelector('div').style.width=(boss.hp/boss.maxHp*100)+'%';
      document.getElementById('bossTxt').textContent = boss.name+'  '+Math.round(boss.hp)+'/'+boss.maxHp;
    } else bw.style.display='none';
  },

  renderEquip(){
    const eq = document.getElementById('equips');
    eq.innerHTML='';
    const order=['weapon','armor','helm','ring','boots'];
    for(const slotId of order){
      const slot = CFG.loot.slots.find(s=>s.id===slotId);
      const it = game.player.equip[slotId];
      const d = document.createElement('div');
      d.className='eslot';
      d.dataset.slot=slotId;
      d.innerHTML = `
        <div class="slotname">${slot.name}</div>
        <div class="icon" style="border-color:${it?it.rarityColor:'#2c3342'}">${it?it.icon:'·'}</div>
        <div class="info"><b style="color:${it?it.rarityColor:'#6a7284'}">${it? it.name : '空'}</b>${it?'<span style="color:#8a93a6">'+(it.rarityName+' · 战力'+it.power)+'</span>':''}</div>`;
      if(it) d.addEventListener('click', (e)=>{
        e.stopPropagation();
        // 脱装：放回背包
        game.player.equip[slotId]=null;
        game.player.inv.push(it);
        recomputeStats(game.player);
        UI.renderEquip(); UI.renderBag();
      });
      eq.appendChild(d);
    }
    UI.renderBag();
  },

  renderBag(){
    const bag=document.getElementById('bag');
    const p=game.player;
    if(p.inv.length===0){
      bag.innerHTML='<div style="grid-column:1/-1;text-align:center;color:#6a7284;font-size:12px;padding:30px 0">背包空空如也，去裂界里刷装备吧</div>';
      return;
    }
    bag.innerHTML='';
    p.inv.forEach((it,idx)=>{
      const d=document.createElement('div');
      d.className='bslot';
      d.dataset.idx=idx;
      d.innerHTML=`<div class="icon">${it.icon}</div><div class="rname" style="color:${it.rarityColor}">${it.name}</div>`;
      d.addEventListener('mouseenter', ()=>{
        UI.showTooltip(it, d);
      });
      d.addEventListener('mouseleave', ()=>UI.hideTooltip());
      bag.appendChild(d);
    });
  },

  onBagClick(e){
    const slotEl = e.target.closest('.bslot');
    if(!slotEl) return;
    const idx=+slotEl.dataset.idx;
    const p=game.player;
    const it=p.inv[idx];
    // 穿戴（比较战力）
    const cur = p.equip[it.slot];
    if(cur){
      // 交换
      p.equip[it.slot]=it;
      p.inv[idx]=cur;
      showMsg('已换装：'+cur.name+' → '+it.name);
    } else {
      p.equip[it.slot]=it;
      p.inv.splice(idx,1);
      showMsg('已装备：'+it.name);
    }
    recomputeStats(p);
    UI.renderEquip(); UI.renderBag();
    UI.hideTooltip();
  },

  showTooltip(it, anchor){
    const tt=document.getElementById('itemtooltip');
    let affixes = it.affixes.map(a=>`<div class="it-affix">• ${affixText(a)}</div>`).join('');
    tt.innerHTML = `
      <div class="it-name" style="color:${it.rarityColor}">${it.icon} ${it.name}</div>
      <div class="it-slots">${it.slotName} · ${it.rarityName} · 物品等级${it.floor}${it.slot==='weapon'?' · 攻击 '+it.basePower:''}</div>
      ${affixes}
      <div class="it-power">战力估算：${it.power}</div>`;
    tt.style.display='block';
    const r = anchor.getBoundingClientRect();
    let x = r.left - 250, y = r.top;
    if(x<10) x = r.right+10;
    if(y+180>window.innerHeight) y = window.innerHeight-190;
    tt.style.left=x+'px'; tt.style.top=y+'px';
  },
  hideTooltip(){ document.getElementById('itemtooltip').style.display='none'; },

  toggleBag(force){
    UI.bagOpen = force!==undefined? force : !UI.bagOpen;
    document.getElementById('inv').style.display = UI.bagOpen? 'flex':'none';
    if(UI.bagOpen){ UI.renderEquip(); }
    game.paused = UI.bagOpen || game.screen!=='playing';
  },

  /* 关闭卡牌选择界面并恢复游戏 */
  hideCardPick(){
    const el=document.getElementById('cardpick');
    el.classList.add('hidden');
    el.style.display='none';
    game.paused=false;
  },

  /* 掉落推送 */
  feedLoot(item){
    const feed=document.getElementById('feed');
    const d=document.createElement('div');
    d.className='feed-item';
    d.style.borderLeftColor=item.rarityColor;
    d.innerHTML=`<span style="color:${item.rarityColor};font-weight:700">${item.icon} ${item.name}</span> <span style="color:#8a93a6;font-size:10px">${item.rarityName}·${item.slotName}</span>`;
    feed.prepend(d);
    while(feed.children.length>6) feed.lastChild.remove();
    setTimeout(()=>d.remove(),3000);
  },

  showMsg(text){
    const m=document.getElementById('msg');
    m.textContent=text; m.style.opacity=1;
    clearTimeout(m._t);
    m._t=setTimeout(()=>m.style.opacity=0,1600);
  },

  tutorial(){
    const t=document.getElementById('tutorial');
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints>0;
    t.innerHTML=`<b>裂界猎魔指引</b><br>
      ${isTouch
        ? '· <b>点地面</b>移动，<b>点怪物</b>锁定攻击，按住拖动持续移动<br>\
      · 底部按钮<b>释放技能</b>（自动瞄准最近敌人）<br>\
      · 右下按钮：<b>🎒背包</b> · <b>💨翻滚</b>（有无敌帧）· <b>🐺幻兽出击</b><br>\
      · 点击顶部<b>等级框</b>查看角色属性'
        : '· <b>左键</b>点地面移动，点怪物攻击<br>\
      · <b>右键</b>或<b>1/2/3</b> 释放技能（魔焰/暗影新星/狂暴）<br>\
      · <b>Shift</b> 疾跑，<b>空格</b> 翻滚闪避（有无敌帧）<br>\
      · <b>I</b> 打开背包换装；点击顶部<b>等级框</b>看属性'}
      <br>· 击杀魔物掉落装备与<b>魂晶</b>，靠近自动拾取并喂食幻兽<br>
      · 每 <b>5 层</b>有<b>裂界魔王</b>镇守，击败后战利品丰厚<br>
      · 清空本层开启<b>裂界之门</b>，进入下一层前在<b>2 张强化卡牌</b>中选 1 张（伤害/攻速/范围/技能等级…）<br>
      · 通关 <b>30 层</b>即为胜利，之后可继续深入无尽深渊
      <button class="tbtn" id="tutOk">开始猎杀</button>`;
    t.style.display='block';
    document.getElementById('tutOk').addEventListener('click', ()=>t.style.display='none');
    game.paused=true;
  }
};

/* 全局便捷函数 */
function showMsg(t){ UI.showMsg(t); }
function feedLoot(it){ UI.feedLoot(it); }
