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
function renderCityMap(s){
  const el=document.querySelector("#cityMap");if(!el)return;
  const businesses=s.businesses||[],catalog=s.businessCatalog||[];
  const meta={kiosk:{icon:"🏪",zone:"trade",spot:[18,31]},cafe:{icon:"☕",zone:"center",spot:[43,22]},workshop:{icon:"🔧",zone:"industry",spot:[66,38]},factory:{icon:"🏭",zone:"industry",spot:[79,67]}};
  const markers=catalog.filter(b=>meta[b.id]).map(b=>{
    const owned=businesses.find(x=>x.id===b.id);if(!owned)return "";
    const m=meta[b.id],level=Number(owned.level)||1;
    const size=level>=10?"building-xl":level>=5?"building-lg":"";
    return '<button class="map-marker business-marker '+size+'" style="left:'+m.spot[0]+'%;top:'+m.spot[1]+'%" data-map-title="'+String(b.name).replaceAll('"','&quot;')+' · ур. '+level+'" aria-label="'+String(b.name).replaceAll('"','&quot;')+' · уровень '+level+'"><span>'+m.icon+'</span><small>'+b.name+'</small><em>ур. '+level+'</em></button>';
  }).join("");
  const ownedCount=businesses.length,income=businesses.reduce((n,b)=>n+(Number(b.profitPerHour)||0),0);
  const empty=ownedCount===0?'<div class="map-empty"><span>🪿</span><b>Город ещё пуст</b><small>Открой первый бизнес — он появится здесь.</small></div>':"";
  el.innerHTML='<div class="city-map"><div class="map-district district-trade"><span>ТОРГОВЛЯ</span></div><div class="map-district district-center"><span>ЦЕНТР</span></div><div class="map-district district-industry"><span>ПРОМЗОНА</span></div><div class="map-road road-a"></div><div class="map-road road-b"></div><div class="map-road road-c"></div><div class="map-road road-d"></div><div class="map-water"></div><div class="map-marker home-marker" style="left:48%;top:55%" data-map-title="Мой дом" aria-label="Мой дом"><span>🏠</span><small>Мой дом</small><em>База</em></div>'+markers+empty+'<div class="map-center-label">Твоя территория</div></div><div class="map-legend"><span>🏠 Дом</span><span>🏪 Бизнес</span><span>⬆️ Уровень</span><b>'+ownedCount+' объектов · '+money(income)+'/ч</b></div>';
}
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
