const tg=window.Telegram?.WebApp;
const t=(key,vars={})=>window.MrGusLocale?.t(key,vars)||key;
const lang=()=>window.MrGusLocale?.get()||"ru";
if(tg){tg.ready();tg.expand();try{tg.enableClosingConfirmation?.()}catch{}}

const op=t=>t+"_"+crypto.randomUUID();
const money=n=>new Intl.NumberFormat("ru-RU").format(Math.max(0,Math.floor(Number(n)||0)))+" ₽";

function setStatus(message,error=false){const el=document.querySelector("#status");if(el){el.textContent=message;el.dataset.error=error?"1":"0"}}
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
  try{const s=await api("/api/state");render(s);setStatus(fromAuth?t("status.loggedIn"):t("status.connected"));return s}
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
  const next=s.achievements?.length?null:null;
  const thresholds=[0,500,1200,2100,3300];
  const current=level<=thresholds.length?thresholds[level-1]:thresholds.at(-1);
  const nextXp=level<thresholds.length?thresholds[level]:null;
  if(nextXp===null){document.querySelector("#xpBar").style.width="100%";document.querySelector("#xpHint").textContent="Прогресс продолжается с повышением уровня."}
  else{ document.querySelector("#xpBar").style.width=Math.max(0,Math.min(100,((xp-current)/(nextXp-current))*100))+"%";document.querySelector("#xpHint").textContent=t("xp.next",{level:level+1,xp:Math.max(0,nextXp-xp)})}
    document.querySelector("#businesses").innerHTML=(s.businessCatalog||[]).map(b=>{
    const owned=s.businesses?.find(x=>x.id===b.id);
    if(owned)return `<div class="mini-card"><div class="row"><div><b>${b.name} · ур. ${owned.level}</b><p class="muted">${b.description}</p></div><strong>${money(owned.profitPerHour)}/ч</strong></div><div class="row"><span class="muted" data-i18n="nextLevel">${t("nextLevel")}</span>${button("upgrade",t("upgrade"),`data-business-id="${b.id}"`)}</div></div>`;
    return `<div class="mini-card"><div class="row"><div><b>${b.name}</b><p class="muted">${b.description}</p></div><strong>${money(b.cost)}</strong></div><p class="muted">${t("business.unlock",{level:b.unlockLevel})}</p>${button("buy",t("open"),`data-business-id="${b.id}"`,!b.unlocked)}</div>`;
  }).join("");
  document.querySelector("#incomeAction").innerHTML=button("collect","💰 Забрать накопленный доход");
  document.querySelector("#tasks").innerHTML=(s.tasks||[]).map(task=>`<div class="mini-card"><b>${task.title}</b><p class="muted">${task.description}</p><span class="reward">+${money(t.reward)} · +${task.xp} XP</span><br>${button("claim",t("claim"),`data-task-id="${String(task.id).replaceAll("'","&#39;")}"`,task.claimed||task.locked)}</div>`).join("");
  document.querySelector("#achievements").innerHTML=(s.achievements||[]).map(a=>`<div class="mini-card"><div class="row"><div><b>${a.title}</b><p class="muted">${a.description}</p></div><span class="reward">+${money(a.reward)}<br>+${a.xp} XP</span></div>${button("achievement",a.claimed?t("received"):a.unlocked?t("claim"):"🔒",`data-id="${a.id}"`,a.claimed||!a.unlocked)}</div>`).join("");
  document.querySelector("#goals").innerHTML=(s.goals||[]).map(g=>`<div class="mini-card"><div class="row"><div><b>${g.title}</b><p class="muted">${g.description}</p></div><span class="reward">+${money(g.reward)}<br>+${g.xp} XP</span></div>${button("goal",g.claimed?t("received"):g.unlocked?t("claim"):"🔒",`data-id="${g.id}"`,g.claimed||!g.unlocked)}</div>`).join("");
  const e=s.event||{};document.querySelector("#event").innerHTML=`<div class="event-card"><b>${e.title||"Событие"}</b><p class="muted">${e.description||""}</p><span class="reward">+${money(e.reward||0)} · +${e.xp||0} XP</span><div>${button("event",e.claimed?t("received"):t("claimBonus"))}</div></div>`;if(e.claimed)document.querySelector("#event button").disabled=true;
  const st=s.stats||{};document.querySelector("#stats").innerHTML=`<div><span>Заданий</span><b>${st.tasksCompleted||0}</b></div><div><span>Бизнесов</span><b>${st.businessesOwned||0}</b></div><div><span>Улучшений</span><b>${st.businessUpgrades||0}</b></div><div><span>Доход получен</span><b>${money(st.totalIncome||0)}</b></div><div><span>Всего заработано</span><b>${money(st.totalEarned||0)}</b></div>`;
}
async function action(button,fn){if(!button||button.disabled)return;button.disabled=true;try{const state=await fn();render(state);setStatus(t("status.done"))}catch(e){setStatus(friendlyError(e),true)}finally{button.disabled=false}}
async function buy(button,id){await action(button,()=>api("/api/business/buy",{method:"POST",body:JSON.stringify({businessId:id,operationId:op("buy")})}))}
async function upgrade(button,id){await action(button,()=>api("/api/business/upgrade",{method:"POST",body:JSON.stringify({businessId:id,operationId:op("upgrade")})}))}
async function collect(button){await action(button,()=>api("/api/income/collect",{method:"POST",body:JSON.stringify({operationId:op("income")})}))}
async function claim(button,id){await action(button,()=>api("/api/task/claim",{method:"POST",body:JSON.stringify({taskId:id,operationId:op("task")})}))}
async function claimAchievement(button,id){await action(button,()=>api("/api/achievement/claim",{method:"POST",body:JSON.stringify({achievementId:id,operationId:op("achievement")})}))}
async function claimGoal(button,id){await action(button,()=>api("/api/goal/claim",{method:"POST",body:JSON.stringify({goalId:id,operationId:op("goal")})}))}
async function claimEvent(button){await action(button,()=>api("/api/event/claim",{method:"POST",body:JSON.stringify({operationId:op("event")})}))}
document.addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b||b.disabled)return;const a=b.dataset.action;if(a==="auth")auth();else if(a==="refresh")refresh();else if(a==="buy")buy(b,b.dataset.businessId);else if(a==="upgrade")upgrade(b,b.dataset.businessId);else if(a==="collect")collect(b);else if(a==="claim")claim(b,b.dataset.taskId);else if(a==="achievement")claimAchievement(b,b.dataset.id);else if(a==="goal")claimGoal(b,b.dataset.id);else if(a==="event")claimEvent(b)});
window.addEventListener("load",async()=>{if(tg?.initData)await auth();else setStatus(t("status.waitingTelegram"))});

window.addEventListener("mr-gus-language-changed",()=>{const s=window.__mrGusState;if(s)render(s);});
