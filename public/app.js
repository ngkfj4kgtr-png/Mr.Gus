const tg=window.Telegram?.WebApp;
const t=(key,vars={})=>window.MrGusLocale?.t(key,vars)||key;
const lang=()=>window.MrGusLocale?.get()||"ru";
if(tg){tg.ready();tg.expand();try{tg.enableClosingConfirmation?.()}catch{}}

const op=t=>t+"_"+crypto.randomUUID();
const money=n=>new Intl.NumberFormat("ru-RU").format(Math.max(0,Math.floor(Number(n)||0)))+" ₽";

function setStatus(message,error=false){const el=document.querySelector("#status");if(!el)return;clearTimeout(window.__mrGusStatusTimer);el.textContent=message;el.dataset.error=error?"1":"0";if(message===t("status.waitingTelegram"))return;window.__mrGusStatusTimer=setTimeout(()=>{if(el.textContent===message){el.textContent="";el.dataset.error="0"}},error?3500:2200)}
function friendlyError(error){
  const message=String(error?.message||"Ошибка");
  const map={
    "Откройте Mr.Gus через Telegram.":t("errors.telegram"),
    "Недостаточно денег.":t("errors.balance"),
    "Insufficient balance":"Недостаточно денег.",
    "Business already owned":"Этот бизнес уже куплен.",
    "Business is locked":"Этот бизнес пока закрыт. Поднимите уровень.",
    "Maximum business level reached":"Достигнут максимальный уровень бизнеса.",
    "Task reward already claimed":"Это задание уже выполнено.",
    "Task is locked":"Это задание пока заблокировано.",
    "Business not owned":"Сначала купите бизнес.",
    "Achievement reward already claimed":"Награда за достижение уже получена.",
    "Achievement is locked":"Достижение ещё не выполнено.",
    "Goal reward already claimed":"Награда за цель уже получена.",
    "Goal is locked":"Цель ещё не выполнена.",
    "Event reward already claimed":"Сегодняшний бонус уже получен.",
    "Clock moved backwards":"Время устройства изменилось. Обновите игру.",
    "Authentication required":"Сессия истекла. Откройте игру через Telegram ещё раз.",
    "Too many requests":"Слишком много запросов. Подождите немного."
  };
  return map[message]||message;
}
async function api(path,opt={}){
  const h={"Content-Type":"application/json",...(opt.headers||{})};
  if(tg?.initData)h["X-Telegram-Init-Data"]=tg.initData;
  const r=await fetch(path,{...opt,headers:h});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error||("HTTP "+r.status));
  return d;
}
async function auth(){
  try{
    if(!tg?.initData)throw Error("Откройте Mr.Gus через Telegram.");
    setStatus(lang()==="en"?"Logging in with Telegram…":"Авторизация через Telegram…");
    await api("/api/auth/telegram",{method:"POST"});await refresh(true);
  }catch(e){setStatus(friendlyError(e),true)}
}
async function refresh(fromAuth=false){
  try{const s=await api("/api/state");const live=s.cityLive||await api("/api/city/live").catch(()=>null);if(live)s.cityLive=live;window.__mrGusAnalytics=await api("/api/analytics?range=24h").catch(()=>({points:[]}));render(s);await loadSocial();setStatus(fromAuth?t("status.loggedIn"):t("status.connected"));return s}
  catch(e){setStatus(friendlyError(e),true);return null}
}
function button(action,label,extra="",disabled=false){return `<button class="btn" data-action="${action}" ${extra} ${disabled?"disabled":""}>${label}</button>`}
function render(s){
  window.__mrGusState=s;
  document.querySelector("#balance").textContent=money(s.balance);
  document.querySelector("#level").textContent=s.level;
  const totalIncome=(s.businesses||[]).reduce((sum,b)=>sum+(Number(b.profitPerHour)||0),0);
  document.querySelector("#income").textContent=money(totalIncome)+"/ч";
  document.querySelector("#xpText").textContent=Number(s.xp||0)+" XP";
  const xp=Number(s.xp)||0,level=Number(s.level)||1;
  const progress=s.xpProgress||{current:0,next:1,percent:0};
  document.querySelector("#xpBar").style.width=(progress.percent||0)+"%";
  document.querySelector("#xpHint").textContent=level>=100?t("xp.max"):t("xp.next",{level:level+1,xp:Math.max(0,(progress.next||0)-xp)});
    document.querySelector("#businesses").innerHTML=(s.businessCatalog||[]).map(b=>{
    const owned=s.businesses?.find(x=>x.id===b.id);
    if(owned)return `<div class="mini-card"><div class="row"><div><b>${b.name} · ур. ${owned.level}</b><p class="muted">${b.description}</p></div><strong>${money(owned.profitPerHour)}/ч</strong></div><div class="row"><span class="muted">${t("nextLevel")}</span>${button("upgrade",t("upgrade"),`data-business-id="${b.id}"`)}</div><div class="advanced-grid"><div><span class="muted">👤 Кассиры: ${owned.employees?.cashier||0}</span> ${button("hire",t("hire")+" 2k",`data-business-id="${b.id}" data-role="cashier"`)}</div><div><span class="muted">👔 Управляющие: ${owned.employees?.manager||0}</span> ${button("hire",t("hire")+" 10k",`data-business-id="${b.id}" data-role="manager"`)}</div><div><span class="muted">📊 Бухгалтеры: ${owned.employees?.accountant||0}</span> ${button("hire",t("hire")+" 25k",`data-business-id="${b.id}" data-role="accountant"`)}</div><div><span class="muted">🏗️ Расширение: ${owned.expansionLevel||0}/5</span> ${button("expand",t("expand"),`data-business-id="${b.id}"`)}</div><div><span class="muted">💼 Инвестиции: ${money(owned.investment||0)}</span> ${button("invest",t("invest")+" 5k",`data-business-id="${b.id}"`)}</div><div>${button("boost",t("boost"),`data-business-id="${b.id}"`)}</div></div></div>`;
    return `<div class="mini-card"><div class="row"><div><b>${b.name}</b><p class="muted">${b.description}</p></div><strong>${money(b.cost)}</strong></div><p class="muted">${t("business.unlock",{level:b.unlockLevel})}</p>${button("buy",t("open"),`data-business-id="${b.id}"`,!b.unlocked)}</div>`;
  }).join("");
  renderEmpireVisual(s);
  renderCityMap(s);startCityLifeLoop();
  document.querySelector("#incomeAction").innerHTML=button("collect","💰 Забрать накопленный доход");
  document.querySelector("#tasks").innerHTML=(s.tasks||[]).filter(task=>!task.claimed).map(task=>`<div class="mini-card"><b>${task.title}</b><p class="muted">${task.description}</p><span class="reward">+${money(task.reward)} · +${task.xp} XP</span><br>${button("claim",t("claim"),`data-task-id="${String(task.id).replaceAll("'","&#39;")}"`,task.claimed||task.locked)}</div>`).join("");
  document.querySelector("#achievements").innerHTML=(s.achievements||[]).filter(a=>!a.claimed).map(a=>`<div class="mini-card"><div class="row"><div><b>${a.title}</b><p class="muted">${a.description}</p></div><span class="reward">+${money(a.reward)}<br>+${a.xp} XP</span></div>${button("achievement",a.claimed?t("received"):a.unlocked?t("claim"):"🔒",`data-id="${a.id}"`,a.claimed||!a.unlocked)}</div>`).join("");
  document.querySelector("#goals").innerHTML=(s.goals||[]).filter(g=>!g.claimed).map(g=>`<div class="mini-card"><div class="row"><div><b>${g.title}</b><p class="muted">${g.description}</p></div><span class="reward">+${money(g.reward)}<br>+${g.xp} XP</span></div>${button("goal",g.claimed?t("received"):g.unlocked?t("claim"):"🔒",`data-id="${g.id}"`,g.claimed||!g.unlocked)}</div>`).join("");
  const d=s.daily||{};document.querySelector("#daily").innerHTML=`<div class="event-card"><b>${t("dailyStreak",{streak:d.streak||0})}</b><p class="muted">${t("dailyReward",{reward:d.reward||0,xp:d.xp||0})}</p>${button("daily",d.already?t("received"):t("claim"))}</div>`;if(d.already)document.querySelector("#daily button").disabled=true;
  document.querySelector("#shop").innerHTML=(s.shop||[]).map(item=>`<div class="mini-card"><div class="row"><div><b>${item.title}</b><p class="muted">${item.description}</p></div><strong>${money(item.cost)}</strong></div><span class="muted">Получено: ${item.owned||0}</span> ${button("shop",t("buy"),`data-item-id="${item.id}"`)}</div>`).join("");
  const e=s.event||{};document.querySelector("#event").innerHTML=`<div class="event-card"><b>${e.title||"Событие"}</b><p class="muted">${e.description||""}</p><span class="reward">+${money(e.reward||0)} · +${e.xp||0} XP</span><div>${button("event",e.claimed?t("received"):t("claimBonus"))}</div></div>`;if(e.claimed)document.querySelector("#event button").disabled=true;
  const st=s.stats||{};document.querySelector("#stats").innerHTML=`<div><span>Заданий</span><b>${st.tasksCompleted||0}</b></div><div><span>Бизнесов</span><b>${st.businessesOwned||0}</b></div><div><span>Улучшений</span><b>${st.businessUpgrades||0}</b></div><div><span>Доход получен</span><b>${money(st.totalIncome||0)}</b></div><div><span>Всего заработано</span><b>${money(st.totalEarned||0)}</b></div>`;
}
async function loadSocial(){
  try{const r=await api("/api/rankings"),p=await api("/api/profile");renderProfile(p);window.__mrGusRankings=r;renderRankings(r);if(window.__mrGusState?.isAdmin){const a=await api("/api/admin");renderAdmin(a)}}
  catch(e){if(!String(e.message).includes("Forbidden"))console.warn("social load",e.message)}
}

let __cityLifeTimer=null;
function startCityLifeLoop(){
  if(__cityLifeTimer)return;
  __cityLifeTimer=setInterval(async()=>{
    const panel=document.querySelector('#cityPanel');
    if(panel&&!panel.hidden)return;
    try{const live=await api('/api/city/live');if(!window.__mrGusState)return;window.__mrGusState.cityLive=live;renderCityMap(window.__mrGusState)}catch{}
  },12000);
}
function initCityMapControls(){
  const map=document.querySelector(".city-map"),world=document.querySelector(".map-world");
  if(!map||!world||map.dataset.controls==="1")return;
  map.dataset.controls="1";
  let scale=1,tx=0,ty=0,dragId=null,startX=0,startY=0,startTx=0,startTy=0;
  const pointers=new Map();let pinchDistance=0,pinchScale=1;
  const clamp=()=>{
    scale=Math.max(.85,Math.min(2.4,scale));
    const maxX=map.clientWidth*(scale-1)*.55,maxY=map.clientHeight*(scale-1)*.55;
    tx=Math.max(-maxX,Math.min(maxX,tx));ty=Math.max(-maxY,Math.min(maxY,ty));
  };
  const apply=()=>{clamp();world.style.transform='translate3d('+tx+'px,'+ty+'px,0) scale('+scale+')';};
  const dist=()=>{const p=[...pointers.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)};
  const down=e=>{
    if(e.target.closest("button,.city-panel,.map-zoom-controls,[data-city-open]"))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    try{map.setPointerCapture(e.pointerId)}catch{}
    if(pointers.size===2){pinchDistance=dist();pinchScale=scale;dragId=null}
    else {dragId=e.pointerId;startX=e.clientX;startY=e.clientY;startTx=tx;startTy=ty}
  };
  const move=e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2&&pinchDistance){scale=pinchScale*dist()/pinchDistance;apply();return}
    if(pointers.size===1&&dragId===e.pointerId){tx=startTx+e.clientX-startX;ty=startTy+e.clientY-startY;apply()}
  };
  const up=e=>{
    pointers.delete(e.pointerId);try{map.releasePointerCapture(e.pointerId)}catch{}
    if(pointers.size<2)pinchDistance=0;
    if(pointers.size===1){const [id,p]=[...pointers.entries()][0];dragId=id;startX=p.x;startY=p.y;startTx=tx;startTy=ty}else dragId=null;
  };
  map.addEventListener("pointerdown",down);map.addEventListener("pointermove",move);
  map.addEventListener("pointerup",up);map.addEventListener("pointercancel",up);
  map.addEventListener("wheel",e=>{e.preventDefault();const old=scale;scale*=e.deltaY<0?1.12:.89;const r=map.getBoundingClientRect(),cx=e.clientX-r.left-r.width/2,cy=e.clientY-r.top-r.height/2;tx=cx-(cx-tx)*(scale/old);ty=cy-(cy-ty)*(scale/old);apply()},{passive:false});
  const controls=document.createElement("div");controls.className="map-zoom-controls";controls.innerHTML='<button type="button" data-map-zoom="-1" aria-label="Уменьшить">−</button><button type="button" data-map-zoom="1" aria-label="Увеличить">+</button><button type="button" data-map-reset="1" aria-label="Сбросить карту">⌖</button>';
  map.appendChild(controls);
  controls.addEventListener("click",e=>{const z=e.target.closest("[data-map-zoom]");if(z){scale+=Number(z.dataset.mapZoom)*.18;apply();return}if(e.target.closest("[data-map-reset]")){scale=1;tx=0;ty=0;apply()}});
}

