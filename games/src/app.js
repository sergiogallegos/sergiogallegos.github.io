const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
const library = document.querySelector("#library");
const player = document.querySelector("#player");
const overlay = document.querySelector("#game-overlay");
const scoreNode = document.querySelector("#score");
const statLabel = document.querySelector("#stat-label");
const statValue = document.querySelector("#stat-value");
const pauseButton = document.querySelector("#pause-button");
const touchControls = document.querySelector("#touch-controls");

const gameInfo = {
  snake: {
    title: "Snake", color: "#32a778", guide: "Guide the snake",
    text: "Collect fruit to grow longer. Avoid the walls and your own tail.",
    hint: "Use the arrow keys, WASD, or swipe to change direction.", stat: "BEST", note: "Your best score is saved on this device.",
    keys: [["Move", ["↑", "←", "↓", "→"]], ["Pause", ["P"]]],
    controls: [["←", "left"], ["↑", "up"], ["↓", "down"], ["→", "right"]],
  },
  tetris: {
    title: "Tetris", color: "#8b5cf6", guide: "Build complete lines",
    text: "Move and rotate falling pieces. Complete a row to clear it before the stack reaches the top.",
    hint: "Move with the arrows. Press up to rotate and space for a hard drop.", stat: "LINES", note: "Clear four rows at once for the biggest score bonus.",
    keys: [["Move", ["←", "↓", "→"]], ["Rotate", ["↑"]], ["Drop", ["Space"]]],
    controls: [["←", "left"], ["↻", "rotate"], ["↓", "down"], ["→", "right"], ["DROP", "drop", "wide"]],
  },
  asteroids: {
    title: "Cosmic Drift", color: "#4a72c7", guide: "Clear the sector",
    text: "Turn, thrust, and fire. Break every drifting rock while keeping your ship intact.",
    hint: "Turn with left and right, thrust with up, and fire with space.", stat: "LIVES", note: "Small rocks are faster—and worth more points.",
    keys: [["Steer", ["←", "→"]], ["Thrust", ["↑"]], ["Fire", ["Space"]]],
    controls: [["↶", "left"], ["▲", "up"], ["↷", "right"], ["FIRE", "fire", "wide"]],
  },
};

let game = null;
let gameName = "";
let running = false;
let lastTime = performance.now();
let pointerStart = null;

function safeBest(name, value) {
  const key = `sergio-arcade-${name}-best`;
  let best = 0;
  try { best = Number(localStorage.getItem(key)) || 0; } catch {}
  if (value > best) { best = value; try { localStorage.setItem(key, String(best)); } catch {} }
  return best;
}

function updateHud() {
  if (!game) return;
  scoreNode.textContent = game.score.toLocaleString();
  if (gameName === "snake") statValue.textContent = safeBest(gameName, game.score).toLocaleString();
  else if (gameName === "tetris") statValue.textContent = game.lines;
  else statValue.textContent = game.lives;
}

function showOverlay(kicker, title, text, button) {
  document.querySelector("#overlay-kicker").textContent = kicker;
  document.querySelector("#overlay-title").textContent = title;
  document.querySelector("#overlay-text").textContent = text;
  document.querySelector("#overlay-button").textContent = button;
  overlay.hidden = false;
}

function endGame(won = false) {
  running = false;
  updateHud();
  showOverlay(won ? "SECTOR CLEAR" : "GAME OVER", won ? "Nice flying." : "Good run.", `Final score: ${game.score.toLocaleString()}`, "Play again");
}

function begin() {
  if (!game || game.over) game = createGame(gameName);
  overlay.hidden = true;
  running = true;
  pauseButton.textContent = "Ⅱ";
  pauseButton.setAttribute("aria-label", "Pause game");
  canvas.focus({ preventScroll: true });
  lastTime = performance.now();
}

function restart() {
  game = createGame(gameName);
  updateHud();
  begin();
}

function togglePause() {
  if (!game || game.over || !overlay.hidden) return;
  running = !running;
  pauseButton.textContent = running ? "Ⅱ" : "▶";
  pauseButton.setAttribute("aria-label", running ? "Pause game" : "Resume game");
  if (!running) showOverlay("GAME PAUSED", "Take a breath.", "Your game is waiting right where you left it.", "Resume");
  else overlay.hidden = true;
  lastTime = performance.now();
}

