import { BUSINESS, xpForLevel, levelFromXp } from './economy.js';

export const BUSINESS_SPECIALIZATIONS=Object.freeze({
  kiosk:{name:'Розничная торговля',demand:'повседневный спрос',district:'commercial'},
  cafe:{name:'Общественное питание',demand:'посетители',district:'center'},
  workshop:{name:'Сервис и ремонт',demand:'заказы на ремонт',district:'residential'},
  factory:{name:'Производство',demand:'оптовые заказы',district:'industrial'}
});

const CLIENTS=['Антон','Марина','Илья','Светлана','Дмитрий','Ольга','Максим','Алина','Сергей','Елена'];
const DISTRICTS=['residential','center','commercial','industrial','outskirts'];
const NPC_TYPES={resident:{name:'Житель',speed:1.0,home:'residential'},student:{name:'Студент',speed:1.25,home:'center'},worker:{name:'Рабочий',speed:.9,home:'industrial'},family:{name:'Семья',speed:.75,home:'residential'},courier:{name:'Курьер',speed:1.45,home:'commercial'}};
const BUSINESS_DEMAND={kiosk:{base:28,preferred:['resident','family','courier'],ticket:45},cafe:{base:34,preferred:['student','resident','family'],ticket:75},workshop:{base:22,preferred:['worker','resident','courier'],ticket:140},factory:{base:18,preferred:['worker','courier'],ticket:220}};
const DISTRICT_POINTS={residential:[20,72],center:[50,44],commercial:[73,53],industrial:[79,72],outskirts:[12,48]};

function hash(n){let x=Number(n)||0;return Math.abs(Math.sin(x*12.9898)*43758.5453)%1}
function ownedSpecialties(player){
  return Object.keys(player.businesses||{}).map(id=>BUSINESS_SPECIALIZATIONS[id]).filter(Boolean)
}
function ensure(player,now){
  const raw=player.cityLife&&typeof player.cityLife==='object'&&!Array.isArray(player.cityLife)?player.cityLife:{};
  const day=new Date(now).toISOString().slice(0,10);
  if(raw.date!==day){raw.date=day;raw.orders=[];raw.ordersGeneratedAt=0}
  raw.districts=raw.districts&&typeof raw.districts==='object'?raw.districts:{};
  for(const d of DISTRICTS)raw.districts[d]=Math.max(0,Math.min(100,Number(raw.districts[d]||0)));
  raw.orders=Array.isArray(raw.orders)?raw.orders:[];
  raw.npcs=Array.isArray(raw.npcs)?raw.npcs:[];
  raw.npcTick=Number(raw.npcTick||0);raw.visitRevenue=Number.isSafeInteger(raw.visitRevenue)?raw.visitRevenue:0;raw.visitsCompleted=Number.isSafeInteger(raw.visitsCompleted)?raw.visitsCompleted:0;raw.visitOperations=Array.isArray(raw.visitOperations)?raw.visitOperations:[];
  return raw
}

