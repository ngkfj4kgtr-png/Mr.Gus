export const CONFIG = Object.freeze({
  startingBalance: 0,
  maxOfflineSeconds: 8 * 60 * 60,
  firstBusinessCost: 1_000,
  firstBusinessGrossPerHour: 750,
  firstBusinessExpensesPerHour: 250,
  maxMoney: Number.MAX_SAFE_INTEGER
});

export const BUSINESS = Object.freeze({
  kiosk:Object.freeze({id:'kiosk',name:'Торговая точка',description:'Небольшой магазин у дома.',baseCost:1_000,upgradeBaseCost:500,grossPerHour:750,expensesPerHour:250,upgradeMultiplier:1.35,maxLevel:100}),
  cafe:Object.freeze({id:'cafe',name:'Кафе',description:'Больше оборот — больше постоянный доход.',baseCost:5_000,upgradeBaseCost:2_000,grossPerHour:2_700,expensesPerHour:900,upgradeMultiplier:1.32,maxLevel:100}),
  workshop:Object.freeze({id:'workshop',name:'Мастерская',description:'Производство с серьёзной прибылью.',baseCost:25_000,upgradeBaseCost:8_000,grossPerHour:10_000,expensesPerHour:3_000,upgradeMultiplier:1.30,maxLevel:100}),
  factory:Object.freeze({id:'factory',name:'Фабрика',description:'Крупный источник дохода.',baseCost:100_000,upgradeBaseCost:30_000,grossPerHour:32_000,expensesPerHour:7_000,upgradeMultiplier:1.28,maxLevel:100})
});

export const XP_REWARDS = Object.freeze({businessPurchase:100,businessUpgrade:50});
const LEVEL_XP=Object.freeze([
  0,500,1_200,2_100,3_300,4_800,6_600,8_700,11_200,14_200,
  17_700,21_700,26_200,31_200,36_700,42_700,49_200,56_200,63_700,71_700,
  80_200,89_200,98_700,108_700,119_200,130_200,141_700,153_700,166_200,179_200,
  192_700,206_700,221_200,236_200,251_700,267_700,284_200,301_200,318_700,336_700,
  355_200,374_200,393_700,413_700,433_200,452_700,472_200,492_200,512_700,533_700
]);

export const TASKS=Object.freeze({
  first_order:Object.freeze({id:'first_order',title:'Выполнить первый заказ',description:'Сделай первый заказ и получи стартовый капитал.',reward:250,xp:50,unlockAfter:0}),
  second_order:Object.freeze({id:'second_order',title:'Выполнить второй заказ',description:'Продолжай выполнять заказы и увеличивай капитал.',reward:350,xp:75,unlockAfter:1}),
  third_order:Object.freeze({id:'third_order',title:'Выполнить третий заказ',description:'Три заказа — первый серьёзный шаг к бизнесу.',reward:500,xp:100,unlockAfter:2}),
  busy_day:Object.freeze({id:'busy_day',title:'Выполнить 4 задания',description:'Выполни все четыре задания и получи крупный бонус.',reward:900,xp:200,unlockAfter:3}),
  level_10_order:Object.freeze({id:'level_10_order',title:'Заказ на уровне 10',description:'Достигни 10 уровня и выполни особое задание.',reward:2_500,xp:450,unlockLevel:10}),
  level_20_order:Object.freeze({id:'level_20_order',title:'Большой контракт',description:'Достигни 20 уровня и выполни особое задание.',reward:6_000,xp:900,unlockLevel:20}),
  level_30_order:Object.freeze({id:'level_30_order',title:'Крупный клиент',description:'Достигни 30 уровня и выполни особое задание.',reward:15_000,xp:1_500,unlockLevel:30}),
  level_50_order:Object.freeze({id:'level_50_order',title:'Легендарный заказ',description:'Достигни 50 уровня и выполни особое задание.',reward:50_000,xp:3_000,unlockLevel:50})
});

