const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();try{tg.enableClosingConfirmation?.()}catch{}}

const op=t=>t+"_"+crypto.randomUUID();
const money=n=>new Intl.NumberFormat("ru-RU").format(Math.max(0,Math.floor(n)))+" ₽";

function setStatus(message,error=false){
  const el=document.querySelector("#status");
  if(el){el.textContent=message;el.dataset.error=error?"1":"0"}
}

function friendlyError(error){
  const message=String(error?.message||"Ошибка");
  if(message==="Insufficient balance")return "Недостаточно денег для этой покупки.";
  if(message==="Business already owned")return "Этот бизнес уже куплен.";
  if(message==="Maximum business level reached")return "Достигнут максимальный уровень бизнеса.";
  if(message==="Task reward already claimed")return "Это задание уже выполнено.";
  if(message==="Task is locked")return "Это задание пока заблокировано.";
  if(message==="Business not owned")return "Сначала купите бизнес.";
  if(message==="Clock moved backwards")return "Время устройства изменилось. Обновите игру.";
  if(message==="Authentication required")return "Сессия истекла. Откройте игру через Telegram ещё раз.";
  if(message==="Too many requests")return "Слишком много запросов. Подождите немного.";
  return message;
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
    if(!tg?.initData)throw Error("Откройте Mr.Gus через кнопку Telegram «Открыть Mr.Gus».");
    setStatus("Авторизация через Telegram…");
    await api("/api/auth/telegram",{method:"POST"});
    await refresh(true);
    setStatus("Вы вошли через Telegram");
  }catch(e){setStatus(friendlyError(e),true);alert(friendlyError(e))}
}

async function refresh(fromAuth=false){
  try{
    const s=await api("/api/state");
    render(s);
    setStatus(fromAuth?"Вы вошли через Telegram":"Подключено");
    return s;
  }catch(e){
    setStatus(friendlyError(e),true);
    if(fromAuth)throw e;
    return null;
  }
}

function nextUpgradeCost(level){
  return Math.max(500,Math.round(500*Math.pow(1.35,Math.max(0,level-1))));
}

function render(s){
  document.querySelector("#balance").textContent=money(s.balance);
  document.querySelector("#level").textContent=s.level;
  const b=s.businesses?.[0];
  document.querySelector("#income").textContent=money(b?.profitPerHour||0)+"/ч";
  const upgradeCost=b?nextUpgradeCost(b.level):0;
  document.querySelector("#business").innerHTML=b
    ? "<b>Торговая точка — уровень "+b.level+"</b><p>+"+money(b.profitPerHour)+"/час</p><p class='muted'>Следующее улучшение: "+money(upgradeCost)+"</p><button class='btn' data-action='collect'>Забрать доход</button><button class='btn' data-action='upgrade'>Улучшить за "+money(upgradeCost)+"</button>"
    : "<p>Первая торговая точка — 1 000 ₽</p><button class='btn' data-action='buy'>Открыть</button>";
  document.querySelector("#tasks").innerHTML=(s.tasks||[]).map(t=>"<div class='card'><b>"+t.title+"</b><p class='muted'>"+(t.description||"")+"</p><button class='btn' "+(t.claimed||t.locked?"disabled":"")+" data-action='claim' data-task-id='"+String(t.id).replaceAll("'","&#39;")+"'>"+(t.claimed?"Готово":t.locked?"🔒":"Забрать")+"</button></div>").join("");
}

async function action(button,fn){
  if(!button||button.disabled)return;
  button.disabled=true;
  try{
    const state=await fn();
    render(state);
    setStatus("Готово");
  }catch(e){setStatus(friendlyError(e),true)}
  finally{button.disabled=false}
}
async function buy(button){await action(button,()=>api("/api/business/buy",{method:"POST",body:JSON.stringify({businessId:"kiosk",operationId:op("buy")})}))}
async function upgrade(button){await action(button,()=>api("/api/business/upgrade",{method:"POST",body:JSON.stringify({businessId:"kiosk",operationId:op("upgrade")})}))}
async function collect(button){await action(button,()=>api("/api/income/collect",{method:"POST",body:JSON.stringify({operationId:op("income")})}))}
async function claim(button,id){await action(button,()=>api("/api/task/claim",{method:"POST",body:JSON.stringify({taskId:id,operationId:op("task")})}))}

document.addEventListener("click",event=>{
  const button=event.target.closest("[data-action]");
  if(!button||button.disabled)return;
  const actionName=button.dataset.action;
  if(actionName==="auth")auth();
  else if(actionName==="refresh")refresh();
  else if(actionName==="buy")buy(button);
  else if(actionName==="upgrade")upgrade(button);
  else if(actionName==="collect")collect(button);
  else if(actionName==="claim")claim(button,button.dataset.taskId);
});

window.addEventListener("load",async()=>{
  if(tg?.initData)await auth();
  else setStatus("Ожидается запуск из Telegram");
});