const WEATHER_EFFECTS=Object.freeze({
  clear:{kiosk:1.08,cafe:1.12,workshop:1.00,factory:1.03},
  rain:{kiosk:.92,cafe:1.16,workshop:1.10,factory:1.02},
  snow:{kiosk:.88,cafe:1.20,workshop:1.14,factory:.96},
  storm:{kiosk:.78,cafe:.96,workshop:.90,factory:.88}
});
const TIME_EFFECTS=Object.freeze({
  kiosk:[[0,6,.55],[6,10,1.18],[10,16,1.05],[16,20,1.25],[20,24,.82]],
  cafe:[[0,7,.45],[7,11,1.28],[11,15,1.18],[15,18,.92],[18,23,1.30],[23,24,.55]],
  workshop:[[0,7,.60],[7,12,1.25],[12,17,1.12],[17,21,1.00],[21,24,.68]],
  factory:[[0,6,.72],[6,14,1.28],[14,22,1.18],[22,24,.70]]
});
function timeMultiplier(businessId,hour){
  const ranges=TIME_EFFECTS[businessId]||[[0,24,1]];
  return ranges.find(([from,to])=>hour>=from&&hour<to)?.[2]||1;
}
function weatherForDay(now){
  const day=Math.floor(now/86400000),r=hash(day*17+31);
  return r<.12?'storm':r<.30?'snow':r<.52?'rain':'clear';
}
function npcPreference(type,businessId){
  const def=BUSINESS_DEMAND[businessId];
  return def?.preferred?.includes(type)?1.30:0.78;
}
function businessDemand(player,businessId,state,now){
  const b=player.businesses?.[businessId],spec=BUSINESS_DEMAND[businessId];if(!b||!spec)return 0;
  const level=Math.max(1,Number(b.level)||1),district=BUSINESS_SPECIALIZATIONS[businessId]?.district||'center';
  const districtScore=Number(state.districts?.[district]||0);
  const hour=new Date(now).getUTCHours(),weather=state.weather||weatherForDay(now);
  const weatherMultiplier=WEATHER_EFFECTS[weather]?.[businessId]||1;
  const time=timeMultiplier(businessId,hour);
  const activity=1+Math.min(.25,districtScore/400);
  return Math.max(4,Math.min(100,Math.round((spec.base+level*6)*activity*time*weatherMultiplier)));
}
function seedNpcState(state,now){
  if(state.npcs.length)return;
  const types=Object.keys(NPC_TYPES);
  for(let i=0;i<18;i++){const type=types[i%types.length],home=NPC_TYPES[type].home;state.npcs.push({id:'npc_'+i,type,phase:'home',home,createdAt:now,cycle:i%4});}
}
function businessCapacity(player,businessId){const b=player.businesses?.[businessId];if(!b)return 0;const e=b.employees||{};return Math.max(1,2+(Number(e.cashier)||0)*2+(Number(e.manager)||0)+(Number(b.expansionLevel)||0)*2)}
function completeNpcVisit(player,state,npc,now){const id=npc.targetBusiness,b=player.businesses?.[id],def=BUSINESS_DEMAND[id];if(!b||!def)return null;const level=Math.max(1,Number(b.level)||1),reward=Math.max(10,Math.round(def.ticket*(1+(level-1)*.06))),xp=Math.max(1,Math.round(reward/25));if(!Number.isSafeInteger(reward)||!Number.isSafeInteger(xp))throw new Error('Invalid NPC visit reward');player.balance+=reward;player.xp+=xp;player.level=levelFromXp(player.xp);player.stats.totalEarned=Number(player.stats.totalEarned||0)+reward;player.stats.totalIncome=Number(player.stats.totalIncome||0)+reward;player.stats.visitsCompleted=Number(player.stats.visitsCompleted||0)+1;player.stats.visitRevenue=Number(player.stats.visitRevenue||0)+reward;state.visitRevenue=Number(state.visitRevenue||0)+reward;state.visitsCompleted=Number(state.visitsCompleted||0)+1;state.lastVisitAt=now;state.visitOperations.push({id:'npc_visit_'+npc.id+'_'+now,npcId:npc.id,businessId:id,reward,xp,at:now});return {npcId:npc.id,businessId:id,reward,xp}}
function simulateNpcs(player,state,now){
  seedNpcState(state,now);
  const owned=Object.keys(player.businesses||{}), tick=Math.floor(now/15000);
  if(state.npcTick===tick)return;
  state.npcTick=tick;
  const businessPool=owned.map(id=>({id,demand:businessDemand(player,id,state,now)})).filter(x=>x.demand>0);
  const totalDemand=businessPool.reduce((n,x)=>n+x.demand,0);
  const previousQueue={};for(const npc of state.npcs)previousQueue[npc.id]=npc.phase==='queue'||npc.phase==='service';
  state.npcs.forEach((npc,i)=>{
    const phase=(tick+i*3)%12;npc.previousPhase=npc.phase;
    if(phase<4){npc.phase='home';npc.targetDistrict=npc.home;npc.targetBusiness=null}
    else if(phase<7){npc.phase='travel';const weighted=businessPool.map((pick)=>({pick,score:pick.demand*npcPreference(npc.type,pick.id)}));
      const total=weighted.reduce((n,x)=>n+x.score,0);
      let cursor=total?hash(tick*97+i*13)*total:0,chosen=weighted[0]?.pick||null;
      for(const item of weighted){cursor-=item.score;if(cursor<=0){chosen=item.pick;break}}
      npc.targetBusiness=chosen?.id||null;npc.targetDistrict=chosen?BUSINESS_SPECIALIZATIONS[chosen.id]?.district:'center'}
    else if(phase<9){npc.phase='queue';npc.targetDistrict=npc.targetDistrict||'center'}
    else if(phase<10){npc.phase='service';npc.targetDistrict=npc.targetDistrict||'center'}
    else{npc.phase='return';npc.targetDistrict=npc.home}
    if(npc.phase==='service'&&npc.targetBusiness){const cap=businessCapacity(player,npc.targetBusiness);const active=state.npcs.filter(x=>x.targetBusiness===npc.targetBusiness&&(x.phase==='service'||x.phase==='queue')).length;if(active>cap)npc.phase='queue'}
    if(previousQueue[npc.id]&&npc.phase==='return')completeNpcVisit(player,state,npc,now);
    npc.progress=((tick+i*7)%20)/20;
  });
  state.queue={};state.service={};
  for(const npc of state.npcs){if(npc.phase==='queue'&&npc.targetBusiness)state.queue[npc.targetBusiness]=(state.queue[npc.targetBusiness]||0)+1;if(npc.phase==='service'&&npc.targetBusiness)state.service[npc.targetBusiness]=(state.service[npc.targetBusiness]||0)+1}
  state.totalDemand=totalDemand;
}
function npcSnapshot(player,state){
  return state.npcs.map(n=>({id:n.id,type:n.type,typeName:NPC_TYPES[n.type]?.name||n.type,phase:n.phase,home:n.home,targetDistrict:n.targetDistrict,targetBusiness:n.targetBusiness,progress:n.progress}));
}

