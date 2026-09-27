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
  try{const s=await api("/api/state");render(s);await loadSocial();setStatus(fromAuth?t("status.loggedIn"):t("status.connected"));return s}
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
  renderCityMap(s);
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

function initCityMapControls(){
  const map=document.querySelector(".city-map"),world=document.querySelector(".map-world");if(!map||!world||map.dataset.controls==="1")return;
  map.dataset.controls="1";
  let scale=1,tx=0,ty=0,startX=0,startY=0,startTx=0,startTy=0,drag=false,moved=false,pinchStart=0;
  const clamp=()=>{scale=Math.max(.85,Math.min(2.4,scale));tx=Math.max(-map.clientWidth*(scale-1)*.55,Math.min(map.clientWidth*(scale-1)*.55,tx));ty=Math.max(-map.clientHeight*(scale-1)*.55,Math.min(map.clientHeight*(scale-1)*.55,ty));};
  const apply=()=>{clamp();world.style.transform='translate3d('+tx+'px,'+ty+'px,0) scale('+scale+')';};
  let pointers=new Map(),pinchDistance=0,pinchScale=1;
  map.addEventListener("pointerdown",e=>{
    if(e.target.closest("button,.city-panel"))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);pinchScale=scale;drag=false;}
  });
  map.addEventListener("pointermove",e=>{
    if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinchDistance){scale=pinchScale*d/pinchDistance;apply();}}
  });
  map.addEventListener("pointerup",e=>pointers.delete(e.pointerId));
  map.addEventListener("pointercancel",e=>pointers.delete(e.pointerId));
  map.addEventListener("pointerdown",e=>{
    if(e.target.closest("button,.city-panel"))return;
    drag=true;moved=false;startX=e.clientX;startY=e.clientY;startTx=tx;startTy=ty;
    try{map.setPointerCapture(e.pointerId)}catch{}
  });
  map.addEventListener("pointermove",e=>{if(!drag)return;const dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)+Math.abs(dy)>5)moved=true;tx=startTx+dx;ty=startTy+dy;apply();});
  map.addEventListener("pointerup",e=>{drag=false;try{map.releasePointerCapture(e.pointerId)}catch{}});
  map.addEventListener("pointercancel",()=>{drag=false});
  map.addEventListener("wheel",e=>{e.preventDefault();const old=scale,dir=e.deltaY<0?1.12:.89;scale*=dir;const r=map.getBoundingClientRect(),cx=e.clientX-r.left-r.width/2,cy=e.clientY-r.top-r.height/2;tx=cx-(cx-tx)*(scale/old);ty=cy-(cy-ty)*(scale/old);apply()},{passive:false});
  let lastDist=0;
  map.addEventListener("touchstart",e=>{if(e.touches.length===2){const a=e.touches[0],b=e.touches[1];lastDist=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);pinchStart=scale;}},{passive:true});
  map.addEventListener("touchmove",e=>{if(e.touches.length===2&&lastDist){const a=e.touches[0],b=e.touches[1],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);scale=pinchStart*d/lastDist;apply();}},{passive:true});
  map.addEventListener("touchend",()=>{lastDist=0},{passive:true});
  const zoom=(d)=>{scale+=d;apply()};
  const hud=document.createElement("div");hud.className="map-hud";hud.innerHTML='<span>🗺️ '+cityNames[cityStage]+'</span><span>Ур. '+level+'</span><span>🏢 '+owned+'/4</span><span>💰 '+money(totalIncome)+'/ч</span>';
  map.appendChild(hud);
  const live=document.createElement("div");live.className="map-live-feed";live.innerHTML='<span class="map-live-dot"></span><span>Город развивается</span>';map.appendChild(live);
  const controls=document.createElement("div");controls.className="map-zoom-controls";controls.innerHTML='<button type="button" data-map-zoom="-1" aria-label="Уменьшить">−</button><button type="button" data-map-zoom="1" aria-label="Увеличить">+</button><button type="button" data-map-reset="1" aria-label="Сбросить карту">⌖</button>';
  map.appendChild(controls);
  controls.addEventListener("click",e=>{const z=e.target.closest("[data-map-zoom]");if(z){zoom(Number(z.dataset.mapZoom)*.18);return}if(e.target.closest("[data-map-reset]")){scale=1;tx=0;ty=0;apply()}});
}

