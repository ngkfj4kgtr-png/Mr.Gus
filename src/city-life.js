import { BUSINESS } from './economy.js';

export const BUSINESS_SPECIALIZATIONS=Object.freeze({
  kiosk:{name:'Розничная торговля',demand:'повседневный спрос',district:'commercial'},
  cafe:{name:'Общественное питание',demand:'посетители',district:'center'},
  workshop:{name:'Сервис и ремонт',demand:'заказы на ремонт',district:'residential'},
  factory:{name:'Производство',demand:'оптовые заказы',district:'industrial'}
});

const CLIENTS=['Антон','Марина','Илья','Светлана','Дмитрий','Ольга','Максим','Алина','Сергей','Елена'];
const DISTRICTS=['residential','center','commercial','industrial','outskirts'];
const NPC_TYPES={resident:{name:'Житель',speed:1.0,home:'residential'},student:{name:'Студент',speed:1.25,home:'center'},worker:{name:'Рабочий',speed:.9,home:'industrial'},family:{name:'Семья',speed:.75,home:'residential'},courier:{name:'Курьер',speed:1.45,home:'commercial'}};
const BUSINESS_DEMAND={kiosk:{base:28,preferred:['resident','family','courier']},cafe:{base:34,preferred:['student','resident','family']},workshop:{base:22,preferred:['worker','resident','courier']},factory:{base:18,preferred:['worker','courier']}};
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
  raw.npcTick=Number(raw.npcTick||0);
  return raw
}

function businessDemand(player,businessId,state){
  const b=player.businesses?.[businessId],spec=BUSINESS_DEMAND[businessId];if(!b||!spec)return 0;
  const level=Math.max(1,Number(b.level)||1),district=BUSINESS_SPECIALIZATIONS[businessId]?.district||'center';
  const districtScore=Number(state.districts?.[district]||0);
  return Math.max(4,Math.round(spec.base+level*6+districtScore*.35));
}
function seedNpcState(state,now){
  if(state.npcs.length)return;
  const types=Object.keys(NPC_TYPES);
  for(let i=0;i<18;i++){const type=types[i%types.length],home=NPC_TYPES[type].home;state.npcs.push({id:'npc_'+i,type,phase:'home',home,createdAt:now,cycle:i%4});}
}
function simulateNpcs(player,state,now){
  seedNpcState(state,now);
  const owned=Object.keys(player.businesses||{}), tick=Math.floor(now/15000);
  if(state.npcTick===tick)return;
  state.npcTick=tick;
  const businessPool=owned.map(id=>({id,demand:businessDemand(player,id,state)})).filter(x=>x.demand>0);
  const totalDemand=businessPool.reduce((n,x)=>n+x.demand,0);
  state.npcs.forEach((npc,i)=>{
    const phase=(tick+i*3)%12;
    if(phase<4){npc.phase='home';npc.targetDistrict=npc.home;npc.targetBusiness=null}
    else if(phase<7){npc.phase='travel';const pick=businessPool.length?businessPool[(tick+i)%businessPool.length]:null;npc.targetBusiness=pick?.id||null;npc.targetDistrict=pick?BUSINESS_SPECIALIZATIONS[pick.id]?.district:'center'}
    else if(phase<10){npc.phase='queue';npc.targetDistrict=npc.targetDistrict||'center'}
    else{npc.phase='return';npc.targetBusiness=null;npc.targetDistrict=npc.home}
    npc.progress=((tick+i*7)%20)/20;
  });
  state.queue={};
  for(const npc of state.npcs)if(npc.phase==='queue'&&npc.targetBusiness)state.queue[npc.targetBusiness]=(state.queue[npc.targetBusiness]||0)+1;
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
  simulateNpcs(player,state,now);
  const income=owned.reduce((n,id)=>n+Number(player.businesses[id]?.profitPerHour||0),0);
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
    demand:Object.fromEntries(owned.map(id=>[id,businessDemand(player,id,state)])),
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
export function cityAnalytics(player,now=Date.now()){
  const live=getCityLive(player,now),st=player.stats||{};
  return {live,summary:{
    balance:Number(player.balance||0),xp:Number(player.xp||0),level:Number(player.level||1),
    incomePerHour:Number(live.totalIncomePerHour||0),orders:Number(st.ordersCompleted||0),
    orderRevenue:Number(st.orderRevenue||0),totalEarned:Number(st.totalEarned||0),
    businesses:Object.keys(player.businesses||{}).length
  }}
}