function ensureArchitectureStyle(){if(document.querySelector("#mrgus-architecture-style"))return;const style=document.createElement("style");style.id="mrgus-architecture-style";style.textContent=".city-houses-layer{z-index:3}.arch-house{width:48px;height:42px;filter:drop-shadow(0 7px 6px rgba(0,0,0,.32))}.arch-house span{position:absolute;display:block}.arch-house .house-body{left:7px;right:7px;bottom:2px;height:25px;border-radius:4px 4px 3px 3px;background:linear-gradient(90deg,var(--wall-dark),var(--wall),var(--wall-dark));border:1px solid rgba(255,255,255,.18)}.arch-house .house-roof{left:3px;top:3px;width:42px;height:24px;background:linear-gradient(135deg,var(--roof-light),var(--roof),var(--roof-dark));clip-path:polygon(50% 0,100% 72%,100% 88%,0 88%,0 72%)}.arch-house .house-window{left:17px;bottom:12px;width:10px;height:9px;border-radius:2px;background:#bfe6ff;box-shadow:inset 0 0 0 2px rgba(20,35,45,.35),0 0 5px rgba(255,224,130,.22)}.arch-house .house-door{left:28px;bottom:2px;width:7px;height:15px;border-radius:2px 2px 0 0;background:#4d3528}.arch-house .house-chimney{right:10px;top:0;width:6px;height:12px;background:#70483b}.arch-house.house-0{--wall:#d6b184;--wall-dark:#9c704b;--roof:#8d3f35;--roof-light:#b85a4b;--roof-dark:#5d2c2a}.arch-house.house-1{--wall:#b7c9bd;--wall-dark:#71897d;--roof:#4d6674;--roof-light:#708b99;--roof-dark:#344752}.arch-house.house-2{--wall:#d7c08b;--wall-dark:#9b7d4c;--roof:#566d42;--roof-light:#718c58;--roof-dark:#34472d}.arch-house.house-3{--wall:#c7a5c4;--wall-dark:#886681;--roof:#6a405f;--roof-light:#8d587d;--roof-dark:#43283f}.arch-house .house-lawn{left:-5px;right:-5px;bottom:-2px;height:6px;border-radius:50%;background:rgba(84,123,64,.45);z-index:-1}.arch-house.house-2 .house-chimney,.arch-house.house-3 .house-chimney{display:none}.building-art{position:relative;display:block;width:46px;height:48px;filter:drop-shadow(0 7px 7px rgba(0,0,0,.35))}.building-art i{position:absolute;display:block}.building-art .b-body{left:6px;right:6px;bottom:3px;height:34px;border-radius:4px 4px 2px 2px;background:linear-gradient(90deg,var(--b-dark),var(--b-main),var(--b-dark));border:1px solid rgba(255,255,255,.2)}.building-art .b-roof{left:4px;right:4px;top:2px;height:13px;background:var(--b-roof);clip-path:polygon(8% 100%,50% 0,92% 100%)}.building-art .b-window{left:14px;top:19px;width:8px;height:7px;background:#c7edff;box-shadow:13px 0 #c7edff,0 11px rgba(255,221,132,.9),13px 11px rgba(255,221,132,.9);border-radius:1px}.building-art .b-door{left:24px;bottom:3px;width:8px;height:14px;background:#44352e;border-radius:2px 2px 0 0}.building-art .b-sign{left:9px;right:9px;top:11px;height:7px;border-radius:2px;background:rgba(255,235,185,.82)}.building-kiosk{--b-main:#c98b45;--b-dark:#7e512e;--b-roof:#9b342f}.building-cafe{--b-main:#a97a59;--b-dark:#634736;--b-roof:#d2a15e}.building-workshop{--b-main:#73828c;--b-dark:#46535b;--b-roof:#3c4a53}.building-factory{width:56px;height:58px;--b-main:#6d777d;--b-dark:#394349;--b-roof:#59656b}.building-factory .b-body{height:43px}.building-factory .b-roof{height:18px}.building-factory .b-smokestack{right:7px;top:-7px;width:7px;height:25px;background:#4b5558;border-radius:2px}.building-factory .b-smoke{right:3px;top:-16px;width:9px;height:9px;border-radius:50%;background:rgba(220,225,225,.55);box-shadow:8px -8px 0 -1px rgba(220,225,225,.3)}.city-architecture-layer{position:absolute;inset:0;pointer-events:none;z-index:2}.city-zone{position:absolute;pointer-events:none;z-index:1;border:1px solid rgba(255,255,255,.06);box-shadow:inset 0 0 35px rgba(0,0,0,.08)}.city-zone.residential{left:2%;top:10%;width:38%;height:43%;border-radius:18px;background:linear-gradient(145deg,rgba(120,151,105,.13),rgba(190,161,115,.04))}.city-zone.center{left:35%;top:30%;width:31%;height:39%;border-radius:50%;background:radial-gradient(circle,rgba(219,193,139,.16),rgba(92,111,93,.03) 70%,transparent)}.city-zone.commercial{left:39%;top:8%;width:55%;height:32%;border-radius:22px;background:linear-gradient(160deg,rgba(187,143,83,.12),rgba(89,101,111,.03))}.city-zone.industrial{left:60%;top:48%;width:37%;height:43%;border-radius:16px;background:linear-gradient(145deg,rgba(91,102,108,.14),rgba(60,66,69,.04))}.city-zone.outskirts{left:1%;top:54%;width:34%;height:44%;border-radius:25px;background:radial-gradient(circle at 35% 45%,rgba(91,128,74,.12),transparent 70%)}.city-zone-label{position:absolute;z-index:2;pointer-events:none;font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:rgba(238,228,199,.46);font-weight:800;text-shadow:0 2px 4px rgba(0,0,0,.5)}.city-zone-label.res{left:7%;top:13%}.city-zone-label.com{left:65%;top:11%}.city-zone-label.cen{left:44%;top:34%}.city-zone-label.ind{left:69%;top:82%}.city-zone-label.out{left:7%;top:91%}.arch-park{position:absolute;border-radius:50%;background:radial-gradient(circle at 50% 45%,rgba(95,145,76,.65),rgba(54,91,58,.2) 65%,transparent 70%)}.arch-park.p1{left:4%;top:63%;width:17%;height:13%}.arch-park.p2{right:4%;top:15%;width:15%;height:11%}.arch-fountain{position:absolute;left:48%;top:43%;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle,#dff6ff 0 12%,#6da7bd 13% 30%,#405e68 31% 100%);box-shadow:0 0 0 5px rgba(110,155,169,.12)}.arch-road-mark{position:absolute;height:3px;background:rgba(235,210,144,.32);border-radius:3px;transform-origin:left center}.arch-road-mark.r1{left:8%;top:53%;width:37%;transform:rotate(-10deg)}.arch-road-mark.r2{left:53%;top:54%;width:38%;transform:rotate(13deg)}.city-chart{display:flex;flex-direction:column;gap:8px;margin:8px 0 14px}.city-chart-title{font-size:12px;font-weight:900;letter-spacing:.06em;color:rgba(255,255,255,.72);margin-top:10px}.city-chart-row{display:grid;grid-template-columns:78px 1fr auto;gap:7px;align-items:center;font-size:10px}.city-chart-row span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.city-chart-track,.city-level-track{height:8px;border-radius:8px;background:rgba(255,255,255,.08);overflow:hidden}.city-chart-track i,.city-level-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#d7a84d,#f3d477);box-shadow:0 0 8px rgba(243,212,119,.2)}.city-chart-row b{font-size:9px;white-space:nowrap}.city-level-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px}.city-level-card{padding:8px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}.city-level-card b{display:block;font-size:10px}.city-level-card span{display:block;font-size:9px;opacity:.62;margin:2px 0 6px}.city-zone-label{transition:opacity .2s}.city-time-night .city-zone-label{opacity:.34}.city-stage-village .city-zone{opacity:.72}.city-stage-town .city-zone,.city-stage-small .city-zone{opacity:.86}.city-stage-large .city-zone,.city-stage-mega .city-zone{opacity:1}@media(max-width:600px){.arch-house{width:36px;height:33px}.arch-house .house-body{left:5px;right:5px;height:20px}.arch-house .house-roof{left:2px;width:32px;height:19px}.arch-house .house-window{left:13px;bottom:9px;width:8px;height:7px}.arch-house .house-door{left:22px;height:11px}.building-art{width:34px;height:38px}.building-art .b-body{left:4px;right:4px;height:27px}.building-art .b-roof{left:3px;right:3px;height:10px}.building-art .b-window{left:10px;top:14px;width:6px;height:5px;box-shadow:10px 0 #c7edff,0 8px rgba(255,221,132,.9),10px 8px rgba(255,221,132,.9)}.building-art .b-door{left:18px;height:11px}.building-factory{width:40px;height:44px}.building-factory .b-body{height:32px}.building-factory .b-roof{height:13px}.building-factory .b-smokestack{right:5px;top:-5px;height:19px}.building-factory .b-smoke{right:2px;top:-12px}.arch-fountain{transform:scale(.8)}}";document.head.appendChild(style)}

