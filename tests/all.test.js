import test from 'node:test';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {createPlayer,claimTask,buyBusiness,collectOfflineIncome,hourlyProfit,upgradeBusiness,availableTasks,CONFIG,assertMoneyAmount,xpForLevel,levelFromXp} from '../src/economy.js';
import {createOperationId,validateOperationId} from '../src/operations.js';
import {assertOperationNotProcessed} from '../src/db.js';
import {validateTelegramInitData} from '../src/telegram-auth.js';

test('new player starts safely',()=>{const p=createPlayer('u');assert.equal(p.balance,0);assert.equal(p.level,1);});
test('XP level thresholds match the economy design',()=>{
  assert.equal(xpForLevel(1),0);
  assert.equal(xpForLevel(2),500);
  assert.equal(xpForLevel(3),1200);
  assert.equal(xpForLevel(4),2100);
  assert.equal(xpForLevel(5),3300);
  assert.equal(levelFromXp(499),1);
  assert.equal(levelFromXp(500),2);
  assert.equal(levelFromXp(1199),2);
  assert.equal(levelFromXp(1200),3);
  assert.equal(levelFromXp(2099),3);
  assert.equal(levelFromXp(2100),4);
  assert.equal(levelFromXp(3299),4);
  assert.equal(levelFromXp(3300),5);
});

test('money and XP remain separate',()=>{
  const p=createPlayer('u');
  claimTask(p,'first_order');
  assert.equal(p.balance,250);
  assert.equal(p.xp,50);
  assert.equal(p.level,1);
});

test('business development awards XP without adding money',()=>{
  const p=createPlayer('u');
  p.balance=1000;
  buyBusiness(p,'kiosk',1000);
  assert.equal(p.balance,0);
  assert.equal(p.xp,100);
  assert.equal(p.level,1);
});

test('business upgrade awards XP without adding money',()=>{
  const p=createPlayer('u');
  p.balance=10000;
  buyBusiness(p,'kiosk',1000);
  const before=p.balance;
  upgradeBusiness(p,'kiosk',2000);
  assert.equal(p.balance,before-1350);
  assert.equal(p.xp,150);
  assert.equal(p.level,1);
});

test('task chain cannot be skipped',()=>{const p=createPlayer('u');assert.equal(availableTasks(p)[1].locked,true);claimTask(p,'first_order');assert.equal(p.balance,250);assert.throws(()=>claimTask(p,'third_order'),/locked/);});
test('task reward cannot be claimed twice',()=>{const p=createPlayer('u');claimTask(p,'first_order');assert.throws(()=>claimTask(p,'first_order'),/already claimed/);assert.equal(p.balance,250);});
test('business profit is server-side',()=>{const p=createPlayer('u');p.balance=1000;buyBusiness(p,'kiosk',1000);assert.equal(hourlyProfit(p,'kiosk'),100);});
test('offline income is capped at eight hours',()=>{const p=createPlayer('u');p.balance=1000;buyBusiness(p,'kiosk',1000);const r=collectOfflineIncome(p,1000+24*3600*1000);assert.equal(r.seconds,CONFIG.maxOfflineSeconds);assert.equal(r.income,800);});
test('same collection timestamp pays zero twice',()=>{const p=createPlayer('u');p.balance=1000;buyBusiness(p,'kiosk',1000);const t=1000+2*3600*1000;assert.equal(collectOfflineIncome(p,t).income,200);assert.equal(collectOfflineIncome(p,t).income,0);});
test('clock rollback is rejected',()=>{const p=createPlayer('u');p.balance=1000;buyBusiness(p,'kiosk',5000);assert.throws(()=>collectOfflineIncome(p,4999),/Clock moved backwards/);});
test('upgrade changes profit',()=>{const p=createPlayer('u');p.balance=1000;buyBusiness(p,'kiosk',1000);p.balance=100000;upgradeBusiness(p,'kiosk',2000);assert.equal(hourlyProfit(p,'kiosk'),135);});
test('operation IDs are validated',()=>{const id=createOperationId('income');assert.match(id,/^income_/);validateOperationId(id);assert.throws(()=>validateOperationId('bad id'),/Invalid operation ID/);});

test('upgrade must not retroactively reprice already elapsed income',()=>{
  const p=createPlayer('u');p.balance=10000;buyBusiness(p,'kiosk',1000);
  const before=1000+3600*1000;
  assert.equal(collectOfflineIncome(p,before).income,100);
  p.balance+=10000;
  const oldProfit=hourlyProfit(p,'kiosk');
  upgradeBusiness(p,'kiosk',before+1000);
  assert.notEqual(hourlyProfit(p,'kiosk'),oldProfit);
});
test('buying another business must preserve accrued income of existing businesses at purchase time',()=>{
  const p=createPlayer('u');p.balance=10000;buyBusiness(p,'kiosk',1000);
  const t=1000+2*3600*1000;
  const accrued=collectOfflineIncome(p,t).income;
  assert.equal(accrued,200);
  assert.equal(p.lastIncomeAt,t);
});