function generateOrders(player,state,now){
  const owned=Object.keys(player.businesses||{});
  if(!owned.length)return;
  const bucket=Math.floor(now/3600000);
  if(state.ordersGeneratedAt===bucket)return;
  state.ordersGeneratedAt=bucket;
  const businessId=owned[bucket%owned.length], def=BUSINESS[businessId];
  if(!def)return;
  const client=CLIENTS[Math.floor(hash(bucket)*CLIENTS.length)];
  const amount=Math.max(250,Math.round(def.baseCost*0.12*(1+(Number(player.businesses[businessId]?.level||1)-1)*0.18)));
  state.orders.unshift({id:'ord_'+bucket+'_'+businessId,client,businessId,title:def.name,reward:amount,xp:Math.max(15,Math.round(amount/100)),createdAt:now,expiresAt:now+6*3600000,claimed:false});
  state.orders=state.orders.filter(o=>o.expiresAt>now&&!o.claimed).slice(0,8);
}
export function getCityLive(player,now=Date.now()){
  const state=ensure(player,now);generateOrders(player,state,now);
  const owned=Object.keys(player.businesses||{});
  state.weather=state.weather||weatherForDay(now);
  simulateNpcs(player,state,now);
  const income=owned.reduce((n,id)=>n+Math.floor(Number(player.businesses[id]?.profitPerHour||0)*Math.max(60,Math.min(110,Number(state.businessMetrics?.[id]?.efficiency||100)))/100),0);
  const totalLevel=owned.reduce((n,id)=>n+Number(player.businesses[id]?.level||1),0);
  const traffic=Math.round(Math.min(100,18+owned.length*12+totalLevel*2+(hash(Math.floor(now/600000))*18)));
  const visitors=Math.max(0,Math.round(traffic*1.6));
  for(const d of DISTRICTS){
    const target=d==='commercial'?owned.length*14:d==='industrial'&&owned.includes('factory')?35:d==='center'&&owned.includes('cafe')?30:d==='residential'&&owned.includes('workshop')?24:8;
    state.districts[d]=Math.round(state.districts[d]*.92+Math.min(100,target)*.08);
  }
  player.cityLife=state;
  return {
    traffic,visitors,
    districts:Object.fromEntries(DISTRICTS.map(d=>[d,Math.round(state.districts[d])])),
    businesses:Object.keys(player.businesses||{}).map(id=>({id,name:BUSINESS[id]?.name,specialization:BUSINESS_SPECIALIZATIONS[id]?.name,demand:BUSINESS_SPECIALIZATIONS[id]?.demand})),
    orders:state.orders.map(o=>({...o,remainingMs:Math.max(0,o.expiresAt-now)})),
    npcs:npcSnapshot(player,state),
    queues:Object.fromEntries(Object.entries(state.queue||{})),
    service:Object.fromEntries(Object.entries(state.service||{})),
    visitsCompleted:Number(state.visitsCompleted||0),visitRevenue:Number(state.visitRevenue||0),visitOperations:state.visitOperations.map(v=>({...v})),
    weather:state.weather,
    hour:new Date(now).getUTCHours(),
    demand:Object.fromEntries(owned.map(id=>[id,businessDemand(player,id,state,now)])),
    businessMetrics:Object.fromEntries(owned.map(id=>{
      const queue=Number(state.queue?.[id]||0),service=Number(state.service?.[id]||0),capacity=businessCapacity(player,id);
      const load=Math.min(100,Math.round(((queue+service)/Math.max(1,capacity))*100));
      const efficiency=queue>0?Math.max(60,100-Math.min(40,queue*10)):Math.min(110,100+Math.min(10,service*3));
      return [id,{queue,service,capacity,load,efficiency}];
    })),
    totalIncomePerHour:income,
    generatedAt:now
  }
}
export function claimCityOrder(player,orderId,now=Date.now()){
  const state=ensure(player,now);generateOrders(player,state,now);
  const order=state.orders.find(o=>o.id===String(orderId)&&!o.claimed);
  if(!order)throw new Error('Order not found or expired');
  if(order.expiresAt<=now)throw new Error('Order expired');
  const business=player.businesses[order.businessId];if(!business)throw new Error('Business not owned');
  const level=Number(business.level)||1;
  const reward=Math.round(Number(order.reward||0)*(1+(level-1)*0.08));
  player.balance+=reward;
  player.xp+=Number(order.xp)||0;
  player.stats.totalEarned=Number(player.stats.totalEarned||0)+reward;
  player.stats.orderRevenue=Number(player.stats.orderRevenue||0)+reward;
  player.stats.ordersCompleted=Number(player.stats.ordersCompleted||0)+1;
  order.claimed=true;
  state.orders=state.orders.filter(o=>!o.claimed);
  state.districts[BUSINESS_SPECIALIZATIONS[order.businessId]?.district||'center']=Math.min(100,(state.districts[BUSINESS_SPECIALIZATIONS[order.businessId]?.district||'center']||0)+2);
  return {orderId:order.id,reward,xp:Number(order.xp)||0,balance:player.balance};
}
export function consumeVisitOperations(player){const state=ensure(player,Date.now());const out=state.visitOperations.map(v=>({...v}));state.visitOperations=[];return out}

export function cityAnalytics(player,now=Date.now()){
  const live=getCityLive(player,now),st=player.stats||{};
  return {live,visitOperations:live.visitOperations,summary:{
    balance:Number(player.balance||0),xp:Number(player.xp||0),level:Number(player.level||1),
    incomePerHour:Number(live.totalIncomePerHour||0),orders:Number(st.ordersCompleted||0),
    orderRevenue:Number(st.orderRevenue||0),visitRevenue:Number(st.visitRevenue||0),visitsCompleted:Number(st.visitsCompleted||0),totalEarned:Number(st.totalEarned||0),
    businesses:Object.keys(player.businesses||{}).length
  }}
}