export const ACHIEVEMENTS=Object.freeze({
  first_business:Object.freeze({id:'first_business',title:'Первый бизнес',description:'Открой первый бизнес.',reward:300,xp:100}),
  business_owner:Object.freeze({id:'business_owner',title:'Предприниматель',description:'Владей двумя разными бизнесами.',reward:1_000,xp:200}),
  business_tycoon:Object.freeze({id:'business_tycoon',title:'Империя',description:'Владей четырьмя разными бизнесами.',reward:5_000,xp:500}),
  level_five:Object.freeze({id:'level_five',title:'Пятый уровень',description:'Достигни 5 уровня игрока.',reward:2_000,xp:300}),
  millionaire:Object.freeze({id:'millionaire',title:'Крупный капитал',description:'Получи 1 000 000 ₽ суммарного дохода за всё время.',reward:10_000,xp:1_000}),
  level_ten:Object.freeze({id:'level_ten',title:'Десятый уровень',description:'Достигни 10 уровня.',reward:3_000,xp:500}),
  level_twentyfive:Object.freeze({id:'level_twentyfive',title:'Опытный предприниматель',description:'Достигни 25 уровня.',reward:10_000,xp:1_200}),
  level_fifty:Object.freeze({id:'level_fifty',title:'Легенда Mr.Gus',description:'Достигни 50 уровня.',reward:50_000,xp:3_000}),
  upgrade_ten:Object.freeze({id:'upgrade_ten',title:'Мастер развития',description:'Сделай 10 улучшений бизнеса.',reward:5_000,xp:700}),
  task_master:Object.freeze({id:'task_master',title:'Серия заданий',description:'Выполни 8 разных заданий.',reward:7_500,xp:900})
});

export const GOALS=Object.freeze({
  start_business:Object.freeze({id:'start_business',title:'Старт бизнеса',description:'Открой первый бизнес.',reward:500,xp:150}),
  upgrade_three:Object.freeze({id:'upgrade_three',title:'Развитие',description:'Сделай 3 улучшения бизнеса.',reward:2_000,xp:300}),
  earn_10k:Object.freeze({id:'earn_10k',title:'Первые 10 тысяч',description:'Получи 10 000 ₽ дохода от бизнеса.',reward:1_500,xp:250}),
  reach_level_5:Object.freeze({id:'reach_level_5',title:'Новая высота',description:'Достигни 5 уровня.',reward:3_000,xp:400}),
  reach_level_25:Object.freeze({id:'reach_level_25',title:'Большая цель',description:'Достигни 25 уровня.',reward:12_000,xp:1_500}),
  reach_level_50:Object.freeze({id:'reach_level_50',title:'Путь легенды',description:'Достигни 50 уровня.',reward:50_000,xp:4_000}),
  upgrade_ten:Object.freeze({id:'upgrade_ten',title:'Десять улучшений',description:'Сделай 10 улучшений бизнеса.',reward:7_500,xp:900})
});

export const EVENTS=Object.freeze([
  Object.freeze({id:'trade_rush',title:'🔥 Торговый ажиотаж',description:'Сегодня доход бизнеса повышен на 20%.',incomeMultiplier:1.20,reward:500,xp:100}),
  Object.freeze({id:'gus_bonus',title:'🪿 Бонус Mr.Gus',description:'Сегодня за активность начисляется дополнительный бонус.',incomeMultiplier:1,reward:750,xp:150}),
  Object.freeze({id:'smart_saving',title:'💼 День экономии',description:'Сегодня доход бизнеса повышен на 10%.',incomeMultiplier:1.10,reward:600,xp:120})
]);

