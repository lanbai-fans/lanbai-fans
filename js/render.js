/* ============ 2.5D 渲染器 ============ */
const Render = {
  ctx: null, canvas: null, w:0, h:0,
  cam: { cx:0, cy:0, ox:0, oy:0, zoom:1.0 },
  fog: null,
  init(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', ()=>this.resize());
  },
  resize(){
    const dpr = Math.min(window.devicePixelRatio||1, 2);   // 高清屏适配
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w*dpr);
    this.canvas.height = Math.round(this.h*dpr);
    this.canvas.style.width = this.w+'px';
    this.canvas.style.height = this.h+'px';
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.cam.ox = this.w/2;
    this.cam.oy = this.h*0.52;
  },
  resetCam(){ this.cam.cx=0; this.cam.cy=0; },

  /* 地面纹理（预生成菱形地砖） */
  _groundPattern:null,
  makeGroundPattern(){
    const c = document.createElement('canvas');
    c.width = 96; c.height = 84;
    const g = c.getContext('2d');
    g.fillStyle = '#14161d';
    g.fillRect(0,0,96,84);
    // 菱形地砖
    const hw=48, hh=42;
    g.strokeStyle = 'rgba(255,255,255,0.03)';
    g.lineWidth=1;
    for(let gy=-1;gy<2;gy++){
      for(let gx=-1;gx<2;gx++){
        const cx=gx*hw, cy=gy*hh;
        g.beginPath();
        g.moveTo(cx, cy-hh/2);
        g.lineTo(cx+hw/2, cy);
        g.lineTo(cx, cy+hh/2);
        g.lineTo(cx-hw/2, cy);
        g.closePath();
        g.fillStyle = (gx+gy)%2===0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.05)';
        g.fill(); g.stroke();
      }
    }
    this._groundPattern = this.ctx.createPattern(c,'repeat');
  },

  draw(){
    const ctx = this.ctx, cam=this.cam;
    if(!game.player) return;   // 未开始游戏不渲染实体
    ctx.clearRect(0,0,this.w,this.h);
    // 震屏：整体位移，draw() 末尾统一 restore（修复原先 save 无 restore 导致画面累积漂移）
    ctx.save();
    if(fx.shake>0){
      ctx.translate((Math.random()-0.5)*fx.shake*14, (Math.random()-0.5)*fx.shake*14);
    }
    // 背景
    const bg = ctx.createRadialGradient(this.w/2,this.h/2,50,this.w/2,this.h/2,this.w*0.7);
    bg.addColorStop(0,'#1a1d27'); bg.addColorStop(1,'#07080d');
    ctx.fillStyle=bg; ctx.fillRect(0,0,this.w,this.h);

    if(!this._groundPattern) this.makeGroundPattern();
    // 绘制等距地面（大范围）
    ctx.save();
    ctx.translate(cam.ox, cam.oy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.cx, -cam.cy);
    // 世界范围地面菱形
    const size = WORLD.size;
    const topLeft = toScreen({x:0,y:0}, cam);
    const w_px = size*2.2;
    ctx.fillStyle = this._groundPattern;
    ctx.fillRect(topLeft.x-w_px, topLeft.y-w_px, w_px*2, w_px*2);
    ctx.restore();

    // 收集可绘制对象并按 iso 深度排序（越靠屏幕下方越后画）
    const drawables = [];
    // 地面物体：障碍物
    for(const ob of WORLD.obstacles){
      drawables.push({ type:'obstacle', ob, depth: isoV(ob.x, ob.y), y:ob.y });
    }
    // 掉落物
    for(const d of fx.drops) if(!d.taken) drawables.push({type:'drop', d, depth: isoV(d.x,d.y)});
    // 敌人
    for(const e of game.enemies) if(!e.dead) drawables.push({type:'enemy', e, depth: isoV(e.x,e.y)});
    // 幻兽
    if(game.beast.alive) drawables.push({type:'beast', b:game.beast, depth: isoV(game.beast.x,game.beast.y)});
    // 裂界之门
    if(game.doorActive && game.doorPos) drawables.push({type:'door', depth: isoV(game.doorPos.x,game.doorPos.y)});
    // 玩家
    drawables.push({type:'player', p:game.player, depth: isoV(game.player.x,game.player.y)});
    // 投射物（半透明，浅层）
    for(const pr of fx.projectiles) drawables.push({type:'projectile', pr, depth: isoV(pr.x,pr.y)});

    drawables.sort((a,b)=>a.depth-b.depth);
    for(const d of drawables){
      switch(d.type){
        case 'obstacle': this.drawObstacle(d.ob); break;
        case 'drop': this.drawDrop(d.d); break;
        case 'enemy': this.drawEnemy(d.e); break;
        case 'beast': this.drawBeast(d.b); break;
        case 'door': this.drawDoor(); break;
        case 'player': this.drawPlayer(d.p); break;
        case 'projectile': this.drawProjectile(d.pr); break;
      }
    }

    // 特效层（半透明、不参与深度排序）
    this.drawFx();
    // 伤害数字
    for(const n of fx.dmgs) this.drawDmgNum(n);
    // 环境雾效 / 光晕
    this.drawAmbient();
    ctx.restore();   // 结束震屏位移
  },

  /* 世界坐标绘制辅助 */
  _wp(x,y){ return toScreen({x,y}, this.cam); },

  /* 障碍物：带高度的 2.5D 石块/石柱 */
  drawObstacle(ob){
    const ctx=this.ctx;
    const s=toScreen({x:ob.x,y:ob.y}, this.cam);
    const h = ob.h; // 地面单位
    const hgt = Math.min(h,80)*0.55; // 高度（px）
    const wx=ob.w, wy=ob.h;
    // 顶部菱形面
    const cx=s.x, cy=s.y;
    const halfW = wx*this.cam.zoom*0.62, halfH = wy*this.cam.zoom*0.36;
    // 侧壁
    ctx.fillStyle = ob.type==='column'? '#2a2e3a' : '#33384a';
    ctx.beginPath();
    ctx.moveTo(cx-halfW, cy-halfH);
    ctx.lineTo(cx+halfW, cy-halfH);
    ctx.lineTo(cx+halfW, cy+halfH);
    ctx.lineTo(cx-halfW, cy+halfH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1; ctx.stroke();
    // 顶面
    const ty = cy - halfH;
    ctx.fillStyle = ob.type==='column'? '#3d4354' : '#4a5164';
    ctx.beginPath();
    ctx.moveTo(cx-halfW, ty);
    ctx.lineTo(cx, ty-halfH);
    ctx.lineTo(cx+halfW, ty);
    ctx.lineTo(cx, ty+halfH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.stroke();
    // 顶部装饰（发光符文点）
    ctx.fillStyle = 'rgba(216,169,74,0.5)';
    ctx.beginPath(); ctx.arc(cx, ty, 3, 0, 7); ctx.fill();
  },

  /* 掉落物：发光光柱 + 旋转 */
  drawDrop(d){
    const ctx=this.ctx;
    const s=toScreen({x:d.x,y:d.y}, this.cam);
    const bob = Math.sin(d.bob)*3;
    const col = d.isSoul? '#8fe3ff' : (d.item.rarityColor);
    // 光柱
    const grd = ctx.createRadialGradient(s.x,s.y+bob,2,s.x,s.y+bob,26);
    grd.addColorStop(0, col); grd.addColorStop(1, 'transparent');
    ctx.fillStyle=grd;
    ctx.beginPath(); ctx.ellipse(s.x,s.y+bob,22,9,0,0,7); ctx.fill();
    // 光柱竖线
    ctx.globalAlpha=0.85;
    ctx.fillStyle=col;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y+bob, 5, 2.5, 0,0,7); ctx.fill();
    ctx.globalAlpha=1;
    if(d.item){
      // 物品图标
      ctx.font='16px serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(d.item.icon, s.x, s.y+bob-16);
    } else {
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.arc(s.x, s.y+bob-10, 5,0,7); ctx.fill();
    }
  },

  /* 裂界之门：发光的传送门 */
  drawDoor(){
    const ctx=this.ctx;
    const s=toScreen(game.doorPos, this.cam);
    const t=performance.now()/500;
    // 光环
    const grd=ctx.createRadialGradient(s.x,s.y,5,s.x,s.y,46);
    grd.addColorStop(0,'rgba(216,169,74,0.9)'); grd.addColorStop(1,'rgba(216,169,74,0)');
    ctx.fillStyle=grd;
    ctx.beginPath(); ctx.ellipse(s.x,s.y,46,26,0,0,7); ctx.fill();
    // 门体（竖向椭圆）
    ctx.strokeStyle='rgba(255,220,120,'+(0.7+Math.sin(t)*0.3)+')';
    ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(s.x,s.y-14,22,40,0,0,7); ctx.stroke();
    ctx.fillStyle='rgba(255,220,120,0.35)';
    ctx.beginPath(); ctx.ellipse(s.x,s.y-14,22,40,0,0,7); ctx.fill();
    ctx.font='11px sans-serif'; ctx.textAlign='center';
    ctx.fillStyle='#ffe9a0'; ctx.textBaseline='bottom';
    ctx.fillText('裂界之门', s.x, s.y+34);
  },

  /* 敌人：精灵图 + 几何回退 */
  drawEnemy(e){
    const ctx=this.ctx;
    const s=toScreen({x:e.x,y:e.y}, this.cam);
    const r=e.radius*this.cam.zoom;
    const bob = Math.sin(e.anim)*2;
    const bodyY = s.y - bob;
    // 阴影
    ctx.fillStyle='rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(s.x,s.y,r*1.2,r*0.55,0,0,7); ctx.fill();

    // 按体型选择精灵图尺寸
    let size;
    if(e.boss) size=140;
    else if(e.type==='brute') size=105;
    else if(e.type==='elite') size=95;
    else size=78;

    const img = ASSETS.getEnemy(e.type, !!e.eliteAffix);
    if(img && img.complete && img.width){
      ctx.save();
      ctx.translate(s.x, bodyY-size*0.90);
      ctx.scale(Math.cos(e.facing)<0? -1:1, 1);
      if(e.hurtFlash>0) ctx.filter='brightness(3) saturate(0.3)';
      ctx.drawImage(img, -size/2, 0, size, size);
      ctx.filter='none';
      ctx.restore();
    } else {
      // 几何回退
      const hgt = r*(e.size*1.2);
      ctx.fillStyle = e.hurtFlash>0? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.ellipse(s.x, bodyY-hgt*0.5, r*0.9, hgt*0.62, 0,0,7);
      ctx.fill();
      ctx.fillStyle = e.hurtFlash>0? '#fff' : shadeColor(e.color, -20);
      ctx.beginPath(); ctx.arc(s.x, bodyY-hgt- r*0.3, r*0.55, 0,7); ctx.fill();
      ctx.fillStyle='#ffdd55';
      ctx.beginPath(); ctx.arc(s.x-r*0.3, bodyY-hgt-r*0.3, r*0.12,0,7); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x+r*0.3, bodyY-hgt-r*0.3, r*0.12,0,7); ctx.fill();
    }

    // 精英词缀光环
    if(e.eliteAffix){
      ctx.strokeStyle='rgba(255,30,80,0.55)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(s.x, bodyY-size*0.40, size*0.45, size*0.18,0,0,7); ctx.stroke();
    }

    // 攻击动画（前摇刀光）
    if(e.atkAnim>0){
      const a = e.facing;
      ctx.strokeStyle='rgba(255,120,80,0.8)'; ctx.lineWidth=3;
      ctx.beginPath();
      ctx.arc(s.x, bodyY-size*0.45, r*2.2, a-0.6,a+0.6);
      ctx.stroke();
    }

    // 血条
    if(e.hp<e.maxHp){
      const w=Math.max(30,r*2.4);
      const pct=e.hp/e.maxHp;
      ctx.fillStyle='rgba(0,0,0,0.6)';
      ctx.fillRect(s.x-w/2, bodyY-size-6, w,4);
      ctx.fillStyle = pct>0.5?'#5cb85c':(pct>0.25?'#f0ad4e':'#d33');
      ctx.fillRect(s.x-w/2, bodyY-size-6, w*pct,4);
    }
    // 精英词缀名称
    if(e.eliteAffix){
      ctx.font='12px serif'; ctx.textAlign='center';
      ctx.fillStyle='#ffd700';
      ctx.fillText(e.eliteAffix.name, s.x, bodyY-size-10);
    }
  },

  drawBeast(b){
    const ctx=this.ctx;
    const s=toScreen({x:b.x,y:b.y}, this.cam);
    const bob=Math.sin(b.anim)*2;
    ctx.fillStyle='rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(s.x,s.y,16,7,0,0,7); ctx.fill();
    const bodyY=s.y-bob;
    const evScale = 1+b.evolution*0.15;

    const img = ASSETS.beast;
    if(img && img.complete && img.width){
      const size=60;
      ctx.save();
      ctx.translate(s.x, bodyY-size*0.92*evScale);
      ctx.scale(Math.cos(b.facing)<0? -1:1, 1);
      if(b.hurtFlash && b.hurtFlash>0) ctx.filter='brightness(2.5)';
      ctx.drawImage(img, -size*evScale/2, 0, size*evScale, size*evScale);
      ctx.filter='none';
      ctx.restore();
      // 进化光环
      if(b.evolution>=1){
        ctx.strokeStyle=b.evolution>=2?'rgba(230,126,34,0.65)':'rgba(155,89,182,0.65)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.ellipse(s.x, bodyY-size*0.5*evScale, size*0.55*evScale, size*0.22*evScale,0,0,7); ctx.stroke();
      }
    } else {
      // 几何回退
      const col = b.evolution>=2? '#e67e22' : (b.evolution>=1? '#8e44ad':'#6c3483');
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(s.x, bodyY-20*evScale, 14*evScale, 22*evScale,0,0,7); ctx.fill();
      ctx.fillStyle='#ffddaa';
      ctx.beginPath(); ctx.arc(s.x-5*evScale, bodyY-34*evScale, 3,0,7); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x+5*evScale, bodyY-34*evScale, 3,0,7); ctx.fill();
      ctx.fillStyle='rgba(155,89,182,0.7)';
      ctx.beginPath(); ctx.arc(s.x, bodyY-6*evScale, 6,0,7); ctx.fill();
    }
    // 等级
    if(b.level>1){
      ctx.font='10px sans-serif'; ctx.textAlign='center';
      ctx.fillStyle='#d8a94a';
      ctx.fillText('Lv'+b.level, s.x, bodyY-48*evScale-4);
    }
  },

  drawPlayer(p){
    const ctx=this.ctx;
    const s=toScreen({x:p.x,y:p.y}, this.cam);
    const bob=Math.sin(p.attackAnim*30)*2;
    ctx.fillStyle='rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(s.x,s.y,20,9,0,0,7); ctx.fill();
    const bodyY=s.y-bob;

    // 精灵图：暗影猎魔人（脚底对齐）
    const img = ASSETS.player;
    if(img && img.complete && img.width){
      const size=72;
      ctx.save();
      ctx.translate(s.x, bodyY-size*0.92);
      ctx.scale(Math.cos(p.facing)<0? -1:1, 1);
      if(p.hurtFlash>0) ctx.filter='brightness(2.8) sepia(1) hue-rotate(-30deg)';
      ctx.drawImage(img, -size/2, 0, size, size);
      ctx.filter='none';
      ctx.restore();
    } else {
      // 几何回退（图片未加载时）
      ctx.fillStyle = p.hurtFlash>0? '#fff' : '#3d5a80';
      ctx.beginPath();
      ctx.moveTo(s.x, bodyY-52);
      ctx.quadraticCurveTo(s.x+18, bodyY-22, s.x+13, bodyY);
      ctx.lineTo(s.x-13, bodyY);
      ctx.quadraticCurveTo(s.x-18, bodyY-22, s.x, bodyY-52);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='#f1c27d';
      ctx.beginPath(); ctx.arc(s.x, bodyY-58, 9,0,7); ctx.fill();
      ctx.fillStyle = p.hurtFlash>0? '#fff' : '#2c3e50';
      ctx.beginPath(); ctx.arc(s.x, bodyY-60, 12, Math.PI,0); ctx.fill();
    }

    // 武器刀光（保留攻击反馈）
    if(p.attackAnim>0){
      const a=p.facing;
      ctx.strokeStyle='rgba(160,255,255,0.75)'; ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(s.x+Math.cos(a)*18, bodyY-34+Math.sin(a)*18);
      ctx.lineTo(s.x+Math.cos(a)*42, bodyY-34+Math.sin(a)*42);
      ctx.stroke();
    }
    // 狂暴状态光效
    if(p.furyT>0){
      ctx.strokeStyle='rgba(230,126,34,0.7)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(s.x, bodyY-34, 26+Math.sin(performance.now()/80)*3,0,7); ctx.stroke();
    }
    // 无敌闪烁
    if(p.invuln>0 && Math.floor(p.invuln*20)%2===0){
      ctx.fillStyle='rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.ellipse(s.x,bodyY-30,22,36,0,0,7); ctx.fill();
    }
  },

  drawProjectile(pr){
    const ctx=this.ctx;
    const s=toScreen({x:pr.x,y:pr.y}, this.cam);
    ctx.fillStyle = pr.color;
    ctx.beginPath(); ctx.arc(s.x,s.y, pr.radius, 0,7); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(s.x,s.y, pr.radius*0.4,0,7); ctx.fill();
    // 尾迹
    ctx.globalAlpha=0.3;
    ctx.beginPath(); ctx.arc(s.x-Math.cos(pr.ang)*8, s.y-Math.sin(pr.ang)*8, pr.radius*0.7,0,7); ctx.fill();
    ctx.globalAlpha=1;
  },

  drawFx(){
    const ctx=this.ctx;
    // 环
    for(const r of fx.rings){
      const t=r.t/r.dur;
      const s=toScreen({x:r.x,y:r.y}, this.cam);
      ctx.strokeStyle=r.color;
      ctx.globalAlpha=1-t;
      ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(s.x,s.y, r.maxR*t*this.cam.zoom,0,7); ctx.stroke();
      ctx.globalAlpha=1;
    }
    // 粒子
    for(const p of fx.particles){
      const s=toScreen({x:p.x,y:p.y}, this.cam);
      ctx.globalAlpha = 1-p.t/p.dur;
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(s.x,s.y,p.r*this.cam.zoom,0,7); ctx.fill();
      ctx.globalAlpha=1;
    }
  },

  drawDmgNum(n){
    const ctx=this.ctx;
    const t=n.t/n.dur;
    const s=toScreen({x:n.x, y:n.y+n.vy*t*30}, this.cam);
    ctx.globalAlpha=1-t;
    ctx.font = n.crit? 'bold 20px sans-serif':'bold 15px sans-serif';
    ctx.textAlign='center';
    ctx.fillStyle = n.crit? '#ffd700':'#fff';
    ctx.strokeStyle='rgba(0,0,0,0.8)'; ctx.lineWidth=3;
    ctx.strokeText(n.val, s.x, s.y);
    ctx.fillText(n.val, s.x, s.y);
    ctx.globalAlpha=1;
  },

  drawAmbient(){
    const ctx=this.ctx;
    // 四角暗角
    const vg = ctx.createRadialGradient(this.w/2,this.h/2,this.h*0.3,this.w/2,this.h/2,this.h*0.9);
    vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.55)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,this.w,this.h);
    // 震屏衰减已移到 updateFx 按时间处理
  }
};

function shadeColor(color, percent){
  let num = parseInt(color.replace('#',''),16);
  let r=(num>>16)+percent, g=((num>>8)&0xff)+percent, b=(num&0xff)+percent;
  r=clamp(r,0,255); g=clamp(g,0,255); b=clamp(b,0,255);
  return '#'+(r.toString(16).padStart(2,'0'))+(g.toString(16).padStart(2,'0'))+(b.toString(16).padStart(2,'0'));
}