function renderCityMap(s){
  const el=document.querySelector("#cityMap");if(!el)return;
  const businesses=s.businesses||[],catalog=s.businessCatalog||[];
  const meta={kiosk:{icon:"🏪",spot:[18,31],zone:"trade"},cafe:{icon:"☕",spot:[43,22],zone:"trade"},workshop:{icon:"🔧",spot:[66,38],zone:"business"},factory:{icon:"🏭",spot:[79,67],zone:"industry"}};
  const totalIncome=businesses.reduce((n,b)=>n+(Number(b.profitPerHour)||0),0),owned=businesses.length,level=Math.max(1,Number(s.level)||1);
  const cityStage=level>=25||owned>=4?"mega":level>=15||owned>=3?"large":level>=10||owned>=2?"small":level>=7?"town":"village";
  const cityNames={village:"ДЕРЕВНЯ",town:"ПОСЁЛОК",small:"МАЛЕНЬКИЙ ГОРОД",large:"БОЛЬШОЙ ГОРОД",mega:"МЕГАПОЛИС"};
  const cityProgress={village:1,town:2,small:3,large:4,mega:5}[cityStage];
  const traffic=Math.min(10,Math.max(1,Math.ceil((owned*1.5)+(level/5))));
  const people=Math.min(12,Math.max(2,Math.ceil(owned*1.2+(level/4))));
  const hour=new Date().getHours(),night=hour>=20||hour<7;
  const cars=Array.from({length:traffic},(_,i)=>'<i class="city-car car-'+(i%4)+'" style="--i:'+i+'">🚗</i>').join("");
  const walkers=Array.from({length:people},(_,i)=>'<i class="city-person person-'+(i%5)+'" style="--i:'+i+'">●</i>').join("");
  const activeBusinesses=businesses.filter(b=>Number(b.level||1)>=5);
  const trucks=activeBusinesses.filter(b=>b.id==="workshop"||b.id==="factory").slice(0,4).map((b,i)=>'<i class="city-truck truck-route-'+b.id+'" style="--i:'+i+'">🚚</i>').join("");
  const moneyFlows=businesses.slice(0,4).map((b,i)=>{const m=meta[b.id]||{spot:[48,55]};return '<i class="money-flow money-'+b.id+'" style="--x:'+m.spot[0]+';--y:'+m.spot[1]+';--i:'+i+'">+'+Math.max(1,Math.round(Number(b.profitPerHour||0)))+'</i>'}).join("");
  const activity=businesses.map(b=>{const m=meta[b.id];if(!m)return "";const count=Math.min(3,Math.max(1,Math.floor((Number(b.level)||1)/5)));return Array.from({length:count},(_,i)=>'<i class="business-worker worker-'+b.id+'" style="--n:'+i+';left:'+m.spot[0]+'%;top:'+(m.spot[1]+5+i*2)+'%"></i>').join("")}).join("");
  const pendingByBusiness=businesses.map(b=>{
    const pending=Math.max(0,Number(b.pendingIncome||b.pending||0));
    if(!pending)return "";
    const m=meta[b.id];if(!m)return "";
    const pulses=Math.min(3,Math.max(1,Math.ceil(pending/Math.max(1,Number(b.profitPerHour||1))*3)));
    return Array.from({length:pulses},(_,i)=>'<i class="income-pulse pulse-'+b.id+'" style="--sx:'+m.spot[0]+'%;--sy:'+m.spot[1]+'%;--delay:'+(i*.7)+'s">₽</i>').join("");
  }).join("");
  const routeLines=businesses.map(b=>{
    const m=meta[b.id];if(!m)return "";
    const dx=48-m.spot[0],dy=55-m.spot[1],len=Math.sqrt(dx*dx+dy*dy);
    return '<i class="business-route route-'+b.id+'" style="--sx:'+m.spot[0]+'%;--sy:'+m.spot[1]+'%;--len:'+len+'%;--angle:'+Math.atan2(dy,dx)*180/Math.PI+'deg"></i>';
  }).join("");
  const businessFlows=businesses.map((b,i)=>{
    const m=meta[b.id];if(!m)return "";
    return '<i class="business-flow flow-'+b.id+'" style="--sx:'+m.spot[0]+'%;--sy:'+m.spot[1]+'%;--tx:48%;--ty:55%;--delay:'+(i*.8)+'s"></i>';
  }).join("");
  const homePulse='<div class="home-pulse-ring"></div>';
  const cityLabels='<div class="map-compass">N</div><div class="map-scale-label">МАСШТАБ · ГОРОД</div>';
  const markers=catalog.filter(b=>meta[b.id]).map(cat=>{
    const m=meta[cat.id],biz=businesses.find(x=>x.id===cat.id);
    if(!biz)return '<button type="button" class="map-marker business-marker locked-business" style="left:'+m.spot[0]+'%;top:'+m.spot[1]+'%" data-city-open="business" data-business-id="'+cat.id+'"><span>🔒</span><small>'+cat.name+'</small><em>Участок · '+money(cat.baseCost)+'</em></button>';
    const lv=Math.max(1,Number(biz.level)||1),tier=lv>=25?"city-tier-4":lv>=10?"city-tier-3":lv>=5?"city-tier-2":"city-tier-1";
    const stage=lv>=25?"landmark":lv>=10?"large":lv>=5?"developed":lv>=2?"small":"plot",work=lv>=5?"working":"";
    return '<button type="button" class="map-marker business-marker '+tier+' building-stage-'+stage+' '+work+'" style="left:'+m.spot[0]+'%;top:'+m.spot[1]+'%" data-city-open="business" data-business-id="'+cat.id+'"><span>'+({plot:"🧱",small:m.icon,developed:m.icon,large:m.icon,landmark:m.icon+"⭐"}[stage])+'</span><small>'+cat.name+'</small><em>ур. '+lv+' · '+money(biz.profitPerHour||0)+'/ч</em><i class="building-lights"></i><i class="building-smoke"></i></button>';
  }).join("");
  const cityEvents=[["⚡","Спрос +25%","event",59,30],["📦","Заказ","event",72,61],["🎉","Праздник","event",31,52]].slice(0,cityStage==="village"?1:cityStage==="town"?2:3).map(x=>'<button type="button" class="map-marker city-event-marker" style="left:'+x[3]+'%;top:'+x[4]+'%" data-city-open="event"><span>'+x[0]+'</span><small>'+x[1]+'</small><em>Активно</em></button>').join("");
  const points=[["🎯","Задания","tasks",28,69],["🏆","Достижения","achievements",18,79],["🎁","Бонус","daily",67,17],["🛒","Магазин","shop",83,28],["⚡","Событие","event",86,48],["🏆","Рейтинг","rankings",70,79]].map(x=>'<button type="button" class="map-marker city-service-marker service-'+x[2]+'" style="left:'+x[3]+'%;top:'+x[4]+'%" data-city-open="'+x[2]+'"><span>'+x[0]+'</span><small>'+x[1]+'</small><em>Открыть здесь</em></button>').join("")+cityEvents;
  const territoryMarks=[["🌳","Новая территория",18,8,1],["🧭","Северный район",82,10,2],["🏗️","Новый квартал",91,78,3],["🌉","Большая зона",7,88,4]].map(x=>'<button type="button" class="map-marker territory-marker '+(cityProgress>=x[4]?"territory-open":"territory-locked")+'" style="left:'+x[2]+'%;top:'+x[3]+'%" data-city-open="territory" data-territory="'+x[1]+'"><span>'+(cityProgress>=x[4]?x[0]:"🔒")+'</span><small>'+x[1]+'</small><em>'+(cityProgress>=x[4]?"Открыто":"Требуется ур. "+([0,1,7,10,15][x[4]]) )+'</em></button>').join("");
  el.innerHTML='<div class="city-map city-stage-'+cityStage+(night?" city-time-night":" city-time-day")+'"><div class="map-world"><div class="map-district district-residential"><span>🏠 ЖИЛОЙ РАЙОН</span></div><div class="map-district district-trade"><span>🛍️ ТОРГОВЛЯ</span></div><div class="map-district district-business"><span>🏢 ДЕЛОВОЙ ЦЕНТР</span></div><div class="map-district district-industry"><span>🏭 ПРОМЗОНА</span></div><div class="map-plaza"><span>⭐</span><small>ЦЕНТРАЛЬНАЯ ПЛОЩАДЬ</small></div><div class="map-city-status"><b>'+cityNames[cityStage]+'</b><span>Город ур. '+level+'</span><span>'+owned+'/4 объектов</span><span>'+money(totalIncome)+'/ч</span></div><div class="map-road road-a"></div><div class="map-road road-b"></div><div class="map-road road-c"></div><div class="map-road road-d"></div><div class="map-water"></div><div class="map-route route-home-trade"></div><div class="map-route route-home-center"></div><div class="map-route route-home-industry"></div><div class="city-traffic">'+cars+'</div><div class="city-life">'+walkers+'</div><div class="city-logistics">'+trucks+'</div><div class="city-economy-flow">'+moneyFlows+'</div><div class="city-business-life">'+activity+'</div><button type="button" class="map-marker home-marker" style="left:48%;top:55%" data-city-open="home"><span>🏠</span><small>Мой дом</small><em>База · ур. '+level+'</em>'+homePulse+'</button>'+markers+points+territoryMarks+'<div class="map-center-label">Мой город · '+cityNames[cityStage].toLowerCase()+' · '+cityProgress+' территории</div>'+cityLabels+'</div></div><div id="cityPanel" class="city-panel" hidden></div><div class="map-legend"><span>🏠 База</span><span>🏪 Бизнес</span><span>🚗 Трафик</span><span>👥 Жизнь</span><b>'+owned+' объектов · '+money(totalIncome)+'/ч</b></div>';
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
    title="🏠 Мой дом";body='<div class="city-panel-stats"><b>💰 '+money(s.balance||0)+'</b><b>⭐ Уровень '+(s.level||1)+'</b><b>⭐ '+(s.xp||0)+' XP</b></div>'+actionBtn("collect","💰 Забрать весь доход")+'<div class="city-panel-note">База города. Здесь управление развитием империи.</div>';
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
  panel.innerHTML='<button type="button" class="city-panel-close" data-city-close aria-label="Закрыть">×</button><div class="city-panel-title">'+title+'</div><div class="city-panel-scroll">'+body+'</div>';panel.hidden=false;
}