function renderCityMap(s){
  const el=document.querySelector("#cityMap");if(!el)return;
  ensureArchitectureStyle();
  const businesses=s.businesses||[],catalog=s.businessCatalog||[];
  const meta={kiosk:{icon:"🏪",spot:[22,37],zone:"trade"},cafe:{icon:"☕",spot:[64,37],zone:"trade"},workshop:{icon:"🔧",spot:[69,67],zone:"business"},factory:{icon:"🏭",spot:[84,70],zone:"industry"}};
  const totalIncome=businesses.reduce((n,b)=>n+(Number(b.profitPerHour)||0),0),owned=businesses.length,level=Math.max(1,Number(s.level)||1);
  const cityStage=level>=25||owned>=4?"mega":level>=15||owned>=3?"large":level>=10||owned>=2?"small":level>=7?"town":"village";
  const cityNames={village:"ДЕРЕВНЯ",town:"ПОСЁЛОК",small:"МАЛЕНЬКИЙ ГОРОД",large:"БОЛЬШОЙ ГОРОД",mega:"МЕГАПОЛИС"};
  const cityProgress={village:1,town:2,small:3,large:4,mega:5}[cityStage];
  const live=s.cityLive||{};
  const liveTraffic=Math.max(0,Number(live.traffic)||0),liveVisitors=Math.max(0,Number(live.visitors)||0);
  const traffic=Math.min(14,Math.max(1,Math.ceil(liveTraffic/8)+(owned*1.2)+(level/6)));
  const people=Math.min(14,Math.max(2,Math.ceil(liveVisitors/8)+(owned?1:0)));
  const hour=new Date().getHours(),night=hour>=20||hour<7;
  const houseSlots=[[8,12],[24,12],[40,12],[68,12],[84,12],[8,27],[24,27],[38,27],[68,27],[84,27],[8,38],[24,36],[38,39],[68,31],[84,38],[10,55],[31,54],[67,55]];const houseCount=cityStage==="mega"?18:cityStage==="large"?15:cityStage==="small"?12:cityStage==="town"?9:6;const houses=houseSlots.slice(0,houseCount).map((p,i)=>{const x=p[0],y=p[1],type=i%4;return '<i class="arch-house house-'+type+'" style="position:absolute;left:'+x+'%;top:'+y+'%"><span class="house-lawn"></span><span class="house-body"></span><span class="house-roof"></span><span class="house-window"></span><span class="house-door"></span><span class="house-chimney"></span></i>';}).join("");
  const businessTargets=businesses.map(b=>({id:b.id,m:meta[b.id]})).filter(x=>x.m);
  const cars=Array.from({length:traffic},(_,i)=>{
    const lane=i%4, y=[53,56,59,62][lane], dur=12+(i%5)*2, delay=-(i*1.7);
    return '<i class="city-car traffic-car lane-'+lane+'" style="--road-y:'+y+'%;--car-duration:'+dur+'s;--car-delay:'+delay+'s"></i>';
  }).join("");
  const buses=Array.from({length:Math.min(2,cityProgress)},(_,i)=>'<i class="city-bus" style="left:-12%;top:'+(57+i*4)+'%;--bus-delay:-'+(i*6)+'s"></i>').join("");
  const trafficLights='<i class="city-traffic-light active" style="left:49%;top:51%"></i><i class="city-traffic-light" style="left:57%;top:73%"></i><i class="city-traffic-light" style="left:70%;top:58%"></i>';
  const npcList=Array.isArray(live.npcs)?live.npcs:[];
  const walkers=npcList.slice(0,16).map((n,i)=>{
    const target=n.targetBusiness&&businessTargets.find(x=>x.id===n.targetBusiness);
    const spot=target?.m?.spot||[50,55];
    const spawnPoints=[[12,52],[25,53],[37,56],[61,53],[76,55],[89,57],[18,75],[35,76],[53,76],[72,76],[86,77],[30,48]];const spawn=spawnPoints[i%spawnPoints.length],sx=spawn[0],sy=spawn[1];
    return '<i class="city-person customer-person npc-'+n.type+' npc-'+n.phase+'" style="left:'+sx+'%;top:'+sy+'%;--customer-x:'+(spot[0]-sx)+'%;--customer-y:'+(spot[1]-sy)+'%;--customer-duration:'+(5+(i%5))+'s;--customer-delay:-'+(i*.55)+'s" title="'+n.typeName+'"></i>';
  }).join("");
  const queueBadges=businesses.map(b=>{const m=meta[b.id];if(!m)return "";const q=Number(live.queues?.[b.id]||0),d=Number(live.demand?.[b.id]||0);if(!q&&!d)return "";return '<span class="business-demand-badge" style="left:'+m.spot[0]+'%;top:'+(m.spot[1]-6)+'%">'+(q?'👥 '+q+' в очереди':'📈 спрос '+d)+'</span>';}).join("");
  const streetLife='<i class="city-tree tree-1">🌳</i><i class="city-tree tree-2">🌲</i><i class="city-tree tree-3">🌳</i><i class="city-lamp lamp-1">💡</i><i class="city-lamp lamp-2">💡</i>';
  const activeBusinesses=businesses.filter(b=>Number(b.level||1)>=5);
  const trucks=activeBusinesses.filter(b=>b.id==="workshop"||b.id==="factory").slice(0,4).map((b,i)=>'<i class="city-truck truck-route-'+b.id+'" style="--i:'+i+'"></i>').join("");
  const moneyFlows=businesses.slice(0,4).map((b,i)=>{const m=meta[b.id]||{spot:[50,68]};return '<i class="money-flow money-'+b.id+'" style="--x:'+m.spot[0]+';--y:'+m.spot[1]+';--i:'+i+'">+'+Math.max(1,Math.round(Number(b.profitPerHour||0)))+'</i>'}).join("");
  const activity=businesses.map(b=>{const m=meta[b.id];if(!m)return "";const count=Math.min(3,Math.max(1,Math.floor((Number(b.level)||1)/5)));return Array.from({length:count},(_,i)=>'<i class="business-worker worker-'+b.id+'" style="--n:'+i+';left:'+m.spot[0]+'%;top:'+(m.spot[1]+5+i*2)+'%"></i>').join("")}).join("");
  const pendingByBusiness=businesses.map(b=>{
    const pending=Math.max(0,Number(b.pendingIncome||b.pending||0)); if(!pending)return "";
    const m=meta[b.id];if(!m)return "";
    const pulses=Math.min(3,Math.max(1,Math.ceil(pending/Math.max(1,Number(b.profitPerHour||1))*3)));
    return Array.from({length:pulses},(_,i)=>'<i class="income-pulse pulse-'+b.id+'" style="--sx:'+m.spot[0]+'%;--sy:'+m.spot[1]+'%;--dx:'+((48-m.spot[0]))+'vw;--dy:'+((55-m.spot[1]))+'vh;--delay:'+(i*.7)+'s">₽</i>').join("");
  }).join("");
  const routeLines=businesses.map(b=>{const m=meta[b.id];if(!m)return "";const dx=48-m.spot[0],dy=55-m.spot[1],len=Math.sqrt(dx*dx+dy*dy);return '<i class="business-route route-'+b.id+'" style="--sx:'+m.spot[0]+'%;--sy:'+m.spot[1]+'%;--len:'+len+'%;--angle:'+Math.atan2(dy,dx)*180/Math.PI+'deg"></i>';}).join("");
  const businessFlows=businesses.map((b,i)=>{const m=meta[b.id];if(!m)return "";return '<i class="business-flow flow-'+b.id+'" style="--sx:'+m.spot[0]+'%;--sy:'+m.spot[1]+'%;--dx:'+((48-m.spot[0]))+'vw;--dy:'+((55-m.spot[1]))+'vh;--delay:'+(i*.8)+'s"></i>';}).join("");
  const parkingSpots=[[15,47],[28,47],[74,57],[87,58],[17,78],[28,78],[67,78],[80,78]];const parking=parkingSpots.map(p=>'<i class="city-parking-slot" style="left:'+p[0]+'%;top:'+p[1]+'%"></i>').join("");const homePulse='<div class="home-pulse-ring"></div>';
  const cityLabels='<div class="map-compass">N</div><div class="map-scale-label">МАСШТАБ · ГОРОД</div>';
  const markers=catalog.filter(b=>meta[b.id]).map(cat=>{
    const m=meta[cat.id],biz=businesses.find(x=>x.id===cat.id);
    const typeClass=cat.id==="factory"?"building-factory":cat.id==="workshop"?"building-workshop":cat.id==="cafe"?"building-cafe":"building-kiosk";
    if(!biz)return '<button type="button" class="map-marker business-marker locked-business" style="left:'+m.spot[0]+'%;top:'+m.spot[1]+'%" data-city-open="business" data-business-id="'+cat.id+'"><span class="building-art '+typeClass+'"><i class="b-roof"></i><i class="b-body"></i><i class="b-window"></i><i class="b-door"></i></span><small>'+cat.name+'</small><em>Участок · '+money(cat.baseCost)+'</em></button>';
    const lv=Math.max(1,Number(biz.level)||1),tier=lv>=25?"city-tier-4":lv>=10?"city-tier-3":lv>=5?"city-tier-2":"city-tier-1";
    const stage=lv>=25?"landmark":lv>=10?"large":lv>=5?"developed":lv>=2?"small":"plot",work=lv>=5?"working":"";
    const art=stage==="plot"?"<span class=\"building-art building-workshop\"><i class=\"b-body\"></i><i class=\"b-roof\"></i></span>":'<span class="building-art '+typeClass+' '+(stage==="landmark"?"building-landmark":"")+'"><i class="b-roof"></i><i class="b-body"></i><i class="b-window"></i><i class="b-door"></i>'+(cat.id==="factory"?'<i class="b-smokestack"></i><i class="b-smoke"></i>':'')+(stage==="large"||stage==="landmark"?'<i class="b-sign"></i>':'')+'</span>';
    return '<button type="button" class="map-marker business-marker '+tier+' building-stage-'+stage+' '+work+'" style="left:'+m.spot[0]+'%;top:'+m.spot[1]+'%" data-city-open="business" data-business-id="'+cat.id+'">'+art+'<small>'+cat.name+'</small><em>ур. '+lv+' · '+money(biz.profitPerHour||0)+'/ч</em><i class="building-lights"></i><i class="building-smoke"></i></button>';
  }).join("");
  const pendingTasks=(s.tasks||[]).filter(x=>!x.claimed&&x.locked===false).length;
  const pendingAchievements=(s.achievements||[]).filter(x=>!x.claimed&&x.unlocked).length;
  const dailyReady=!(s.daily||{}).already;
  const eventReady=!(s.event||{}).claimed;
  const cityEvents=[["⚡","Спрос +25%","event",30,57],["📦","Заказ","event",72,30],["🎉","Праздник","event",50,24]].slice(0,cityStage==="village"?1:cityStage==="town"?2:3).map(x=>'<button type="button" class="map-marker city-event-marker '+(eventReady?"event-ready":"event-done")+'" style="left:'+x[3]+'%;top:'+x[4]+'%" data-city-open="event"><span>'+x[0]+'</span><small>'+x[1]+'</small><em>'+(eventReady?"Забрать":"Получено")+'</em></button>').join("");
  const servicePoints=[["🎯","Задания","tasks",8,pendingTasks],["🏆","Достижения","achievements",24.8,pendingAchievements],["🎁","Бонус","daily",41.6,dailyReady?1:0],["🛒","Магазин","shop",58.4,(s.shop||[]).length],["⚡","Событие","event",75.2,eventReady?1:0],["🥇","Рейтинг","rankings",92,0]].map(x=>'<button type="button" class="map-marker city-service-marker service-'+x[2]+' '+(x[4]?'service-ready':'service-idle')+'" style="left:'+x[3]+'%" data-city-open="'+x[2]+'"><span>'+x[0]+'</span><small>'+x[1]+'</small></button>').join("");
  const territoryMarks=[["🌳","Новая территория",8,72,1],["🧭","Северный район",92,72,2],["🏗️","Новый квартал",92,80,3],["🌉","Большая зона",8,80,4]].map(x=>'<button type="button" class="map-marker territory-marker '+(cityProgress>=x[4]?"territory-open":"territory-locked")+'" style="left:'+x[2]+'%;top:'+x[3]+'%" data-city-open="territory" data-territory="'+x[1]+'"><span>'+(cityProgress>=x[4]?x[0]:"🔒")+'</span><small>'+x[1]+'</small><em>'+(cityProgress>=x[4]?"Открыто":"Требуется ур. "+([0,1,7,10,15][x[4]]) )+'</em></button>').join("");
  el.innerHTML='<div class="city-map city-stage-'+cityStage+(night?" city-time-night":" city-time-day")+'"><div class="map-world"><div class="city-architecture-layer"><div class="city-zone residential"></div><div class="city-zone center"></div><div class="city-zone commercial"></div><div class="city-zone industrial"></div><div class="city-zone outskirts"></div><span class="city-zone-label res">Жилой район</span><span class="city-zone-label com">Торговая улица</span><span class="city-zone-label cen">Центр</span><span class="city-zone-label ind">Промзона</span><span class="city-zone-label out">Окраина</span><div class="arch-sidewalk s1"></div><div class="arch-sidewalk s2"></div><div class="arch-road-mark r1"></div><div class="arch-road-mark r2"></div><i class="arch-crosswalk c1"></i><i class="arch-crosswalk c2"></i><i class="arch-lamp-post l1"></i><i class="arch-lamp-post l2"></i><i class="arch-tree t1"></i><i class="arch-tree t2"></i><i class="arch-tree t3"></i><div class="arch-park p1"></div><div class="arch-park p2"></div><div class="arch-fountain"></div></div><div class="city-houses-layer">'+houses+'</div><div class="city-street-life">'+streetLife+'</div><div class="map-plaza"><span>⭐</span><small>ЦЕНТРАЛЬНАЯ ПЛОЩАДЬ</small></div><div class="city-sidewalks"><i class="sidewalk-block sb1"></i><i class="sidewalk-block sb2"></i><i class="sidewalk-block sb3"></i><i class="sidewalk-block sb4"></i></div><div class="city-parking">'+parking+'</div><div class="map-road road-a"></div><div class="map-road road-b"></div><div class="map-road road-c"></div><div class="map-road road-d"></div><div class="map-water"></div><div class="map-route route-home-trade"></div><div class="map-route route-home-center"></div><div class="map-route route-home-industry"></div><div class="city-business-routes">'+routeLines+businessFlows+pendingByBusiness+'</div><div class="city-traffic">'+cars+buses+trafficLights+'</div><div class="city-life">'+walkers+'</div><div class="city-logistics">'+trucks+'</div><div class="city-economy-flow">'+moneyFlows+'</div><div class="city-business-life">'+activity+'</div><button type="button" class="map-marker home-marker" style="left:50%;top:67%" data-city-open="home"><span class="building-art building-landmark building-cafe"><i class="b-roof"></i><i class="b-body"></i><i class="b-window"></i><i class="b-door"></i><i class="b-sign"></i></span><small>Мой дом</small><em>База · ур. '+level+'</em>'+homePulse+'</button>'+markers+territoryMarks+'<div class="map-center-label">Мой город · '+cityNames[cityStage].toLowerCase()+' · '+cityProgress+' территории</div></div><div class="map-ui-layer"><div class="map-hud"><span>💰 '+money(s.balance||0)+'</span><span>⭐ Ур. '+level+'</span></div><div class="map-city-status"><b>'+cityNames[cityStage]+'</b><span>Город ур. '+level+'</span><span>'+owned+'/4 объектов</span><span>'+money(totalIncome)+'/ч</span></div>'+servicePoints+cityLabels+'</div><div id="cityPanel" class="city-panel" hidden></div><div class="map-legend"><span>🏠 База</span><span>🏪 Бизнес</span><span>🚗 Трафик</span><span>👥 Жизнь</span><b>'+owned+' объектов · '+money(totalIncome)+'/ч</b></div></div>'; 
  initCityMapControls();
}

