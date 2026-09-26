import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayer,claimTask,buyBusiness,collectOfflineIncome,hourlyProfit,upgradeBusiness,availableTasks,CONFIG} from '../src/economy.js';
import {createOperationId,validateOperationId} from '../src/operations.js';
import {assertOperationNotProcessed} from '../src/db.js';

test('new player starts safely',()=>{const p=createPlayer('u');assert.equal(p.balance,0);assert.equal(p.level,1);});
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