function renderGuide(info) {
  document.querySelector("#key-guide").innerHTML = info.keys.map(([label, keys]) => `<div class="key-row"><span>${label}</span><span class="keys">${keys.map(key => `<i class="key">${key}</i>`).join("")}</span></div>`).join("");
  touchControls.innerHTML = info.controls.map(([label, action, cls = ""]) => `<button class="touch-button ${cls}" data-action="${action}" type="button" aria-label="${action}">${label}</button>`).join("");
}

function openGame(name) {
  gameName = name;
  const info = gameInfo[name];
  library.hidden = true;
  player.hidden = false;
  document.querySelector("#game-title").textContent = info.title;
  document.querySelector("#game-dot").style.background = info.color;
  document.querySelector("#guide-title").textContent = info.guide;
  document.querySelector("#guide-text").textContent = info.text;
  document.querySelector("#best-note").textContent = info.note;
  statLabel.textContent = info.stat;
  renderGuide(info);
  game = createGame(name);
  updateHud();
  game.draw();
  showOverlay("READY?", info.title, info.hint, "Start game");
  history.replaceState(null, "", `${location.pathname}?game=${name}`);
  window.scrollTo(0, 0);
}

function closeGame() {
  running = false; game = null; player.hidden = true; library.hidden = false;
  history.replaceState(null, "", location.pathname);
}

document.querySelectorAll("[data-game]").forEach(card => card.addEventListener("click", () => openGame(card.dataset.game)));
document.querySelector("#overlay-button").addEventListener("click", begin);
document.querySelector("#restart-button").addEventListener("click", restart);
document.querySelector("#back-button").addEventListener("click", closeGame);
pauseButton.addEventListener("click", () => running ? togglePause() : begin());

function actionFromKey(key) {
  const map = { ArrowLeft:"left", a:"left", A:"left", ArrowRight:"right", d:"right", D:"right", ArrowUp:"up", w:"up", W:"up", ArrowDown:"down", s:"down", S:"down", " ":"fire" };
  if (gameName === "tetris" && key === " ") return "drop";
  if (gameName === "tetris" && (key === "ArrowUp" || key.toLowerCase() === "w")) return "rotate";
  return map[key];
}

window.addEventListener("keydown", event => {
  if (player.hidden) return;
  if (event.key.toLowerCase() === "p") { event.preventDefault(); togglePause(); return; }
  if (event.key.toLowerCase() === "r") { event.preventDefault(); restart(); return; }
  const action = actionFromKey(event.key);
  if (action) { event.preventDefault(); if (!running && overlay.hidden === false) return; game?.input(action, true); }
});
window.addEventListener("keyup", event => { const action = actionFromKey(event.key); if (action) game?.input(action, false); });

touchControls.addEventListener("pointerdown", event => {
  const button = event.target.closest("[data-action]"); if (!button || !game) return;
  event.preventDefault(); button.setPointerCapture(event.pointerId); button.classList.add("active"); game.input(button.dataset.action, true);
});
touchControls.addEventListener("pointerup", event => {
  const button = event.target.closest("[data-action]"); if (!button || !game) return;
  button.classList.remove("active"); game.input(button.dataset.action, false);
});
canvas.addEventListener("pointerdown", event => { pointerStart = { x:event.clientX, y:event.clientY }; });
canvas.addEventListener("pointerup", event => {
  if (!pointerStart || !running || gameName === "asteroids") return;
  const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y; pointerStart = null;
  if (Math.hypot(dx, dy) < 22) { if (gameName === "tetris") game.input("rotate", true); return; }
  game.input(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"), true);
});

function createGame(name) {
  const created = name === "snake" ? new SnakeGame() : name === "tetris" ? new TetrisGame() : new AsteroidsGame();
  canvas.width = created.width; canvas.height = created.height; created.draw(); return created;
}

function roundRect(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2); context.beginPath(); context.roundRect(x, y, w, h, radius); context.fill();
}