test('stage 5: duplicate operation is rejected before mutation',async()=>{
  const client={query:async(sql,args)=>({rowCount:sql.includes('SELECT')?1:0,rows:sql.includes('SELECT')?[{operation_id:args[1],operation_type:'task_reward',reward_amount:250,created_at:new Date()}]:[]})};
  await assert.rejects(()=>assertOperationNotProcessed(client,{operationId:'task_retry_123',userId:42}),/Operation already processed/);
});

test('stage 5: new operation passes precheck',async()=>{
  const client={query:async()=>({rowCount:0,rows:[]})};
  await assert.doesNotReject(()=>assertOperationNotProcessed(client,{operationId:'task_new_123',userId:42}));
});


test('stage 7: insufficient purchase cannot make balance negative',()=>{
  const p=createPlayer('u');p.balance=999;
  assert.throws(()=>buyBusiness(p,'kiosk',1000),/Insufficient balance/);
  assert.equal(p.balance,999);
});

test('stage 7: insufficient upgrade cannot make balance negative',()=>{
  const p=createPlayer('u');p.balance=1000;buyBusiness(p,'kiosk',1000);
  assert.throws(()=>upgradeBusiness(p,'kiosk',2000),/Insufficient balance/);
  assert.equal(p.balance,0);
});

test('stage 8: money must be an integer safe amount',()=>{
  assertMoneyAmount(1000);
  assert.throws(()=>assertMoneyAmount(999.99),/safe integer/);
  assert.throws(()=>assertMoneyAmount(Number.MAX_SAFE_INTEGER+1),/safe integer/);
  assert.throws(()=>assertMoneyAmount(Infinity),/safe integer/);
  assert.throws(()=>assertMoneyAmount(NaN),/safe integer/);
});

test('stage 8: balance overflow is rejected without changing balance',()=>{
  const p=createPlayer('u');p.balance=Number.MAX_SAFE_INTEGER;
  assert.throws(()=>claimTask(p,'first_order'),/Balance overflow/);
  assert.equal(p.balance,Number.MAX_SAFE_INTEGER);
});

test('stage 8: fractional balance is rejected by player invariant',()=>{
  const p=createPlayer('u');p.balance=100.5;
  assert.throws(()=>hourlyProfit(p,'kiosk'),/Invalid balance/);
});


test('Telegram initData accepts a valid signed payload',()=>{
  const botToken='123456:TEST_TOKEN';
  const authDate=1700000000;
  const params=new URLSearchParams();
  params.set('auth_date',String(authDate));
  params.set('query_id','AA123');
  params.set('user',JSON.stringify({id:123456789,first_name:'Test',username:'tester'}));
  const dataCheckString=[...params.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>`${key}=${value}`).join('\n');
  const secretKey=createHmac('sha256','WebAppData').update(botToken).digest();
  const hash=createHmac('sha256',secretKey).update(dataCheckString).digest('hex');
  params.set('hash',hash);
  const result=validateTelegramInitData(params.toString(),botToken,{now:authDate});
  assert.equal(result.user.id,123456789);
});

test('Telegram initData rejects a tampered payload',()=>{
  const botToken='123456:TEST_TOKEN';
  const authDate=1700000000;
  const params=new URLSearchParams({auth_date:String(authDate),user:JSON.stringify({id:1,first_name:'Test'})});
  const dataCheckString=[...params.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>`${key}=${value}`).join('\\n');
  const secretKey=createHmac('sha256','WebAppData').update(botToken).digest();
  params.set('hash',createHmac('sha256',secretKey).update(dataCheckString).digest('hex'));
  params.set('user',JSON.stringify({id:2,first_name:'Tampered'}));
  assert.throws(()=>validateTelegramInitData(params.toString(),botToken,{now:authDate}),/Invalid Telegram signature/);
});


test('Telegram initData rejects expired authentication data',()=>{
  const botToken='123456:TEST_TOKEN';
  const authDate=1700000000;
  const params=new URLSearchParams({auth_date:String(authDate),user:JSON.stringify({id:1,first_name:'Test'})});
  const dataCheckString=[...params.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>`${key}=${value}`).join('\\n');
  const secretKey=createHmac('sha256','WebAppData').update(botToken).digest();
  params.set('hash',createHmac('sha256',secretKey).update(dataCheckString).digest('hex'));
  assert.throws(()=>validateTelegramInitData(params.toString(),botToken,{now:authDate+86401}),/expired/);
});

test('Telegram initData rejects future authentication data',()=>{
  const botToken='123456:TEST_TOKEN';
  const authDate=1700000061;
  const params=new URLSearchParams({auth_date:String(authDate),user:JSON.stringify({id:1,first_name:'Test'})});
  const dataCheckString=[...params.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>`${key}=${value}`).join('\\n');
  const secretKey=createHmac('sha256','WebAppData').update(botToken).digest();
  params.set('hash',createHmac('sha256',secretKey).update(dataCheckString).digest('hex'));
  assert.throws(()=>validateTelegramInitData(params.toString(),botToken,{now:authDate-61}),/future/);
});
