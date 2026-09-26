const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand()}
const op=t=>t+"_"+crypto.randomUUID();
const money=n=>new Intl.NumberFormat("ru-RU").format(Math.max(0,Math.floor(n)))+" ₽";

async function api(path,opt={}){
  const h={"Content-Type":"application/json",...(opt.headers||{})};
  if(tg?.initData)h["X-Telegram-Init-Data"]=tg.initData;
  const r=await fetch(path,{...opt,headers:h});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error||("HTTP "+r.status));
  return d;
}
async function auth(){
  try{await api("/api/auth/telegram",{method:"POST"});await refresh()}
  catch(e){alert(e.message)}
}
async function refresh(){
  try{const s=await api("/api/state");render(s)}
  catch(e){alert(e.message)}
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
async function buy(){try{render(await api("/api/business/buy",{method:"POST",body:JSON.stringify({businessId:"kiosk",operationId:op("buy")})}))}catch(e){alert(e.message)}}
async function upgrade(){try{render(await api("/api/business/upgrade",{method:"POST",body:JSON.stringify({businessId:"kiosk",operationId:op("upgrade")})}))}catch(e){alert(e.message)}}
async function collect(){try{render(await api("/api/income/collect",{method:"POST",body:JSON.stringify({operationId:op("income")})}))}catch(e){alert(e.message)}}
async function claim(id){try{render(await api("/api/task/claim",{method:"POST",body:JSON.stringify({taskId:id,operationId:op("task")})}))}catch(e){alert(e.message)}}

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
refresh();
