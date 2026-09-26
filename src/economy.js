export const CONFIG = Object.freeze({
  startingBalance: 0,
  maxOfflineSeconds: 8 * 60 * 60,
  firstBusinessCost: 1_000,
  firstBusinessGrossPerHour: 180,
  firstBusinessExpensesPerHour: 80,
  maxMoney: Number.MAX_SAFE_INTEGER
});

export const BUSINESS = Object.freeze({
  kiosk: Object.freeze({
    id:'kiosk', name:'Небольшая торговая точка', baseCost:1_000,
    grossPerHour:180, expensesPerHour:80, upgradeMultiplier:1.35, maxLevel:100
  })
});

export const TASKS = Object.freeze({
  first_order:Object.freeze({id:'first_order',title:'Выполнить первый заказ',description:'Сделай первый заказ и получи стартовый капитал.',reward:250,xp:50,unlockAfter:0}),
  second_order:Object.freeze({id:'second_order',title:'Выполнить второй заказ',description:'Продолжай выполнять заказы и увеличивай капитал.',reward:350,xp:75,unlockAfter:1}),
  third_order:Object.freeze({id:'third_order',title:'Выполнить третий заказ',description:'Три заказа — первый серьёзный шаг к бизнесу.',reward:500,xp:100,unlockAfter:2}),
  busy_day:Object.freeze({id:'busy_day',title:'Выполнить 5 заказов',description:'Покажи стабильный результат и получи крупный бонус.',reward:900,xp:200,unlockAfter:3})
});

export function xpForLevel(level) {
  if(!Number.isSafeInteger(level)||level<1) throw new Error('Invalid level');
  if(level===1) return 0;
  return Math.round(500*((level-1)**1.55));
}
export function levelFromXp(xp) {
  if(!Number.isSafeInteger(xp)||xp<0) throw new Error('Invalid XP');
  let level=1; while(level<100&&xp>=xpForLevel(level+1)) level+=1; return level;
}
export function createPlayer(id) {
  if(!id||typeof id!=='string') throw new Error('Invalid player id');
  return {id,balance:0,xp:0,level:1,businesses:{},claimedTasks:new Set(),lastIncomeAt:null,createdAt:new Date().toISOString()};
}
function assertPlayer(player){
  if(!player||typeof player!=='object') throw new Error('Player not found');
  if(!Number.isSafeInteger(player.balance)||player.balance<0||player.balance>CONFIG.maxMoney) throw new Error('Invalid balance');
  if(!Number.isSafeInteger(player.xp)||player.xp<0) throw new Error('Invalid XP');
  if(!Number.isSafeInteger(player.level)||player.level<1) throw new Error('Invalid level');
  if(!(player.claimedTasks instanceof Set)) throw new Error('Invalid claimed tasks');
}
function addBalance(player,amount){
  if(!Number.isSafeInteger(amount)||amount<0) throw new Error('Invalid reward');
  const next=player.balance+amount;
  if(!Number.isSafeInteger(next)||next>CONFIG.maxMoney) throw new Error('Balance overflow');
  player.balance=next;
}
export function availableTasks(player){
  assertPlayer(player); const claimedCount=player.claimedTasks.size;
  return Object.values(TASKS).map(task=>({...task,claimed:player.claimedTasks.has(task.id),locked:!player.claimedTasks.has(task.id)&&claimedCount<task.unlockAfter}));
}
export function claimTask(player,taskId){
  assertPlayer(player); const task=TASKS[taskId];
  if(!task) throw new Error('Task not found');
  if(player.claimedTasks.has(taskId)) throw new Error('Task reward already claimed');
  if(player.claimedTasks.size<task.unlockAfter) throw new Error('Task is locked');
  addBalance(player,task.reward); player.xp+=task.xp; player.level=levelFromXp(player.xp); player.claimedTasks.add(taskId);
  return {reward:task.reward,xp:task.xp,balance:player.balance,level:player.level};
}
export function buyBusiness(player,businessId,now=Date.now()){
  assertPlayer(player); const definition=BUSINESS[businessId];
  if(!definition) throw new Error('Business not found');
  if(player.businesses[businessId]) throw new Error('Business already owned');
  if(!Number.isSafeInteger(now)||now<0) throw new Error('Invalid timestamp');
  if(player.balance<definition.baseCost) throw new Error('Insufficient balance');
  player.balance-=definition.baseCost; player.businesses[businessId]={id:businessId,level:1,purchasedAt:now}; player.lastIncomeAt=now;
  return player.businesses[businessId];
}
export function hourlyProfit(player,businessId){
  assertPlayer(player); const definition=BUSINESS[businessId],owned=player.businesses[businessId];
  if(!definition||!owned) throw new Error('Business not owned');
  if(!Number.isSafeInteger(owned.level)||owned.level<1||owned.level>definition.maxLevel) throw new Error('Invalid business level');
  const scale=definition.upgradeMultiplier**(owned.level-1);
  return Math.max(0,Math.floor(definition.grossPerHour*scale)-Math.floor(definition.expensesPerHour*scale));
}
export function collectOfflineIncome(player,now=Date.now()){
  assertPlayer(player);
  if(!Number.isSafeInteger(now)||now<0) throw new Error('Invalid timestamp');
  if(player.lastIncomeAt===null){player.lastIncomeAt=now;return {seconds:0,income:0,balance:player.balance};}
  if(!Number.isSafeInteger(player.lastIncomeAt)||player.lastIncomeAt<0) throw new Error('Invalid last income timestamp');
  if(now<player.lastIncomeAt) throw new Error('Clock moved backwards');
  const elapsed=Math.min(now-player.lastIncomeAt,CONFIG.maxOfflineSeconds*1000),seconds=Math.floor(elapsed/1000);
  let income=0; for(const id of Object.keys(player.businesses)) income+=Math.floor(hourlyProfit(player,id)*seconds/3600);
  addBalance(player,income); player.lastIncomeAt=now;
  return {seconds,income,balance:player.balance};
}
export function upgradeBusiness(player,businessId,now=Date.now()){
  assertPlayer(player); const definition=BUSINESS[businessId],owned=player.businesses[businessId];
  if(!definition||!owned) throw new Error('Business not owned');
  if(owned.level>=definition.maxLevel) throw new Error('Maximum business level reached');
  if(!Number.isSafeInteger(now)||now<0) throw new Error('Invalid timestamp');
  const cost=Math.max(definition.baseCost,Math.round(definition.baseCost*definition.upgradeMultiplier**owned.level));
  if(player.balance<cost) throw new Error('Insufficient balance');
  player.balance-=cost; owned.level+=1;
  return {level:owned.level,cost,balance:player.balance,profitPerHour:hourlyProfit(player,businessId)};
}