export function xpForLevel(level){
  if(!Number.isSafeInteger(level)||level<1)throw new Error('Invalid level');
  if(level<=LEVEL_XP.length)return LEVEL_XP[level-1];
  const last=LEVEL_XP.at(-1),previous=LEVEL_XP.at(-2),increment=last-previous,extra=level-LEVEL_XP.length;
  return last+extra*(increment+200*(extra+1)/2);
}
export function levelFromXp(xp){
  if(!Number.isSafeInteger(xp)||xp<0)throw new Error('Invalid XP');
  let level=1;while(level<100&&xp>=xpForLevel(level+1))level+=1;return level;
}
export function createPlayer(id){
  if(!id||typeof id!=='string')throw new Error('Invalid player id');
  return {id,balance:0,xp:0,level:1,businesses:{},claimedTasks:new Set(),claimedAchievements:new Set(),claimedGoals:new Set(),eventClaims:{},stats:{tasksCompleted:0,businessesOwned:0,businessUpgrades:0,totalIncome:0,totalEarned:0},lastIncomeAt:null,createdAt:new Date().toISOString()};
}
function assertPlayer(player){
  if(!player||typeof player!=='object')throw new Error('Player not found');
  if(!Number.isSafeInteger(player.balance)||player.balance<0||player.balance>CONFIG.maxMoney)throw new Error('Invalid balance');
  if(!Number.isSafeInteger(player.xp)||player.xp<0)throw new Error('Invalid XP');
  if(!Number.isSafeInteger(player.level)||player.level<1)throw new Error('Invalid level');
  if(player.level!==levelFromXp(player.xp))throw new Error('Level does not match XP');
  if(!player.businesses||typeof player.businesses!=='object'||Array.isArray(player.businesses))throw new Error('Invalid businesses');
  for(const [id,business] of Object.entries(player.businesses)){
    const definition=BUSINESS[id];
    if(!definition||!business||typeof business!=='object'||Array.isArray(business))throw new Error('Invalid business');
    if(business.id!==id||!Number.isSafeInteger(business.level)||business.level<1||business.level>definition.maxLevel)throw new Error('Invalid business');
    if(!Number.isSafeInteger(business.purchasedAt)||business.purchasedAt<0)throw new Error('Invalid business timestamp');
  }
  if(!(player.claimedTasks instanceof Set)||!(player.claimedAchievements instanceof Set)||!(player.claimedGoals instanceof Set))throw new Error('Invalid progression state');
  const validTaskIds=new Set(Object.keys(TASKS));
  const validAchievementIds=new Set(Object.keys(ACHIEVEMENTS));
  const validGoalIds=new Set(Object.keys(GOALS));
  for(const id of player.claimedTasks)if(!validTaskIds.has(id))throw new Error('Invalid claimed task');
  for(const id of player.claimedAchievements)if(!validAchievementIds.has(id))throw new Error('Invalid claimed achievement');
  for(const id of player.claimedGoals)if(!validGoalIds.has(id))throw new Error('Invalid claimed goal');
  if(!player.eventClaims||typeof player.eventClaims!=='object'||Array.isArray(player.eventClaims))throw new Error('Invalid event claims');
  for(const [dateKey,claimed] of Object.entries(player.eventClaims)){
    const parts=dateKey.split('-');
    const year=Number(parts[0]),month=Number(parts[1]),day=Number(parts[2]);
    const daysInMonth=month>=1&&month<=12?new Date(Date.UTC(year,month,0)).getUTCDate():0;
    if(parts.length!==3||parts.some(part=>!/^\d+$/.test(part))||parts[0].length!==4||parts[1].length!==2||parts[2].length!==2||year<1970||month<1||month>12||day<1||day>daysInMonth||claimed!==true)throw new Error('Invalid event claim');
  }
  if(player.lastIncomeAt!==null&&(!Number.isSafeInteger(player.lastIncomeAt)||player.lastIncomeAt<0))throw new Error('Invalid last income timestamp');
  if(!player.stats||typeof player.stats!=='object')throw new Error('Invalid stats');
  for(const key of ['tasksCompleted','businessesOwned','businessUpgrades','totalIncome','totalEarned']){
    if(!Number.isSafeInteger(player.stats[key])||player.stats[key]<0)throw new Error(`Invalid stat: ${key}`);
  }
  if(player.stats.businessesOwned!==Object.keys(player.businesses).length)throw new Error('Invalid businesses owned stat');
}
export function assertMoneyAmount(amount,label='Money'){
  if(!Number.isSafeInteger(amount)||amount<0)throw new Error(`${label} must be a non-negative safe integer`);
  return amount;
}
function addBalance(player,amount,earned=true){
  assertMoneyAmount(amount,'Reward');const next=player.balance+amount;
  if(!Number.isSafeInteger(next)||next>CONFIG.maxMoney)throw new Error('Balance overflow');
  player.balance=next;if(earned)player.stats.totalEarned=assertMoneyAmount((player.stats.totalEarned||0)+amount,'Total earned');
}
function addXp(player,xp){player.xp=assertMoneyAmount(player.xp+xp,'XP');player.level=levelFromXp(player.xp)}
export function availableTasks(player){
  assertPlayer(player);const count=player.claimedTasks.size;
  return Object.values(TASKS).map(task=>({...task,claimed:player.claimedTasks.has(task.id),locked:!player.claimedTasks.has(task.id)&&(task.unlockLevel?player.level<task.unlockLevel:count<task.unlockAfter)}));
}
export function claimTask(player,taskId){
  assertPlayer(player);const task=TASKS[taskId];
  if(!task)throw new Error('Task not found');if(player.claimedTasks.has(taskId))throw new Error('Task reward already claimed');
  if(task.unlockLevel?player.level<task.unlockLevel:player.claimedTasks.size<task.unlockAfter)throw new Error('Task is locked');
  addBalance(player,task.reward);addXp(player,task.xp);player.claimedTasks.add(taskId);player.stats.tasksCompleted+=1;
  return {reward:task.reward,xp:task.xp,balance:player.balance,level:player.level};
}
function progressionUnlocked(player,kind,id){
  const a=player.stats;
  if(kind==='achievement'){
    if(id==='first_business')return Object.keys(player.businesses).length>=1;
    if(id==='business_owner')return Object.keys(player.businesses).length>=2;
    if(id==='business_tycoon')return Object.keys(player.businesses).length>=4;
    if(id==='level_five')return player.level>=5;
    if(id==='millionaire')return (player.stats.totalEarned||0)>=1_000_000;
    if(id==='level_ten')return player.level>=10;
    if(id==='level_twentyfive')return player.level>=25;
    if(id==='level_fifty')return player.level>=50;
    if(id==='upgrade_ten')return a.businessUpgrades>=10;
    if(id==='task_master')return a.tasksCompleted>=8;
  }
  if(kind==='goal'){
    if(id==='start_business')return Object.keys(player.businesses).length>=1;
    if(id==='upgrade_three')return a.businessUpgrades>=3;
    if(id==='earn_10k')return a.totalIncome>=10_000;
    if(id==='reach_level_5')return player.level>=5;
    if(id==='reach_level_25')return player.level>=25;
    if(id==='reach_level_50')return player.level>=50;
    if(id==='upgrade_ten')return a.businessUpgrades>=10;
  }
  return false;
}
export function availableAchievements(player){
  assertPlayer(player);return Object.values(ACHIEVEMENTS).map(x=>({...x,claimed:player.claimedAchievements.has(x.id),unlocked:progressionUnlocked(player,'achievement',x.id)}));
}
export function availableGoals(player){
  assertPlayer(player);return Object.values(GOALS).map(x=>({...x,claimed:player.claimedGoals.has(x.id),unlocked:progressionUnlocked(player,'goal',x.id)}));
}
export function claimAchievement(player,id){
  assertPlayer(player);const x=ACHIEVEMENTS[id];if(!x)throw new Error('Achievement not found');
  if(player.claimedAchievements.has(id))throw new Error('Achievement reward already claimed');
  if(!progressionUnlocked(player,'achievement',id))throw new Error('Achievement is locked');
  addBalance(player,x.reward);addXp(player,x.xp);player.claimedAchievements.add(id);return {reward:x.reward,xp:x.xp,level:player.level};
}
export function claimGoal(player,id){
  assertPlayer(player);const x=GOALS[id];if(!x)throw new Error('Goal not found');
  if(player.claimedGoals.has(id))throw new Error('Goal reward already claimed');
  if(!progressionUnlocked(player,'goal',id))throw new Error('Goal is locked');
  addBalance(player,x.reward);addXp(player,x.xp);player.claimedGoals.add(id);return {reward:x.reward,xp:x.xp,level:player.level};
}
function eventForDate(dateKey){
  let n=0;for(const c of dateKey)n=(n+c.charCodeAt(0))%EVENTS.length;return EVENTS[n];
}
export function currentEvent(now=Date.now()){
  if(!Number.isSafeInteger(now)||now<0)throw new Error('Invalid timestamp');
  const d=new Date(now),dateKey=d.toISOString().slice(0,10),event=eventForDate(dateKey);
  return {...event,dateKey};
}
export function claimEvent(player,now=Date.now()){
  assertPlayer(player);const event=currentEvent(now),key=event.dateKey;
  if(player.eventClaims[key])throw new Error('Event reward already claimed');
  addBalance(player,event.reward);addXp(player,event.xp);player.eventClaims[key]=true;
  return {eventId:event.id,dateKey:key,reward:event.reward,xp:event.xp,level:player.level};
}
export function businessUnlockLevel(businessId){
  return {kiosk:1,cafe:2,workshop:3,factory:5}[businessId]??99;
}
export function canBuyBusiness(player,businessId){
  const d=BUSINESS[businessId];if(!d)throw new Error('Business not found');
  if(player.level<businessUnlockLevel(businessId))return false;return true;
}
export function buyBusiness(player,businessId,now=Date.now()){
  assertPlayer(player);const definition=BUSINESS[businessId];
  if(!definition)throw new Error('Business not found');if(player.businesses[businessId])throw new Error('Business already owned');
  if(!canBuyBusiness(player,businessId))throw new Error('Business is locked');if(!Number.isSafeInteger(now)||now<0)throw new Error('Invalid timestamp');
  if(player.balance<definition.baseCost)throw new Error('Insufficient balance');
  player.balance-=definition.baseCost;player.businesses[businessId]={id:businessId,level:1,purchasedAt:now};addXp(player,XP_REWARDS.businessPurchase);player.lastIncomeAt=now;player.stats.businessesOwned=Object.keys(player.businesses).length;
  return player.businesses[businessId];
}
export function hourlyProfit(player,businessId){
  assertPlayer(player);const d=BUSINESS[businessId],owned=player.businesses[businessId];
  if(!d||!owned)throw new Error('Business not owned');if(!Number.isSafeInteger(owned.level)||owned.level<1||owned.level>d.maxLevel)throw new Error('Invalid business level');
  const scale=d.upgradeMultiplier**(owned.level-1);return Math.max(0,Math.floor(d.grossPerHour*scale)-Math.floor(d.expensesPerHour*scale));
}
export function collectOfflineIncome(player,now=Date.now(),incomeMultiplier=1){
  assertPlayer(player);if(!Number.isSafeInteger(now)||now<0)throw new Error('Invalid timestamp');if(typeof incomeMultiplier!=='number'||!Number.isFinite(incomeMultiplier)||incomeMultiplier<0||incomeMultiplier>10)throw new Error('Invalid income multiplier');
  if(player.lastIncomeAt===null){player.lastIncomeAt=now;return {seconds:0,income:0,balance:player.balance};}
  if(!Number.isSafeInteger(player.lastIncomeAt)||player.lastIncomeAt<0)throw new Error('Invalid last income timestamp');
  if(now<player.lastIncomeAt)throw new Error('Clock moved backwards');
  const elapsed=Math.min(now-player.lastIncomeAt,CONFIG.maxOfflineSeconds*1000),seconds=Math.floor(elapsed/1000);
  let income=0;for(const id of Object.keys(player.businesses))income+=Math.floor(hourlyProfit(player,id)*seconds/3600*incomeMultiplier);
  addBalance(player,income);player.lastIncomeAt=now;player.stats.totalIncome=assertMoneyAmount((player.stats.totalIncome||0)+income,'Total income');assertPlayer(player);
  return {seconds,income,balance:player.balance};
}
export function upgradeBusiness(player,businessId,now=Date.now()){
  assertPlayer(player);const d=BUSINESS[businessId],owned=player.businesses[businessId];
  if(!d||!owned)throw new Error('Business not owned');if(owned.level>=d.maxLevel)throw new Error('Maximum business level reached');if(!Number.isSafeInteger(now)||now<0)throw new Error('Invalid timestamp');
  const cost=Math.max(d.upgradeBaseCost,Math.round(d.upgradeBaseCost*d.upgradeMultiplier**(owned.level-1)));
  if(player.balance<cost)throw new Error('Insufficient balance');
  player.balance-=cost;owned.level+=1;addXp(player,XP_REWARDS.businessUpgrade);player.stats.businessUpgrades+=1;return {level:owned.level,cost,balance:player.balance,profitPerHour:hourlyProfit(player,businessId)};
}
