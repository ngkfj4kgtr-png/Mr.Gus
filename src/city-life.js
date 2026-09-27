import { BUSINESS } from './economy.js';

export const BUSINESS_SPECIALIZATIONS=Object.freeze({
  kiosk:{name:'Розничная торговля',demand:'повседневный спрос',district:'commercial'},
  cafe:{name:'Общественное питание',demand:'посетители',district:'center'},
  workshop:{name:'Сервис и ремонт',demand:'заказы на ремонт',district:'residential'},
  factory:{name:'Производство',demand:'оптовые заказы',district:'industrial'}
});

const CLIENTS=['Антон','Марина','Илья','Светлана','Дмитрий','Ольга','Максим','Алина','Сергей','Елена'];
const DISTRICTS=['residential','center','commercial','industrial','outskirts'];

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
  return raw
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