function closeCityPanel(){const p=document.querySelector("#cityPanel");if(p)p.hidden=true}

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
async function action(button,fn){if(!button||button.disabled)return;button.disabled=true;try{const state=await fn();render(state);setStatus(t("status.done"))}catch(e){setStatus(friendlyError(e),true)}finally{button.disabled=false}}
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
document.addEventListener("click",e=>{
  const cityOpen=e.target.closest("[data-city-open]");
  if(cityOpen){e.preventDefault();openCityPanel(cityOpen.dataset.cityOpen,cityOpen.dataset.businessId||cityOpen.dataset.territory);return}
  if(e.target.closest("[data-city-close]")){closeCityPanel();return}

  const marker=e.target.closest("[data-map-title]");
  if(marker){setStatus(marker.dataset.mapTitle);return}
const search=e.target.closest("#adminSearch");if(search)return;const rank=e.target.closest("[data-rank-tab]");if(rank){currentRankTab=rank.dataset.rankTab;const s=window.__mrGusRankings;if(s)renderRankings(s);return}const admin=e.target.closest("[data-admin-block]");if(admin){(async()=>{try{await api("/api/admin/"+admin.dataset.adminBlock,{method:"POST",body:JSON.stringify({userId:admin.dataset.adminUser,operationId:op("admin")})});await loadSocial();setStatus("Админ-действие выполнено")}catch(err){setStatus(friendlyError(err),true)}})();return}const b=e.target.closest("[data-action]");if(!b||b.disabled)return;const a=b.dataset.action;if(a==="auth")auth();else if(a==="refresh")refresh();else if(a==="buy")buy(b,b.dataset.businessId);else if(a==="upgrade")upgrade(b,b.dataset.businessId);else if(a==="collect")collect(b);else if(a==="claim")claim(b,b.dataset.taskId);else if(a==="achievement")claimAchievement(b,b.dataset.id);else if(a==="goal")claimGoal(b,b.dataset.id);else if(a==="event")claimEvent(b);else if(a==="hire")hire(b,b.dataset.businessId,b.dataset.role);else if(a==="expand")expand(b,b.dataset.businessId);else if(a==="invest")invest(b,b.dataset.businessId);else if(a==="boost")boost(b,b.dataset.businessId);else if(a==="shop")shop(b,b.dataset.itemId);else if(a==="daily")daily(b)});
let currentPage="home";
function showPage(page){
  const allowed=["home","tasks","achievements","daily","shop","event"];
  if(!allowed.includes(page))page="home";
  currentPage=page;
  document.querySelectorAll(".page-screen").forEach(el=>el.classList.toggle("page-active",el.dataset.page===page));
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
