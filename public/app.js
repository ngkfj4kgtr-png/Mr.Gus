const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();try{tg.enableClosingConfirmation?.()}catch{}}

const op=t=>t+"_"+crypto.randomUUID();
const money=n=>new Intl.NumberFormat("ru-RU").format(Math.max(0,Math.floor(n)))+" ₽";

function setStatus(message,error=false){
  const el=document.querySelector("#status");
  if(el){el.textContent=message;el.dataset.error=error?"1":"0"}
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
    if(!tg?.initData)throw Error("Откройте SellAI через кнопку Telegram «Открыть SellAI».");
    setStatus("Авторизация через Telegram…");
    await api("/api/auth/telegram",{method:"POST"});
    await refresh();
    setStatus("Вы вошли через Telegram");
  }catch(e){setStatus(e.message,true);alert(e.message)}
}

async function refresh(){
  try{
    const s=await api("/api/state");
    render(s);
    setStatus("Подключено");
  }catch(e){
    if(e.message.includes("401"))setStatus("Нажмите «Войти через Telegram»",true);
    else setStatus(e.message,true);
  }
}

function render(s){
  document.querySelector("#balance").textContent=money(s.balance);
  document.querySelector("#level").textContent=s.level;
  const b=s.businesses?.[0];
  document.querySelector("#income").textContent=money(b?.profitPerHour||0)+"/ч";
  document.querySelector("#business").innerHTML=b
    ? "<b>Торговая точка</b><p>+"+money(b.profitPerHour)+"/час</p><button class='btn' data-action='collect'>Забрать доход</button><button class='btn' data-action='upgrade'>Улучшить</button>"
    : "<p>Первая торговая точка — 1 000 ₽</p><button class='btn' data-action='buy'>Открыть</button>";
  document.querySelector("#tasks").innerHTML=(s.tasks||[]).map(t=>"<div class='card'><b>"+t.title+"</b><p class='muted'>"+(t.description||"")+"</p><button class='btn' "+(t.claimed||t.locked?"disabled":"")+" data-action='claim' data-task-id='"+String(t.id).replaceAll("'","&#39;")+"'>"+(t.claimed?"Готово":t.locked?"🔒":"Забрать")+"</button></div>").join("");
}

async function buy(){try{render(await api("/api/business/buy",{method:"POST",body:JSON.stringify({businessId:"kiosk",operationId:op("buy")})}))}catch(e){setStatus(e.message,true)}}
async function upgrade(){try{render(await api("/api/business/upgrade",{method:"POST",body:JSON.stringify({businessId:"kiosk",operationId:op("upgrade")})}))}catch(e){setStatus(e.message,true)}}
async function collect(){try{render(await api("/api/income/collect",{method:"POST",body:JSON.stringify({operationId:op("income")})}))}catch(e){setStatus(e.message,true)}}
async function claim(id){try{render(await api("/api/task/claim",{method:"POST",body:JSON.stringify({taskId:id,operationId:op("task")})}))}catch(e){setStatus(e.message,true)}}

document.addEventListener("click",event=>{
  const button=event.target.closest("[data-action]");
  if(!button||button.disabled)return;
  const action=button.dataset.action;
  if(action==="auth")auth();
  else if(action==="refresh")refresh();
  else if(action==="buy")buy();
  else if(action==="upgrade")upgrade();
  else if(action==="collect")collect();
  else if(action==="claim")claim(button.dataset.taskId);
});

window.addEventListener("load",async()=>{
  if(tg?.initData){
    await auth();
  }else{
    setStatus("Ожидается запуск из Telegram");
  }
});