class SnakeGame {
  constructor() { this.width=600;this.height=600;this.score=0;this.over=false;this.elapsed=0;this.stepMs=.115;this.dir={x:1,y:0};this.next={...this.dir};this.snake=[{x:10,y:12},{x:9,y:12},{x:8,y:12},{x:7,y:12}];this.food=this.newFood(); }
  newFood(){let p;do{p={x:Math.floor(Math.random()*24),y:Math.floor(Math.random()*24)}}while(this.snake.some(s=>s.x===p.x&&s.y===p.y));return p}
  input(action,down){if(!down)return;const dirs={left:{x:-1,y:0},right:{x:1,y:0},up:{x:0,y:-1},down:{x:0,y:1}};const d=dirs[action];if(d&&!(d.x===-this.dir.x&&d.y===-this.dir.y))this.next=d}
  update(dt){this.elapsed+=dt;if(this.elapsed<this.stepMs)return;this.elapsed%=this.stepMs;this.dir=this.next;const head={x:this.snake[0].x+this.dir.x,y:this.snake[0].y+this.dir.y};if(head.x<0||head.x>=24||head.y<0||head.y>=24||this.snake.some(s=>s.x===head.x&&s.y===head.y)){this.over=true;endGame();return}this.snake.unshift(head);if(head.x===this.food.x&&head.y===this.food.y){this.score+=10;this.stepMs=Math.max(.062,this.stepMs-.002);this.food=this.newFood()}else this.snake.pop();updateHud()}
  draw(){ctx.fillStyle="#10251e";ctx.fillRect(0,0,600,600);ctx.fillStyle="rgba(255,255,255,.035)";for(let y=0;y<24;y++)for(let x=0;x<24;x++){ctx.beginPath();ctx.arc(x*25+12.5,y*25+12.5,1.2,0,Math.PI*2);ctx.fill()}ctx.fillStyle="#ff695f";ctx.beginPath();ctx.arc(this.food.x*25+12.5,this.food.y*25+13,9,0,Math.PI*2);ctx.fill();ctx.fillStyle="#8ee0b9";this.snake.forEach((part,i)=>{ctx.globalAlpha=Math.max(.42,1-i*.018);roundRect(ctx,part.x*25+2,part.y*25+2,21,21,6)});ctx.globalAlpha=1;const h=this.snake[0];ctx.fillStyle="#10251e";const vertical=this.dir.y!==0;if(vertical){ctx.fillRect(h.x*25+6,h.y*25+(this.dir.y>0?15:7),3,3);ctx.fillRect(h.x*25+16,h.y*25+(this.dir.y>0?15:7),3,3)}else{ctx.fillRect(h.x*25+(this.dir.x>0?15:7),h.y*25+6,3,3);ctx.fillRect(h.x*25+(this.dir.x>0?15:7),h.y*25+16,3,3)}}
}