function openCityPanel(kind,id){
  const panel=document.querySelector("#cityPanel");if(!panel)return;
  const s=window.__mrGusState;if(!s){setStatus("Данные города ещё загружаются");return}
  const actionBtn=(action,label,extra="",disabled=false)=>button(action,label,extra,disabled);
  let title="Город",body="";
  if(kind==="business"){
    const biz=(s.businesses||[]).find(x=>x.id===id),cat=(s.businessCatalog||[]).find(x=>x.id===id);if(!cat)return;
    title=(biz?"🏙️ ":"🔒 ")+cat.name;
    if(biz){
      const emp=biz.employees||{};
      body='<div class="city-panel-stats"><b>Уровень '+(biz.level||1)+'</b><b>'+money(biz.profitPerHour||0)+'/ч</b><b>Доход '+money(biz.pendingIncome||0)+'</b></div><div class="city-panel-actions">'+actionBtn("upgrade","⬆️ Улучшить",'data-business-id="'+id+'"')+actionBtn("collect","💰 Забрать доход")+actionBtn("hire","👷 Нанять кассира",'data-business-id="'+id+'" data-role="cashier"')+actionBtn("hire","👔 Нанять управляющего",'data-business-id="'+id+'" data-role="manager"')+actionBtn("expand","🏗️ Расширить",'data-business-id="'+id+'"')+actionBtn("invest","💼 Инвестировать 5k",'data-business-id="'+id+'"')+actionBtn("boost","⚡ Ускорить",'data-business-id="'+id+'"')+'</div><div class="city-panel-note">Кассиры: '+(emp.cashier||0)+' · Управляющие: '+(emp.manager||0)+' · Расширение: '+(biz.expansionLevel||0)+'/5 · Инвестиции: '+money(biz.investment||0)+'</div>';
    }else body='<div class="city-panel-note">'+cat.description+'</div>'+actionBtn("buy","🏗️ Купить за "+money(cat.baseCost),'data-business-id="'+id+'"',cat.unlocked===false);
  }else if(kind==="home"){
    title="🏠 Мой дом · аналитика";
    const live=s.cityLive||{};const orders=live.orders||[];const districtNames={residential:'Жилой',center:'Центр',commercial:'Коммерция',industrial:'Промзона',outskirts:'Окраина'};
    const bs=(s.businesses||[]).slice(0,6);
    const maxIncome=Math.max(1,...bs.map(b=>Number(b.profitPerHour)||0));
    const maxLevel=Math.max(1,...bs.map(b=>Number(b.level)||1));
    const incomeBars=bs.length?bs.map(b=>{const v=Number(b.profitPerHour)||0;return '<div class="city-chart-row"><span>'+((s.businessCatalog||[]).find(x=>x.id===b.id)?.name||b.id)+'</span><div class="city-chart-track"><i style="width:'+Math.max(5,Math.round(v/maxIncome*100))+'%"></i></div><b>'+money(v)+'/ч</b></div>'}).join(""):'<div class="city-panel-note">Купи первый бизнес — здесь появится статистика.</div>';
    const levelBars=bs.length?bs.map(b=>{const lv=Number(b.level)||1;return '<div class="city-level-card"><b>'+((s.businessCatalog||[]).find(x=>x.id===b.id)?.name||b.id)+'</b><span>ур. '+lv+'</span><div class="city-level-track"><i style="width:'+Math.max(6,Math.round(lv/maxLevel*100))+'%"></i></div></div>'}).join(""):"";
    const hist=(window.__mrGusAnalytics?.points||[]).slice(-24);const maxHist=Math.max(1,...hist.map(x=>Number(x.income_per_hour)||0));const historyBars=hist.length?hist.map(x=>'<div class="city-history-bar" title="'+new Date(x.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})+'"><i style="height:'+Math.max(4,Math.round((Number(x.income_per_hour)||0)/maxHist*100))+'%"></i></div>').join(""):'<div class="city-panel-note">История начнёт накапливаться во время игры.</div>';body='<div class="city-panel-stats"><b>🚗 Трафик '+(live.traffic||0)+'%</b><b>🚶 Посетители '+(live.visitors||0)+'</b><b>📦 Заказов '+orders.length+'</b></div><div class="city-chart-title">Доход объектов</div><div class="city-chart">'+incomeBars+'</div><div class="city-chart-title">Развитие бизнеса</div><div class="city-level-grid">'+levelBars+'</div><div class="city-chart-title">Активные заказы</div>'+(orders.length?orders.map(o=>'<div class="city-list-item"><div><b>📦 '+o.client+' · '+o.title+'</b><small>Заказ для бизнеса · '+Math.ceil((o.remainingMs||0)/3600000)+' ч.</small><em>+'+money(o.reward)+' · +'+(o.xp||0)+' XP</em></div>'+actionBtn("order","Получить заказ",'data-order-id="'+o.id+'"')+'</div>').join(""):'<div class="city-panel-note">Новые заказы появятся после открытия бизнеса.</div>')+'<div class="city-chart-title">История дохода / час · 24 ч</div><div class="city-history-chart">'+historyBars+'</div><div class="city-chart-title">Состояние районов</div><div class="city-level-grid">'+Object.entries(live.districts||{}).map(([k,v])=>'<div class="city-level-card"><b>'+districtNames[k]+'</b><span>'+v+'%</span><div class="city-level-track"><i style="width:'+v+'%"></i></div></div>').join('')+'</div><div class="city-panel-stats"><b>'+money(bs.reduce((n,b)=>n+(Number(b.profitPerHour)||0),0))+'/ч</b><b>'+bs.length+'/4 объектов</b><b>Ур. '+(s.level||1)+'</b></div>';
  }else if(kind==="tasks"){
    title="🎯 Задания";const rows=(s.tasks||[]).filter(x=>!x.claimed);
    body=rows.length?rows.map(x=>'<div class="city-list-item"><div><b>'+x.title+'</b><small>'+x.description+'</small><em>+'+money(x.reward)+' · +'+x.xp+' XP</em></div>'+actionBtn("claim",x.locked?"🔒":"Забрать",'data-task-id="'+String(x.id).replaceAll('"','&quot;')+'"',!!x.locked)+'</div>').join(""):'<div class="city-panel-note">Все доступные задания выполнены.</div>';
  }else if(kind==="achievements"){
    title="🏆 Достижения";const rows=(s.achievements||[]).filter(x=>!x.claimed);
    body=rows.length?rows.map(x=>'<div class="city-list-item"><div><b>'+x.title+'</b><small>'+x.description+'</small><em>+'+money(x.reward)+' · +'+x.xp+' XP</em></div>'+actionBtn("achievement",x.unlocked?"Забрать":"🔒",'data-id="'+x.id+'"',!x.unlocked)+'</div>').join(""):'<div class="city-panel-note">Все доступные достижения получены.</div>';
  }else if(kind==="daily"){
    title="🎁 Ежедневный бонус";const d=s.daily||{};body='<div class="city-panel-stats"><b>Серия: '+(d.streak||0)+'</b><b>+'+money(d.reward||0)+'</b><b>+'+(d.xp||0)+' XP</b></div>'+actionBtn("daily",d.already?"Получено сегодня":"Забрать бонус","",!!d.already);
  }else if(kind==="shop"){
    title="🛒 Магазин";body=(s.shop||[]).map(x=>'<div class="city-list-item"><div><b>'+x.title+'</b><small>'+x.description+'</small><em>'+money(x.cost)+' · получено: '+(x.owned||0)+'</em></div>'+actionBtn("shop","Купить",'data-item-id="'+x.id+'"')+'</div>').join("")||'<div class="city-panel-note">Магазин пока пуст.</div>';
  }else if(kind==="rankings"){
    title="🏆 Рейтинг города";
    const r=window.__mrGusRankings||{};
    const list=r.overall||r.level||[];
    body=list.slice(0,8).map((x,i)=>'<div class="city-list-item"><div><b>#'+(i+1)+' '+(x.name||x.username||"Игрок")+'</b><small>Уровень '+(x.level||0)+' · '+money(x.balance||0)+'</small></div><em>'+(x.score||0)+' очков</em></div>').join("")||'<div class="city-panel-note">Рейтинг загружается.</div>';
  }else if(kind==="territory"){
    title="🗺️ Территория";
    body='<div class="city-panel-stats"><b>'+String(id||"Новая территория")+'</b><b>Городская зона</b></div><div class="city-panel-note">Развитие города открывает новые районы и игровые объекты. Территория связана с уровнем города и развивается вместе с ним.</div>';
  }else if(kind==="event"){
    title="⚡ Событие";const ev=s.event||{};body='<div class="city-event"><b>'+String(ev.title||"Событие")+'</b><small>'+String(ev.description||"")+'</small><em>+'+money(ev.reward||0)+' · +'+(ev.xp||0)+' XP</em>'+actionBtn("event",ev.claimed?"Получено":"Забрать награду","",!!ev.claimed)+'</div>';
  }
  panel.innerHTML='<button type="button" class="city-panel-close" data-city-close aria-label="Закрыть">×</button><div class="city-panel-title">'+title+'</div><div class="city-panel-scroll">'+body+'</div>';panel.hidden=false;document.body.classList.add("map-panel-open");
}