const SHAPES=[
  {c:"#47b6d8",m:[[1,1,1,1]]},{c:"#e0b23f",m:[[1,1],[1,1]]},{c:"#9a6fe3",m:[[0,1,0],[1,1,1]]},
  {c:"#45b882",m:[[0,1,1],[1,1,0]]},{c:"#e96772",m:[[1,1,0],[0,1,1]]},{c:"#5c83e2",m:[[1,0,0],[1,1,1]]},{c:"#e89043",m:[[0,0,1],[1,1,1]]}
];
class TetrisGame {
  constructor(){this.width=560;this.height=680;this.score=0;this.lines=0;this.over=false;this.board=Array.from({length:20},()=>Array(10).fill(null));this.elapsed=0;this.interval=.72;this.next=this.randomPiece();this.spawn()}
  randomPiece(){const s=SHAPES[Math.floor(Math.random()*SHAPES.length)];return{matrix:s.m.map(r=>[...r]),color:s.c}}
  spawn(){this.piece=this.next;this.next=this.randomPiece();this.piece.x=Math.floor((10-this.piece.matrix[0].length)/2);this.piece.y=0;if(this.collides(this.piece.x,this.piece.y,this.piece.matrix)){this.over=true;endGame()}}
  collides(px,py,m){return m.some((row,y)=>row.some((v,x)=>v&&(px+x<0||px+x>=10||py+y>=20||(py+y>=0&&this.board[py+y][px+x]))))}
  move(dx,dy){if(!this.collides(this.piece.x+dx,this.piece.y+dy,this.piece.matrix)){this.piece.x+=dx;this.piece.y+=dy;return true}if(dy>0)this.lock();return false}
  rotate(){const m=this.piece.matrix[0].map((_,i)=>this.piece.matrix.map(row=>row[i]).reverse());for(const kick of [0,-1,1,-2,2])if(!this.collides(this.piece.x+kick,this.piece.y,m)){this.piece.x+=kick;this.piece.matrix=m;return}}
  lock(){this.piece.matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v&&this.piece.y+y>=0)this.board[this.piece.y+y][this.piece.x+x]=this.piece.color}));let cleared=0;for(let y=19;y>=0;y--)if(this.board[y].every(Boolean)){this.board.splice(y,1);this.board.unshift(Array(10).fill(null));cleared++;y++}if(cleared){this.lines+=cleared;this.score+=[0,100,300,500,800][cleared]*(Math.floor(this.lines/10)+1);this.interval=Math.max(.12,.72-this.lines*.018)}this.spawn();updateHud()}
  input(action,down){if(!down||this.over)return;if(action==="left")this.move(-1,0);if(action==="right")this.move(1,0);if(action==="down"){if(this.move(0,1))this.score+=1}if(action==="rotate"||action==="up")this.rotate();if(action==="drop"){let cells=0;while(this.move(0,1))cells++;this.score+=cells*2}updateHud()}
  update(dt){this.elapsed+=dt;if(this.elapsed>=this.interval){this.elapsed=0;this.move(0,1)}}
  cell(x,y,color,alpha=1){ctx.globalAlpha=alpha;ctx.fillStyle=color;roundRect(ctx,74+x*28,60+y*28,25,25,5);ctx.fillStyle="rgba(255,255,255,.15)";roundRect(ctx,78+x*28,64+y*28,17,4,2);ctx.globalAlpha=1}
  draw(){ctx.fillStyle="#16131d";ctx.fillRect(0,0,this.width,this.height);ctx.fillStyle="#211d2a";roundRect(ctx,54,40,320,600,18);ctx.fillStyle="#302a3c";for(let y=0;y<20;y++)for(let x=0;x<10;x++)roundRect(ctx,74+x*28,60+y*28,25,25,5);this.board.forEach((row,y)=>row.forEach((c,x)=>{if(c)this.cell(x,y,c)}));let gy=this.piece.y;while(!this.collides(this.piece.x,gy+1,this.piece.matrix))gy++;this.piece.matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v)this.cell(this.piece.x+x,gy+y,this.piece.color,.2)}));this.piece.matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v)this.cell(this.piece.x+x,this.piece.y+y,this.piece.color)}));ctx.fillStyle="#8e8899";ctx.font="700 11px Inter, sans-serif";ctx.letterSpacing="2px";ctx.fillText("NEXT",414,72);this.next.matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v){ctx.fillStyle=this.next.color;roundRect(ctx,414+x*25,91+y*25,22,22,5)}}));ctx.fillStyle="#8e8899";ctx.fillText("LINES",414,230);ctx.fillStyle="#fff";ctx.font="700 34px Inter, sans-serif";ctx.fillText(String(this.lines).padStart(2,"0"),414,269)}
}