function closeCityPanel(){const p=document.querySelector("#cityPanel");if(p)p.hidden=true;document.body.classList.remove("map-panel-open")}

function renderEmpireVisual(s){
  const el=document.querySelector("#empireVisual"); if(!el)return;
  const businesses=s.businesses||[];
  const catalog=s.businessCatalog||[];
  const total=Math.max(1,businesses.reduce((n,b)=>n+(Number(b.profitPerHour)||0),0));
  const bars=catalog.slice(0,8).map(b=>{
    const owned=businesses.find(x=>x.id===b.id);
    const income=Number(owned?.profitPerHour)||0;
    const pct=Math.min(100,Math.max(0,income/total*100));
    return '<div class="visual-row"><div class="visual-label"><span>'+b.name+'</span><b>'+money(income)+'/ч</b></div><div class="visual-track"><i style="width:'+pct+'%"></i></div></div>';
  }).join("");
  const level=Math.max(1,Number(s.level)||1), xp=Number(s.xp)||0, xpP=s.xpProgress?.percent||0;
  el.innerHTML='<div class="visual-summary"><div><span>Уровень</span><b>'+level+'</b></div><div><span>XP</span><b>'+xp.toLocaleString('ru-RU')+'</b></div><div><span>Доход/ч</span><b>'+money(total)+'</b></div></div><div class="visual-xp"><div class="visual-label"><span>Прогресс уровня</span><b>'+xpP+'%</b></div><div class="visual-track"><i style="width:'+xpP+'%"></i></div></div><div class="visual-bars">'+(bars||'<div class="muted">Открой первый бизнес — здесь появится график твоей империи.</div>')+'</div>';
}
function renderProfile(p){
  const el=document.querySelector("#profile");if(!el)return;
  const avatar=p.photoUrl?("<img class=\"avatar\" src=\"" + p.photoUrl + "\" alt=\"\">"):"<div class=\"avatar placeholder\">🪿</div>";
  el.innerHTML="<div class=\"profile-head\">"+avatar+"<div><b>"+p.name+"</b><div class=\"muted\">"+(p.username?("@"+p.username):"Mr.Gus")+"</div></div></div><div class=\"profile-grid\"><div><span>Уровень</span><b>"+p.level+"</b></div><div><span>XP</span><b>"+p.xp+"</b></div><div><span>Капитал</span><b>"+money(p.balance)+"</b></div><div><span>Бизнесы</span><b>"+p.businesses+"</b></div><div><span>Достижения</span><b>"+p.achievements+"</b></div><div><span>Начало</span><b>"+(p.createdAt?new Date(p.createdAt).toLocaleDateString():"—")+"</b></div></div>";
}
function rankList(title,rows,key){
  const html=rows.slice(0,10).map((r,i)=>"<div class=\"rank-row\"><span>#"+(i+1)+" "+r.name+"</span><b>"+(key==="balance"?money(r[key]):(r[key]??0))+"</b></div>").join("");
  return "<div class=\"rank-block\"><b>"+title+"</b>"+(html||"<div class=\"muted\">Пока нет игроков</div>")+"</div>";
}
let currentRankTab="overall";
function renderRankings(r){
  const el=document.querySelector("#rankings");if(!el)return;
  const titles={overall:"Общий рейтинг",level:"По уровню",capital:"По капиталу",businesses:"По бизнесам",achievements:"По достижениям",weekly:"Недельный рейтинг",season:"Сезон "+r.seasonKey};
  const keys={overall:"score",level:"level",capital:"balance",businesses:"businesses",achievements:"achievements",weekly:"points",season:"points"};
  el.innerHTML=rankList(titles[currentRankTab]||titles.overall,r[currentRankTab]||[],keys[currentRankTab]||"score");
  document.querySelectorAll("[data-rank-tab]").forEach(b=>b.classList.toggle("active",b.dataset.rankTab===currentRankTab));
}
function renderAdmin(a){
  const panel=document.querySelector("#adminPanel"),el=document.querySelector("#admin");if(!panel||!el)return;panel.hidden=false;
  el.innerHTML=`<input class="admin-search" id="adminSearch" placeholder="Поиск: Telegram ID, username, имя"><div class="stats-grid"><div><span>Пользователи</span><b>${a.metrics.users}</b></div><div><span>Операции</span><b>${a.metrics.operations}</b></div><div><span>Ошибки</span><b>${a.metrics.errors}</b></div></div><div class="admin-list">${a.users.slice(0,30).map(u=>`<div class="mini-card"><div class="row"><div><b>${u.name}</b><p class="muted">TG: ${u.id} · LVL ${u.level} · ${money(u.balance)}</p></div><button class="btn ${u.blocked?"secondary":""}" data-admin-user="${u.dbId}" data-admin-block="${u.blocked?"unblock":"block"}">${u.blocked?"Разблокировать":"Заблокировать"}</button></div></div>`).join("")}</div><details><summary>Последние операции</summary><pre class="admin-pre">${JSON.stringify(a.operations.slice(0,20),null,2)}</pre></details><details><summary>Аудит</summary><pre class="admin-pre">${JSON.stringify(a.audits.slice(0,30),null,2)}</pre></details><details><summary>Последние ошибки</summary><pre class="admin-pre">${JSON.stringify(a.errors.slice(0,20),null,2)}</pre></details>`;
}
async function action(button,fn){if(!button||button.disabled)return;button.disabled=true;try{const state=await fn();const live=await api('/api/city/live').catch(()=>null);if(live)state.cityLive=live;render(state);setStatus(t('status.done'))}catch(e){setStatus(friendlyError(e),true)}finally{button.disabled=false}}
async function buy(button,id){await action(button,()=>api("/api/business/buy",{method:"POST",body:JSON.stringify({businessId:id,operationId:op("buy")})}))}
async function upgrade(button,id){await action(button,()=>api("/api/business/upgrade",{method:"POST",body:JSON.stringify({businessId:id,operationId:op("upgrade")})}))}
async function collect(button){await action(button,()=>api("/api/income/collect",{method:"POST",body:JSON.stringify({operationId:op("income")})}))}
async function claim(button,id){await action(button,()=>api("/api/task/claim",{method:"POST",body:JSON.stringify({taskId:id,operationId:op("task")})}))}
async function claimAchievement(button,id){await action(button,()=>api("/api/achievement/claim",{method:"POST",body:JSON.stringify({achievementId:id,operationId:op("achievement")})}))}
async function claimGoal(button,id){await action(button,()=>api("/api/goal/claim",{method:"POST",body:JSON.stringify({goalId:id,operationId:op("goal")})}))}
async function claimEvent(button){await action(button,()=>api("/api/event/claim",{method:"POST",body:JSON.stringify({operationId:op("event")})}))}
async function hire(button,id,role){await action(button,()=>api("/api/business/employee/hire",{method:"POST",body:JSON.stringify({businessId:id,role,operationId:op("hire")})}))}
async function expand(button,id){await action(button,()=>api("/api/business/expand",{method:"POST",body:JSON.stringify({businessId:id,operationId:op("expand")})}))}
async function invest(button,id){await action(button,()=>api("/api/business/invest",{method:"POST",body:JSON.stringify({businessId:id,amount:5000,operationId:op("invest")})}))}
async function boost(button,id){await action(button,()=>api("/api/business/boost",{method:"POST",body:JSON.stringify({businessId:id,operationId:op("boost")})}))}
async function shop(button,id){await action(button,()=>api("/api/shop/buy",{method:"POST",body:JSON.stringify({itemId:id,operationId:op("shop")})}))}
async function daily(button){await action(button,()=>api("/api/daily/claim",{method:"POST",body:JSON.stringify({operationId:op("daily")})}))}
async function claimOrder(button,id){await action(button,()=>api("/api/order/claim",{method:"POST",body:JSON.stringify({orderId:id,operationId:op("order")})}))}
document.addEventListener("click",e=>{
  const cityOpen=e.target.closest("[data-city-open]");
  if(cityOpen){e.preventDefault();openCityPanel(cityOpen.dataset.cityOpen,cityOpen.dataset.businessId||cityOpen.dataset.territory);return}
  if(e.target.closest("[data-city-close]")){closeCityPanel();return}

  const marker=e.target.closest("[data-map-title]");
  if(marker){setStatus(marker.dataset.mapTitle);return}
const search=e.target.closest("#adminSearch");if(search)return;const rank=e.target.closest("[data-rank-tab]");if(rank){currentRankTab=rank.dataset.rankTab;const s=window.__mrGusRankings;if(s)renderRankings(s);return}const admin=e.target.closest("[data-admin-block]");if(admin){(async()=>{try{await api("/api/admin/"+admin.dataset.adminBlock,{method:"POST",body:JSON.stringify({userId:admin.dataset.adminUser,operationId:op("admin")})});await loadSocial();setStatus("Админ-действие выполнено")}catch(err){setStatus(friendlyError(err),true)}})();return}const b=e.target.closest("[data-action]");if(!b||b.disabled)return;const a=b.dataset.action;if(a==="auth")auth();else if(a==="refresh")refresh();else if(a==="buy")buy(b,b.dataset.businessId);else if(a==="upgrade")upgrade(b,b.dataset.businessId);else if(a==="collect")collect(b);else if(a==="claim")claim(b,b.dataset.taskId);else if(a==="achievement")claimAchievement(b,b.dataset.id);else if(a==="goal")claimGoal(b,b.dataset.id);else if(a==="event")claimEvent(b);else if(a==="hire")hire(b,b.dataset.businessId,b.dataset.role);else if(a==="expand")expand(b,b.dataset.businessId);else if(a==="invest")invest(b,b.dataset.businessId);else if(a==="boost")boost(b,b.dataset.businessId);else if(a==="shop")shop(b,b.dataset.itemId);else if(a==="daily")daily(b);else if(a==="order")claimOrder(b,b.dataset.orderId)});
let currentPage="home";
function showPage(page){
  const allowed=["home","tasks","achievements","daily","shop","event"];
  if(!allowed.includes(page))page="home";
  currentPage=page;
  document.querySelectorAll(".page-screen").forEach(el=>el.classList.toggle("page-active",el.dataset.page===page));document.body.classList.toggle("map-fullscreen",page==="home");
  document.querySelectorAll("[data-page-nav]").forEach(el=>{
    const active=el.dataset.pageNav===page;
    el.classList.toggle("active",active);
    el.setAttribute("aria-current",active?"page":"false");
  });
  window.scrollTo(0,0);
  try{history.replaceState(null,"","#"+page)}catch{}
  if(tg?.BackButton){
    if(page==="home")tg.BackButton.hide();else tg.BackButton.show();
  }
}
document.addEventListener("click",e=>{
  const nav=e.target.closest("[data-page-nav]");
  if(!nav)return;
  e.preventDefault();
  showPage(nav.dataset.pageNav);
});
if(tg?.BackButton)tg.BackButton.onClick(()=>showPage("home"));
window.addEventListener("popstate",()=>showPage(location.hash.slice(1)||"home"));
window.addEventListener("load",async()=>{showPage(location.hash.slice(1)||"home");if(tg?.initData)await auth();else setStatus(t("status.waitingTelegram"))});

window.addEventListener("mr-gus-language-changed",()=>{const s=window.__mrGusState;if(s)render(s);});

let adminSearchTimer;document.addEventListener("input",e=>{if(e.target.id!=="adminSearch")return;clearTimeout(adminSearchTimer);adminSearchTimer=setTimeout(async()=>{try{const r=await api("/api/admin/users?q="+encodeURIComponent(e.target.value));const a=await api("/api/admin");a.users=r.users;renderAdmin(a)}catch(err){setStatus(friendlyError(err),true)}},250)});