class AsteroidsGame {
  constructor(){this.width=900;this.height=600;this.score=0;this.lives=3;this.over=false;this.ship={x:450,y:300,a:-Math.PI/2,vx:0,vy:0,inv:2};this.bullets=[];this.held=new Set();this.shotWait=0;this.wave=1;this.rocks=[];for(let i=0;i<5;i++)this.addRock(44+i%2*10)}
  addRock(r,x,y){const edge=Math.floor(Math.random()*4);x=x??(edge%2?Math.random()*900:(edge?900:0));y=y??(edge%2?(edge===1?0:600):Math.random()*600);const angle=Math.random()*Math.PI*2;this.rocks.push({x,y,r,a:0,spin:(Math.random()-.5)*.8,vx:Math.cos(angle)*(25+Math.random()*30),vy:Math.sin(angle)*(25+Math.random()*30),j:Array.from({length:10},()=>.75+Math.random()*.28)})}
  input(action,down){if(["left","right","up","fire"].includes(action)){if(down)this.held.add(action);else this.held.delete(action)}}
  wrap(o,margin=0){if(o.x < -margin)o.x=this.width+margin;if(o.x>this.width+margin)o.x=-margin;if(o.y < -margin)o.y=this.height+margin;if(o.y>this.height+margin)o.y=-margin}
  fire(){if(this.shotWait>0||this.bullets.length>7)return;const s=this.ship;this.bullets.push({x:s.x+Math.cos(s.a)*20,y:s.y+Math.sin(s.a)*20,vx:s.vx+Math.cos(s.a)*430,vy:s.vy+Math.sin(s.a)*430,life:1.15});this.shotWait=.18}
  hitShip(){if(this.ship.inv>0)return;this.lives--;updateHud();if(this.lives<=0){this.over=true;endGame();return}Object.assign(this.ship,{x:450,y:300,vx:0,vy:0,inv:2})}
  update(dt){const s=this.ship;if(this.held.has("left"))s.a-=3.2*dt;if(this.held.has("right"))s.a+=3.2*dt;if(this.held.has("up")){s.vx+=Math.cos(s.a)*220*dt;s.vy+=Math.sin(s.a)*220*dt}if(this.held.has("fire"))this.fire();s.vx*=Math.pow(.992,dt*60);s.vy*=Math.pow(.992,dt*60);s.x+=s.vx*dt;s.y+=s.vy*dt;this.wrap(s,15);s.inv=Math.max(0,s.inv-dt);this.shotWait=Math.max(0,this.shotWait-dt);this.bullets.forEach(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;this.wrap(b)});this.bullets=this.bullets.filter(b=>b.life>0);this.rocks.forEach(r=>{r.x+=r.vx*dt;r.y+=r.vy*dt;r.a+=r.spin*dt;this.wrap(r,r.r)});for(let bi=this.bullets.length-1;bi>=0;bi--){for(let ri=this.rocks.length-1;ri>=0;ri--){const b=this.bullets[bi],r=this.rocks[ri];if(Math.hypot(b.x-r.x,b.y-r.y)<r.r){this.bullets.splice(bi,1);this.rocks.splice(ri,1);this.score+=r.r>30?20:50;if(r.r>30){this.addRock(r.r*.58,r.x,r.y);this.addRock(r.r*.58,r.x,r.y)}updateHud();break}}}for(const r of this.rocks)if(Math.hypot(s.x-r.x,s.y-r.y)<r.r+12){this.hitShip();break}if(!this.rocks.length){this.wave++;if(this.wave>3){endGame(true);return}for(let i=0;i<4+this.wave;i++)this.addRock(40+Math.random()*15)}}
  drawShip(){const s=this.ship;if(s.inv>0&&Math.floor(s.inv*8)%2===0)return;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.a);ctx.strokeStyle="#b9d0ff";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(21,0);ctx.lineTo(-14,-13);ctx.lineTo(-8,0);ctx.lineTo(-14,13);ctx.closePath();ctx.stroke();if(this.held.has("up")){ctx.strokeStyle="#ff9367";ctx.beginPath();ctx.moveTo(-10,-7);ctx.lineTo(-25,0);ctx.lineTo(-10,7);ctx.stroke()}ctx.restore()}
  draw(){ctx.fillStyle="#0c1320";ctx.fillRect(0,0,this.width,this.height);ctx.fillStyle="rgba(181,204,255,.55)";for(let i=0;i<70;i++){const x=(i*137)%900,y=(i*i*47)%600;ctx.fillRect(x,y,i%4===0?2:1,i%4===0?2:1)}ctx.strokeStyle="#7695c9";ctx.lineWidth=2;this.rocks.forEach(r=>{ctx.save();ctx.translate(r.x,r.y);ctx.rotate(r.a);ctx.beginPath();r.j.forEach((j,i)=>{const a=i/r.j.length*Math.PI*2,x=Math.cos(a)*r.r*j,y=Math.sin(a)*r.r*j;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.stroke();ctx.restore()});ctx.fillStyle="#ffdf74";this.bullets.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill()});this.drawShip();ctx.fillStyle="rgba(185,208,255,.7)";ctx.font="700 11px Inter, sans-serif";ctx.fillText(`WAVE ${this.wave} / 3`,28,34)}
}

function loop(now) {
  const dt=Math.min(.034,(now-lastTime)/1000);lastTime=now;
  if(game){if(running&&!game.over)game.update(dt);game.draw()}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

const requestedGame = new URLSearchParams(location.search).get("game");
if (gameInfo[requestedGame]) openGame(requestedGame);
